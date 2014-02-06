interface Chrome {
  bluetooth: Bluetooth.Bluetooth;
  runtime: Runtime;
}

interface Runtime {
  lastError: any;
}

declare module Bluetooth {
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
    name?: string;
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

  export interface ReadOptions {
    socket: Socket;
  }

  // Options for the disconnect function.
  export interface DisconnectOptions {
    // The socket to disconnect.
    socket: Socket;
  }

  export interface Bluetooth {
    getProfiles(options: GetProfilesOptions, result: (profiles: Profile[]) => void);
    addProfile(...argArray: any[]): any;
    removeProfile(...argArray: any[]): any;
    getDevices(...argArray: any[]): any;
    getServices(...argArray: any[]): any;
    getAdapterState(...argArray: any[]): any;
    connect(...argArray: any[]): any;
    disconnect(options: DisconnectOptions, result?: () => void): any;
    write(options: WriteOptions, result: (result: number) => void): void;
    read(options: ReadOptions, result: (result?: ArrayBuffer) => void): void;
    onConnection: any;
    onAdapterStateChanged: any;
  }
}

declare var chrome: Chrome;
