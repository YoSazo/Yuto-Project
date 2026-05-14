import { registerPlugin } from "@capacitor/core";
import { supabase } from "./supabase";

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
 * Call this whenever the app is online and balance is fetched.
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
  const txId = crypto.randomUUID();
  const timestamp = Date.now();

  const txPayload = JSON.stringify({
    id: txId,
    senderId,
    recipientId: recipient.userId,
    amount,
    timestamp,
  });

  // Enforce local cached balance (prevents overdraft offline)
  const cached = getCachedBalance();
  if (cached && cached.balance < amount) {
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
      p_amount_kes: Math.round(amount),
      p_note: "Bluetooth P2P transfer",
    });

    if (!error) {
      // Deduct from local cache too
      deductCachedBalance(amount);
      return { success: true, offline: false, message: `KSH ${amount} sent!` };
    }
  } catch {
    // No internet — fall through
  }

  // Offline path: BLE succeeded, queue for later
  if (bleSent) {
    // Deduct from local cached balance (optimistic)
    const deducted = deductCachedBalance(amount);
    if (!deducted && cached) {
      return { success: false, offline: true, message: "Insufficient cached balance for offline send." };
    }

    const tx: OfflineTransaction = { id: txId, senderId, recipientId: recipient.userId, amount, timestamp, synced: false };
    saveOfflineTransaction(tx);
    return { success: true, offline: true, message: `KSH ${amount} sent offline! Will settle when online.` };
  }

  return { success: false, offline: true, message: "Transfer failed. Get closer and try again." };
}

/**
 * Sync any pending offline transactions to Supabase.
 * Call this when the app comes online.
 */
export async function syncOfflineTransactions(): Promise<number> {
  const transactions = getOfflineTransactions();
  const pending = transactions.filter((tx) => !tx.synced);
  let synced = 0;

  for (const tx of pending) {
    try {
      const { data: result, error } = await supabase.rpc("settle_offline_transfer", {
        p_tx_id: tx.id,
        p_sender_id: tx.senderId,
        p_recipient_id: tx.recipientId,
        p_amount_kes: Math.round(tx.amount),
        p_timestamp: tx.timestamp,
      });

      if (!error && (result === "settled" || result === "already_settled")) {
        tx.synced = true;
        synced++;
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
  return synced;
}

// ── Internal helpers ────────────────────────────────────────

function handleIncomingTransaction(payload: string) {
  try {
    const tx = JSON.parse(payload) as OfflineTransaction;
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

function saveOfflineTransaction(tx: OfflineTransaction) {
  const transactions = getOfflineTransactions();
  transactions.push(tx);
  persistSetSync(OFFLINE_TX_KEY, JSON.stringify(transactions));
}

function getOfflineTransactions(): OfflineTransaction[] {
  try {
    const raw = persistGetSync(OFFLINE_TX_KEY);
    return raw ? JSON.parse(raw) : [];
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
