import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  status: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  bluetoothStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  permissionStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  controls: {
    padding: 20,
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  disconnectButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    marginRight: 10,
    fontSize: 14,
    color: '#333',
  },
  section: {
    flex: 1,
    margin: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 15,
    backgroundColor: '#f8f8f8',
    color: '#333',
  },
  deviceList: {
    flex: 1,
  },
  deviceItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceItemConnected: {
    backgroundColor: '#f0f8ff',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  deviceId: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  deviceRssi: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  deviceConnectable: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  deviceServices: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 2,
  },
  connectedIndicator: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  connectedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  notificationList: {
    flex: 1,
    maxHeight: 200,
  },
  notificationItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  notificationTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  notificationService: {
    fontSize: 11,
    color: '#333',
    fontFamily: 'monospace',
  },
  notificationChar: {
    fontSize: 11,
    color: '#333',
    fontFamily: 'monospace',
  },
  notificationValue: {
    fontSize: 12,
    color: '#2196F3',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    padding: 20,
    lineHeight: 20,
  },
});
