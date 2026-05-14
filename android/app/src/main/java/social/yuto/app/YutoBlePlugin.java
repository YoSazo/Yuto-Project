package social.yuto.app;

import android.Manifest;
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
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.ParcelUuid;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(
    name = "YutoBle",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_ADVERTISE,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        )
    }
)
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
    private String pendingTxPayload = null;

    // Saved call for permission callback
    private PluginCall savedCall = null;
    private String savedAction = "";

    private boolean hasPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        } else {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        }
    }

    @PluginMethod
    public void startAdvertising(PluginCall call) {
        if (!hasPermissions()) {
            savedCall = call;
            savedAction = "advertise";
            requestPermissionForAlias("bluetooth", call, "permissionCallback");
            return;
        }
        doStartAdvertising(call);
    }

    @PluginMethod
    public void startScanning(PluginCall call) {
        if (!hasPermissions()) {
            savedCall = call;
            savedAction = "scan";
            requestPermissionForAlias("bluetooth", call, "permissionCallback");
            return;
        }
        doStartScanning(call);
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (!hasPermissions()) {
            call.reject("Bluetooth permissions denied. Please enable in Settings.");
            return;
        }
        if ("advertise".equals(savedAction)) {
            doStartAdvertising(call);
        } else if ("scan".equals(savedAction)) {
            doStartScanning(call);
        }
    }

    private void doStartAdvertising(PluginCall call) {
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

        // Set device name
        String shortId = userId.replace("-", "").substring(0, 8);
        try {
            bluetoothAdapter.setName("YUTO_" + shortId);
        } catch (SecurityException e) {
            Log.w(TAG, "Cannot set BT name: " + e.getMessage());
        }

        // Start GATT server
        try {
            startGattServer();
        } catch (SecurityException e) {
            call.reject("GATT server failed: " + e.getMessage());
            return;
        }

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
            call.reject("Advertise permission denied: " + e.getMessage());
        }
    }

    private void doStartScanning(PluginCall call) {
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
            call.reject("Scan permission denied: " + e.getMessage());
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

        try {
            BluetoothDevice device = bluetoothAdapter.getRemoteDevice(deviceAddress);
            device.connectGatt(getContext(), false, new BluetoothGattCallback() {
                @Override
                public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
                    if (newState == BluetoothProfile.STATE_CONNECTED) {
                        try { gatt.discoverServices(); } catch (SecurityException e) { call.reject(e.getMessage()); }
                    } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                        try { gatt.close(); } catch (Exception ignored) {}
                    }
                }

                @Override
                public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                    BluetoothGattService service = gatt.getService(YUTO_SERVICE_UUID);
                    if (service != null) {
                        BluetoothGattCharacteristic txChar = service.getCharacteristic(YUTO_TX_CHAR_UUID);
                        if (txChar != null) {
                            txChar.setValue(payload.getBytes(StandardCharsets.UTF_8));
                            txChar.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                            try { 
                                boolean initiated = gatt.writeCharacteristic(txChar);
                                if (!initiated) {
                                    try { gatt.disconnect(); gatt.close(); } catch (Exception ignored) {}
                                    call.reject("Write not initiated");
                                }
                            } catch (SecurityException e) { call.reject(e.getMessage()); }
                        } else {
                            try { gatt.disconnect(); gatt.close(); } catch (Exception ignored) {}
                            call.reject("TX characteristic not found");
                        }
                    } else {
                        try { gatt.disconnect(); gatt.close(); } catch (Exception ignored) {}
                        call.reject("Yuto service not found on device");
                    }
                }

                @Override
                public void onCharacteristicWrite(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) {
                    try { gatt.disconnect(); gatt.close(); } catch (Exception ignored) {}
                    call.resolve(new JSObject().put("success", status == BluetoothGatt.GATT_SUCCESS));
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

    // ── GATT Server ──────────────────────────────────────────

    private void startGattServer() throws SecurityException {
        gattServer = bluetoothManager.openGattServer(getContext(), gattServerCallback);
        BluetoothGattService service = new BluetoothGattService(YUTO_SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY);
        BluetoothGattCharacteristic txChar = new BluetoothGattCharacteristic(
                YUTO_TX_CHAR_UUID,
                BluetoothGattCharacteristic.PROPERTY_WRITE,
                BluetoothGattCharacteristic.PERMISSION_WRITE
        );
        service.addCharacteristic(txChar);
        gattServer.addService(service);
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
                JSObject event = new JSObject();
                event.put("payload", payload);
                notifyListeners("transactionReceived", event);
            }
            if (responseNeeded && gattServer != null) {
                try { gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null); }
                catch (SecurityException e) { Log.w(TAG, "Send response error: " + e.getMessage()); }
            }
        }
    };

    // ── Callbacks ────────────────────────────────────────────

    private final AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
        @Override
        public void onStartSuccess(AdvertiseSettings settingsInEffect) {
            Log.i(TAG, "Advertising started");
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
            try { deviceName = result.getDevice().getName(); } catch (SecurityException e) { /* ignore */ }
            if (deviceName == null) deviceName = "";

            if (deviceName.startsWith("YUTO_")) {
                String shortId = deviceName.substring(5);
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
