/// <reference path="chrome.d.ts"/>
/// <reference path="obex.ts"/>

module Bluetooth {
  export class RequestProcessor {
    private _socket: Bluetooth.Socket;
    private _parser = new Obex.PacketParser();
    private _errorHandler: () => void;
    private _errorMessage = "";

    public constructor(socket: Bluetooth.Socket) {
      this._socket = socket;
    }

    public get errorMessage(): string { return this._errorMessage; }

    private setError(value: string): void {
      console.log(value)
    this._errorMessage = value;
      if (this._errorHandler)
        this._errorHandler();
    }

    public setErrorHandler(handler: () => void) {
      this._errorHandler = handler;
    }

    public sendRequest(request: Obex.RequestBuilder, responseCallback: (response: Obex.Packet) => void) {
      this._errorMessage = "";

      var stream = new Obex.ByteStream();
      request.serialize(stream);
      var buffer = stream.toArrayBuffer();
      Obex.dumpArrayBuffer(buffer);

      chrome.bluetooth.write({ socket: this._socket, data: buffer }, (result: number) => {
        if (chrome.runtime.lastError) {
          this.setError("Error sending packet to peer: " + chrome.runtime.lastError.message);
          return;
        }

        if (result != buffer.byteLength) {
          this.setError("Error sending packet to peer: Could not send all bytes.");
          return;
        }

        this.readResponse(responseCallback);
      });
    }

    private readResponse(responseCallback: (response: Obex.Packet) => void) {
      var responseProcessed = false;
      var responseHandler = packet => {
        console.log("Packet received!");
        responseCallback(packet);
        responseProcessed = true;
      };

      var readCallback = (data: ArrayBuffer) => {
        this._parser.addData(new Obex.ByteArrayView(data));
        if (responseProcessed)
          return;
        this.readPoll(readCallback);
      };

      this._parser.setHandler(responseHandler);
      this.readPoll(readCallback);
    }

    private readPoll(callback: (result: ArrayBuffer) => void) {
      chrome.bluetooth.read({ socket: this._socket }, (result?: ArrayBuffer) => {
        if (chrome.runtime.lastError) {
          this.setError("Error reading packet from peer: " + chrome.runtime.lastError.message);
          return;
        }

        if (result.byteLength === 0) {
          console.log("Nothing received from peer. Polling again in 1000 ms.");
          window.setTimeout(() => this.readPoll(callback), 1000);
          return;
        }

        console.log("Received data from peer.")
      callback(result);
      });
    }
  }

  export interface BluetoothConnectionHandler {
    (socket: Bluetooth.Socket): void;
  }

  export class BluetoothConnectionDispatcher {
    private _handers = new Core.StringMap<BluetoothConnectionHandler>();
    private _listener: BluetoothConnectionHandler;

    public constructor() {
      this._listener = (socket: Bluetooth.Socket) => this.onConnection(socket);
      chrome.bluetooth.onConnection.addListener(this._listener);
    }

    // Add a "onConnect" handler for a given device and profile.
    public setHandler(device: Bluetooth.Device, profile: Bluetooth.Profile, handler: BluetoothConnectionHandler): void {
      var key = this.buildKey(device, profile);
      this._handers.set(key, handler);
    }

    private buildKey(device: Bluetooth.Device, profile: Bluetooth.Profile): string {
      return "<" + device.address.toLowerCase() + ">" +
        "<" + profile.uuid.toLowerCase() + ">";
    }

    private onConnection(socket: Bluetooth.Socket): void {
      try {
        console.log("OnConnection: socket id=" + socket.id + ", device name=" + socket.device.name + ", profile id=" + socket.profile.uuid);
        var key = this.buildKey(socket.device, socket.profile);
        var handler = this._handers.get(key);
        if (typeof handler === "undefined") {
          console.log("No handler registered for given device/profile.");
          return;
        }

        handler(socket);
      }
      catch (e) {
        console.error(e);
        throw e;
      }
    }
  }
  export var connectionDispatcher = new BluetoothConnectionDispatcher();
}
