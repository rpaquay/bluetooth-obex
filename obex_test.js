// Obex component: Obex is a transport protocol conceptually similar to HTTP.
// It is a request/response message protocol where each request/response
// message is a set of headers followed by a body.
var Obex;
(function (Obex) {
    // Simple growable byte stream
    var ByteStream = (function () {
        function ByteStream() {
            this._bytes = new DataView(new ArrayBuffer(8));
            this._length = 0;
        }
        Object.defineProperty(ByteStream.prototype, "offset", {
            get: function () {
                return this._length;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ByteStream.prototype, "length", {
            get: function () {
                return this._length;
            },
            enumerable: true,
            configurable: true
        });

        ByteStream.prototype.setByte = function (offset, value) {
            if (value < 0 || value > 255)
                throw new Error("Value must be between 0 and 255.");
            if (offset < 0 || offset > this._length)
                throw new Error("Offset must be between 0 and " + this._length + ".");

            this._bytes.setUint8(offset, value);
        };

        ByteStream.prototype.addByte = function (value) {
            this.growIfNeeded();
            this.setByte(this._length, value);
            this._length++;
        };

        ByteStream.prototype.add16 = function (value) {
            if (value < 0 || value > 65535)
                throw new Error("Value must be between 0 and 65535.");

            this.addByte((value & 0xff00) >> 8);
            this.addByte((value & 0x00ff));
        };

        ByteStream.prototype.update16 = function (offset, value) {
            if (value < 0 || value > 65535)
                throw new Error("Value must be between 0 and 65535.");

            this.setByte(offset, (value & 0xff00) >> 8);
            this.setByte(offset + 1, (value & 0x00ff));
        };

        ByteStream.prototype.toBuffer = function () {
            var size = this._length;
            var view = new Uint8Array(this._bytes.buffer, 0, size);
            var result = new Uint8Array(size);
            result.set(view, 0);
            return result.buffer;
        };

        ByteStream.prototype.growIfNeeded = function () {
            if (this._length === this._bytes.byteLength)
                this.grow();
        };

        ByteStream.prototype.grow = function () {
            var new_len = this._bytes.byteLength * 2;
            var new_buffer = new ArrayBuffer(new_len);

            // Copy old buffer content to new one
            var old_array = new Uint8Array(this._bytes.buffer);
            var new_array = new Uint8Array(new_buffer);
            new_array.set(old_array, 0);

            // Assign new buffer
            this._bytes = new DataView(new_buffer);
        };
        return ByteStream;
    })();
    Obex.ByteStream = ByteStream;

    // Headers identifier abstraction + helper functions.
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

    // Header type (2 high bits of header identifier value)
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
        Object.defineProperty(HeaderValue.prototype, "asInt", {
            get: function () {
                if (this._kind != 128 /* Int8 */ && this._kind != 192 /* Int32 */)
                    throw new Error("Value must be of Int8 or Int32 kind.");
                return this._intValue;
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(HeaderValue.prototype, "asString", {
            get: function () {
                if (this._kind != 0 /* Unicode */)
                    throw new Error("Value must be of Unicode kind.");
                return this._stringValue;
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(HeaderValue.prototype, "asArrayBuffer", {
            get: function () {
                if (this._kind != 64 /* ByteSequence */)
                    throw new Error("Value must be of ByteSequence kind.");
                return this._byteSequence;
            },
            enumerable: true,
            configurable: true
        });

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
                stream.addByte(this._intValue);
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
                    stream.addByte(view.get(i));
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
                stream.addByte(entry.identifier.value);
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
                stream.addByte(entry.identifier.value);
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
        Object.defineProperty(ConnectRequestBuilder.prototype, "count", {
            get: function () {
                return this._headers.headerList.add(Obex.HeaderIdentifiers.Count).value.asInt;
            },
            set: function (value) {
                this._headers.headerList.add(Obex.HeaderIdentifiers.Count).value.setInt32(value);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ConnectRequestBuilder.prototype, "length", {
            get: function () {
                return this._headers.headerList.add(Obex.HeaderIdentifiers.Length).value.asInt;
            },
            set: function (value) {
                this._headers.headerList.add(Obex.HeaderIdentifiers.Length).value.setInt32(value);
            },
            enumerable: true,
            configurable: true
        });

        ConnectRequestBuilder.prototype.serialize = function (stream) {
            stream.addByte(this.opCode);
            var lengthOffset = stream.offset;
            stream.add16(0); // request length unknown at this time
            stream.addByte(this.obexVersion);
            stream.addByte(this.flags);
            stream.add16(this.maxPacketSize);
            this.headerList.serialize(stream);
            stream.update16(lengthOffset, stream.length);
        };
        return ConnectRequestBuilder;
    })();
    Obex.ConnectRequestBuilder = ConnectRequestBuilder;
})(Obex || (Obex = {}));
/// <reference path="obex.ts"/>
var Assert;
(function (Assert) {
    function fail(msg) {
        throw new Error(msg);
    }
    Assert.fail = fail;

    function assertImpl(value, msg) {
        if (!value) {
            if (msg)
                msg = "Assertion failure: " + msg;
            else
                msg = "Assertion failure.";
            fail(msg);
        }
    }

    function isTrue(value, msg) {
        assertImpl(value, msg);
    }
    Assert.isTrue = isTrue;

    function isFalse(value, msg) {
        assertImpl(!value, msg);
    }
    Assert.isFalse = isFalse;

    function isNull(value, msg) {
        assertImpl(value === null, msg);
    }
    Assert.isNull = isNull;

    function isNotNull(value, msg) {
        assertImpl(value !== null, msg);
    }
    Assert.isNotNull = isNotNull;

    function isEqual(expected, value, msg) {
        if (value !== expected) {
            fail("Expected value " + expected + " instead of " + value);
        }
    }
    Assert.isEqual = isEqual;
})(Assert || (Assert = {}));

var Tests;
(function (Tests) {
    function run(title, action) {
        console.log(">>>>>>>>>> Running \"" + title + "\" tests <<<<<<<<<<<<");
        try  {
            action();
        } catch (e) {
            console.log(">>>>>>>>>> Failure <<<<<<<<<<<<");
            throw e;
        }
        console.log(">>>>>>>>>> Success <<<<<<<<<<<<");
    }
    Tests.run = run;
})(Tests || (Tests = {}));

var ObexTests;
(function (ObexTests) {
    Tests.run("Headers", function () {
        Assert.isTrue(Obex.HeaderIdentifiers.Name.isUnicode);
        Assert.isFalse(Obex.HeaderIdentifiers.Name.isByteSequence);
        Assert.isFalse(Obex.HeaderIdentifiers.Count.isUnicode);
        Assert.isTrue(Obex.HeaderIdentifiers.Count.isInt32);
        Assert.isFalse(Obex.HeaderIdentifiers.Length.isUnicode);
        Assert.isTrue(Obex.HeaderIdentifiers.Length.isInt32);
        Assert.isFalse(Obex.HeaderIdentifiers.Type.isUnicode);
        Assert.isTrue(Obex.HeaderIdentifiers.Type.isByteSequence);
    });

    Tests.run("ByteStream1", function () {
        var stream = new Obex.ByteStream();
        stream.addByte(5);
        var buffer = stream.toBuffer();
        Assert.isNotNull(buffer);
        Assert.isEqual(1, buffer.byteLength);
    });

    Tests.run("ByteStream2", function () {
        var stream = new Obex.ByteStream();
        for (var i = 0; i < 256; i++) {
            stream.addByte(Math.floor(i / 2));
        }
        var buffer = stream.toBuffer();
        Assert.isNotNull(buffer);
        Assert.isEqual(256, buffer.byteLength);

        var view = new DataView(buffer);
        for (var i = 0; i < 256; i++) {
            Assert.isEqual(Math.floor(i / 2), view.getUint8(i));
        }
    });

    Tests.run("Encoder1", function () {
        var encoder = new Obex.HeaderListBuilder();
        var stream = new Obex.ByteStream();
        encoder.serialize(stream);
        var buffer = stream.toBuffer();
        Assert.isNotNull(buffer);
        Assert.isEqual(0, buffer.byteLength);
    });

    Tests.run("Encoder2", function () {
        var encoder = new Obex.HeaderListBuilder();
        encoder.headerList.add(Obex.HeaderIdentifiers.Count).value.setInt32(1);

        var stream = new Obex.ByteStream();
        encoder.serialize(stream);
        var buffer = stream.toBuffer();
        Assert.isNotNull(buffer);
        Assert.isEqual(5, buffer.byteLength);
    });

    Tests.run("Encoder3", function () {
        var encoder = new Obex.HeaderListBuilder();

        // 1 + 4 bytes
        encoder.headerList.add(Obex.HeaderIdentifiers.Count).value.setInt32(1);

        // 1 + 2 + 2 * 4 bytes
        encoder.headerList.add(Obex.HeaderIdentifiers.Name).value.setUnicode("toto");

        // 1 + 4 bytes
        encoder.headerList.add(Obex.HeaderIdentifiers.Length).value.setInt32(245);

        // 1 + 2 + 100 bytes
        encoder.headerList.add(Obex.HeaderIdentifiers.Body).value.setByteSequence(new ArrayBuffer(100));

        var stream = new Obex.ByteStream();
        encoder.serialize(stream);
        var buffer = stream.toBuffer();
        Assert.isNotNull(buffer);
        Assert.isEqual(124, buffer.byteLength);
    });

    Tests.run("ConnectRequestBuilder", function () {
        var request = new Obex.ConnectRequestBuilder();
        request.maxPacketSize = 8 * 1024;
        request.headerList.add(Obex.HeaderIdentifiers.Count).value.setInt32(4);
        request.headerList.add(Obex.HeaderIdentifiers.Length).value.setInt32(0xf483);
        var stream = new Obex.ByteStream();
        request.serialize(stream);
        var buffer = stream.toBuffer();
        Assert.isNotNull(buffer);
        Assert.isEqual(17, buffer.byteLength);
    });
})(ObexTests || (ObexTests = {}));
