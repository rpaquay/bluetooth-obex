interface Chrome {
  runtime: Runtime;
  fileSystem: any;
  bluetooth: Bluetooth.Bluetooth;
}
declare var chrome: Chrome;

interface Runtime {
  lastError: any;
}

interface ChromeEventListener<T> {
  (item: T): void;
}

interface ChromeEvent<T> {
  addListener(handler: ChromeEventListener<T>): void;
  removeListener(handler: ChromeEventListener<T>): void;
  hasListener(handler: ChromeEventListener<T>): boolean;
  hasListeners(): boolean;
}

declare module Bluetooth {
  export interface AdapterState {
  }

  export interface OutOfBandPairingData {
  }

  export interface ServiceRecord {
  }

  export interface Profile {
    // Unique profile identifier, e.g. 00001401-0000-1000-8000-00805F9B23FB
    uuid: string;

    // Human-readable name of the Profile, e.g. "Health Device"
    name?: string;

    // The RFCOMM channel id, used when the profile is to be exported to remote
    // devices.
    channel?: number;

    // The LS2CAP PSM number, used when the profile is to be exported to remote
    // deviecs.
    psm?: number;

    // Specifies whether pairing (and encryption) is required to be able to
    // connect.
    requireAuthentication?: boolean;

    // Specifies whether user authorization is required to be able to connect.
    requireAuthorization?: boolean;

    // Specifies whether this profile will be automatically connected if any
    // other profile of device also exporting this profile connects to the host.
    autoConnect?: boolean;

    // Specifies the implemented version of the profile.
    version?: number;

    // Specifies the profile-specific bit field of features the implementation
    // supports.
    features?: number;
  }

  export interface Device {
    // The address of the device, in the format 'XX:XX:XX:XX:XX:XX'.
    address: string;

    // The human-readable name of the device.
    name?: string;

    // Indicates whether or not the device is paired with the system.
    paired?: boolean;

    // Indicates whether the device is currently connected to the system.
    connected?: boolean;
  }

  // Options for the getProfiles function.
  export interface GetProfilesOptions {
    // The remote Bluetooth device to retrieve the exported profiles list from.
    device: Device;
  }

  // Options for the write function.
  export interface WriteOptions {
    // The socket to write to.
    socket: Socket;

    // The data to write.
    data: ArrayBuffer;
  }

  export interface Socket {
    // The remote Bluetooth device associated with this socket.
    device: Device;

    // The remote Bluetooth profile associated with this socket.
    profile: Profile ;

    // An identifier for this socket that should be used with the
    // read/write/disconnect methods.
    id: number;
  }

  interface AdapterStateCallback { (result: AdapterState): void; }
  interface AddressCallback { (result: string): void; }
  interface BooleanCallback { (result: boolean): void }
  interface DataCallback { (result?: ArrayBuffer): void; }
  interface DeviceCallback { (device: Device): void; }
  interface DevicesCallback { (result: Device[]): void; }
  interface NameCallback { (result: string): void; }
  interface OutOfBandPairingDataCallback { (data: OutOfBandPairingData): void; }
  interface ProfilesCallback { (result: Profile[]): void; }
  interface ResultCallback { (): void; }
  interface ServicesCallback { (result: ServiceRecord[]): void; }
  interface SizeCallback { (result: number): void; }
  interface SocketCallback { (result: Socket): void; }

  export interface ReadOptions {
    socket: Socket;
  }

  // Options for the disconnect function.
  export interface DisconnectOptions {
    // The socket to disconnect.
    socket: Socket;
  }

  // Options for the getDevices function. If |profile| is not provided, all
  // devices known to the system are returned.
  export interface GetDevicesOptions {
    // Only devices providing |profile| will be returned.
    profile?: Profile;

    // Called for each matching device.  Note that a service discovery request
    // must be made to each non-matching device before it can be definitively
    // excluded.  This can take some time.
    deviceCallback: DeviceCallback;
  }

  // Options for the getServices function.
  export interface GetServicesOptions {
    // The address of the device to inquire about. |deviceAddress| should be
    // in the format 'XX:XX:XX:XX:XX:XX'.
    deviceAddress: string;
  }


  // Options for the connect function.
  export interface ConnectOptions {
    // The connection is made to |device|.
    device: Device;

    // The connection is made to |profile|.
    profile: Profile;
  }

  export interface Bluetooth {
    addProfile(profile: Profile, callback: ResultCallback): void;
    removeProfile(profile: Profile, callback: ResultCallback): void;

    getAdapterState(callback: AdapterStateCallback): void;
    getDevices(options: GetDevicesOptions, callback: ResultCallback): any;
    getProfiles(options: GetProfilesOptions, callback: ProfilesCallback): void;
    getServices(options: GetServicesOptions, callback: ServicesCallback): void;

    connect(options: ConnectOptions, callback : ResultCallback): any;
    disconnect(options: DisconnectOptions, callback?: ResultCallback): any;
    read(options: ReadOptions, callback: DataCallback): void;
    write(options: WriteOptions, callback: SizeCallback): void;

    onConnection: ChromeEvent<Socket>;
    onAdapterStateChanged: ChromeEvent<AdapterState>;
  }
}
