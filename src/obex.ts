// Obex component: Obex is a transport protocol conceptually similar to HTTP.
// It is a request/response message protocol where each request/response
// message is a set of headers followed by a body.

/// <reference path="core.ts"/>

module Obex {
  var LittleEndian = false;

  export function dumpByteArrayView(data: ByteArrayView) {
    var msg;
    console.log("ByteArrayView: length=" + data.byteLength);

    var txt = "";
    for (var i = 0; i < data.byteLength; i++) {
      if (i > 0) {
        if ((i % 16) == 0) {
          console.log("  Content: " + txt);
          txt = "";
        }
        else {
          txt += " ";
        }
      }

      var hex = data.getUint8(i).toString(16);
      if (hex.length == 1)
        hex = "0" + hex;
      txt += "0x" + hex;
    }

    if (txt.length > 0);
      console.log("  Content: " + txt);
  }

  export function dumpArrayBuffer(buffer: ArrayBuffer) {
    dumpByteArrayView(new ByteArrayView(buffer));
  }

  // Implements an interface similar to the union of DataView and Uint8Buffer.
  export class ByteArrayView {
    private _view: DataView;
    private static emptyBuffer = new ArrayBuffer(1);

    public constructor(buffer: ArrayBuffer, byteOffset?: number, length?: number) {
      if (typeof byteOffset === "undefined")
        byteOffset = 0;

      if (typeof length === "undefined")
        length = buffer.byteLength - byteOffset;

      // Workaround DataView bug: new DataView(new ArrayBuffer(0), 0, 0) throws!
      if (buffer.byteLength === 0 && byteOffset === 0 && length === 0)
        buffer = ByteArrayView.emptyBuffer;

      this._view = new DataView(buffer, byteOffset, length);
    }

    public get byteLength(): number { return this._view.byteLength; }

    public setUint8(offset: number, value: number): void {
      this._view.setUint8(offset, value);
    }

    public getUint8(offset: number): number {
      return this._view.getUint8(offset);
    }

    public getUint16(offset: number): number {
      return this._view.getUint16(offset, LittleEndian);
    }

    public getUint32(offset: number): number {
      return this._view.getUint32(offset, LittleEndian);
    }

    public subarray(start: number, end?: number): ByteArrayView {
      if (typeof end === "undefined")
        end = this._view.byteLength - this._view.byteOffset;
      var length = end - start;
      return new ByteArrayView(this._view.buffer, this._view.byteOffset + start, length);
    }

    public setData(data: ByteArrayView, offset: number) {
      this.toUint8Array().set(data.toUint8Array(), offset);
    }

    // Return a Uint8Array wrapping the same view of the underlying buffer as
    // this instance.
    private toUint8Array(): Uint8Array {
      return new Uint8Array(this._view.buffer, this._view.byteOffset, this._view.byteLength);
    }

    // Return an ArrayBuffer containing a *copy* of the underlying buffer
    // content.
    public toArrayBuffer(): ArrayBuffer {
      var result = new ArrayBuffer(this.byteLength);
      var view_dest = new ByteArrayView(result);
      view_dest.setData(this, 0);
      return result;
    }
  }

  // Simple growable buffer
  export class GrowableBuffer {
    private _bytes = new ByteArrayView(new ArrayBuffer(8));
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
    public setData(offset: number, data: ByteArrayView) {
      var view = this.toByteArrayView();
      view.setData(data, offset);
    }

    // Return a ByteArrayView wrapping the buffer content. Note the underlying
    // buffer content is not copied, so the returned view is only valid as long
    // as the buffer is unchanged.
    public toByteArrayView(): ByteArrayView {
      return this._bytes.subarray(0, this._length);
    }

    // Return an ArrayBuffer containing a *copy* of the buffer content.
    public toArrayBuffer(): ArrayBuffer {
      var content = this._bytes.subarray(0, this._length);
      return content.toArrayBuffer();
    }

    private grow(): void {
      // Create new (larger) buffer
      var new_len = this._bytes.byteLength * 2;
      var new_view = new ByteArrayView(new ArrayBuffer(new_len));

      // Copy old buffer content to new one
      new_view.setData(this.toByteArrayView(), 0);

      // Assign new buffer
      this._bytes = new_view;
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

    public addData(data: ByteArrayView) {
      var offset = this.length;
      this._buffer.setLength(offset + data.byteLength);
      this._buffer.setData(offset, data);
    }

    public toArrayBuffer(): ArrayBuffer {
      return this._buffer.toArrayBuffer();
    }
  }

  // Abstraction of an Obex header identifier instance.
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

  // Well known Obex header identifiers.
  export class HeaderIdentifiers {
    public static Count = new HeaderIdentifier(0xc0);
    public static Name = new HeaderIdentifier(0x01);
    public static Type = new HeaderIdentifier(0x42);
    public static Length = new HeaderIdentifier(0xc3);
    public static Body = new HeaderIdentifier(0x48);
    public static EndOfBody = new HeaderIdentifier(0x49);
    public static ConnectionId = new HeaderIdentifier(0xcf);
    public static Description = new HeaderIdentifier(0x05);
  }

  // Abstraction of an Obax Header value, with its kind and internal
  // represenation.
  export class HeaderValue {
    private _kind: HeaderValueKind;
    private _intValue: number;
    private _stringValue: string;
    private _byteSequence: ByteArrayView;

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

    public get asByteArrayView(): ByteArrayView {
      if (this._kind != HeaderValueKind.ByteSequence)
        throw new Error("Value must be of ByteSequence kind.");
      return this._byteSequence;
    }

    public setUint8(value: number): void {
      if (value < 0 || value > 255)
        throw new Error("Value must be smaller than 256.");
      if (this._kind != HeaderValueKind.Int8)
        throw new Error("Value must be of Int8 kind.");
      this._intValue = value;
    }

    public setUint32(value: number): void {
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

    public setByteSequence(value: ByteArrayView): void {
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
        // Special case for empty string.
        if (this._stringValue.length === 0) {
          // HI + 2-byte length
          var length = 1 + 2;
          stream.addUint16(length);
        }
        else {
          // HI + 2-byte length + (string length + null terminator) * sizeof(wchar_t)
          var length = 1 + 2 + (this._stringValue.length + 1) * 2;
          stream.addUint16(length);
          for (var i = 0; i < this._stringValue.length; i++) {
            var c = this._stringValue.charCodeAt(i);
            stream.addUint16(c);
          }
          stream.addUint16(0); // NULL terminator
        }
      } else if (this._kind === HeaderValueKind.ByteSequence) {
        // HI + 2-byte length + byte sequence length
        var length = 1 + 2 + this._byteSequence.byteLength;
        stream.addUint16(length);
        stream.addData(this._byteSequence);
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

    public get length() { return this._items.length; }

    public add(header: HeaderIdentifier): HeaderEntry {
      var entry = this.get(header);
      if (!entry) {
        entry = new HeaderEntry(header, new HeaderValue(header.valueKind));
        this._items.push(entry);
      }
      return entry;
    }

    public get(header: HeaderIdentifier): HeaderEntry {
      // TODO(rpaquay): Improve performance of linear search.
      for (var i = 0; i < this._items.length; i++) {
        if (this._items[i].identifier.value === header.value) {
          return this._items[i];
        }
      }
      return null;
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


  export class HeaderListParser {
    private _data: ByteArrayView;
    private _offset = 0;

    public constructor(data: ByteArrayView) {
      this._data = data;
    }

    private fetchUint8(): number {
      var result = this._data.getUint8(this._offset);
      this._offset++;
      return result;
    }

    private fetchUint16(): number {
      var result = this._data.getUint16(this._offset);
      this._offset += 2;
      return result;
    }

    private fetchUint32(): number {
      var result = this._data.getUint32(this._offset);
      this._offset += 4;
      return result;
    }

    public parse(): HeaderList {
      var list = new HeaderList();
      while (this._offset < this._data.byteLength) {
        var op_code = this.fetchUint8();
        var id = new HeaderIdentifier(op_code);
        switch (id.valueKind) {
          case HeaderValueKind.Int8:
            var value = this.parseInt8();
            list.add(id).value.setUint8(value);
            break;
          case HeaderValueKind.Int32:
            var value = this.parseInt32();
            list.add(id).value.setUint32(value);
            break;
          case HeaderValueKind.Unicode:
            var text = this.parseUnicodeString();
            list.add(id).value.setUnicode(text);
            break;
          case HeaderValueKind.ByteSequence:
            var view = this.parseByteSequence();
            list.add(id).value.setByteSequence(view);
            break;
          default:
            throw new Error("Unsupported value kind.");
        }
      }
      return list;
    }

    private parseInt8(): number {
      return this.fetchUint8();
    }

    private parseInt32(): number {
      return this.fetchUint32();
    }

    private parseUnicodeString(): string {
      var length = this.fetchUint16();
      if ((length < 3) || (length % 2 ) == 0)
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
    }

    private parseByteSequence(): ByteArrayView {
      var length = this.fetchUint16();
      if (length < 3)
        throw new Error("Invalid byte sequence format");
      var byteLength = length - 3;
      var result = this._data.subarray(this._offset, this._offset + byteLength);
      this._offset += byteLength;
      return result;
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

  // Base class for specialized request builders.
  export class RequestBuilder {
    private _opCode: RequestOpCode;
    private _headerList = new HeaderListBuilder();

    public get opCode(): RequestOpCode { return this._opCode; }
    public set opCode(value: RequestOpCode) { this._opCode = value; }

    public get headers(): HeaderListBuilder { return this._headerList; }
    public get headerList(): HeaderList { return this._headerList.headerList; }

    public serialize(stream: ByteStream): void {
      stream.addUint8(this.opCode);
      var lengthOffset = stream.length;
      stream.addUint16(0); // request length unknown at this time

      this.serializeCustomData(stream);
      this.serializeHeaders(stream);

      stream.setUint16(lengthOffset, stream.length);
    }

    // Implement in derived classes.
    public serializeCustomData(stream: ByteStream): void {
    }

    private serializeHeaders(stream: ByteStream): void {
      this._headerList.serialize(stream);
    }
  }

  // Builder for a CONNECT Obex request.
  export class ConnectRequestBuilder extends RequestBuilder {
    private _maxPacketSize = 255;

    public constructor() {
      super();
      this.opCode = RequestOpCode.Connect;
    }

    public get obexVersion(): number { return 0x10; }

    public get flags(): number { return 0x00; }

    public get maxPacketSize(): number { return this._maxPacketSize; }
    public set maxPacketSize(value: number) { this._maxPacketSize = value; }

    public get count(): number { return this.headerList.add(Obex.HeaderIdentifiers.Count).value.asInt; }
    public set count(value: number) { this.headerList.add(Obex.HeaderIdentifiers.Count).value.setUint32(value); }

    public get length(): number { return this.headerList.add(Obex.HeaderIdentifiers.Length).value.asInt; }
    public set length(value: number) { this.headerList.add(Obex.HeaderIdentifiers.Length).value.setUint32(value); }

    public serializeCustomData(stream: ByteStream): void {
      stream.addUint8(this.obexVersion);
      stream.addUint8(this.flags);
      stream.addUint16(this.maxPacketSize);
    }
  }

  // Builder for a DISCONNECT Obex request.
  export class DisconnectRequestBuilder extends RequestBuilder {
    public constructor() {
      super();
      this.opCode = RequestOpCode.Disconnect;
    }
  }

  // Builder for a PUT Obex request.
  export class PutRequestBuilder extends RequestBuilder {
    public constructor() {
      super();
      this.opCode = RequestOpCode.Put;
    }

    public get isFinal(): boolean { return (this.opCode & 0x80) !== 0; }
    public set isFinal(value: boolean) {
      if (value)
        this.opCode = this.opCode | 0x80;
      else
        this.opCode = this.opCode & ~0x80;
    }

    public get name(): string { return this.headerList.add(Obex.HeaderIdentifiers.Name).value.asString; }
    public set name(value: string) { this.headerList.add(Obex.HeaderIdentifiers.Name).value.setUnicode(value); }

    public get length(): number { return this.headerList.add(Obex.HeaderIdentifiers.Length).value.asInt; }
    public set length(value: number) { this.headerList.add(Obex.HeaderIdentifiers.Length).value.setUint32(value); }

    public get description(): string { return this.headerList.add(Obex.HeaderIdentifiers.Description).value.asString; }
    public set description(value: string) { this.headerList.add(Obex.HeaderIdentifiers.Description).value.setUnicode(value); }

    public get type(): ByteArrayView { return this.headerList.add(Obex.HeaderIdentifiers.Type).value.asByteArrayView; }
    public set type(value: ByteArrayView) { this.headerList.add(Obex.HeaderIdentifiers.Type).value.setByteSequence(value); }

    public get body(): ByteArrayView { return this.headerList.add(Obex.HeaderIdentifiers.Body).value.asByteArrayView; }
    public set body(value: ByteArrayView) { this.headerList.add(Obex.HeaderIdentifiers.Body).value.setByteSequence(value); }

    public get endOfbody(): ByteArrayView { return this.headerList.add(Obex.HeaderIdentifiers.EndOfBody).value.asByteArrayView; }
    public set endOfbody(value: ByteArrayView) { this.headerList.add(Obex.HeaderIdentifiers.EndOfBody).value.setByteSequence(value); }
  }

  export enum ResponseOpCode {
    None = 0x00,

    Continue = 0x10,

    Success = 0x20,
    Created,
    Accepted,
    NonAuthoritativeInformation,
    NoContent,
    ResetContent,
    PartialContent,

    MultipleChoice = 0x30,
    MovedPermanently,
    Movedtemporarily,
    SeeOther,
    Notmodified ,
    UseProxy,

    BadRequest = 0x40,
    Unauthorized,
    PaymentRequired,
    Forbidden,
    NotFound,
    MethodNotAllowed,
    NotAcceptable,
    ProxyAuthenticationRequired,
    RequestTimeOut,
    Conflict,
    Gone ,
    LengthRequired,
    PreconditionFailed,
    RequestedEntityTooLarge,
    RequestURLTooLarge,
    UnsupportedMediaType,

    InternalServerError = 0x50,
    NotImplemented,
    BadGateway,
    ServiceUnavailable,
    GatewayTimeout,
    HTTPVersionNotSupported,

    DatabaseFull = 0x60,
    DatabaseLocked,

  }

  //Representation of an Obex packet (request or response).
  export class Packet {
    private _packetData: ByteArrayView;
    private _data: ByteArrayView;

    public constructor(packetData: ByteArrayView) {
      this._packetData = packetData;
      this._data = packetData.subarray(3); // Skip opcode and length
    }
    public get code(): number { return this._packetData.getUint8(0); }
    public get opCode(): number { return this.code & 0x7f; }
    public get isFinal(): boolean { return (this.code & 0x80) !== 0; }
    public get length(): number { return this._packetData.getUint16(1); }
    public get data(): ByteArrayView { return this._data; }
  }

  // Processes a series of byte sequences, chunks it into Obex packets,
  // and calls |handler| for each full packet received.
  export class PacketParser {
    private _buffer = new GrowableBuffer();
    private _handler: (value: Packet) => void = null;

    public setHandler(value: (packet: Packet) => void): void {
      this._handler = value;
    }

    public addData(data: ByteArrayView): void {
      // Add |data| at end of array.
      var offset = this._buffer.length;
      this._buffer.setLength(this._buffer.length + data.byteLength);
      this._buffer.setData(offset, data);

      // Parse data to figure out if we have a complete response.
      this.parseData();
    }

    private parseData(): void {
      if (this._buffer.length < 3)
        return;

      var packet = new Packet(this._buffer.toByteArrayView());
      var packetLength = packet.length;

      // If we haven't receive all the packet data yet, return.
      if (this._buffer.length < packetLength)
        return;

      // Create full packet and flush it from buffer.
      packet = new Packet(this._buffer.toByteArrayView().subarray(0, packetLength));
      this.flushPacket(packetLength);
      this._handler(packet);
    }

    private flushPacket(packetLength: number): void {
      var remaining_length = this._buffer.length - packetLength;
      var remaining_data = this._buffer.toByteArrayView().subarray(packetLength, this._buffer.length);
      var new_data = new GrowableBuffer();
      new_data.setLength(remaining_length);
      new_data.setData(0, remaining_data);
      this._buffer = new_data;
    }
  }

  // Representation of an Obex CONNECT response packet.
  export class ConnectResponse {
    private _headerList: HeaderList = null;
    public constructor(private _packet: Packet) {
    }

    public get opCode(): ResponseOpCode { return this._packet.opCode; }
    public get obexVersion(): number { return this._packet.data.getUint8(0); }
    public get flags(): number { return this._packet.data.getUint8(1); }
    public get maxPacketSize(): number { return this._packet.data.getUint16(2); }
    public get headerList(): HeaderList {
      if (this._headerList === null) {
        // 4 = 1 (version) + 1 (flags) + 2 (maxPacketSize)
        var view = this._packet.data.subarray(4);
        var parser = new HeaderListParser(view);
        this._headerList = parser.parse();
      }
      return this._headerList;
    }
  }
}
