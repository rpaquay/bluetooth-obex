// Obex component: Obex is a transport protocol conceptually similar to HTTP.
// It is a request/response message protocol where each request/response
// message is a set of headers followed by a body.

module Obex {
  // Simple growable buffer
  export class GrowableBuffer {
    private _bytes = new DataView(new ArrayBuffer(8));
    private _length = 0;

    public get capacity(): number { return this._bytes.byteLength; }
    public get length(): number { return this._length; }

    // Ensures the buffer capacity is >= length and update the content length to
    // |length|. Any unitilized bytes between the previous length and the new
    // length is set to 0.
    public setLength(length: number): void {
      while (this.capacity < length) {
        this.grow();
      }
      this._length = length;
    }

    // Set a byte value at a given offset (the buffer must be big enough to allow
    // writing at that offset).
    public setUint8(offset: number, value: number) {
      if (value < 0 || value > 255)
        throw new Error("Value must be between 0 and 255.");
      if (offset < 0 || offset >= this._length)
        throw new Error("Offset must be between 0 and " + (this._length - 1) + ".");

      this._bytes.setUint8(offset, value);
    }

    // Copy the content of |data| into the buffer at |offset|. The buffer length
    // must be big enough to contain the copied data.
    public setData(offset: number, data: Uint8Array) {
      var view = this.toUint8Array();
      view.set(data, offset);
    }

    // Return a UInt8Array wrapping the buffer content. Note the underlying
    // buffer content is not copied, so the returned view is only valid as long
    // as the buffer is unchanged.
    public toUint8Array(): Uint8Array {
      return new Uint8Array(this._bytes.buffer, 0, this._length);
    }

    // Return a DataView wrapping the buffer content. Note the underlying buffer
    // content is not copied, so the returned view is only valid as long as the
    // buffer is unchanged.
    public toDataView(): DataView {
      return new DataView(this._bytes.buffer, 0, this._length);
    }

    // Return an ArrayBuffer containing a *copy* of the buffer content.
    public toArrayBuffer(): ArrayBuffer {
      var view = this.toUint8Array();
      var result = new Uint8Array(view.byteLength);
      result.set(view, 0);
      return result.buffer;
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

  // Simple growable byte stream
  export class ByteStream {
    private _buffer = new GrowableBuffer();

    public get length(): number { return this._buffer.length; }
    public get buffer(): GrowableBuffer { return this._buffer; }

    public setUint8(offset: number, value: number) {
      this._buffer.setUint8(offset, value);
    }

    public setUint16(offset: number, value: number) {
      if (value < 0 || value > 65535)
        throw new Error("Value must be between 0 and 65535.");

      this.setUint8(offset, (value & 0xff00) >> 8);
      this.setUint8(offset + 1, (value & 0x00ff));
    }

    public addUint8(value: number) {
      var offset = this.length;
      this._buffer.setLength(offset + 1);
      this.setUint8(offset, value);
    }

    public addUint16(value: number) {
      var offset = this.length;
      this._buffer.setLength(offset + 2);
      this.setUint16(offset, value);
    }

    public addData(data: Uint8Array) {
      var offset = this.length;
      this._buffer.setLength(offset + data.byteLength);
      this._buffer.setData(offset, data);
    }

    public toArrayBuffer(): ArrayBuffer {
      return this._buffer.toArrayBuffer();
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
        stream.addUint8(this._intValue);
      } else if (this._kind === HeaderValueKind.Int32) {
        stream.addUint16((this._intValue & 0xffff0000) >>> 16);
        stream.addUint16((this._intValue & 0x0000ffff));
      } else if (this._kind === HeaderValueKind.Unicode) {
        stream.addUint16(this._stringValue.length);
        for (var i = 0; i < this._stringValue.length; i++) {
          var c = this._stringValue.charCodeAt(i);
          stream.addUint16(c);
        }
      } else if (this._kind === HeaderValueKind.ByteSequence) {
        stream.addUint16(this._byteSequence.byteLength);
        var view = new Uint8Array(this._byteSequence);
        stream.addData(view);
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
        stream.addUint8(entry.identifier.value);
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
        stream.addUint8(entry.identifier.value);
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
      stream.addUint8(this.opCode);
      var lengthOffset = stream.length;
      stream.addUint16(0); // request length unknown at this time
      stream.addUint8(this.obexVersion);
      stream.addUint8(this.flags);
      stream.addUint16(this.maxPacketSize);
      this.headerList.serialize(stream);
      stream.setUint16(lengthOffset, stream.length);
    }
  }

  export enum ResponseCode {
    Reserved = 0x00,
    Continue = 0x10,
    Success = 0x20,
    Created = 0x21,

    MultipleChoice = 0x30,
  }

  export class Response {
    private _data: DataView;
    private _responseData: DataView;
    private _littleEndian = false;

    public constructor(data: Uint8Array) {
      this._data = new DataView(data.buffer, data.byteOffset, data.byteLength);
      this._responseData = new DataView(data.buffer, data.byteOffset + 3, data.byteLength - 3); // Skip opcode and length
    }
    public get opCode(): number { return this._data.getUint8(0); }
    public get isFinal(): boolean { return (this.opCode & 0x80) !== 0; }
    public get code(): ResponseCode { return this.opCode & 0x7f; }
    public get length(): number { return this._data.getUint16(1, this._littleEndian); }
    public get data(): DataView { return this._responseData; }
  }

  export class ResponseParser {
    private _data = new GrowableBuffer();
    private _onResponse: (value: Response) => void;

    public addData(data: Uint8Array) {
      // Add |data| at end of array.
      var offset = this._data.length;
      this._data.setLength(this._data.length + data.byteLength);
      this._data.setData(offset, data);

      // Parse data to figure out if we have a complete response.
      this.parseData();
    }

    public setHandler(value: (value: Response) => void): void {
      this._onResponse = value;
    }

    private parseData(): void {
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
    }

    private flushResponse(responseLength: number): void {
      var remaining_length = this._data.length - responseLength;
      var remaining_data = this._data.toUint8Array().subarray(responseLength, this._data.length); 
      var new_data = new GrowableBuffer();
      new_data.setLength(remaining_length);
      new_data.setData(0, remaining_data);
      this._data = new_data;
    }
  }
}
