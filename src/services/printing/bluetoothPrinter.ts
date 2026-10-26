import { isDesktopApp } from '../../utils/platform';

// Bluetooth receipt printing via Web Bluetooth (Chrome/Edge on Android and
// desktop). Supports BLE thermal printers that expose a writable GATT
// characteristic, which covers most low-cost 58mm/80mm receipt printers.
// Not supported: iPhone/iPad browsers, and older "Bluetooth Classic"-only
// printers (those need the native Android app, not a web page).

/** Service UUIDs commonly used by BLE receipt printers; Web Bluetooth only allows services listed up front. */
const PRINTER_SERVICES: BluetoothServiceUUID[] = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

/** BLE writes are limited by the connection's MTU; 100 bytes is safe on every printer we know of. */
const CHUNK_SIZE = 100;
const CHUNK_DELAY_MS = 20;

export class BluetoothPrintError extends Error {}

interface Connection {
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
}

let connection: Connection | null = null;

export function isBluetoothSupported(): boolean {
  // The desktop app has no Bluetooth device picker; it prints straight to any printer Windows already knows.
  if (isDesktopApp()) return false;
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator && !!navigator.bluetooth;
}

export function connectedPrinterName(): string {
  return connection?.device.gatt?.connected ? connection.device.name || 'Bluetooth printer' : '';
}

async function findWritableCharacteristic(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic> {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const characteristics = await service.getCharacteristics();
    const writable = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
    if (writable) return writable;
  }
  throw new BluetoothPrintError('This device does not look like a receipt printer');
}

async function openGatt(device: BluetoothDevice): Promise<Connection> {
  if (!device.gatt) throw new BluetoothPrintError('This device cannot be connected to');
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);
  connection = { device, characteristic };
  return connection;
}

/** Shows the browser's device picker. Must be called from a click. */
export async function pairBluetoothPrinter(): Promise<string> {
  if (!isBluetoothSupported()) {
    throw new BluetoothPrintError('Bluetooth printing is not available in this browser. Use Chrome on Android or desktop.');
  }
  try {
    const device = await navigator.bluetooth!.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICES,
    });
    const { device: connected } = await openGatt(device);
    return connected.name || 'Bluetooth printer';
  } catch (e) {
    if (e instanceof BluetoothPrintError) throw e;
    if ((e as DOMException)?.name === 'NotFoundError') throw new BluetoothPrintError('No printer was selected');
    throw new BluetoothPrintError('Could not connect. Make sure the printer is on and close to this device.');
  }
}

/** Reuses the live connection, reconnects to a previously allowed device, or throws asking the user to pair. */
async function ensureConnection(): Promise<Connection> {
  if (connection?.device.gatt?.connected) return connection;
  try {
    if (connection) return await openGatt(connection.device);
    const known = (await navigator.bluetooth?.getDevices?.()) ?? [];
    if (known.length > 0) return await openGatt(known[0]);
  } catch {
    // fall through to the pairing message
  }
  throw new BluetoothPrintError('Printer not connected. Open Settings and tap "Connect Bluetooth printer".');
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function writeToBluetoothPrinter(data: Uint8Array): Promise<void> {
  if (!isBluetoothSupported()) throw new BluetoothPrintError('Bluetooth printing is not available in this browser');
  const { characteristic } = await ensureConnection();
  try {
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      if (characteristic.properties.writeWithoutResponse) await characteristic.writeValueWithoutResponse(chunk);
      else await characteristic.writeValueWithResponse(chunk);
      await sleep(CHUNK_DELAY_MS);
    }
  } catch {
    throw new BluetoothPrintError('Lost connection to the printer. Check it is on and try again.');
  }
}

export function disconnectBluetoothPrinter(): void {
  try {
    connection?.device.gatt?.disconnect();
  } catch {
    // already disconnected
  }
  connection = null;
}
