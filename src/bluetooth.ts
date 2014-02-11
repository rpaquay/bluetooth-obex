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
      console.log(value);
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
      //Obex.dumpArrayBuffer(buffer);

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
          //console.log("Nothing received from peer. Polling again in 1000 ms.");
          window.setTimeout(() => this.readPoll(callback), 10);
          return;
        }

        console.log("Received data from peer.");
        callback(result);
      });
    }
  }

  export class SendFileProcessor {
    private _offset = 0;
    private _view: Obex.ByteArrayView;
    private _packetSize = 0x2000;
    private _errorHandler: (message: string) => void;

    constructor(private _processor: Bluetooth.RequestProcessor, private _name: string, private _contents: ArrayBuffer) {
      this._view = new Obex.ByteArrayView(_contents);
      _processor.setErrorHandler(() => {
        this._errorHandler(this._processor.errorMessage);
      });
    }

    public get fileOffset(): number { return this._offset; }
    public get fileLength(): number { return this._view.byteLength; }

    public setErrorHandler(handler: (message: string) => void): void {
      this._errorHandler = handler;
    }

    public sendNextRequest(callback: (finished: boolean) => void): void {
      if (this._offset >= this._contents.byteLength)
        callback(true);

      var isFirstRequest = (this._offset === 0);
      var remainingLength = (this._view.byteLength - this._offset);
      var isFinalRequest = (remainingLength <= this._packetSize);

      var request = new Obex.PutRequestBuilder();
      request.name = this._name;
      if (isFirstRequest)
        request.length = this._view.byteLength;
      if (isFinalRequest)
        request.isFinal = true;
      var packetLength = Math.min(remainingLength, this._packetSize);
      var view = this._view.subarray(this._offset, this._offset + packetLength);
      if (isFinalRequest)
        request.endOfbody = view;
      else
        request.body = view;

      this._processor.sendRequest(request, (response) => {
        if (response.opCode == Obex.ResponseOpCode.Success || response.opCode == Obex.ResponseOpCode.Continue) {
          this._offset += packetLength;
          callback(isFinalRequest); // Note: Must be last call of function
          return;
        }
        else {
          var message = "Response error: " + response.code.toString(16);
          this._errorHandler(message);
        }
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
