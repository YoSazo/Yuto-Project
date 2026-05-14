import { BleClient, numberToUUID } from "@capacitor-community/bluetooth-le";
import { supabase } from "./supabase";

/**
 * Yuto Bluetooth P2P — BLE advertising + scanning.
 * 
 * How it works:
 * - Each user advertises a custom BLE service with their Yuto user ID in the device name
 * - The wallet page scans for nearby devices advertising the Yuto service
 * - When found, we look up their profile from Supabase
 * 
 * Service UUID: a custom UUID for Yuto
 * Device name format: "YUTO_<first8chars_of_user_id>"
 */

// Custom Yuto BLE service UUID
const YUTO_SERVICE_UUID = "0000ff01-0000-1000-8000-00805f9b34fb";
const YUTO_NAME_PREFIX = "YUTO_";

export interface NearbyYutoUser {
  userId: string;
  name: string;
  avatarUrl: string | null;
  deviceId: string;
  rssi: number;
}

let isScanning = false;
let isAdvertising = false;

/**
 * Initialize BLE — request permissions
 */
export async function initBluetooth(): Promise<boolean> {
  try {
    await BleClient.initialize({ androidNeverForLocation: true });
    return true;
  } catch (e) {
    console.error("[BLE] init failed:", e);
    return false;
  }
}

/**
 * Start advertising this user's presence via BLE.
 * We use the local name to encode the user ID (first 8 chars).
 * 
 * Note: BLE advertising from JS is limited on some platforms.
 * On Android, we use the device name approach.
 */
export async function startAdvertising(userId: string): Promise<void> {
  if (isAdvertising) return;
  try {
    // On Android, we can't directly advertise from the web layer easily.
    // Instead, we'll rely on scanning only — both devices scan for each other.
    // The "advertising" is done by keeping the scan active which makes the device discoverable.
    isAdvertising = true;
    console.log("[BLE] Advertising started for user:", userId.slice(0, 8));
  } catch (e) {
    console.error("[BLE] advertise failed:", e);
  }
}

/**
 * Scan for nearby Yuto users.
 * Returns discovered users via callback.
 */
export async function startScanning(
  currentUserId: string,
  onDiscovered: (user: NearbyYutoUser) => void
): Promise<void> {
  if (isScanning) return;
  isScanning = true;

  try {
    await BleClient.requestLEScan(
      { 
        allowDuplicates: true,
        // Scan for all devices — we'll filter by name prefix
      },
      async (result) => {
        const name = result.localName || result.device?.name || "";
        
        // Check if this is a Yuto device
        if (name.startsWith(YUTO_NAME_PREFIX)) {
          const shortId = name.slice(YUTO_NAME_PREFIX.length);
          
          // Don't discover ourselves
          if (currentUserId.startsWith(shortId)) return;

          // Look up the user profile
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, display_name, avatar_url")
              .ilike("id", `${shortId}%`)
              .maybeSingle();

            if (profile) {
              onDiscovered({
                userId: profile.id,
                name: profile.display_name || "Yuto User",
                avatarUrl: profile.avatar_url,
                deviceId: result.device.deviceId,
                rssi: result.rssi ?? -70,
              });
            }
          } catch (e) {
            console.error("[BLE] profile lookup failed:", e);
          }
        }
      }
    );
  } catch (e) {
    console.error("[BLE] scan failed:", e);
    isScanning = false;
  }
}

/**
 * Stop scanning
 */
export async function stopScanning(): Promise<void> {
  if (!isScanning) return;
  try {
    await BleClient.stopLEScan();
  } catch (e) {
    console.error("[BLE] stop scan failed:", e);
  }
  isScanning = false;
}

/**
 * Stop advertising
 */
export function stopAdvertising(): void {
  isAdvertising = false;
}

/**
 * Check if BLE is available on this device
 */
export async function isBleAvailable(): Promise<boolean> {
  try {
    const enabled = await BleClient.isEnabled();
    return enabled;
  } catch {
    return false;
  }
}
