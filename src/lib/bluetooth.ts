import { registerPlugin } from "@capacitor/core";
import { supabase, authFetch } from "./supabase";

/**
 * Yuto Bluetooth P2P — Real BLE advertising + scanning + offline transfers.
 * 
 * Architecture:
 * 1. Each device advertises as "YUTO_<8chars>" via native BLE peripheral
 * 2. Scanning finds nearby Yuto users by service UUID filter
 * 3. Tap to send → transaction payload sent via BLE GATT write
 * 4. Receiver stores it locally → syncs to Supabase when online
 * 5. If sender is online, settles immediately via RPC
 */

// Native plugin interface
interface YutoBlePlugin {
  startAdvertising(options: { userId: string }): Promise<{ success: boolean }>;
  stopAdvertising(): Promise<{ success: boolean }>;
  startScanning(): Promise<{ success: boolean }>;
  stopScanning(): Promise<{ success: boolean }>;
  sendTransaction(options: { deviceAddress: string; payload: string }): Promise<{ success: boolean }>;
  getPendingTransaction(): Promise<{ payload: string | null }>;
  addListener(event: "deviceDiscovered", handler: (data: { shortId: string; deviceAddress: string; rssi: number; deviceName: string }) => void): any;
  addListener(event: "transactionReceived", handler: (data: { payload: string }) => void): any;
}

const YutoBle = registerPlugin<YutoBlePlugin>("YutoBle");

export interface NearbyYutoUser {
  userId: string;
  shortId: string;
  name: string;
  avatarUrl: string | null;
  deviceAddress: string;
  rssi: number;
}

export interface OfflineTransaction {
  id: string;
  senderId: string;
  recipientId: string;
  amount: number;
  timestamp: number;
  synced: boolean;
  cancelled?: boolean;
  hmac?: string;
}

const OFFLINE_TX_KEY = "yuto_offline_transactions";
const CACHED_BALANCE_KEY = "yuto_cached_balance";
const CACHED_USER_KEY = "yuto_cached_user";
const CACHED_PROFILES_KEY = "yuto_cached_profiles";

// ── Persistent Storage (native SharedPreferences — survives app kill) ──────
import { Preferences } from "@capacitor/preferences";

async function persistSet(key: string, value: string) {
  await Preferences.set({ key, value });
}

async function persistGet(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key });
  return value;
}

// Synchronous fallback for immediate reads (uses in-memory cache)
const memCache = new Map<string, string>();

function persistSetSync(key: string, value: string) {
  memCache.set(key, value);
  // Fire and forget the async write
  Preferences.set({ key, value }).catch(() => {});
}

function persistGetSync(key: string): string | null {
  return memCache.get(key) || null;
}

// Load all cached values into memory on module init
async function loadCacheIntoMemory() {
  const keys = [CACHED_BALANCE_KEY, CACHED_USER_KEY, OFFLINE_TX_KEY, CACHED_PROFILES_KEY];
  for (const key of keys) {
    const { value } = await Preferences.get({ key });
    if (value) memCache.set(key, value);
  }
}
// Auto-load on import
loadCacheIntoMemory().catch(() => {});

// ── Local Balance Cache ─────────────────────────────────────

/**
 * Cache the user's balance and identity locally (native storage).
 * Always caches the value — the caller is responsible for only calling this with valid data.
 */
export function cacheBalanceLocally(userId: string, balance: number, displayName: string) {
  const balData = JSON.stringify({ userId, balance, updatedAt: Date.now() });
  const userData = JSON.stringify({ userId, displayName });
  persistSetSync(CACHED_BALANCE_KEY, balData);
  persistSetSync(CACHED_USER_KEY, userData);
}

/**
 * Get the locally cached balance.
 */
export function getCachedBalance(): { userId: string; balance: number; updatedAt: number } | null {
  try {
    const raw = persistGetSync(CACHED_BALANCE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Deduct from local cached balance (optimistic offline spend).
 */
export function deductCachedBalance(amount: number): boolean {
  const cached = getCachedBalance();
  if (!cached || cached.balance < amount) return false;
  cached.balance -= amount;
  cached.updatedAt = Date.now();
  persistSetSync(CACHED_BALANCE_KEY, JSON.stringify(cached));
  return true;
}

/**
 * Get cached user identity
 */
export function getCachedUser(): { userId: string; displayName: string } | null {
  try {
    const raw = persistGetSync(CACHED_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Cache a discovered profile for offline name resolution
 */
export function cacheProfile(shortId: string, userId: string, name: string) {
  try {
    const raw = persistGetSync(CACHED_PROFILES_KEY);
    const profiles: Record<string, { userId: string; name: string }> = raw ? JSON.parse(raw) : {};
    profiles[shortId] = { userId, name };
    persistSetSync(CACHED_PROFILES_KEY, JSON.stringify(profiles));
  } catch {}
}

/**
 * Get a cached profile by shortId (for offline name display)
 */
export function getCachedProfile(shortId: string): { userId: string; name: string } | null {
  try {
    const raw = persistGetSync(CACHED_PROFILES_KEY);
    if (!raw) return null;
    const profiles = JSON.parse(raw);
    return profiles[shortId] || null;
  } catch { return null; }
}

// ── Security: Payload Validation ────────────────────────────

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_AMOUNT_KES = 1;
const MAX_AMOUNT_KES = 50_000;
const MAX_TIMESTAMP_DRIFT_MS = 60 * 60 * 1000; // 1 hour

interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: OfflineTransaction;
}

export function validateBlePayload(payload: unknown, nowMs?: number): ValidationResult {
  const now = nowMs ?? Date.now();

  if (typeof payload !== "object" || payload === null) {
    return { valid: false, error: "payload_not_object" };
  }

  const p = payload as Record<string, unknown>;
  const requiredFields = ["id", "senderId", "recipientId", "amount", "timestamp"];
  for (const field of requiredFields) {
    if (!(field in p) || p[field] === undefined || p[field] === null) {
      return { valid: false, error: `missing_field:${field}` };
    }
  }

  if (typeof p.id !== "string" || !UUID_V4_REGEX.test(p.id)) {
    return { valid: false, error: "invalid_id_format" };
  }
  if (typeof p.senderId !== "string" || !UUID_V4_REGEX.test(p.senderId)) {
    return { valid: false, error: "invalid_sender_id_format" };
  }
  if (typeof p.recipientId !== "string" || !UUID_V4_REGEX.test(p.recipientId)) {
    return { valid: false, error: "invalid_recipient_id_format" };
  }
  if (p.senderId === p.recipientId) {
    return { valid: false, error: "sender_equals_recipient" };
  }
  if (typeof p.amount !== "number" || isNaN(p.amount)) {
    return { valid: false, error: "invalid_amount_type" };
  }
  const roundedAmount = Math.round(p.amount as number);
  if (roundedAmount < MIN_AMOUNT_KES || roundedAmount > MAX_AMOUNT_KES) {
    return { valid: false, error: "amount_out_of_bounds" };
  }
  if (typeof p.timestamp !== "number" || !Number.isInteger(p.timestamp) || p.timestamp <= 0) {
    return { valid: false, error: "invalid_timestamp" };
  }
  const drift = now - (p.timestamp as number);
  if (drift > MAX_TIMESTAMP_DRIFT_MS) {
    return { valid: false, error: `timestamp_too_old:${drift}ms` };
  }
  if (drift < -MAX_TIMESTAMP_DRIFT_MS) {
    return { valid: false, error: `timestamp_in_future:${Math.abs(drift)}ms` };
  }

  return {
    valid: true,
    sanitized: {
      id: (p.id as string).slice(0, 36),
      senderId: (p.senderId as string).slice(0, 36),
      recipientId: (p.recipientId as string).slice(0, 36),
      amount: roundedAmount,
      timestamp: p.timestamp as number,
      synced: false,
    },
  };
}

// ── Security: HMAC Signing (Web Crypto API) ─────────────────

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export async function deriveSigningSecret(accessToken: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(accessToken);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return bufToHex(hashBuf).slice(0, 32);
}

export async function signBlePayload(
  payload: { id: string; senderId: string; recipientId: string; amount: number; timestamp: number },
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const canonical = `${payload.id}|${payload.senderId}|${payload.recipientId}|${payload.amount}|${payload.timestamp}`;
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(canonical));
  return bufToBase64(sig);
}

// ── Security: Offline Transaction Cancellation ──────────────

/**
 * Cancel a pending offline transaction before it syncs.
 * Restores the deducted amount to the local cached balance.
 */
export function cancelOfflineTransaction(txId: string): boolean {
  const transactions = getOfflineTransactions();
  const tx = transactions.find((t) => t.id === txId);
  if (!tx) return false;
  if (tx.synced) return false;
  if (tx.cancelled) return true;

  tx.cancelled = true;

  // Restore cached balance
  const cached = getCachedBalance();
  if (cached) {
    cached.balance += tx.amount;
    cached.updatedAt = Date.now();
    persistSetSync(CACHED_BALANCE_KEY, JSON.stringify(cached));
  }

  persistSetSync(OFFLINE_TX_KEY, JSON.stringify(transactions));
  return true;
}

// ── Public API ──────────────────────────────────────────────

/**
 * Initialize BLE: start advertising + scanning
 */
export async function initBluetooth(userId: string): Promise<boolean> {
  try {
    await YutoBle.startAdvertising({ userId });
    await YutoBle.startScanning();

    // Listen for incoming transactions (we're the receiver)
    YutoBle.addListener("transactionReceived", (data) => {
      handleIncomingTransaction(data.payload);
    });

    return true;
  } catch (e) {
    console.error("[BLE] init failed:", e);
    return false;
  }
}

/**
 * Start scanning and call onDiscovered when a Yuto user is found.
 * Resolves their profile from Supabase (if online) or shows shortId.
 */
export async function startScanning(
  currentUserId: string,
  onDiscovered: (user: NearbyYutoUser) => void
): Promise<void> {
  const profileCache = new Map<string, NearbyYutoUser>();

  YutoBle.addListener("deviceDiscovered", async (data) => {
    const { shortId, deviceAddress, rssi } = data;

    if (profileCache.has(shortId)) {
      const cached = profileCache.get(shortId)!;
      onDiscovered({ ...cached, rssi, deviceAddress });
      return;
    }

    // Look up profile via RPC
    try {
      const { data: profiles, error } = await supabase.rpc("find_profile_by_id_prefix", {
        p_prefix: shortId
      });

      const profile = (!error && profiles && profiles.length > 0) ? profiles[0] : null;

      if (profile) {
        cacheProfile(shortId, profile.id, profile.display_name || "Yuto User");
        const user: NearbyYutoUser = {
          userId: profile.id,
          shortId,
          name: profile.display_name || "Yuto User",
          avatarUrl: profile.avatar_url,
          deviceAddress,
          rssi,
        };
        profileCache.set(shortId, user);
        onDiscovered(user);
      } else {
        const cached = getCachedProfile(shortId);
        const user: NearbyYutoUser = {
          userId: cached?.userId || shortId,
          shortId,
          name: cached?.name || "Nearby user",
          avatarUrl: null,
          deviceAddress,
          rssi,
        };
        profileCache.set(shortId, user);
        onDiscovered(user);
      }
    } catch (e) {
      console.warn("[BLE] profile lookup failed (offline?):", e);
      const cached = getCachedProfile(shortId);
      const user: NearbyYutoUser = {
        userId: cached?.userId || shortId,
        shortId,
        name: cached?.name || "Nearby user",
        avatarUrl: null,
        deviceAddress,
        rssi,
      };
      profileCache.set(shortId, user);
      onDiscovered(user);
    }
  });
}

export async function sendViaBluetooth(
  senderId: string,
  recipient: NearbyYutoUser,
  amount: number
): Promise<{ success: boolean; offline: boolean; message: string }> {
  // Amount bounds pre-check
  const roundedAmount = Math.round(amount);
  if (roundedAmount < MIN_AMOUNT_KES) {
    return { success: false, offline: false, message: "Minimum transfer is KSH 1." };
  }
  if (roundedAmount > MAX_AMOUNT_KES) {
    return { success: false, offline: false, message: "Maximum transfer is KSH 50,000." };
  }

  const txId = crypto.randomUUID();
  const timestamp = Date.now();

  // HMAC sign the payload
  let hmac: string | undefined;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const secret = await deriveSigningSecret(session.access_token);
      hmac = await signBlePayload({ id: txId, senderId, recipientId: recipient.userId, amount: roundedAmount, timestamp }, secret);
    }
  } catch { /* signing optional for BLE send, required for settlement */ }

  const txPayload = JSON.stringify({
    id: txId,
    senderId,
    recipientId: recipient.userId,
    amount: roundedAmount,
    timestamp,
    ...(hmac ? { hmac } : {}),
  });

  // Enforce local cached balance (prevents overdraft offline)
  const cached = getCachedBalance();
  if (cached && cached.balance < roundedAmount) {
    return { success: false, offline: true, message: `Insufficient balance. You have KSH ${Math.round(cached.balance)} cached.` };
  }

  // Send via BLE first (instant, no network needed)
  let bleSent = false;
  try {
    const result = await YutoBle.sendTransaction({ deviceAddress: recipient.deviceAddress, payload: txPayload });
    bleSent = result.success;
  } catch (e) {
    console.warn("[BLE] GATT write failed:", e);
  }

  // Try online settlement
  try {
    const { error } = await supabase.rpc("transfer_yuto_balance", {
      p_to_user_id: recipient.userId,
      p_amount_kes: roundedAmount,
      p_note: "Bluetooth P2P transfer",
    });

    if (!error) {
      // Deduct from local cache too
      deductCachedBalance(roundedAmount);
      // Notify recipient (fire-and-forget)
      const senderName = getCachedUser()?.displayName ?? "someone";
      authFetch("/api/notify", {
        method: "POST",
        body: JSON.stringify({ userId: recipient.userId, title: "💸 Money received!", body: `KSH ${roundedAmount} from ${senderName}` }),
      }).catch(() => {});
      return { success: true, offline: false, message: `KSH ${roundedAmount} sent!` };
    }
  } catch {
    // No internet — fall through
  }

  // Offline path: BLE succeeded, queue for later
  if (bleSent) {
    // Deduct from local cached balance (optimistic)
    const deducted = deductCachedBalance(roundedAmount);
    if (!deducted && cached) {
      return { success: false, offline: true, message: "Insufficient cached balance for offline send." };
    }

    const tx: OfflineTransaction = { id: txId, senderId, recipientId: recipient.userId, amount: roundedAmount, timestamp, synced: false, hmac };
    await saveOfflineTransaction(tx);
    return { success: true, offline: true, message: `KSH ${roundedAmount} sent offline! Will settle when online.` };
  }

  return { success: false, offline: true, message: "Transfer failed. Get closer and try again." };
}

/**
 * Sync any pending offline transactions to Supabase.
 * Call this when the app comes online.
 */
export async function syncOfflineTransactions(): Promise<number> {
  const transactions = await getOfflineTransactionsAsync();
  const pending = transactions.filter((tx) => !tx.synced && !tx.cancelled);
  let synced = 0;

  for (const tx of pending) {
    try {
      const { data: result, error } = await supabase.rpc("settle_offline_transfer", {
        p_tx_id: tx.id,
        p_sender_id: tx.senderId,
        p_recipient_id: tx.recipientId,
        p_amount_kes: Math.round(tx.amount),
        p_timestamp: tx.timestamp,
        p_hmac: tx.hmac || null,
      });

      if (!error && (result === "settled" || result === "already_settled")) {
        tx.synced = true;
        synced++;
        // Notify recipient on first settlement (fire-and-forget)
        if (result === "settled") {
          const senderName = getCachedUser()?.displayName ?? "someone";
          authFetch("/api/notify", {
            method: "POST",
            body: JSON.stringify({ userId: tx.recipientId, title: "💸 Money received!", body: `KSH ${tx.amount} from ${senderName}` }),
          }).catch(() => {});
        }
      } else if (result === "insufficient_balance") {
        tx.synced = true; // Mark as processed (rejected)
        console.warn(`[BLE] Offline tx ${tx.id} rejected: insufficient balance`);
      } else if (result === "expired") {
        tx.synced = true;
        console.warn(`[BLE] Offline tx ${tx.id} expired (>24h old)`);
      }
    } catch {
      // Will retry next time
    }
  }

  persistSetSync(OFFLINE_TX_KEY, JSON.stringify(transactions));
  // Ensure persistence
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: OFFLINE_TX_KEY, value: JSON.stringify(transactions) });
  } catch {}
  return synced;
}

// ── Internal helpers ────────────────────────────────────────

function handleIncomingTransaction(payload: string) {
  try {
    const parsed = JSON.parse(payload);

    // Validate payload before storing
    const result = validateBlePayload(parsed);
    if (!result.valid || !result.sanitized) {
      console.warn("[BLE] Rejected incoming payload:", result.error);
      return;
    }

    const tx = result.sanitized;
    // Store as received transaction
    const received = JSON.parse(localStorage.getItem("yuto_received_transactions") || "[]");
    received.push({ ...tx, receivedAt: Date.now() });
    localStorage.setItem("yuto_received_transactions", JSON.stringify(received));

    // Show notification (the WalletScreen will pick this up)
    window.dispatchEvent(new CustomEvent("yuto:ble-received", { detail: tx }));
  } catch (e) {
    console.error("[BLE] parse incoming tx failed:", e);
  }
}

async function saveOfflineTransaction(tx: OfflineTransaction) {
  const transactions = getOfflineTransactions();
  transactions.push(tx);
  const value = JSON.stringify(transactions);
  persistSetSync(OFFLINE_TX_KEY, value);
  // Also do a blocking write to ensure persistence before app kill
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: OFFLINE_TX_KEY, value });
  } catch {}
}

export function getOfflineTransactions(): OfflineTransaction[] {
  try {
    const raw = persistGetSync(OFFLINE_TX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Read offline transactions directly from native storage (for cold start) */
async function getOfflineTransactionsAsync(): Promise<OfflineTransaction[]> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: OFFLINE_TX_KEY });
    if (value) {
      const txs = JSON.parse(value);
      // Also update memCache
      memCache.set(OFFLINE_TX_KEY, value);
      return txs;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Stop all BLE activity
 */
export async function stopBluetooth(): Promise<void> {
  try {
    await YutoBle.stopScanning();
    await YutoBle.stopAdvertising();
  } catch { /* ignore */ }
}

/**
 * Check if BLE is available (native only)
 */
export function isBleAvailable(): boolean {
  return typeof (window as any).Capacitor !== "undefined" && (window as any).Capacitor.isNativePlatform();
}
