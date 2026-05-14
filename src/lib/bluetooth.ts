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
  // Profile cache to avoid repeated lookups
  const profileCache = new Map<string, NearbyYutoUser>();

  YutoBle.addListener("deviceDiscovered", async (data) => {
    const { shortId, deviceAddress, rssi } = data;

    // Check cache first
    if (profileCache.has(shortId)) {
      const cached = profileCache.get(shortId)!;
      onDiscovered({ ...cached, rssi, deviceAddress });
      return;
    }

    // Try to look up profile (requires internet)
    try {
      // shortId is first 8 hex chars without dashes. UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      // So we search for id starting with those 8 chars (with dash after)
      const uuidPrefix = `${shortId.slice(0, 8)}`;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .like("id", `${uuidPrefix}%`)
        .limit(1);

      const profile = profiles?.[0];
      if (profile) {
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
        // No internet or user not found — show with shortId
        const user: NearbyYutoUser = {
          userId: shortId,
          shortId,
          name: `User ${shortId.slice(0, 4)}`,
          avatarUrl: null,
          deviceAddress,
          rssi,
        };
        profileCache.set(shortId, user);
        onDiscovered(user);
      }
    } catch {
      // Offline — show with shortId
      const user: NearbyYutoUser = {
        userId: shortId,
        shortId,
        name: `User ${shortId.slice(0, 4)}`,
        avatarUrl: null,
        deviceAddress,
        rssi,
      };
      profileCache.set(shortId, user);
      onDiscovered(user);
    }
  });
}

/**
 * Send money to a nearby user via BLE.
 * If online: settles immediately via Supabase RPC.
 * If offline: sends transaction via BLE GATT + queues for later sync.
 */
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

  // Send via BLE first (instant, no network needed)
  let bleSent = false;
  try {
    const result = await YutoBle.sendTransaction({ deviceAddress: recipient.deviceAddress, payload: txPayload });
    bleSent = result.success;
  } catch (e) {
    console.warn("[BLE] GATT write failed:", e);
  }

  // Try online settlement (if we have internet)
  try {
    const { error } = await supabase.rpc("transfer_yuto_balance", {
      p_to_user_id: recipient.userId,
      p_amount_kes: Math.round(amount),
      p_note: "Bluetooth P2P transfer",
    });

    if (!error) {
      return { success: true, offline: false, message: `KSH ${amount} sent!` };
    }
  } catch {
    // No internet — that's fine, we'll queue it
  }

  // If BLE succeeded but online didn't, queue for later sync
  if (bleSent) {
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
      const { error } = await supabase.rpc("transfer_yuto_balance", {
        p_to_user_id: tx.recipientId,
        p_amount_kes: Math.round(tx.amount),
        p_note: `Bluetooth P2P (offline, synced)`,
      });

      if (!error) {
        tx.synced = true;
        synced++;
      }
    } catch {
      // Will retry next time
    }
  }

  // Save updated list
  localStorage.setItem(OFFLINE_TX_KEY, JSON.stringify(transactions));
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
  localStorage.setItem(OFFLINE_TX_KEY, JSON.stringify(transactions));
}

function getOfflineTransactions(): OfflineTransaction[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_TX_KEY) || "[]");
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
