// Obex component: Obex is a transport protocol conceptually similar to HTTP.
// It is a request/response message protocol where each request/response
// message is a set of headers followed by a body.

module Obex {
  // Simple growable byte stream
  export class ByteStream {
    private _bytes = new DataView(new ArrayBuffer(8));
    private _length = 0;

    public get offset(): number { return this._length; }
    public get length(): number { return this._length; }

    public setByte(offset: number, value: number) {
      if (value < 0 || value > 255)
        throw new Error("Value must be between 0 and 255.");
      if (offset < 0 || offset > this._length)
        throw new Error("Offset must be between 0 and " + this._length + ".");

      this._bytes.setUint8(offset, value);
    }

    public addByte(value: number) {
      this.growIfNeeded();
      this.setByte(this._length, value);
      this._length++;
    }

    public add16(value: number) {
      if (value < 0 || value > 65535)
        throw new Error("Value must be between 0 and 65535.");

      this.addByte((value & 0xff00) >> 8);
      this.addByte((value & 0x00ff));
    }

    public update16(offset: number, value: number) {
      if (value < 0 || value > 65535)
        throw new Error("Value must be between 0 and 65535.");

      this.setByte(offset, (value & 0xff00) >> 8);
      this.setByte(offset + 1, (value & 0x00ff));
    }

    public toBuffer(): ArrayBuffer {
      var size = this._length;
      var view = new Uint8Array(this._bytes.buffer, 0, size);
      var result = new Uint8Array(size);
      result.set(view, 0);
      return result.buffer;
    }

    private growIfNeeded(): void {
      if (this._length === this._bytes.byteLength)
        this.grow();
    }

    private grow(): void {
      var new_len = this._bytes.byteLength * 2;
      var new_buffer = new ArrayBuffer(new_len);

      // Copy old buffer content to new one
      var old_array = new Uint8Array(this._bytes.buffer);
      var new_array = new Uint8Array(new_buffer);
      new_array.set(old_array, 0);

      // Assign new buffer
      this._bytes = new DataView(new_buffer);
    }
  }

  // Headers identifier abstraction + helper functions.
  export class HeaderIdentifier {
    public constructor(public value: number) {
    }

    public get valueKind(): HeaderValueKind {
      return (this.value & 0xc0);
    }

    public get isUnicode(): boolean {
      return this.valueKind === HeaderValueKind.Unicode;
    }

    public get isByteSequence(): boolean {
      return this.valueKind === HeaderValueKind.ByteSequence;
    }

    public get isInt8(): boolean {
      return this.valueKind === HeaderValueKind.Int8;
    }

    public get isInt32(): boolean {
      return this.valueKind === HeaderValueKind.Int32;
    }
  }

  // Header type (2 high bits of header identifier value)
  export enum HeaderValueKind {
    Unicode = 0x00,
    ByteSequence = 0x40,
    Int8 = 0x80,
    Int32 = 0xc0,
  }

  export class HeaderIdentifiers {
    public static Count = new HeaderIdentifier(0xc0);
    public static Name = new HeaderIdentifier(0x01);
    public static Type = new HeaderIdentifier(0x42);
    public static Length = new HeaderIdentifier(0xc3);
    public static Body = new HeaderIdentifier(0x48);
    public static EndOfBody = new HeaderIdentifier(0x49);
    public static ConnectionId = new HeaderIdentifier(0xcf);
  }

  export class HeaderValue {
    private _kind: HeaderValueKind;
    private _intValue: number;
    private _stringValue: string;
    private _byteSequence: ArrayBuffer;

    public constructor(kind: HeaderValueKind) {
      this._kind = kind;
      this._intValue = 0;
      this._stringValue = null;
      this._byteSequence = null;
    }

    public get asInt(): number {
      if (this._kind != HeaderValueKind.Int8 && this._kind != HeaderValueKind.Int32)
        throw new Error("Value must be of Int8 or Int32 kind.");
      return this._intValue;
    }

    public get asString(): string {
      if (this._kind != HeaderValueKind.Unicode)
        throw new Error("Value must be of Unicode kind.");
      return this._stringValue;
    }

    public get asArrayBuffer(): ArrayBuffer {
      if (this._kind != HeaderValueKind.ByteSequence)
        throw new Error("Value must be of ByteSequence kind.");
      return this._byteSequence;
    }

    public setInt8(value: number): void {
      if (value < 0 || value > 255)
        throw new Error("Value must be smaller than 256.");
      if (this._kind != HeaderValueKind.Int8)
        throw new Error("Value must be of Int8 kind.");
      this._intValue = value;
    }

    public setInt32(value: number): void {
      if (value < 0 || value > 0xffffffff)
        throw new Error("Value must be smaller than 2^32.");
      if (this._kind != HeaderValueKind.Int32)
        throw new Error("Value must be of Int32 kind.");
      this._intValue = value;
    }

    public setUnicode(value: string): void {
      if (value === null)
        throw new Error("value is null.");
      if (this._kind != HeaderValueKind.Unicode)
        throw new Error("Value must be of Unicode kind.");
      this._stringValue = value;
    }

    public setByteSequence(value: ArrayBuffer): void {
      if (value === null)
        throw new Error("value is null.");
      if (this._kind != HeaderValueKind.ByteSequence)
        throw new Error("Value must be of ByteSequence kind.");
      this._byteSequence = value;
    }

    public serialize(stream: ByteStream): void {
      if (this._kind === HeaderValueKind.Int8) {
        stream.addByte(this._intValue);
      } else if (this._kind === HeaderValueKind.Int32) {
        stream.add16((this._intValue & 0xffff0000) >>> 16);
        stream.add16((this._intValue & 0x0000ffff));
      } else if (this._kind === HeaderValueKind.Unicode) {
        stream.add16(this._stringValue.length);
        for (var i = 0; i < this._stringValue.length; i++) {
          var c = this._stringValue.charCodeAt(i);
          stream.add16(c);
        }
      } else if (this._kind === HeaderValueKind.ByteSequence) {
        stream.add16(this._byteSequence.byteLength);
        var view = new Uint8Array(this._byteSequence);
        // TODO(rpaquay): This could be more efficient using "view" operations.
        for (var i = 0; i < view.byteLength; i++) {
          stream.addByte(view.get(i));
        }
      } else {
        throw new Error("Invalid value type.");
      }
    }
  }

  export class HeaderEntry {
    public constructor(
      private _identifier: HeaderIdentifier,
      private _value: HeaderValue) {
    }

    public get identifier(): HeaderIdentifier { return this._identifier; }
    public get value(): HeaderValue { return this._value; }
  }

  export class HeaderList {
    private _items: HeaderEntry[] = [];

    public add(header: HeaderIdentifier): HeaderEntry {
      var value = this._items[header.value];
      if (!value) {
        value = new HeaderEntry(header, new HeaderValue(header.valueKind));
        this._items[header.value] = value;
      }
      return value;
    }

    public forEach(action: (entry: HeaderEntry) => void): void {
      this._items.forEach((value, index) => {
        action(value);
      });
    }

    public serialize(stream: ByteStream): void {
      this.forEach(entry => {
        stream.addByte(entry.identifier.value);
        entry.value.serialize(stream);
      });
    }
  }

  export enum RequestOpCode {
    Connect = 0x80,
    Disconnect = 0x81,
    Put = 0x02,
    PutFinal = 0x82,
    Get = 0x03,
    GetFinal = 0x83,
    Session = 0x87,
    Abort = 0xff,
  }

  export class HeaderListBuilder {
    public _headerList = new HeaderList();

    public get headerList(): HeaderList {
      return this._headerList;
    }

    public serialize(stream: ByteStream): void {
      this.headerList.forEach(entry => {
        stream.addByte(entry.identifier.value);
        entry.value.serialize(stream);
      });
    }
  }

  export interface RequestBuilder {
    opCode: RequestOpCode;
    headerList: HeaderList;
    serialize(stream: ByteStream): void;
  }

  export class ConnectRequestBuilder implements RequestBuilder {
    private _headers = new HeaderListBuilder();
    private _maxPacketSize = 255;

    public get opCode(): RequestOpCode { return RequestOpCode.Connect; }
    public get obexVersion(): number { return 0x10; }
    public get flags(): number { return 0x00; }
    public get maxPacketSize(): number { return this._maxPacketSize; }
    public set maxPacketSize(value: number) { this._maxPacketSize = value; }
    public get headerList(): HeaderList { return this._headers.headerList; }
    public get count(): number { return this._headers.headerList.add(Obex.HeaderIdentifiers.Count).value.asInt; }
    public set count(value: number) { this._headers.headerList.add(Obex.HeaderIdentifiers.Count).value.setInt32(value); }
    public get length(): number { return this._headers.headerList.add(Obex.HeaderIdentifiers.Length).value.asInt; }
    public set length(value: number) { this._headers.headerList.add(Obex.HeaderIdentifiers.Length).value.setInt32(value); }

    public serialize(stream: ByteStream): void {
      stream.addByte(this.opCode);
      var lengthOffset = stream.offset;
      stream.add16(0); // request length unknown at this time
      stream.addByte(this.obexVersion);
      stream.addByte(this.flags);
      stream.add16(this.maxPacketSize);
      this.headerList.serialize(stream);
      stream.update16(lengthOffset, stream.length);
    }
  }
}
