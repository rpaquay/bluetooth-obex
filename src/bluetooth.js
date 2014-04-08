/// <reference path="chrome.d.ts"/>
/// <reference path="obex.ts"/>
var Bluetooth;
(function (Bluetooth) {
    var RequestProcessor = (function () {
        function RequestProcessor(socket) {
            var _this = this;
            this._parser = new Obex.PacketParser();
            this._errorMessage = "";
            this._responseCallbacks = [];
            this._socket = socket;
            this._parser.setHandler(function (packet) {
                return _this.onResponse(packet);
            });
            this._listener1 = function (info) {
                return _this.onSocketReceive(info);
            };
            this._listener2 = function (info) {
                return _this.onSocketReceiveError(info);
            };
            chrome.bluetooth.onReceive.addListener(this._listener1);
            chrome.bluetooth.onReceiveError.addListener(this._listener2);
            chrome.bluetooth.setSocketPaused(socket.id, false);
        }
        Object.defineProperty(RequestProcessor.prototype, "errorMessage", {
            get: function () {
                return this._errorMessage;
            },
            enumerable: true,
            configurable: true
        });

        RequestProcessor.prototype.setError = function (value) {
            console.log(value);
            this._errorMessage = value;
            if (this._errorHandler)
                this._errorHandler();
        };

        RequestProcessor.prototype.setErrorHandler = function (handler) {
            this._errorHandler = handler;
        };

        RequestProcessor.prototype.sendRequest = function (request, responseCallback) {
            var _this = this;
            this._errorMessage = "";

            var stream = new Obex.ByteStream();
            request.serialize(stream);
            var buffer = stream.toArrayBuffer();

            //Obex.dumpArrayBuffer(buffer);
            this._responseCallbacks.push(responseCallback);
            chrome.bluetooth.send(this._socket.id, buffer, function (result) {
                if (chrome.runtime.lastError) {
                    _this.setError("Error sending packet to peer: " + chrome.runtime.lastError.message);
                    return;
                }

                if (result != buffer.byteLength) {
                    _this.setError("Error sending packet to peer: Could not send all bytes.");
                    return;
                }
            });
        };

        RequestProcessor.prototype.onResponse = function (packet) {
            if (this._responseCallbacks.length == 0) {
                this.setError("Callback array is empty.");
            }
            var callback = this._responseCallbacks.shift();
            callback(packet);
        };

        RequestProcessor.prototype.onSocketReceive = function (info) {
            if (info.socketId !== this._socket.id)
                return;
            this._parser.addData(new Obex.ByteArrayView(info.data));
        };

        RequestProcessor.prototype.onSocketReceiveError = function (info) {
            if (info.socketId !== this._socket.id)
                return;
            this.setError("Error reading packet from peer: " + info.errorMessage);
            chrome.bluetooth.onReceive.removeListener(this._listener1);
            chrome.bluetooth.onReceiveError.removeListener(this._listener2);
        };
        return RequestProcessor;
    })();
    Bluetooth.RequestProcessor = RequestProcessor;

    var SendFileProcessor = (function () {
        function SendFileProcessor(_processor, _name, _contents) {
            var _this = this;
            this._processor = _processor;
            this._name = _name;
            this._contents = _contents;
            this._offset = 0;
            this._packetSize = 0x2000;
            this._view = new Obex.ByteArrayView(_contents);
            _processor.setErrorHandler(function () {
                _this._errorHandler(_this._processor.errorMessage);
            });
        }
        Object.defineProperty(SendFileProcessor.prototype, "fileOffset", {
            get: function () {
                return this._offset;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(SendFileProcessor.prototype, "fileLength", {
            get: function () {
                return this._view.byteLength;
            },
            enumerable: true,
            configurable: true
        });

        SendFileProcessor.prototype.setErrorHandler = function (handler) {
            this._errorHandler = handler;
        };

        SendFileProcessor.prototype.sendNextRequest = function (callback) {
            var _this = this;
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

            this._processor.sendRequest(request, function (response) {
                if (response.opCode == 32 /* Success */ || response.opCode == 16 /* Continue */) {
                    _this._offset += packetLength;
                    callback(isFinalRequest); // Note: Must be last call of function
                    return;
                } else {
                    var message = "Response error: " + response.code.toString(16);
                    _this._errorHandler(message);
                }
            });
        };
        return SendFileProcessor;
    })();
    Bluetooth.SendFileProcessor = SendFileProcessor;

    var BluetoothConnectionDispatcher = (function () {
        function BluetoothConnectionDispatcher() {
            var _this = this;
            this._handers = new Core.StringMap();
            this._listener = function (socket) {
                return _this.onConnection(socket);
            };
            chrome.bluetooth.onConnection.addListener(this._listener);
        }
        // Add a "onConnect" handler for a given device and profile.
        BluetoothConnectionDispatcher.prototype.setHandler = function (device, profile, handler) {
            var key = this.buildKey(device, profile.uuid);
            this._handers.set(key, handler);
        };

        BluetoothConnectionDispatcher.prototype.buildKey = function (device, uuid) {
            return "<" + device.address.toLowerCase() + ">" + "<" + uuid.toLowerCase() + ">";
        };

        BluetoothConnectionDispatcher.prototype.onConnection = function (socket) {
            try  {
                console.log("OnConnection: socket id=" + socket.id + ", device name=" + socket.device.name + ", profile id=" + socket.uuid);
                var key = this.buildKey(socket.device, socket.uuid);
                var handler = this._handers.get(key);
                if (typeof handler === "undefined") {
                    console.log("No handler registered for given device/profile.");
                    return;
                }

                handler(socket);
            } catch (e) {
                console.error(e);
                throw e;
            }
        };
        return BluetoothConnectionDispatcher;
    })();
    Bluetooth.BluetoothConnectionDispatcher = BluetoothConnectionDispatcher;
    Bluetooth.connectionDispatcher = new BluetoothConnectionDispatcher();
})(Bluetooth || (Bluetooth = {}));
//# sourceMappingURL=bluetooth.js.map
