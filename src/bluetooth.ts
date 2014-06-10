/// <reference path="chrome.d.ts"/>
/// <reference path="obex.ts"/>

module Bluetooth {
  interface ResponseCallback {
    (response: Obex.Packet): void
  }

  export class RequestProcessor {
    private _socketId: number;
    private _parser = new Obex.PacketParser();
    private _errorHandler: () => void;
    private _errorMessage = "";
    private _responseCallbacks: ResponseCallback[] = [];
    private _listener1: any;
    private _listener2: any;

    constructor(socketId: number) {
      this._socketId = socketId;
      this._parser.setHandler(packet => this.onResponse(packet));
      this._listener1 = (info: BluetoothSocket.ReceiveInfo) => this.onSocketReceive(info);
      this._listener2 = (info: BluetoothSocket.ReceiveErrorInfo) => this.onSocketReceiveError(info);
      chrome.bluetoothSocket.onReceive.addListener(this._listener1);
      chrome.bluetoothSocket.onReceiveError.addListener(this._listener2);
      chrome.bluetoothSocket.setPaused(this._socketId, false);
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

      this._responseCallbacks.push(responseCallback);
      chrome.bluetoothSocket.send(this._socketId, buffer, (result: number) => {
        if (chrome.runtime.lastError) {
          this.setError("Error sending packet to peer: " + chrome.runtime.lastError.message);
          return;
        }

        if (result != buffer.byteLength) {
          this.setError("Error sending packet to peer: Could not send all bytes.");
          return;
        }
      });
    }

    private onResponse(packet: Obex.Packet): void {
      if (this._responseCallbacks.length == 0) {
        this.setError("Callback array is empty.");
      }
      var callback = this._responseCallbacks.shift();
      callback(packet);
    }

    private onSocketReceive(info: BluetoothSocket.ReceiveInfo) {
      if (info.socketId !== this._socketId)
        return;
      this._parser.addData(new Obex.ByteArrayView(info.data));
    }

    private onSocketReceiveError(info: BluetoothSocket.ReceiveErrorInfo) {
      if (info.socketId !== this._socketId)
        return;
      this.setError("Error reading packet from peer: " + info.errorMessage);
      chrome.bluetoothSocket.onReceive.removeListener(this._listener1);
      chrome.bluetoothSocket.onReceiveError.removeListener(this._listener2);
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
}
