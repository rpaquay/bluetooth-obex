// Obex component: Obex is a transport protocol conceptually similar to HTTP.
// It is a request/response message protocol where each request/response
// message is a set of headers followed by a body.
var Obex;
(function (Obex) {
    // Simple growable buffer
    var GrowableBuffer = (function () {
        function GrowableBuffer() {
            this._bytes = new DataView(new ArrayBuffer(8));
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
            var view = this.toUint8Array();
            view.set(data, offset);
        };

        // Return a UInt8Array wrapping the buffer content. Note the underlying
        // buffer content is not copied, so the returned view is only valid as long
        // as the buffer is unchanged.
        GrowableBuffer.prototype.toUint8Array = function () {
            return new Uint8Array(this._bytes.buffer, 0, this._length);
        };

        // Return a DataView wrapping the buffer content. Note the underlying buffer
        // content is not copied, so the returned view is only valid as long as the
        // buffer is unchanged.
        GrowableBuffer.prototype.toDataView = function () {
            return new DataView(this._bytes.buffer, 0, this._length);
        };

        // Return an ArrayBuffer containing a *copy* of the buffer content.
        GrowableBuffer.prototype.toArrayBuffer = function () {
            var view = this.toUint8Array();
            var result = new Uint8Array(view.byteLength);
            result.set(view, 0);
            return result.buffer;
        };

        GrowableBuffer.prototype.grow = function () {
            var new_len = this._bytes.byteLength * 2;
            var new_buffer = new ArrayBuffer(new_len);

            // Copy old buffer content to new one
            var old_array = new Uint8Array(this._bytes.buffer);
            var new_array = new Uint8Array(new_buffer);
            new_array.set(old_array, 0);

            // Assign new buffer
            this._bytes = new DataView(new_buffer);
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

        Object.defineProperty(HeaderValue.prototype, "asUint8Array", {
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
                stream.addUint8(this._intValue);
            } else if (this._kind === 192 /* Int32 */) {
                stream.addUint16((this._intValue & 0xffff0000) >>> 16);
                stream.addUint16((this._intValue & 0x0000ffff));
            } else if (this._kind === 0 /* Unicode */) {
                stream.addUint16(this._stringValue.length);
                for (var i = 0; i < this._stringValue.length; i++) {
                    var c = this._stringValue.charCodeAt(i);
                    stream.addUint16(c);
                }
            } else if (this._kind === 64 /* ByteSequence */) {
                stream.addUint16(this._byteSequence.byteLength);
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
            stream.addUint8(this.opCode);
            var lengthOffset = stream.length;
            stream.addUint16(0); // request length unknown at this time
            stream.addUint8(this.obexVersion);
            stream.addUint8(this.flags);
            stream.addUint16(this.maxPacketSize);
            this.headerList.serialize(stream);
            stream.setUint16(lengthOffset, stream.length);
        };
        return ConnectRequestBuilder;
    })();
    Obex.ConnectRequestBuilder = ConnectRequestBuilder;

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
            this._littleEndian = false;
            this._data = new DataView(data.buffer, data.byteOffset, data.byteLength);
            this._responseData = new DataView(data.buffer, data.byteOffset + 3, data.byteLength - 3); // Skip opcode and length
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
                return this._data.getUint16(1, this._littleEndian);
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

            var response = new Response(this._data.toUint8Array());
            var responseLength = response.length;
            if (responseLength > this._data.length)
                return;
            if (responseLength <= this._data.length) {
                response = new Response(this._data.toUint8Array().subarray(0, responseLength));
            }
            this.flushResponse(responseLength);
            this._onResponse(response);
        };

        ResponseParser.prototype.flushResponse = function (responseLength) {
            var remaining_length = this._data.length - responseLength;
            var remaining_data = this._data.toUint8Array().subarray(responseLength, this._data.length);
            var new_data = new GrowableBuffer();
            new_data.setLength(remaining_length);
            new_data.setData(0, remaining_data);
            this._data = new_data;
        };
        return ResponseParser;
    })();
    Obex.ResponseParser = ResponseParser;

    var HeaderListParser = (function () {
        function HeaderListParser(data) {
            this._littleEndian = false;
            this._offset = 0;
            this._data = data;
        }
        HeaderListParser.prototype.fetchUint8 = function () {
            var result = this._data.getUint8(this._offset);
            this._offset++;
            return result;
        };

        HeaderListParser.prototype.fetchUint16 = function () {
            var result = this._data.getUint16(this._offset, this._littleEndian);
            this._offset += 2;
            return result;
        };

        HeaderListParser.prototype.fetchUint32 = function () {
            var result = this._data.getUint32(this._offset, this._littleEndian);
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
                        var value = this.fetchUint8();
                        list.add(id).value.setInt8(value);
                        break;
                    case 192 /* Int32 */:
                        var value = this.fetchUint32();
                        list.add(id).value.setInt32(value);
                        break;
                    case 0 /* Unicode */:
                        var length = this.fetchUint16();
                        var text = "";
                        for (var i = 0; i < length; i++) {
                            var ch = this.fetchUint16();
                            text += String.fromCharCode(ch);
                        }
                        list.add(id).value.setUnicode(text);
                        break;
                    case 64 /* ByteSequence */:
                        var length = this.fetchUint16();
                        var view = new Uint8Array(this._data.buffer, this._data.byteOffset + this._offset, length);
                        this._offset += length;
                        list.add(id).value.setByteSequence(view);
                        break;
                    default:
                        throw new Error("Unsupported value kind.");
                }
            }
            return list;
        };
        return HeaderListParser;
    })();
    Obex.HeaderListParser = HeaderListParser;
})(Obex || (Obex = {}));
//# sourceMappingURL=obex.js.map
