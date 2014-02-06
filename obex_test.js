// Obex component: Obex is a transport protocol conceptually similar to HTTP.
// It is a request/response message protocol where each request/response
// message is a set of headers followed by a body.
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Obex;
(function (Obex) {
    var LittleEndian = false;

    function dumpByteArrayView(data) {
        var msg;
        console.log("ByteArrayView: length=" + data.byteLength);

        var txt = "";
        for (var i = 0; i < data.byteLength; i++) {
            if (i > 0) {
                if ((i % 16) == 0) {
                    console.log("  Content: " + txt);
                    txt = "";
                } else {
                    txt += " ";
                }
            }

            var hex = data.getUint8(i).toString(16);
            if (hex.length == 1)
                hex = "0" + hex;
            txt += "0x" + hex;
        }

        if (txt.length > 0)
            ;
        console.log("  Content: " + txt);
    }
    Obex.dumpByteArrayView = dumpByteArrayView;

    function dumpArrayBuffer(buffer) {
        dumpByteArrayView(new ByteArrayView(buffer));
    }
    Obex.dumpArrayBuffer = dumpArrayBuffer;

    // Implements an interface similar to the union of DataView and Uint8Buffer.
    var ByteArrayView = (function () {
        function ByteArrayView(buffer, byteOffset, length) {
            if (typeof byteOffset === "undefined")
                byteOffset = 0;

            if (typeof length === "undefined")
                length = buffer.byteLength - byteOffset;

            // Workaround DataView bug: new DataView(new ArrayBuffer(0), 0, 0) throws!
            if (buffer.byteLength === 0 && byteOffset === 0 && length === 0)
                buffer = ByteArrayView.emptyBuffer;

            this._view = new DataView(buffer, byteOffset, length);
        }
        Object.defineProperty(ByteArrayView.prototype, "byteLength", {
            get: function () {
                return this._view.byteLength;
            },
            enumerable: true,
            configurable: true
        });

        //public get byteOffset(): number { return this._view.byteOffset; }
        //public get buffer(): ArrayBuffer { return this._view.buffer; }
        ByteArrayView.prototype.setUint8 = function (offset, value) {
            this._view.setUint8(offset, value);
        };

        ByteArrayView.prototype.getUint8 = function (offset) {
            return this._view.getUint8(offset);
        };

        ByteArrayView.prototype.getUint16 = function (offset) {
            return this._view.getUint16(offset, LittleEndian);
        };

        ByteArrayView.prototype.getUint32 = function (offset) {
            return this._view.getUint32(offset, LittleEndian);
        };

        ByteArrayView.prototype.subarray = function (start, end) {
            if (typeof end === "undefined")
                end = this._view.byteLength - this._view.byteOffset;
            var length = end - start;
            return new ByteArrayView(this._view.buffer, this._view.byteOffset + start, length);
        };

        ByteArrayView.prototype.setData = function (data, offset) {
            this.toUint8Array().set(data.toUint8Array(), offset);
        };

        // Return a Uint8Array wrapping the same view of the underlying buffer as
        // this instance.
        ByteArrayView.prototype.toUint8Array = function () {
            return new Uint8Array(this._view.buffer, this._view.byteOffset, this._view.byteLength);
        };

        // Return an ArrayBuffer containing a *copy* of the underlying buffer
        // content.
        ByteArrayView.prototype.toArrayBuffer = function () {
            var result = new ArrayBuffer(this.byteLength);
            var view_dest = new ByteArrayView(result);
            view_dest.setData(this, 0);
            return result;
        };
        ByteArrayView.emptyBuffer = new ArrayBuffer(1);
        return ByteArrayView;
    })();
    Obex.ByteArrayView = ByteArrayView;

    // Simple growable buffer
    var GrowableBuffer = (function () {
        function GrowableBuffer() {
            this._bytes = new ByteArrayView(new ArrayBuffer(8));
            this._length = 0;
        }
        Object.defineProperty(GrowableBuffer.prototype, "capacity", {
            get: function () {
                return this._bytes.byteLength;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GrowableBuffer.prototype, "length", {
            get: function () {
                return this._length;
            },
            enumerable: true,
            configurable: true
        });

        // Ensures the buffer capacity is >= length and update the content length to
        // |length|. Any unitilized bytes between the previous length and the new
        // length is set to 0.
        GrowableBuffer.prototype.setLength = function (length) {
            while (this.capacity < length) {
                this.grow();
            }
            this._length = length;
        };

        // Set a byte value at a given offset (the buffer must be big enough to allow
        // writing at that offset).
        GrowableBuffer.prototype.setUint8 = function (offset, value) {
            if (value < 0 || value > 255)
                throw new Error("Value must be between 0 and 255.");
            if (offset < 0 || offset >= this._length)
                throw new Error("Offset must be between 0 and " + (this._length - 1) + ".");

            this._bytes.setUint8(offset, value);
        };

        // Copy the content of |data| into the buffer at |offset|. The buffer length
        // must be big enough to contain the copied data.
        GrowableBuffer.prototype.setData = function (offset, data) {
            var view = this.toByteArrayView();
            view.setData(data, offset);
        };

        // Return a ByteArrayView wrapping the buffer content. Note the underlying
        // buffer content is not copied, so the returned view is only valid as long
        // as the buffer is unchanged.
        GrowableBuffer.prototype.toByteArrayView = function () {
            return this._bytes.subarray(0, this._length);
        };

        // Return an ArrayBuffer containing a *copy* of the buffer content.
        GrowableBuffer.prototype.toArrayBuffer = function () {
            var content = this._bytes.subarray(0, this._length);
            return content.toArrayBuffer();
        };

        GrowableBuffer.prototype.grow = function () {
            // Create new (larger) buffer
            var new_len = this._bytes.byteLength * 2;
            var new_view = new ByteArrayView(new ArrayBuffer(new_len));

            // Copy old buffer content to new one
            new_view.setData(this.toByteArrayView(), 0);

            // Assign new buffer
            this._bytes = new_view;
        };
        return GrowableBuffer;
    })();
    Obex.GrowableBuffer = GrowableBuffer;

    // Simple growable byte stream
    var ByteStream = (function () {
        function ByteStream() {
            this._buffer = new GrowableBuffer();
        }
        Object.defineProperty(ByteStream.prototype, "length", {
            get: function () {
                return this._buffer.length;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ByteStream.prototype, "buffer", {
            get: function () {
                return this._buffer;
            },
            enumerable: true,
            configurable: true
        });

        ByteStream.prototype.setUint8 = function (offset, value) {
            this._buffer.setUint8(offset, value);
        };

        ByteStream.prototype.setUint16 = function (offset, value) {
            if (value < 0 || value > 65535)
                throw new Error("Value must be between 0 and 65535.");

            this.setUint8(offset, (value & 0xff00) >> 8);
            this.setUint8(offset + 1, (value & 0x00ff));
        };

        ByteStream.prototype.addUint8 = function (value) {
            var offset = this.length;
            this._buffer.setLength(offset + 1);
            this.setUint8(offset, value);
        };

        ByteStream.prototype.addUint16 = function (value) {
            var offset = this.length;
            this._buffer.setLength(offset + 2);
            this.setUint16(offset, value);
        };

        ByteStream.prototype.addData = function (data) {
            var offset = this.length;
            this._buffer.setLength(offset + data.byteLength);
            this._buffer.setData(offset, data);
        };

        ByteStream.prototype.toArrayBuffer = function () {
            return this._buffer.toArrayBuffer();
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
        HeaderIdentifiers.Description = new HeaderIdentifier(0x05);
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

        Object.defineProperty(HeaderValue.prototype, "asByteArrayView", {
            get: function () {
                if (this._kind != 64 /* ByteSequence */)
                    throw new Error("Value must be of ByteSequence kind.");
                return this._byteSequence;
            },
            enumerable: true,
            configurable: true
        });

        HeaderValue.prototype.setUint8 = function (value) {
            if (value < 0 || value > 255)
                throw new Error("Value must be smaller than 256.");
            if (this._kind != 128 /* Int8 */)
                throw new Error("Value must be of Int8 kind.");
            this._intValue = value;
        };

        HeaderValue.prototype.setUint32 = function (value) {
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
                stream.addUint8(this._intValue);
            } else if (this._kind === 192 /* Int32 */) {
                stream.addUint16((this._intValue & 0xffff0000) >>> 16);
                stream.addUint16((this._intValue & 0x0000ffff));
            } else if (this._kind === 0 /* Unicode */) {
                // Special case for empty string.
                if (this._stringValue.length === 0) {
                    // HI + 2-byte length
                    var length = 1 + 2;
                    stream.addUint16(length);
                } else {
                    // HI + 2-byte length + (string length + null terminator) * sizeof(wchar_t)
                    var length = 1 + 2 + (this._stringValue.length + 1) * 2;
                    stream.addUint16(length);
                    for (var i = 0; i < this._stringValue.length; i++) {
                        var c = this._stringValue.charCodeAt(i);
                        stream.addUint16(c);
                    }
                    stream.addUint16(0); // NULL terminator
                }
            } else if (this._kind === 64 /* ByteSequence */) {
                // HI + 2-byte length + byte sequence length
                var length = 1 + 2 + this._byteSequence.byteLength;
                stream.addUint16(length);
                stream.addData(this._byteSequence);
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
        Object.defineProperty(HeaderList.prototype, "length", {
            get: function () {
                return this._items.length;
            },
            enumerable: true,
            configurable: true
        });

        HeaderList.prototype.add = function (header) {
            var entry = this.get(header);
            if (!entry) {
                entry = new HeaderEntry(header, new HeaderValue(header.valueKind));
                this._items.push(entry);
            }
            return entry;
        };

        HeaderList.prototype.get = function (header) {
            for (var i = 0; i < this._items.length; i++) {
                if (this._items[i].identifier.value === header.value) {
                    return this._items[i];
                }
            }
            return null;
        };

        HeaderList.prototype.forEach = function (action) {
            this._items.forEach(function (value, index) {
                action(value);
            });
        };

        HeaderList.prototype.serialize = function (stream) {
            this.forEach(function (entry) {
                stream.addUint8(entry.identifier.value);
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
                stream.addUint8(entry.identifier.value);
                entry.value.serialize(stream);
            });
        };
        return HeaderListBuilder;
    })();
    Obex.HeaderListBuilder = HeaderListBuilder;

    var HeaderListParser = (function () {
        function HeaderListParser(data) {
            this._offset = 0;
            this._data = data;
        }
        HeaderListParser.prototype.fetchUint8 = function () {
            var result = this._data.getUint8(this._offset);
            this._offset++;
            return result;
        };

        HeaderListParser.prototype.fetchUint16 = function () {
            var result = this._data.getUint16(this._offset);
            this._offset += 2;
            return result;
        };

        HeaderListParser.prototype.fetchUint32 = function () {
            var result = this._data.getUint32(this._offset);
            this._offset += 4;
            return result;
        };

        HeaderListParser.prototype.parse = function () {
            var list = new HeaderList();
            while (this._offset < this._data.byteLength) {
                var op_code = this.fetchUint8();
                var id = new HeaderIdentifier(op_code);
                switch (id.valueKind) {
                    case 128 /* Int8 */:
                        var value = this.parseInt8();
                        list.add(id).value.setUint8(value);
                        break;
                    case 192 /* Int32 */:
                        var value = this.parseInt32();
                        list.add(id).value.setUint32(value);
                        break;
                    case 0 /* Unicode */:
                        var text = this.parseUnicodeString();
                        list.add(id).value.setUnicode(text);
                        break;
                    case 64 /* ByteSequence */:
                        var view = this.parseByteSequence();
                        list.add(id).value.setByteSequence(view);
                        break;
                    default:
                        throw new Error("Unsupported value kind.");
                }
            }
            return list;
        };

        HeaderListParser.prototype.parseInt8 = function () {
            return this.fetchUint8();
        };

        HeaderListParser.prototype.parseInt32 = function () {
            return this.fetchUint32();
        };

        HeaderListParser.prototype.parseUnicodeString = function () {
            var length = this.fetchUint16();
            if ((length < 3) || (length % 2) == 0)
                throw new Error("Invalid unicode string format");
            var result = "";

            // Empty string have a special length == 3
            if (length > 3) {
                var charCount = Math.floor((length - 5) / 2);
                for (var i = 0; i < charCount; i++) {
                    var ch = this.fetchUint16();
                    result += String.fromCharCode(ch);
                }
                var terminator = this.fetchUint16();
                if (terminator != 0)
                    throw new Error("Invalid unicode string format (not null terminated)");
            }
            return result;
        };

        HeaderListParser.prototype.parseByteSequence = function () {
            var length = this.fetchUint16();
            if (length < 3)
                throw new Error("Invalid byte sequence format");
            var byteLength = length - 3;
            var result = this._data.subarray(this._offset, this._offset + byteLength);
            this._offset += byteLength;
            return result;
        };
        return HeaderListParser;
    })();
    Obex.HeaderListParser = HeaderListParser;

    var RequestBuilder = (function () {
        function RequestBuilder() {
            this._headerList = new HeaderListBuilder();
        }
        Object.defineProperty(RequestBuilder.prototype, "opCode", {
            get: function () {
                return this._opCode;
            },
            set: function (value) {
                this._opCode = value;
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(RequestBuilder.prototype, "headers", {
            get: function () {
                return this._headerList;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(RequestBuilder.prototype, "headerList", {
            get: function () {
                return this._headerList.headerList;
            },
            enumerable: true,
            configurable: true
        });

        RequestBuilder.prototype.serialize = function (stream) {
            stream.addUint8(this.opCode);
            var lengthOffset = stream.length;
            stream.addUint16(0); // request length unknown at this time

            this.serializeCustomData(stream);
            this.serializeHeaders(stream);

            stream.setUint16(lengthOffset, stream.length);
        };

        // Implement in derived classes.
        RequestBuilder.prototype.serializeCustomData = function (stream) {
        };

        RequestBuilder.prototype.serializeHeaders = function (stream) {
            this._headerList.serialize(stream);
        };
        return RequestBuilder;
    })();
    Obex.RequestBuilder = RequestBuilder;

    var ConnectRequestBuilder = (function (_super) {
        __extends(ConnectRequestBuilder, _super);
        function ConnectRequestBuilder() {
            _super.call(this);
            this._maxPacketSize = 255;
            this.opCode = 128 /* Connect */;
        }
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

        Object.defineProperty(ConnectRequestBuilder.prototype, "count", {
            get: function () {
                return this.headerList.add(Obex.HeaderIdentifiers.Count).value.asInt;
            },
            set: function (value) {
                this.headerList.add(Obex.HeaderIdentifiers.Count).value.setUint32(value);
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(ConnectRequestBuilder.prototype, "length", {
            get: function () {
                return this.headerList.add(Obex.HeaderIdentifiers.Length).value.asInt;
            },
            set: function (value) {
                this.headerList.add(Obex.HeaderIdentifiers.Length).value.setUint32(value);
            },
            enumerable: true,
            configurable: true
        });

        ConnectRequestBuilder.prototype.serializeCustomData = function (stream) {
            stream.addUint8(this.obexVersion);
            stream.addUint8(this.flags);
            stream.addUint16(this.maxPacketSize);
        };
        return ConnectRequestBuilder;
    })(RequestBuilder);
    Obex.ConnectRequestBuilder = ConnectRequestBuilder;

    var DisconnectRequestBuilder = (function (_super) {
        __extends(DisconnectRequestBuilder, _super);
        function DisconnectRequestBuilder() {
            _super.call(this);
            this.opCode = 129 /* Disconnect */;
        }
        return DisconnectRequestBuilder;
    })(RequestBuilder);
    Obex.DisconnectRequestBuilder = DisconnectRequestBuilder;

    var PutRequestBuilder = (function (_super) {
        __extends(PutRequestBuilder, _super);
        function PutRequestBuilder() {
            _super.call(this);
            this.opCode = 2 /* Put */;
        }
        Object.defineProperty(PutRequestBuilder.prototype, "isFinal", {
            get: function () {
                return (this.opCode & 0x80) !== 0;
            },
            set: function (value) {
                if (value)
                    this.opCode = this.opCode | 0x80;
                else
                    this.opCode = this.opCode & ~0x80;
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(PutRequestBuilder.prototype, "name", {
            get: function () {
                return this.headerList.add(Obex.HeaderIdentifiers.Name).value.asString;
            },
            set: function (value) {
                this.headerList.add(Obex.HeaderIdentifiers.Name).value.setUnicode(value);
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(PutRequestBuilder.prototype, "length", {
            get: function () {
                return this.headerList.add(Obex.HeaderIdentifiers.Length).value.asInt;
            },
            set: function (value) {
                this.headerList.add(Obex.HeaderIdentifiers.Length).value.setUint32(value);
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(PutRequestBuilder.prototype, "description", {
            get: function () {
                return this.headerList.add(Obex.HeaderIdentifiers.Description).value.asString;
            },
            set: function (value) {
                this.headerList.add(Obex.HeaderIdentifiers.Description).value.setUnicode(value);
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(PutRequestBuilder.prototype, "type", {
            get: function () {
                return this.headerList.add(Obex.HeaderIdentifiers.Type).value.asByteArrayView;
            },
            set: function (value) {
                this.headerList.add(Obex.HeaderIdentifiers.Type).value.setByteSequence(value);
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(PutRequestBuilder.prototype, "body", {
            get: function () {
                return this.headerList.add(Obex.HeaderIdentifiers.Body).value.asByteArrayView;
            },
            set: function (value) {
                this.headerList.add(Obex.HeaderIdentifiers.Body).value.setByteSequence(value);
            },
            enumerable: true,
            configurable: true
        });

        Object.defineProperty(PutRequestBuilder.prototype, "endOfbody", {
            get: function () {
                return this.headerList.add(Obex.HeaderIdentifiers.EndOfBody).value.asByteArrayView;
            },
            set: function (value) {
                this.headerList.add(Obex.HeaderIdentifiers.EndOfBody).value.setByteSequence(value);
            },
            enumerable: true,
            configurable: true
        });
        return PutRequestBuilder;
    })(RequestBuilder);
    Obex.PutRequestBuilder = PutRequestBuilder;

    (function (ResponseCode) {
        ResponseCode[ResponseCode["Reserved"] = 0x00] = "Reserved";
        ResponseCode[ResponseCode["Continue"] = 0x10] = "Continue";
        ResponseCode[ResponseCode["Success"] = 0x20] = "Success";
        ResponseCode[ResponseCode["Created"] = 0x21] = "Created";

        ResponseCode[ResponseCode["MultipleChoice"] = 0x30] = "MultipleChoice";
    })(Obex.ResponseCode || (Obex.ResponseCode = {}));
    var ResponseCode = Obex.ResponseCode;

    var Response = (function () {
        function Response(data) {
            this._data = data;
            this._responseData = data.subarray(3); // Skip opcode and length
        }
        Object.defineProperty(Response.prototype, "opCode", {
            get: function () {
                return this._data.getUint8(0);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Response.prototype, "isFinal", {
            get: function () {
                return (this.opCode & 0x80) !== 0;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Response.prototype, "code", {
            get: function () {
                return this.opCode & 0x7f;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Response.prototype, "length", {
            get: function () {
                return this._data.getUint16(1);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Response.prototype, "data", {
            get: function () {
                return this._responseData;
            },
            enumerable: true,
            configurable: true
        });
        return Response;
    })();
    Obex.Response = Response;

    var ResponseParser = (function () {
        function ResponseParser() {
            this._data = new GrowableBuffer();
        }
        ResponseParser.prototype.addData = function (data) {
            // Add |data| at end of array.
            var offset = this._data.length;
            this._data.setLength(this._data.length + data.byteLength);
            this._data.setData(offset, data);

            // Parse data to figure out if we have a complete response.
            this.parseData();
        };

        ResponseParser.prototype.setHandler = function (value) {
            this._onResponse = value;
        };

        ResponseParser.prototype.parseData = function () {
            if (this._data.length < 3)
                return;

            var response = new Response(this._data.toByteArrayView());
            var responseLength = response.length;
            if (responseLength > this._data.length)
                return;
            if (responseLength <= this._data.length) {
                response = new Response(this._data.toByteArrayView().subarray(0, responseLength));
            }
            this.flushResponse(responseLength);
            this._onResponse(response);
        };

        ResponseParser.prototype.flushResponse = function (responseLength) {
            var remaining_length = this._data.length - responseLength;
            var remaining_data = this._data.toByteArrayView().subarray(responseLength, this._data.length);
            var new_data = new GrowableBuffer();
            new_data.setLength(remaining_length);
            new_data.setData(0, remaining_data);
            this._data = new_data;
        };
        return ResponseParser;
    })();
    Obex.ResponseParser = ResponseParser;

    var ConnectResponse = (function () {
        function ConnectResponse(_response) {
            this._response = _response;
            this._headerList = null;
        }
        Object.defineProperty(ConnectResponse.prototype, "code", {
            get: function () {
                return this._response.code;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ConnectResponse.prototype, "obexVersion", {
            get: function () {
                return this._response.data.getUint8(0);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ConnectResponse.prototype, "flags", {
            get: function () {
                return this._response.data.getUint8(1);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ConnectResponse.prototype, "maxPacketSize", {
            get: function () {
                return this._response.data.getUint16(2);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ConnectResponse.prototype, "headerList", {
            get: function () {
                if (this._headerList === null) {
                    // 4 = 1 (version) + 1 (flags) + 2 (maxPacketSize)
                    var view = this._response.data.subarray(4);
                    var parser = new HeaderListParser(view);
                    this._headerList = parser.parse();
                }
                return this._headerList;
            },
            enumerable: true,
            configurable: true
        });
        return ConnectResponse;
    })();
    Obex.ConnectResponse = ConnectResponse;
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
            if (typeof msg === "undefined")
                msg = "Assertion failure.";
            else
                msg = "Assertion failure: " + msg;
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
    Tests.run("TypedArrays", function () {
        var x = new ArrayBuffer(0);
        var y1 = new Uint8Array(x, 0, 0);
        //var y2 = new DataView(x, 0, 0); // throws!
    });

    Tests.run("Headers", function () {
        // Prepare
        // Act
        // Assert
        Assert.isTrue(Obex.HeaderIdentifiers.Name.isUnicode);
        Assert.isFalse(Obex.HeaderIdentifiers.Name.isByteSequence);
        Assert.isFalse(Obex.HeaderIdentifiers.Count.isUnicode);
        Assert.isTrue(Obex.HeaderIdentifiers.Count.isInt32);
        Assert.isFalse(Obex.HeaderIdentifiers.Length.isUnicode);
        Assert.isTrue(Obex.HeaderIdentifiers.Length.isInt32);
        Assert.isFalse(Obex.HeaderIdentifiers.Type.isUnicode);
        Assert.isTrue(Obex.HeaderIdentifiers.Type.isByteSequence);
    });

    Tests.run("ByteArrayView_emtpy", function () {
        // Prepare
        // Act
        var view = new Obex.ByteArrayView(new ArrayBuffer(0), 0, 0);

        // Assert
        Assert.isEqual(0, view.byteLength);
    });

    Tests.run("ByteArrayView_setUint8", function () {
        // Prepare
        var view = new Obex.ByteArrayView(new ArrayBuffer(20), 2, 10);

        // Act
        view.setUint8(5, 63);

        // Assert
        Assert.isEqual(10, view.byteLength);
        Assert.isEqual(63, view.getUint8(5));
    });

    Tests.run("ByteArrayView_SetData", function () {
        // Prepare
        var view = new Obex.ByteArrayView(new ArrayBuffer(20), 2, 10);
        var data = new Obex.ByteArrayView(new ArrayBuffer(5));
        data.setUint8(0, 10);
        data.setUint8(1, 11);
        data.setUint8(2, 12);
        data.setUint8(3, 13);
        data.setUint8(4, 14);

        // Act
        view.setData(data, 4);

        // Assert
        Assert.isEqual(0, view.getUint8(0));
        Assert.isEqual(0, view.getUint8(1));
        Assert.isEqual(0, view.getUint8(2));
        Assert.isEqual(0, view.getUint8(3));
        Assert.isEqual(10, view.getUint8(4));
        Assert.isEqual(11, view.getUint8(5));
        Assert.isEqual(12, view.getUint8(6));
        Assert.isEqual(13, view.getUint8(7));
        Assert.isEqual(14, view.getUint8(8));
        Assert.isEqual(0, view.getUint8(9));

        Assert.isEqual(10, view.subarray(4, 5).getUint8(0));
        Assert.isEqual(11, view.subarray(0).getUint8(5));
        Assert.isEqual(12, view.subarray(1).getUint8(5));
        Assert.isEqual(13, view.subarray(0, view.byteLength).getUint8(7));
        Assert.isEqual(14, view.subarray(8, 9).getUint8(0));
    });

    Tests.run("ByteArrayView_Subarray", function () {
        // Prepare
        var view = new Obex.ByteArrayView(new ArrayBuffer(20), 2, 10);
        var data = new Obex.ByteArrayView(new ArrayBuffer(5));
        data.setUint8(0, 10);
        data.setUint8(1, 11);
        data.setUint8(2, 12);
        data.setUint8(3, 13);
        data.setUint8(4, 14);

        // Act
        view.setData(data, 4);

        // Assert
        Assert.isEqual(10, view.subarray(4, 5).getUint8(0));
        Assert.isEqual(11, view.subarray(0).getUint8(5));
        Assert.isEqual(12, view.subarray(1).getUint8(5));
        Assert.isEqual(13, view.subarray(0, view.byteLength).getUint8(7));
        Assert.isEqual(14, view.subarray(8, 9).getUint8(0));
    });

    Tests.run("ByteArrayView_ToArrayBuffer", function () {
        // Prepare
        var empty_view = new Obex.ByteArrayView(new ArrayBuffer(10), 0, 0);
        var view = new Obex.ByteArrayView(new ArrayBuffer(5), 1, 3);

        // Act
        view.setUint8(2, 127);

        // Assert
        Assert.isEqual(0, empty_view.toArrayBuffer().byteLength);
        Assert.isEqual(3, view.toArrayBuffer().byteLength);
    });

    Tests.run("ByteStream1", function () {
        // Prepare
        var stream = new Obex.ByteStream();

        // Act
        stream.addUint8(5);
        var buffer = stream.toArrayBuffer();

        // Assert
        Assert.isNotNull(buffer);
        Assert.isEqual(1, buffer.byteLength);
    });

    Tests.run("ByteStream2", function () {
        // Prepare
        var stream = new Obex.ByteStream();

        for (var i = 0; i < 256; i++) {
            stream.addUint8(Math.floor(i / 2));
        }
        var buffer = stream.toArrayBuffer();
        Assert.isNotNull(buffer);
        Assert.isEqual(256, buffer.byteLength);

        // Assert
        var view = new DataView(buffer);
        for (var i = 0; i < 256; i++) {
            Assert.isEqual(Math.floor(i / 2), view.getUint8(i));
        }
    });

    Tests.run("HeaderListBuilder1", function () {
        // Prepare
        var builder = new Obex.HeaderListBuilder();

        // Act
        var stream = new Obex.ByteStream();
        builder.serialize(stream);
        var buffer = stream.toArrayBuffer();

        // Assert
        Assert.isNotNull(buffer);
        Assert.isEqual(0, buffer.byteLength);
    });

    Tests.run("HeaderListBuilder2", function () {
        // Prepare
        var encoder = new Obex.HeaderListBuilder();
        encoder.headerList.add(Obex.HeaderIdentifiers.Count).value.setUint32(1);

        // Act
        var stream = new Obex.ByteStream();
        encoder.serialize(stream);
        var buffer = stream.toArrayBuffer();

        // Assert
        Assert.isNotNull(buffer);
        Assert.isEqual(5, buffer.byteLength);
    });

    Tests.run("HeaderListBuilder3", function () {
        // Prepare
        var encoder = new Obex.HeaderListBuilder();

        // 1 + 4 bytes
        encoder.headerList.add(Obex.HeaderIdentifiers.Count).value.setUint32(1);

        // 1 + 2 + 4 * 2 bytes + 1 * 2 bytes(null)
        encoder.headerList.add(Obex.HeaderIdentifiers.Name).value.setUnicode("toto");

        // 1 + 4 bytes
        encoder.headerList.add(Obex.HeaderIdentifiers.Length).value.setUint32(245);

        // 1 + 2 + 100 bytes
        encoder.headerList.add(Obex.HeaderIdentifiers.Body).value.setByteSequence(new Obex.ByteArrayView(new ArrayBuffer(100)));

        // Act
        var stream = new Obex.ByteStream();
        encoder.serialize(stream);
        var buffer = stream.toArrayBuffer();

        // Assert
        Assert.isNotNull(buffer);
        Assert.isEqual(126, buffer.byteLength);
    });

    Tests.run("ConnectRequestBuilder", function () {
        // Prepare
        var request = new Obex.ConnectRequestBuilder();
        request.maxPacketSize = 8 * 1024;
        request.headerList.add(Obex.HeaderIdentifiers.Count).value.setUint32(4);
        request.headerList.add(Obex.HeaderIdentifiers.Length).value.setUint32(0xf483);

        // Act
        var stream = new Obex.ByteStream();
        request.serialize(stream);
        var buffer = stream.toArrayBuffer();

        // Assert
        Assert.isNotNull(buffer);
        Assert.isEqual(17, buffer.byteLength);
    });

    Tests.run("ResponseParser1", function () {
        // Prepare
        var dataStream = new Obex.ByteStream();
        dataStream.addUint8(32 /* Success */);
        dataStream.addUint16(10); // length
        for (var i = 0; i < 7; i++) {
            dataStream.addUint8(i);
        }

        var parser = new Obex.ResponseParser();
        var responseCount = 0;
        var lastResponse = null;
        parser.setHandler(function (response) {
            lastResponse = response;
            responseCount++;
        });

        // Act
        parser.addData(dataStream.buffer.toByteArrayView().subarray(0, 3));
        parser.addData(dataStream.buffer.toByteArrayView().subarray(3, 10));

        // Assert
        Assert.isEqual(1, responseCount);
        Assert.isNotNull(lastResponse);
        Assert.isEqual(32 /* Success */, lastResponse.code);
        Assert.isEqual(10, lastResponse.length);
        Assert.isEqual(7, lastResponse.data.byteLength);
    });

    Tests.run("ResponseParser2", function () {
        // Prepare
        var dataStream = new Obex.ByteStream();
        dataStream.addUint8(32 /* Success */);
        dataStream.addUint16(10); // length
        for (var i = 0; i < 7; i++) {
            dataStream.addUint8(i);
        }
        dataStream.addUint8(33 /* Created */);
        dataStream.addUint16(4); // length
        dataStream.addUint8(0xa0);

        var parser = new Obex.ResponseParser();
        var responseCount = 0;
        var lastResponse = null;
        parser.setHandler(function (response) {
            lastResponse = response;
            responseCount++;
        });

        // Act
        parser.addData(dataStream.buffer.toByteArrayView().subarray(0, 13));

        // Assert
        Assert.isEqual(1, responseCount);
        Assert.isNotNull(lastResponse);
        Assert.isEqual(32 /* Success */, lastResponse.code);
        Assert.isEqual(10, lastResponse.length);
        Assert.isEqual(7, lastResponse.data.byteLength);
        lastResponse = null;

        // Act
        parser.addData(dataStream.buffer.toByteArrayView().subarray(13, 14));

        // Assert
        Assert.isEqual(2, responseCount);
        Assert.isNotNull(lastResponse);
        Assert.isEqual(33 /* Created */, lastResponse.code);
        Assert.isEqual(4, lastResponse.length);
        Assert.isEqual(1, lastResponse.data.byteLength);
    });

    Tests.run("HeaderParser", function () {
        // Prepare
        var builder = new Obex.HeaderListBuilder();
        builder.headerList.add(Obex.HeaderIdentifiers.Count).value.setUint32(4);
        builder.headerList.add(Obex.HeaderIdentifiers.Length).value.setUint32(10);
        builder.headerList.add(Obex.HeaderIdentifiers.Name).value.setUnicode("hello");
        var buffer = new ArrayBuffer(150);
        var view = new Obex.ByteArrayView(buffer, 10, 100);
        builder.headerList.add(Obex.HeaderIdentifiers.Body).value.setByteSequence(view);

        var stream = new Obex.ByteStream();
        builder.serialize(stream);
        var bufferView = stream.buffer.toByteArrayView();

        // Act
        var parser = new Obex.HeaderListParser(bufferView);
        var list = parser.parse();

        // Assert
        Assert.isNotNull(list);
        Assert.isEqual(4, list.length);
        Assert.isNotNull(list.get(Obex.HeaderIdentifiers.Count));
        Assert.isNotNull(list.get(Obex.HeaderIdentifiers.Length));
        Assert.isNotNull(list.get(Obex.HeaderIdentifiers.Name));
        Assert.isNotNull(list.get(Obex.HeaderIdentifiers.Body));
        Assert.isEqual(4, list.get(Obex.HeaderIdentifiers.Count).value.asInt);
        Assert.isEqual(10, list.get(Obex.HeaderIdentifiers.Length).value.asInt);
        Assert.isEqual("hello", list.get(Obex.HeaderIdentifiers.Name).value.asString);
        Assert.isEqual(100, list.get(Obex.HeaderIdentifiers.Body).value.asByteArrayView.byteLength);
    });

    function foo(x, y) {
        if (typeof y === "undefined") { y = x; }
    }
})(ObexTests || (ObexTests = {}));
