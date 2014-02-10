/// <reference path="chrome.d.ts"/>
/// <reference path="obex.ts"/>
var Bluetooth;
(function (Bluetooth) {
    var RequestProcessor = (function () {
        function RequestProcessor(socket) {
            this._parser = new Obex.PacketParser();
            this._errorMessage = "";
            this._socket = socket;
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
            Obex.dumpArrayBuffer(buffer);

            chrome.bluetooth.write({ socket: this._socket, data: buffer }, function (result) {
                if (chrome.runtime.lastError) {
                    _this.setError("Error sending packet to peer: " + chrome.runtime.lastError.message);
                    return;
                }

                if (result != buffer.byteLength) {
                    _this.setError("Error sending packet to peer: Could not send all bytes.");
                    return;
                }

                _this.readResponse(responseCallback);
            });
        };

        RequestProcessor.prototype.readResponse = function (responseCallback) {
            var _this = this;
            var responseProcessed = false;
            var responseHandler = function (packet) {
                console.log("Packet received!");
                responseCallback(packet);
                responseProcessed = true;
            };

            var readCallback = function (data) {
                _this._parser.addData(new Obex.ByteArrayView(data));
                if (responseProcessed)
                    return;
                _this.readPoll(readCallback);
            };

            this._parser.setHandler(responseHandler);
            this.readPoll(readCallback);
        };

        RequestProcessor.prototype.readPoll = function (callback) {
            var _this = this;
            chrome.bluetooth.read({ socket: this._socket }, function (result) {
                if (chrome.runtime.lastError) {
                    _this.setError("Error reading packet from peer: " + chrome.runtime.lastError.message);
                    return;
                }

                if (result.byteLength === 0) {
                    console.log("Nothing received from peer. Polling again in 1000 ms.");
                    window.setTimeout(function () {
                        return _this.readPoll(callback);
                    }, 1000);
                    return;
                }

                console.log("Received data from peer.");
                callback(result);
            });
        };
        return RequestProcessor;
    })();
    Bluetooth.RequestProcessor = RequestProcessor;

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
            var key = this.buildKey(device, profile);
            this._handers.set(key, handler);
        };

        BluetoothConnectionDispatcher.prototype.buildKey = function (device, profile) {
            return "<" + device.address.toLowerCase() + ">" + "<" + profile.uuid.toLowerCase() + ">";
        };

        BluetoothConnectionDispatcher.prototype.onConnection = function (socket) {
            try  {
                console.log("OnConnection: socket id=" + socket.id + ", device name=" + socket.device.name + ", profile id=" + socket.profile.uuid);
                var key = this.buildKey(socket.device, socket.profile);
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
