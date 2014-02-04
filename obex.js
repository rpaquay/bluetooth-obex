// Obex component: Obex is a transport protocol conceptually similar to HTTP.
// It is a request/response message protocol where each request/response
// message is a set of headers followed by a body.
(function (Obex) {
    var ByteStream = (function () {
        function ByteStream() {
            this._offset = 0;
            this._bytes = new Uint8Array(16000);
        }
        Object.defineProperty(ByteStream.prototype, "offset", {
            get: function () {
                return this._offset;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ByteStream.prototype, "length", {
            get: function () {
                return this._offset;
            },
            enumerable: true,
            configurable: true
        });

        ByteStream.prototype.update8 = function (offset, value) {
            if (value < 0 || value > 255)
                throw new Error("Value must be between 0 and 255.");
            if (offset < 0 || offset > this._offset)
                throw new Error("Offset must be between 0 and " + this._offset + ".");

            this._bytes.set(offset, value);
        };

        ByteStream.prototype.add8 = function (value) {
            this.update8(this._offset, value);
            this._offset++;
        };

        ByteStream.prototype.add16 = function (value) {
            if (value < 0 || value > 65535)
                throw new Error("Value must be between 0 and 65535.");

            this.add8((value & 0xff00) >> 8);
            this.add8((value & 0x00ff));
        };

        ByteStream.prototype.update16 = function (offset, value) {
            if (value < 0 || value > 65535)
                throw new Error("Value must be between 0 and 65535.");

            this.update8(offset, (value & 0xff00) >> 8);
            this.update8(offset + 1, (value & 0x00ff));
        };

        ByteStream.prototype.toBuffer = function () {
            var size = this._offset;
            var view = new Uint8Array(this._bytes.buffer, 0, size);
            var result = new Uint8Array(size);
            result.set(view, 0);
            return result.buffer;
        };
        return ByteStream;
    })();
    Obex.ByteStream = ByteStream;

    // Headers identifers (and hepler functions)
    var HeaderIdentifier = (function () {
        function HeaderIdentifier(value) {
            this.value = value;
        }
        Object.defineProperty(HeaderIdentifier.prototype, "valueKind", {
            get: function () {
                return (this.value & 0xc0);
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(HeaderIdentifier.prototype, "isUnicode", {
            get: function () {
                return this.valueKind === 0 /* Unicode */;
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(HeaderIdentifier.prototype, "isByteSequence", {
            get: function () {
                return this.valueKind === 64 /* ByteSequence */;
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(HeaderIdentifier.prototype, "isInt8", {
            get: function () {
                return this.valueKind === 128 /* Int8 */;
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(HeaderIdentifier.prototype, "isInt32", {
            get: function () {
                return this.valueKind === 192 /* Int32 */;
            },
            enumerable: true,
            configurable: true
        });
        return HeaderIdentifier;
    })();
    Obex.HeaderIdentifier = HeaderIdentifier;

    (function (HeaderValueKind) {
        HeaderValueKind[HeaderValueKind["Unicode"] = 0x00] = "Unicode";
        HeaderValueKind[HeaderValueKind["ByteSequence"] = 0x40] = "ByteSequence";
        HeaderValueKind[HeaderValueKind["Int8"] = 0x80] = "Int8";
        HeaderValueKind[HeaderValueKind["Int32"] = 0xc0] = "Int32";
    })(Obex.HeaderValueKind || (Obex.HeaderValueKind = {}));
    var HeaderValueKind = Obex.HeaderValueKind;

    var HeaderIdentifiers = (function () {
        function HeaderIdentifiers() {
        }
        HeaderIdentifiers.Count = new HeaderIdentifier(0xc0);
        HeaderIdentifiers.Name = new HeaderIdentifier(0x01);
        HeaderIdentifiers.Type = new HeaderIdentifier(0x42);
        HeaderIdentifiers.Length = new HeaderIdentifier(0xc3);
        HeaderIdentifiers.Body = new HeaderIdentifier(0x48);
        HeaderIdentifiers.EndOfBody = new HeaderIdentifier(0x49);
        HeaderIdentifiers.ConnectionId = new HeaderIdentifier(0xcf);
        return HeaderIdentifiers;
    })();
    Obex.HeaderIdentifiers = HeaderIdentifiers;

    var HeaderValue = (function () {
        function HeaderValue(kind) {
            this._kind = kind;
            this._intValue = 0;
            this._stringValue = null;
            this._byteSequence = null;
        }
        HeaderValue.prototype.reset = function () {
            this._kind = 0;
            this._intValue = 0;
            this._stringValue = null;
            this._byteSequence = null;
        };

        HeaderValue.prototype.setInt8 = function (value) {
            if (value < 0 || value > 255)
                throw new Error("Value must be smaller than 256.");
            if (this._kind != 128 /* Int8 */)
                throw new Error("Value must be of Int8 kind.");
            this._intValue = value;
        };

        HeaderValue.prototype.setInt32 = function (value) {
            if (value < 0 || value > 0xffffffff)
                throw new Error("Value must be smaller than 2^32.");
            if (this._kind != 192 /* Int32 */)
                throw new Error("Value must be of Int32 kind.");
            this._intValue = value;
        };

        HeaderValue.prototype.setUnicode = function (value) {
            if (value === null)
                throw new Error("value is null.");
            if (this._kind != 0 /* Unicode */)
                throw new Error("Value must be of Unicode kind.");
            this._stringValue = value;
        };

        HeaderValue.prototype.setByteSequence = function (value) {
            if (value === null)
                throw new Error("value is null.");
            if (this._kind != 64 /* ByteSequence */)
                throw new Error("Value must be of ByteSequence kind.");
            this._byteSequence = value;
        };

        HeaderValue.prototype.serialize = function (stream) {
            if (this._kind === 128 /* Int8 */) {
                stream.add8(this._intValue);
            } else if (this._kind === 192 /* Int32 */) {
                stream.add16((this._intValue & 0xffff0000) >>> 16);
                stream.add16((this._intValue & 0x0000ffff));
            } else if (this._kind === 0 /* Unicode */) {
                stream.add16(this._stringValue.length);
                for (var i = 0; i < this._stringValue.length; i++) {
                    var c = this._stringValue.charCodeAt(i);
                    stream.add16(c);
                }
            } else if (this._kind === 64 /* ByteSequence */) {
                stream.add16(this._byteSequence.byteLength);
                var view = new Uint8Array(this._byteSequence);

                for (var i = 0; i < view.byteLength; i++) {
                    stream.add8(view.get(i));
                }
            } else {
                throw new Error("Invalid value type.");
            }
        };
        return HeaderValue;
    })();
    Obex.HeaderValue = HeaderValue;

    var HeaderEntry = (function () {
        function HeaderEntry(_identifier, _value) {
            this._identifier = _identifier;
            this._value = _value;
        }
        Object.defineProperty(HeaderEntry.prototype, "identifier", {
            get: function () {
                return this._identifier;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(HeaderEntry.prototype, "value", {
            get: function () {
                return this._value;
            },
            enumerable: true,
            configurable: true
        });
        return HeaderEntry;
    })();
    Obex.HeaderEntry = HeaderEntry;

    var HeaderList = (function () {
        function HeaderList() {
            this._items = [];
        }
        HeaderList.prototype.add = function (header) {
            var value = this._items[header.value];
            if (!value) {
                value = new HeaderEntry(header, new HeaderValue(header.valueKind));
                this._items[header.value] = value;
            }
            return value;
        };

        HeaderList.prototype.forEach = function (action) {
            this._items.forEach(function (value, index) {
                action(value);
            });
        };

        HeaderList.prototype.serialize = function (stream) {
            this.forEach(function (entry) {
                stream.add8(entry.identifier.value);
                entry.value.serialize(stream);
            });
        };
        return HeaderList;
    })();
    Obex.HeaderList = HeaderList;

    (function (RequestOpCode) {
        RequestOpCode[RequestOpCode["Connect"] = 0x80] = "Connect";
        RequestOpCode[RequestOpCode["Disconnect"] = 0x81] = "Disconnect";
        RequestOpCode[RequestOpCode["Put"] = 0x02] = "Put";
        RequestOpCode[RequestOpCode["PutFinal"] = 0x82] = "PutFinal";
        RequestOpCode[RequestOpCode["Get"] = 0x03] = "Get";
        RequestOpCode[RequestOpCode["GetFinal"] = 0x83] = "GetFinal";
        RequestOpCode[RequestOpCode["Session"] = 0x87] = "Session";
        RequestOpCode[RequestOpCode["Abort"] = 0xff] = "Abort";
    })(Obex.RequestOpCode || (Obex.RequestOpCode = {}));
    var RequestOpCode = Obex.RequestOpCode;

    var HeaderListBuilder = (function () {
        function HeaderListBuilder() {
            this._headerList = new HeaderList();
        }
        Object.defineProperty(HeaderListBuilder.prototype, "headerList", {
            get: function () {
                return this._headerList;
            },
            enumerable: true,
            configurable: true
        });

        HeaderListBuilder.prototype.serialize = function (stream) {
            this.headerList.forEach(function (entry) {
                stream.add8(entry.identifier.value);
                entry.value.serialize(stream);
            });
        };
        return HeaderListBuilder;
    })();
    Obex.HeaderListBuilder = HeaderListBuilder;

    var ConnectRequestBuilder = (function () {
        function ConnectRequestBuilder() {
            this._headers = new HeaderListBuilder();
            this._maxPacketSize = 255;
        }
        Object.defineProperty(ConnectRequestBuilder.prototype, "opCode", {
            get: function () {
                return 128 /* Connect */;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ConnectRequestBuilder.prototype, "obexVersion", {
            get: function () {
                return 0x10;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ConnectRequestBuilder.prototype, "flags", {
            get: function () {
                return 0x00;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ConnectRequestBuilder.prototype, "maxPacketSize", {
            get: function () {
                return this._maxPacketSize;
            },
            set: function (value) {
                this._maxPacketSize = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ConnectRequestBuilder.prototype, "headerList", {
            get: function () {
                return this._headers.headerList;
            },
            enumerable: true,
            configurable: true
        });

        ConnectRequestBuilder.prototype.serialize = function (stream) {
            stream.add8(this.opCode);
            var lengthOffset = stream.offset;
            stream.add16(0); // request length unknown at this time
            stream.add8(this.obexVersion);
            stream.add8(this.flags);
            stream.add16(this.maxPacketSize);
            this.headerList.serialize(stream);
            stream.update16(lengthOffset, stream.length);
        };
        return ConnectRequestBuilder;
    })();
    Obex.ConnectRequestBuilder = ConnectRequestBuilder;
})(exports.Obex || (exports.Obex = {}));
var Obex = exports.Obex;
