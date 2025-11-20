import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Switch,
  SafeAreaView,
  StatusBar,
  ListRenderItem,
  Linking,
} from 'react-native';
import {
  BleManager,
  Device,
  Service,
  Characteristic,
  Subscription,
  State,
} from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { styles } from './home.style';

// Types
interface NotificationData {
  id: number;
  serviceUUID: string;
  characteristicUUID: string;
  value: string;
  timestamp: string;
}

type ConnectionStatus =
  | 'Disconnected'
  | 'Connecting...'
  | 'Connected'
  | 'Connection Failed'
  | 'Reconnecting...'
  | 'Bluetooth Off'
  | 'Checking Bluetooth...';

const BLEDeviceManager: React.FC = () => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [autoReconnect, setAutoReconnect] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    'Checking Bluetooth...',
  );
  const [bluetoothState, setBluetoothState] = useState<State>('Unknown');
  const [permissionsGranted, setPermissionsGranted] = useState<boolean>(false);

  const bleManagerRef = useRef<BleManager | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionsRef = useRef<Subscription[]>([]);
  const stateSubscriptionRef = useRef<Subscription | null>(null);

  useEffect(() => {
    initializeBLE();
    return () => {
      cleanup();
    };
  }, []);

  const initializeBLE = async () => {
    console.log('Initializing BLE...');

    try {
      bleManagerRef.current = new BleManager();

      // Check initial Bluetooth state
      const state = await bleManagerRef.current.state();
      console.log('Initial Bluetooth state:', state);
      setBluetoothState(state);
      updateConnectionStatusFromBluetoothState(state);

      // Subscribe to state changes
      stateSubscriptionRef.current = bleManagerRef.current.onStateChange(
        newState => {
          console.log('Bluetooth state changed:', newState);
          setBluetoothState(newState);
          updateConnectionStatusFromBluetoothState(newState);
        },
        true,
      );

      // Request permissions
      if (Platform.OS === 'android') {
        const granted = await requestPermissions();
        setPermissionsGranted(granted);
      } else {
        setPermissionsGranted(true);
      }
    } catch (error) {
      console.error('BLE initialization error:', error);
      Alert.alert('BLE Error', 'Failed to initialize Bluetooth Low Energy');
    }
  };

  const updateConnectionStatusFromBluetoothState = (state: State) => {
    if (state === 'PoweredOn') {
      if (!isConnected) {
        setConnectionStatus('Disconnected');
      }
    } else if (state === 'PoweredOff') {
      setConnectionStatus('Bluetooth Off');
      // Stop scanning if bluetooth is off
      if (isScanning) {
        stopScan();
      }
    } else {
      setConnectionStatus('Checking Bluetooth...');
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      console.log('Requesting Android permissions...');
      const androidVersion =
        typeof Platform.Version === 'string'
          ? parseInt(Platform.Version, 10)
          : Platform.Version;

      let permissions: string[] = [];

      if (androidVersion >= 31) {
        // Android 12+ permissions
        permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];
      } else if (androidVersion >= 23) {
        // Android 6+ permissions
        permissions = [
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];
      } else {
        // Older Android versions
        return true;
      }

      const granted = await PermissionsAndroid.requestMultiple(permissions);
      console.log('Permission results:', granted);

      const allGranted = Object.values(granted).every(
        permission => permission === PermissionsAndroid.RESULTS.GRANTED,
      );

      if (!allGranted) {
        Alert.alert(
          'Permissions Required',
          'This app needs Bluetooth and Location permissions to scan for devices. Please grant all permissions.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return false;
      }

      console.log('All permissions granted');
      return true;
    } catch (err) {
      console.warn('Permission request failed:', err);
      Alert.alert('Permission Error', 'Failed to request permissions');
      return false;
    }
  };

  const cleanup = (): void => {
    console.log('Cleaning up BLE resources...');

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Clear state subscription
    if (stateSubscriptionRef.current) {
      stateSubscriptionRef.current.remove();
    }

    // Clear all subscriptions
    subscriptionsRef.current.forEach((subscription: Subscription) => {
      if (subscription) subscription.remove();
    });
    subscriptionsRef.current = [];

    if (bleManagerRef.current) {
      bleManagerRef.current.stopDeviceScan();
      if (connectedDevice) {
        bleManagerRef.current.cancelDeviceConnection(connectedDevice.id);
      }
      bleManagerRef.current.destroy();
    }
  };

  const checkPrerequisites = async (): Promise<boolean> => {
    if (!bleManagerRef.current) {
      Alert.alert('Error', 'BLE Manager not initialized');
      return false;
    }

    const state = await bleManagerRef.current.state();
    if (state !== 'PoweredOn') {
      Alert.alert(
        'Bluetooth Required',
        'Please turn on Bluetooth to use this feature.',
        [{ text: 'OK', style: 'default' }],
      );
      return false;
    }

    if (!permissionsGranted) {
      const granted = await requestPermissions();
      if (!granted) return false;
      setPermissionsGranted(true);
    }

    return true;
  };

  const startScan = async (): Promise<void> => {
    console.log('Starting BLE scan...');

    const canProceed = await checkPrerequisites();
    if (!canProceed) return;

    setIsScanning(true);
    setDevices([]);

    try {
      // Scan with options - this is crucial for finding devices
      bleManagerRef.current!.startDeviceScan(
        null, // UUIDs filter - null means scan for all
        {
          allowDuplicates: false,
          scanMode: 1, // Balanced scan mode
          callbackType: 1, // All matches
        },
        (error, device) => {
          if (error) {
            console.error('Scan error:', error);
            setIsScanning(false);
            Alert.alert(
              'Scan Error',
              `${error.message}\n\nMake sure:\n• Bluetooth is on\n• Location is enabled\n• App has all permissions`,
            );
            return;
          }

          if (device) {
            console.log('Found device:', {
              name: device.name,
              id: device.id,
              rssi: device.rssi,
              isConnectable: device.isConnectable,
              serviceUUIDs: device.serviceUUIDs,
            });

            setDevices((prevDevices: Device[]) => {
              // Avoid duplicates
              const existingDeviceIndex = prevDevices.findIndex(
                d => d.id === device.id,
              );
              if (existingDeviceIndex !== -1) {
                // Update existing device with new data
                const newDevices = [...prevDevices];
                newDevices[existingDeviceIndex] = device;
                return newDevices;
              }
              return [...prevDevices, device];
            });
          }
        },
      );

      // Stop scanning after 20 seconds
      scanTimeoutRef.current = setTimeout(() => {
        console.log('Scan timeout reached');
        stopScan();
      }, 20000);
    } catch (error) {
      console.error('Failed to start scan:', error);
      setIsScanning(false);
      Alert.alert('Scan Error', 'Failed to start scanning for devices');
    }
  };

  const stopScan = (): void => {
    console.log('Stopping BLE scan...');

    if (bleManagerRef.current) {
      bleManagerRef.current.stopDeviceScan();
    }
    setIsScanning(false);
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
  };

  const connectToDevice = async (device: Device): Promise<void> => {
    if (!bleManagerRef.current) return;

    try {
      setConnectionStatus('Connecting...');
      console.log(
        'Attempting to connect to:',
        device.name || 'Unknown',
        device.id,
      );

      // Stop scanning before connecting
      if (isScanning) {
        stopScan();
      }

      // Check if device is already connected
      const isAlreadyConnected = await device.isConnected();
      if (isAlreadyConnected) {
        console.log('Device is already connected');
        setConnectedDevice(device);
        setIsConnected(true);
        setConnectionStatus('Connected');
        await subscribeToCharacteristics(device);
        return;
      }

      // Connect with options
      const connectedDev = await bleManagerRef.current.connectToDevice(
        device.id,
        {
          requestMTU: 517,
          timeout: 15000,
          autoConnect: false,
        },
      );

      console.log('Connected! Discovering services...');

      // Discover services and characteristics
      await connectedDev.discoverAllServicesAndCharacteristics();
      console.log('Services discovered');

      setConnectedDevice(connectedDev);
      setIsConnected(true);
      setConnectionStatus('Connected');

      // Set up connection monitoring
      setupConnectionMonitoring(connectedDev);

      // Subscribe to characteristics
      await subscribeToCharacteristics(connectedDev);

      Alert.alert('Success', `Connected to ${device.name || device.id}`);
    } catch (error: any) {
      console.error('Connection error:', error);
      setConnectionStatus('Connection Failed');

      let errorMessage = error.message || 'Unknown error';

      if (errorMessage.includes('timeout')) {
        errorMessage =
          'Connection timeout. Make sure the device is nearby and in pairing mode.';
      } else if (errorMessage.includes('Device not found')) {
        errorMessage = 'Device not found. It may have moved out of range.';
      } else if (errorMessage.includes('Device disconnected')) {
        errorMessage = 'Device disconnected during connection attempt.';
      } else if (errorMessage.includes('Operation was cancelled')) {
        errorMessage = 'Connection was cancelled.';
      }

      Alert.alert('Connection Error', errorMessage);

      // Reset connection state
      setConnectedDevice(null);
      setIsConnected(false);

      // Attempt auto-reconnect if enabled
      if (autoReconnect && !errorMessage.includes('cancelled')) {
        scheduleReconnect(device);
      }
    }
  };

  const setupConnectionMonitoring = (device: Device): void => {

    console.log('Setting up connection monitoring...');

    // Monitor device connection state
    const subscription = device.onDisconnected((error, disconnectedDevice) => {
      console.log('Device disconnected:', error?.message || 'Unknown reason');
      console.log('subscriptionnnnnn', subscription);
      setIsConnected(false);
      setConnectedDevice(null);
      setConnectionStatus('Disconnected');

      // Clear subscriptions
      subscriptionsRef.current.forEach((sub: Subscription) => {
        if (sub) sub.remove();
      });
      subscriptionsRef.current = [];

      if (autoReconnect && !error?.message?.includes('cancelled')) {
        scheduleReconnect(disconnectedDevice || device);
      }
    });

    subscriptionsRef.current.push(subscription);
  };

  const scheduleReconnect = (device: Device): void => {
    console.log('Scheduling reconnect...');
    setConnectionStatus('Reconnecting...');

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('Attempting to reconnect...');
      connectToDevice(device);
    }, 5000);
  };

  

  const subscribeToCharacteristics = async (device: Device): Promise<void> => {
    try {
      console.log('Getting services...');
      const services: Service[] = await device.services();
      console.log(`Found ${services.length} services`);

      let notificationCount = 0;

      for (const service of services) {
        try {
          console.log('Service:', service.uuid);
          const characteristics: Characteristic[] =
            await service.characteristics();
          console.log(
            `Service ${service.uuid} has ${characteristics.length} characteristics`,
          );

          for (const characteristic of characteristics) {
            console.log(`Characteristic: ${characteristic.uuid}, Properties:`, {
              isNotifiable: characteristic.isNotifiable,
              isReadable: characteristic.isReadable,
              isWritableWithResponse: characteristic.isWritableWithResponse,
              isWritableWithoutResponse:
                characteristic.isWritableWithoutResponse,
            });

            // Check if characteristic supports notifications
            if (characteristic.isNotifiable) {
              try {
                console.log(
                  `Subscribing to notifications for ${characteristic.uuid}`,
                );

                const subscription = characteristic.monitor((error, char) => {
                  if (error) {
                    console.error('Notification error:', error);
                    return;
                  }

                  if (char && char.value) {
                    console.log('Received notification:', char.value);
                    const timestamp = new Date().toLocaleTimeString();
                    const notification: NotificationData = {
                      id: Date.now() + Math.random(),
                      serviceUUID: service.uuid,
                      characteristicUUID: char.uuid,
                      value: char.value,
                      timestamp: timestamp,
                    };

                    setNotifications((prev: NotificationData[]) => [
                      notification,
                      ...prev.slice(0, 99),
                    ]); // Keep last 100
                  }
                });

                subscriptionsRef.current.push(subscription);
                notificationCount++;
              } catch (subscribeError) {
                console.error(
                  `Failed to subscribe to ${characteristic.uuid}:`,
                  subscribeError,
                );
              }
            }
          }
        } catch (serviceError) {
          console.error(
            `Error processing service ${service.uuid}:`,
            serviceError,
          );
        }
      }

      console.log(
        `Successfully subscribed to ${notificationCount} notification characteristics`,
      );
    } catch (error: any) {
      console.error('Subscription error:', error);
    }
  };





  const disconnect = async (): Promise<void> => {
    if (!bleManagerRef.current || !connectedDevice) return;

    try {
      console.log('Disconnecting from device...');

      // Clear auto-reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Clear subscriptions
      subscriptionsRef.current.forEach((subscription: Subscription) => {
        if (subscription) subscription.remove();
      });
      subscriptionsRef.current = [];

      await bleManagerRef.current.cancelDeviceConnection(connectedDevice.id);

      setConnectedDevice(null);
      setIsConnected(false);
      setConnectionStatus('Disconnected');
      setNotifications([]);

      console.log('Disconnected successfully');
    } catch (error: any) {
      console.error('Disconnect error:', error);
    }
  };

  // const getDeviceDisplayName = (device: Device): string => {
  //   if (device.name && device.name.trim()) {
  //     return device.name.trim();
  //   }

  //   // Extract a readable part from the MAC address if no name is available
  //   const macParts = device.id.split(':');
  //   if (macParts.length === 6) {
  //     // Show last 4 characters of MAC for identification
  //     return `Device ${macParts[4]}${macParts[5]}`;
  //   }

  //   // Fallback to truncated ID
  //   return `Device ${device.id.slice(-8)}`;
  // };

  const renderDevice: ListRenderItem<Device> = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.deviceItem,
        isConnected &&
          connectedDevice?.id === item.id &&
          styles.deviceItemConnected,
      ]}
      onPress={() => connectToDevice(item)}
      disabled={isConnected || bluetoothState !== 'PoweredOn'}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
        <Text style={styles.deviceId}>{item.id}</Text>
        <Text style={styles.deviceRssi}>RSSI: {item.rssi} dBm</Text>
        <Text style={styles.deviceConnectable}>
          Connectable: {item.isConnectable ? 'Yes' : 'No'}
        </Text>
        {item.serviceUUIDs && item.serviceUUIDs.length > 0 && (
          <Text style={styles.deviceServices}>
            Services: {item.serviceUUIDs.length}
          </Text>
        )}
      </View>
      {isConnected && connectedDevice?.id === item.id && (
        <View style={styles.connectedIndicator}>
          <Text style={styles.connectedText}>Connected</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderNotification: ListRenderItem<NotificationData> = ({ item }) => (
    <View style={styles.notificationItem}>
      <Text style={styles.notificationTime}>{item.timestamp}</Text>
      <Text style={styles.notificationService}>
        Service: {item.serviceUUID}
      </Text>
      <Text style={styles.notificationChar}>
        Char: {item.characteristicUUID}
      </Text>
      <Text style={styles.notificationValue}>Value: {item.value}</Text>
    </View>
  );

  const canStartScan =
    bluetoothState === 'PoweredOn' && permissionsGranted && !isScanning;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      <View style={styles.header}>
        <Text style={styles.title}>BLE Device Manager</Text>
        <Text style={styles.status}>Status: {connectionStatus}</Text>
        <Text style={styles.bluetoothStatus}>Bluetooth: {bluetoothState}</Text>
        <Text style={styles.permissionStatus}>
          Permissions: {permissionsGranted ? 'Granted' : 'Missing'}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, !canStartScan && styles.buttonDisabled]}
          onPress={isScanning ? stopScan : startScan}
          disabled={!canStartScan}
        >
          {isScanning ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>
              {bluetoothState !== 'PoweredOn'
                ? 'Bluetooth Off'
                : !permissionsGranted
                ? 'No Permissions'
                : devices.length > 0
                ? 'Scan Again'
                : 'Start Scan'}
            </Text>
          )}
        </TouchableOpacity>

        {isConnected && (
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={disconnect}
          >
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        )}

        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Auto-Reconnect</Text>
          <Switch
            value={autoReconnect}
            onValueChange={setAutoReconnect}
            trackColor={{ false: '#767577', true: '#4CAF50' }}
            thumbColor={autoReconnect ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Nearby Devices ({devices.length})
        </Text>
        <FlatList
          data={devices}
          renderItem={renderDevice}
          keyExtractor={item => item.id}
          style={styles.deviceList}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {bluetoothState !== 'PoweredOn'
                ? 'Turn on Bluetooth to scan for devices'
                : !permissionsGranted
                ? 'Grant permissions to scan for devices'
                : isScanning
                ? 'Scanning for devices...'
                : 'No devices found. Make sure your device is in pairing mode and tap "Start Scan".'}
            </Text>
          }
        />
      </View>

      {isConnected && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Notifications ({notifications.length})
          </Text>
          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={item => item.id.toString()}
            style={styles.notificationList}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No notifications received yet.
              </Text>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
};

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#f5f5f5',
//   },
//   header: {
//     padding: 20,
//     backgroundColor: 'white',
//     borderBottomWidth: 1,
//     borderBottomColor: '#e0e0e0',
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: 'bold',
//     color: '#333',
//   },
//   status: {
//     fontSize: 16,
//     color: '#666',
//     marginTop: 5,
//   },
//   bluetoothStatus: {
//     fontSize: 14,
//     color: '#666',
//     marginTop: 2,
//   },
//   permissionStatus: {
//     fontSize: 14,
//     color: '#666',
//     marginTop: 2,
//   },
//   controls: {
//     padding: 20,
//     backgroundColor: 'white',
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     flexWrap: 'wrap',
//   },
//   button: {
//     backgroundColor: '#2196F3',
//     paddingHorizontal: 20,
//     paddingVertical: 10,
//     borderRadius: 8,
//     minWidth: 120,
//     alignItems: 'center',
//   },
//   buttonDisabled: {
//     backgroundColor: '#ccc',
//   },
//   disconnectButton: {
//     backgroundColor: '#f44336',
//     paddingHorizontal: 20,
//     paddingVertical: 10,
//     borderRadius: 8,
//     minWidth: 100,
//     alignItems: 'center',
//   },
//   buttonText: {
//     color: 'white',
//     fontWeight: 'bold',
//     fontSize: 12,
//   },
//   switchContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   switchLabel: {
//     marginRight: 10,
//     fontSize: 14,
//     color: '#333',
//   },
//   section: {
//     flex: 1,
//     margin: 10,
//     backgroundColor: 'white',
//     borderRadius: 8,
//     overflow: 'hidden',
//   },
//   sectionTitle: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     padding: 15,
//     backgroundColor: '#f8f8f8',
//     color: '#333',
//   },
//   deviceList: {
//     flex: 1,
//   },
//   deviceItem: {
//     padding: 15,
//     borderBottomWidth: 1,
//     borderBottomColor: '#e0e0e0',
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },
//   deviceItemConnected: {
//     backgroundColor: '#f0f8ff',
//   },
//   deviceInfo: {
//     flex: 1,
//   },
//   deviceName: {
//     fontSize: 16,
//     fontWeight: 'bold',
//     color: '#333',
//   },
//   deviceId: {
//     fontSize: 12,
//     color: '#666',
//     marginTop: 2,
//     fontFamily: 'monospace',
//   },
//   deviceRssi: {
//     fontSize: 12,
//     color: '#999',
//     marginTop: 2,
//   },
//   deviceConnectable: {
//     fontSize: 12,
//     color: '#999',
//     marginTop: 2,
//   },
//   deviceServices: {
//     fontSize: 12,
//     color: '#2196F3',
//     marginTop: 2,
//   },
//   connectedIndicator: {
//     backgroundColor: '#4CAF50',
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 12,
//   },
//   connectedText: {
//     color: 'white',
//     fontSize: 12,
//     fontWeight: 'bold',
//   },
//   notificationList: {
//     flex: 1,
//     maxHeight: 200,
//   },
//   notificationItem: {
//     padding: 10,
//     borderBottomWidth: 1,
//     borderBottomColor: '#e0e0e0',
//   },
//   notificationTime: {
//     fontSize: 12,
//     color: '#666',
//     marginBottom: 2,
//   },
//   notificationService: {
//     fontSize: 11,
//     color: '#333',
//     fontFamily: 'monospace',
//   },
//   notificationChar: {
//     fontSize: 11,
//     color: '#333',
//     fontFamily: 'monospace',
//   },
//   notificationValue: {
//     fontSize: 12,
//     color: '#2196F3',
//     fontFamily: 'monospace',
//     marginTop: 2,
//   },
//   emptyText: {
//     textAlign: 'center',
//     color: '#999',
//     fontSize: 14,
//     padding: 20,
//     lineHeight: 20,
//   },
// });

export default BLEDeviceManager;
