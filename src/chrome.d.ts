interface Chrome {
  runtime: Runtime;
  fileSystem: any;
  bluetooth: Bluetooth.Bluetooth;
  bluetoothSocket: BluetoothSocket.BluetoothSocket;
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
  // Allocation authorities for Vendor IDs.
  export enum VendorIdSource { bluetooth, usb }

  // Common device types recognized by Chrome.
  export enum DeviceType {
    computer, phone, modem, audio, carAudio, video, peripheral,
    joystick, gamepad, keyboard, mouse, tablet,
    keyboardMouseCombo
  }

  export interface AdapterState {
    // The address of the adapter, in the format 'XX:XX:XX:XX:XX:XX'.
    address: string;

    // The human-readable name of the adapter.
    name: string;

    // Indicates whether or not the adapter has power.
    powered: boolean;

    // Indicates whether or not the adapter is available (i.e. enabled).
    available: boolean;

    // Indicates whether or not the adapter is currently discovering.
    discovering: boolean;
  }

  export interface Device {
    // The address of the device, in the format 'XX:XX:XX:XX:XX:XX'.
    address: string;

    // The human-readable name of the device.
    name?: string;

    // The class of the device, a bit-field defined by
    // http://www.bluetooth.org/en-us/specification/assigned-numbers/baseband.
    deviceClass?: number;

    // The Device ID record of the device, where available.
    vendorIdSource?: VendorIdSource;
    vendorId?: number;
    productId?: number;
    deviceId?: number;

    // The type of the device, if recognized by Chrome. This is obtained from
    // the |deviceClass| field and only represents a small fraction of the
    // possible device types. When in doubt you should use the |deviceClass|
    // field directly.
    type?: DeviceType;

    // Indicates whether or not the device is paired with the system.
    paired?: boolean;

    // Indicates whether the device is currently connected to the system.
    connected?: boolean;

    // Indicates the RSSI ("received signal strength indication") of the
    // connection to the device, measured in dBm, to a resolution of 1dBm.
    // If the device is currently connected, then measures the RSSI of the
    // connection signal. Otherwise, measures the RSSI of the last inquiry sent
    // to the device, where available. Absent if unavailable.
    rssi?: number;

    // Indicates the host's current transmit power ("Tx power") for the
    // connection to the device, measured in dBm, to a resolution of 1dBm.
    // This value is only available if the device is currently connected.
    currentHostTransmitPower?: number;

    // Indicates the host's maximum transmit power ("Tx power") for the
    // connection to the device, measured in dBm, to a resolution of 1dBm.
    // This value is only available if the device is currently connected.
    maximumHostTransmitPower?: number;

    // UUIDs of protocols, profiles and services advertised by the device.
    // For classic Bluetooth devices, this list is obtained from EIR data and
    // SDP tables. For Low Energy devices, this list is obtained from AD and
    // GATT primary services. For dual mode devices this may be obtained from
    // both.
    uuids?: string[];
  }

  interface AdapterStateCallback { (result: AdapterState): void; }

  interface GetDeviceCallback { (result: Device): void; }
  interface GetDevicesCallback { (result: Device[]): void; }

  // Callback from the <code>startDiscovery</code> method.
  interface StartDiscoveryCallback { void(); }

  // Callback from the <code>stopDiscovery</code> method.
  interface StopDiscoveryCallback { void(); }

  export interface Bluetooth {
    // Get information about the Bluetooth adapter.
    // |callback| : Called with an AdapterState object describing the adapter
    //              state.
    getAdapterState(callback: AdapterStateCallback): void;

    // Get information about a Bluetooth device known to the system.
    // |deviceAddress| : Address of device to get.
    // |callback| : Called with the Device object describing the device.
    getDevice(deviceAddress: string, callback: GetDeviceCallback): void;

    // Get a list of Bluetooth devices known to the system, including paired
    // and recently discovered devices.
    // |callback| : Called when the search is completed.
    getDevices(callback: GetDevicesCallback): void;

    // Start discovery. Newly discovered devices will be returned via the
    // onDeviceAdded event. Previously discovered devices already known to
    // the adapter must be obtained using getDevices and will only be updated
    // using the |onDeviceChanged| event if information about them changes.
    //
    // Discovery will fail to start if this application has already called
    // startDiscovery.  Discovery can be resource intensive: stopDiscovery
    // should be called as soon as possible.
    // |callback| : Called to indicate success or failure.
    startDiscovery(callback?: StartDiscoveryCallback): void;

    // Stop discovery.
    // |callback| : Called to indicate success or failure.
    stopDiscovery(callback?: StopDiscoveryCallback): void;

    // Fired when the state of the Bluetooth adapter changes.
    // |state| : The new state of the adapter.
    onAdapterStateChanged: ChromeEvent<AdapterState>;

    // Fired when information about a new Bluetooth device is available.
    onDeviceAdded: ChromeEvent<Device>;

    // Fired when information about a known Bluetooth device has changed.
    onDeviceChanged: ChromeEvent<Device>;

    // Fired when a Bluetooth device that was previously discovered has been
    // out of range for long enough to be considered unavailable again, and
    // when a paired device is removed.
    onDeviceRemoved: ChromeEvent<Device>;
  }
}

declare module BluetoothSocket {

  // The socket properties specified in the $ref:create or $ref:update
  // function. Each property is optional. If a property value is not specified,
  // a default value is used when calling $ref:create, or the existing value is
  // preserved when calling $ref:update.
  interface SocketProperties {
    // Flag indicating whether the socket is left open when the event page of
    // the application is unloaded (see <a
    // href="http://developer.chrome.com/apps/app_lifecycle.html">Manage App
    // Lifecycle</a>). The default value is <code>false.</code> When the
    // application is loaded, any sockets previously opened with persistent=true
    // can be fetched with $ref:getSockets.
    persistent?: boolean;

    // An application-defined string associated with the socket.
    name?: string;

    // The size of the buffer used to receive data. The default value is 4096.
    bufferSize?: number;
  }

  // Result of <code>create</code> call.
  interface CreateInfo {
    // The ID of the newly created socket. Note that socket IDs created
    // from this API are not compatible with socket IDs created from other APIs,
    // such as the <code>$(ref:sockets.tcp)</code> API.
    socketId: number;
  }

  // Callback from the <code>create</code> method.
  // |createInfo| : The result of the socket creation.
  interface CreateCallback { (createInfo: CreateInfo): void; }

  // Callback from the <code>update</code> method.
  interface UpdateCallback { (): void; }

  // Callback from the <code>setPaused</code> method.
  interface SetPausedCallback { (): void; }

  // Callback from the <code>listenUsingRfcomm</code>,
  // <code>listenUsingInsecureRfcomm</code> and
  // <code>listenUsingL2cap</code> methods.
  interface ListenCallback { (): void; }

  // Callback from the <code>connect</code> method.
  interface ConnectCallback { (): void;}

  // Callback from the <code>disconnect</code> method.
  interface DisconnectCallback { (): void;}

  // Callback from the <code>close</code> method.
  interface CloseCallback { (): void;}

  // Callback from the <code>send</code> method.
  // |bytesSent| : The number of bytes sent.
  interface SendCallback { (bytesSent: number): void}


  // Result of the <code>getInfo</code> method.
  interface SocketInfo {
    // The socket identifier.
    socketId: number;

    // Flag indicating if the socket remains open when the event page of the
    // application is unloaded (see <code>SocketProperties.persistent</code>).
    // The default value is "false".
    persistent: boolean;

    // Application-defined string associated with the socket.
    name?: string;

    // The size of the buffer used to receive data. If no buffer size has been
    // specified explictly, the value is not provided.
    bufferSize?: number;

    // Flag indicating whether a connected socket blocks its peer from sending
    // more data, or whether connection requests on a listening socket are
    // dispatched through the <code>onAccept</code> event or queued up in the
    // listen queue backlog.
    // See <code>setPaused</code>. The default value is "false".
    paused: boolean;

    // Flag indicating whether the socket is connected to a remote peer.
    connected: boolean;

    // If the underlying socket is connected, contains the Bluetooth address of
    // the device it is connected to.
    address?: string;

    // If the underlying socket is connected, contains information about the
    // service UUID it is connected to, otherwise if the underlying socket is
    // listening, contains information about the service UUID it is listening
    // on.
    uuid?: string;
  }

  // Callback from the <code>getInfo</code> method.
  // |socketInfo| : Object containing the socket information.
  interface GetInfoCallback { (socketInfo: SocketInfo ): void}

  // Callback from the <code>getSockets</code> method.
  // |socketInfos| : Array of object containing socket information.
  interface GetSocketsCallback { (sockets: SocketInfo[]): void}

  // Data from an <code>onAccept</code> event.
  interface AcceptInfo {
    // The server socket identifier.
    socketId: number;

    // The client socket identifier, i.e. the socket identifier of the newly
    // established connection. This socket identifier should be used only with
    // functions from the <code>chrome.bluetoothSocket</code> namespace. Note
    // the client socket is initially paused and must be explictly un-paused by
    // the application to start receiving data.
    clientSocketId: number;
  }

  enum AcceptError {
    // A system error occurred and the connection may be unrecoverable.
    system_error,

    // The socket is not listening.
    not_listening
  }

  // Data from an <code>onAcceptError</code> event.
  interface AcceptErrorInfo {
    // The server socket identifier.
    socketId: number;

    // The error message.
    errorMessage: string;

    // An error code indicating what went wrong.
    error: AcceptError;
  }

  // Data from an <code>onReceive</code> event.
  interface ReceiveInfo {
    // The socket identifier.
    socketId: number;

    // The data received, with a maxium size of <code>bufferSize</code>.
    data: ArrayBuffer;
  }

  enum ReceiveError {
    // The connection was disconnected.
    disconnected,

    // A system error occurred and the connection may be unrecoverable.
    system_error,

    // The socket has not been connected.
    not_connected
  }

  // Data from an <code>onReceiveError</code> event.
  interface ReceiveErrorInfo {
    // The socket identifier.
    socketId: number;

    // The error message.
    errorMessage: string;

    // An error code indicating what went wrong.
    error: ReceiveError;
  }

  export interface BluetoothSocket {
    // Creates a Bluetooth socket.
    // |properties| : The socket properties (optional).
    // |callback| : Called when the socket has been created.
    create(properties?: SocketProperties, callback?: CreateCallback): void;

    // Updates the socket properties.
    // |socketId| : The socket identifier.
    // |properties| : The properties to update.
    // |callback| : Called when the properties are updated.
    update(socketId: number, properties: SocketProperties, callback?: UpdateCallback): void;

    // Enables or disables a connected socket from receiving messages from its
    // peer, or a listening socket from accepting new connections. The default
    // value is "false". Pausing a connected socket is typically used by an
    // application to throttle data sent by its peer. When a connected socket
    // is paused, no <code>onReceive</code>event is raised. When a socket is
    // connected and un-paused, <code>onReceive</code> events are raised again
    // when messages are received. When a listening socket is paused, new
    // connections are accepted until its backlog is full then additional
    // connection requests are refused. <code>onAccept</code> events are raised
    // only when the socket is un-paused.
    setPaused(socketId: number, paused: boolean, callback?: SetPausedCallback): void;

    // Listen for connections using the RFCOMM protocol.
    // |socketId| : The socket identifier.
    // |uuid| : Service UUID to listen on.
    // |channel| : RFCOMM channel id to listen on. Zero may be specified to
    // allocate an unused channel.
    // |backlog| : Length of the socket's listen queue. The default value
    // depends on the operating system's host subsystem.
    // |callback| : Called when listen operation completes.
    listenUsingRfcomm(socketId: number, uuid: string, channel: number, backlog?: number,callbacl?: ListenCallback): void;

    // Listens for connections from Bluetooth 1.0 and 2.0 devices using the
    // RFCOMM protocol without requiring encryption or authentication on the
    // socket.
    // |socketId| : The socket identifier.
    // |uuid| : Service UUID to listen on.
    // |channel| : RFCOMM channel id to listen on. Zero may be specified to
    // allocate an unused channel.
    // |backlog| : Length of the socket's listen queue. The default value
    // depends on the operating system's host subsystem.
    // |callback| : Called when listen operation completes.
    listenUsingInsecureRfcomm(socketId: number, uuid: string, channel: number, backlog?: number, callback?: ListenCallback): void;

    // Listen for connections using the L2CAP protocol.
    // |socketId| : The socket identifier.
    // |uuid| : Service UUID to listen on.
    // |psm| : L2CAP PSM to listen on. Zero may be specified to allocate an
    // unused PSM.
    // |backlog| : Length of the socket's listen queue. The default value
    // depends on the operating system's host subsystem.
    // |callback| : Called when listen operation completes.
    listenUsingL2cap(socketId: number, uuid: string, psm: number, backlog?: number, callback?: ListenCallback): void;

    // Connects the socket to a remote Bluetooth device. When the
    // <code>connect</code> operation completes successfully,
    // <code>onReceive</code> events are raised when data is received from the
    // peer. If a network error occur while the runtime is receiving packets,
    // a <code>onReceiveError</code> event is raised, at which point no more
    // <code>onReceive</code> event will be raised for this socket until the
    // <code>setPaused(false)</code> method is called.
    // |socketId| : The socket identifier.
    // |address| : The address of the Bluetooth device.
    // |uuid| : The UUID of the service to connect to.
    // |callback| : Called when the connect attempt is complete.
    connect(socketId: number, address: string, uuid: string, callback: ConnectCallback): void;

    // Disconnects the socket. The socket identifier remains valid.
    // |socketId| : The socket identifier.
    // |callback| : Called when the disconnect attempt is complete.
    disconnect(socketId: number, callback?: DisconnectCallback): void;

    // Disconnects and destroys the socket. Each socket created should be
    // closed after use. The socket id is no longer valid as soon at the
    // function is called. However, the socket is guaranteed to be closed only
    // when the callback is invoked.
    // |socketId| : The socket identifier.
    // |callback| : Called when the <code>close</code> operation completes.
    close(socketId: number, callback?: CloseCallback): void;

    // Sends data on the given Bluetooth socket.
    // |socketId| : The socket identifier.
    // |data| : The data to send.
    // |callback| : Called with the number of bytes sent.
    send(socketId: number, data: ArrayBuffer, callback?: SendCallback): void;

    // Retrieves the state of the given socket.
    // |socketId| : The socket identifier.
    // |callback| : Called when the socket state is available.
    getInfo(socketId: number, callback: GetInfoCallback): void;

    // Retrieves the list of currently opened sockets owned by the application.
    // |callback| : Called when the list of sockets is available.
    getSockets(callback: GetSocketsCallback ): void;

    // Event raised when a connection has been established for a given socket.
    // |info| : The event data.
    onAccept: ChromeEvent<AcceptInfo>;

    // Event raised when a network error occurred while the runtime was waiting
    // for new connections on the given socket. Once this event is raised, the
    // socket is set to <code>paused</code> and no more <code>onAccept</code>
    // events are raised for this socket.
    // |info| : The event data.
    onAcceptError: ChromeEvent<AcceptErrorInfo>;

    // Event raised when data has been received for a given socket.
    // |info| : The event data.
    onReceive: ChromeEvent<ReceiveInfo>;

    // Event raised when a network error occured while the runtime was waiting
    // for data on the socket. Once this event is raised, the socket is set to
    // <code>paused</code> and no more <code>onReceive</code> events are raised
    // for this socket.
    // |info| : The event data.
    onReceiveError: ChromeEvent<ReceiveErrorInfo>;
  }
}
