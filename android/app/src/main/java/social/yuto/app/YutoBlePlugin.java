package social.yuto.app;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.ParcelUuid;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(name = "YutoBle")
public class YutoBlePlugin extends Plugin {
    private static final String TAG = "YutoBle";
    private static final UUID YUTO_SERVICE_UUID = UUID.fromString("0000ff01-0000-1000-8000-00805f9b34fb");
    private static final UUID YUTO_TX_CHAR_UUID = UUID.fromString("0000ff02-0000-1000-8000-00805f9b34fb");

    private BluetoothManager bluetoothManager;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeAdvertiser advertiser;
    private BluetoothLeScanner scanner;
    private BluetoothGattServer gattServer;
    private String currentUserId = "";
    private boolean isAdvertising = false;
    private boolean isScanning = false;

    // Pending transaction received via BLE (offline)
    private String pendingTxPayload = null;

    @PluginMethod
    public void startAdvertising(PluginCall call) {
        String userId = call.getString("userId", "");
        if (userId.isEmpty()) {
            call.reject("userId required");
            return;
        }
        currentUserId = userId;

        bluetoothManager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        bluetoothAdapter = bluetoothManager.getAdapter();

        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth not available or disabled");
            return;
        }

        advertiser = bluetoothAdapter.getBluetoothLeAdvertiser();
        if (advertiser == null) {
            call.reject("BLE advertising not supported on this device");
            return;
        }

        // Set the device name to YUTO_<first8chars>
        String shortId = userId.replace("-", "").substring(0, 8);
        try {
            bluetoothAdapter.setName("YUTO_" + shortId);
        } catch (SecurityException e) {
            Log.w(TAG, "Cannot set BT name: " + e.getMessage());
        }

        // Start GATT server to receive transaction data
        startGattServer();

        // Advertise
        AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setConnectable(true)
                .setTimeout(0)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .build();

        AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(true)
                .addServiceUuid(new ParcelUuid(YUTO_SERVICE_UUID))
                .build();

        try {
            advertiser.startAdvertising(settings, data, advertiseCallback);
            isAdvertising = true;
            call.resolve(new JSObject().put("success", true));
        } catch (SecurityException e) {
            call.reject("Permission denied: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopAdvertising(PluginCall call) {
        if (advertiser != null && isAdvertising) {
            try {
                advertiser.stopAdvertising(advertiseCallback);
            } catch (SecurityException e) {
                Log.w(TAG, "Stop advertise error: " + e.getMessage());
            }
            isAdvertising = false;
        }
        if (gattServer != null) {
            try {
                gattServer.close();
            } catch (Exception e) {
                Log.w(TAG, "GATT close error: " + e.getMessage());
            }
            gattServer = null;
        }
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void startScanning(PluginCall call) {
        bluetoothManager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        bluetoothAdapter = bluetoothManager.getAdapter();

        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth not available");
            return;
        }

        scanner = bluetoothAdapter.getBluetoothLeScanner();
        if (scanner == null) {
            call.reject("BLE scanner not available");
            return;
        }

        List<ScanFilter> filters = new ArrayList<>();
        filters.add(new ScanFilter.Builder()
                .setServiceUuid(new ParcelUuid(YUTO_SERVICE_UUID))
                .build());

        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();

        try {
            scanner.startScan(filters, settings, scanCallback);
            isScanning = true;
            call.resolve(new JSObject().put("success", true));
        } catch (SecurityException e) {
            call.reject("Permission denied: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopScanning(PluginCall call) {
        if (scanner != null && isScanning) {
            try {
                scanner.stopScan(scanCallback);
            } catch (SecurityException e) {
                Log.w(TAG, "Stop scan error: " + e.getMessage());
            }
            isScanning = false;
        }
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void sendTransaction(PluginCall call) {
        String deviceAddress = call.getString("deviceAddress", "");
        String payload = call.getString("payload", "");

        if (deviceAddress.isEmpty() || payload.isEmpty()) {
            call.reject("deviceAddress and payload required");
            return;
        }

        // Connect to the remote device's GATT server and write the transaction
        BluetoothDevice device = bluetoothAdapter.getRemoteDevice(deviceAddress);
        try {
            BluetoothGatt gatt = device.connectGatt(getContext(), false, new BluetoothGattCallback() {
                @Override
                public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
                    if (newState == BluetoothProfile.STATE_CONNECTED) {
                        try {
                            gatt.discoverServices();
                        } catch (SecurityException e) {
                            Log.e(TAG, "Discover services error: " + e.getMessage());
                        }
                    }
                }

                @Override
                public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                    BluetoothGattService service = gatt.getService(YUTO_SERVICE_UUID);
                    if (service != null) {
                        BluetoothGattCharacteristic txChar = service.getCharacteristic(YUTO_TX_CHAR_UUID);
                        if (txChar != null) {
                            txChar.setValue(payload.getBytes(StandardCharsets.UTF_8));
                            try {
                                gatt.writeCharacteristic(txChar);
                            } catch (SecurityException e) {
                                Log.e(TAG, "Write char error: " + e.getMessage());
                            }
                        }
                    }
                }

                @Override
                public void onCharacteristicWrite(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) {
                    try {
                        gatt.disconnect();
                        gatt.close();
                    } catch (SecurityException e) {
                        Log.w(TAG, "Disconnect error: " + e.getMessage());
                    }
                    JSObject result = new JSObject();
                    result.put("success", status == BluetoothGatt.GATT_SUCCESS);
                    call.resolve(result);
                }
            });
        } catch (SecurityException e) {
            call.reject("Connection failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingTransaction(PluginCall call) {
        JSObject result = new JSObject();
        result.put("payload", pendingTxPayload);
        pendingTxPayload = null;
        call.resolve(result);
    }

    // ── GATT Server (receives transactions from sender) ──────────────

    private void startGattServer() {
        gattServer = bluetoothManager.openGattServer(getContext(), gattServerCallback);

        BluetoothGattService service = new BluetoothGattService(YUTO_SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY);

        BluetoothGattCharacteristic txChar = new BluetoothGattCharacteristic(
                YUTO_TX_CHAR_UUID,
                BluetoothGattCharacteristic.PROPERTY_WRITE,
                BluetoothGattCharacteristic.PERMISSION_WRITE
        );
        service.addCharacteristic(txChar);

        try {
            gattServer.addService(service);
        } catch (SecurityException e) {
            Log.e(TAG, "Add service error: " + e.getMessage());
        }
    }

    private final BluetoothGattServerCallback gattServerCallback = new BluetoothGattServerCallback() {
        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId,
                                                  BluetoothGattCharacteristic characteristic, boolean preparedWrite,
                                                  boolean responseNeeded, int offset, byte[] value) {
            if (YUTO_TX_CHAR_UUID.equals(characteristic.getUuid())) {
                String payload = new String(value, StandardCharsets.UTF_8);
                Log.i(TAG, "Received BLE transaction: " + payload);
                pendingTxPayload = payload;

                // Notify the JS layer
                JSObject event = new JSObject();
                event.put("payload", payload);
                notifyListeners("transactionReceived", event);
            }

            if (responseNeeded && gattServer != null) {
                try {
                    gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null);
                } catch (SecurityException e) {
                    Log.w(TAG, "Send response error: " + e.getMessage());
                }
            }
        }
    };

    // ── Callbacks ────────────────────────────────────────────────────

    private final AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
        @Override
        public void onStartSuccess(AdvertiseSettings settingsInEffect) {
            Log.i(TAG, "Advertising started successfully");
        }

        @Override
        public void onStartFailure(int errorCode) {
            Log.e(TAG, "Advertising failed: " + errorCode);
        }
    };

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            String deviceName = "";
            try {
                deviceName = result.getDevice().getName();
            } catch (SecurityException e) {
                // ignore
            }
            if (deviceName == null) deviceName = "";

            if (deviceName.startsWith("YUTO_")) {
                String shortId = deviceName.substring(5);
                // Don't discover ourselves
                if (currentUserId.replace("-", "").startsWith(shortId)) return;

                JSObject event = new JSObject();
                event.put("shortId", shortId);
                event.put("deviceAddress", result.getDevice().getAddress());
                event.put("rssi", result.getRssi());
                event.put("deviceName", deviceName);
                notifyListeners("deviceDiscovered", event);
            }
        }
    };
}
