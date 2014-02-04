// Obex component: Obex is a transport protocol conceptually similar to HTTP.
// It is a request/response message protocol where each request/response
// message is a set of headers followed by a body.
(function (Obex) {
    var ByteStream = (function () {
        function ByteStream(length) {
            this._offset = 0;
            this._bytes = new Uint8Array(length);
        }
        ByteStream.prototype.add = function (value) {
            if (value < 0 || value > 255)
                throw new Error("Value must be between 0 and 255.");

            this._bytes.set(this._offset, value);
            this._offset++;
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
        HeaderIdentifier.prototype.highBits = function () {
            return (this.value & 0xc0);
        };

        HeaderIdentifier.prototype.isUnicode = function () {
            return this.highBits() === HeaderIdentifier.HIGH_Unicode;
        };

        HeaderIdentifier.prototype.isByteSequence = function () {
            return this.highBits() === HeaderIdentifier.HIGH_ByteSequence;
        };

        HeaderIdentifier.prototype.isInt8 = function () {
            return this.highBits() === HeaderIdentifier.HIGH_Int8;
        };

        HeaderIdentifier.prototype.isInt32 = function () {
            return this.highBits() === HeaderIdentifier.HIGH_Int32;
        };

        HeaderIdentifier.HIGH_Unicode = 0x00;
        HeaderIdentifier.HIGH_ByteSequence = 0x40;
        HeaderIdentifier.HIGH_Int8 = 0x80;
        HeaderIdentifier.HIGH_Int32 = 0xc0;
        return HeaderIdentifier;
    })();
    Obex.HeaderIdentifier = HeaderIdentifier;

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
        function HeaderValue() {
            this.reset();
        }
        HeaderValue.prototype.reset = function () {
            this._kind = 0;
            this._intValue = 0;
            this._stringValue = null;
            this._byteSequence = null;
        };

        HeaderValue.prototype.setInt8 = function (value) {
            if (value > 0xff)
                throw new Error("Value must be smaller than 256.");
            this.reset();
            this._kind = HeaderIdentifier.HIGH_Int8;
            this._intValue = value;
        };

        HeaderValue.prototype.setInt32 = function (value) {
            if (value > 0xffffffff)
                throw new Error("Value must be smaller than 2^32.");
            this.reset();
            this._kind = HeaderIdentifier.HIGH_Int32;
            this._intValue = value;
        };

        HeaderValue.prototype.setUnicode = function (value) {
            this.reset();
            this._kind = HeaderIdentifier.HIGH_Unicode;
            this._stringValue = value;
        };

        HeaderValue.prototype.setByteSequence = function (value) {
            this.reset();
            this._kind = HeaderIdentifier.HIGH_ByteSequence;
            this._byteSequence = value;
        };

        HeaderValue.prototype.serialize = function (stream) {
            if (this._kind === HeaderIdentifier.HIGH_Int8) {
                stream.add(this._intValue);
            } else if (this._kind === HeaderIdentifier.HIGH_Int32) {
                stream.add((this._intValue & 0xff000000) >>> 24);
                stream.add((this._intValue & 0x00ff0000) >>> 16);
                stream.add((this._intValue & 0x0000ff00) >>> 8);
                stream.add((this._intValue & 0x000000ff) >>> 0);
            } else if (this._kind === HeaderIdentifier.HIGH_Unicode) {
                stream.add((this._stringValue.length & 0xff00) >>> 8);
                stream.add((this._stringValue.length & 0x00ff) >>> 0);
                for (var i = 0; i < this._stringValue.length; i++) {
                    var c = this._stringValue.charCodeAt(i);
                    stream.add((c & 0xff00) >>> 8);
                    stream.add((c & 0x00ff) >>> 0);
                }
            } else if (this._kind === HeaderIdentifier.HIGH_ByteSequence) {
                stream.add((this._byteSequence.byteLength & 0xff00) >>> 8);
                stream.add((this._byteSequence.byteLength & 0x00ff) >>> 0);
                var view = new Uint8Array(this._byteSequence);
                for (var i = 0; i < view.byteLength; i++) {
                    stream.add(view.get(i));
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
                value = new HeaderEntry(header, new HeaderValue());
                this._items[header.value] = value;
            }
            return value;
        };

        HeaderList.prototype.forEach = function (action) {
            this._items.forEach(function (value, index) {
                action(value);
            });
        };
        return HeaderList;
    })();
    Obex.HeaderList = HeaderList;

    var Encoder = (function () {
        function Encoder() {
            this._headerList = new HeaderList();
        }
        Object.defineProperty(Encoder.prototype, "headerList", {
            get: function () {
                return this._headerList;
            },
            enumerable: true,
            configurable: true
        });

        Encoder.prototype.serialize = function (stream) {
            this.headerList.forEach(function (entry) {
                stream.add(entry.identifier.value);
                entry.value.serialize(stream);
            });
        };
        return Encoder;
    })();
    Obex.Encoder = Encoder;
})(exports.Obex || (exports.Obex = {}));
var Obex = exports.Obex;
