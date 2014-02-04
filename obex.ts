// Obex component: Obex is a transport protocol conceptually similar to HTTP.
// It is a request/response message protocol where each request/response
// message is a set of headers followed by a body.

export module Obex {
  export class ByteStream {
    private _bytes: Uint8Array;
    private _offset = 0;

    public constructor(length: number) {
      this._bytes = new Uint8Array(length);
    }

    public add(value: number) {
      if (value < 0 || value > 255)
        throw new Error("Value must be between 0 and 255.");

      this._bytes.set(this._offset, value);
      this._offset++;
    }

    public toBuffer(): ArrayBuffer {
      var size = this._offset;
      var view = new Uint8Array(this._bytes.buffer, 0, size);
      var result = new Uint8Array(size);
      result.set(view, 0);
      return result.buffer;
    }
  }

  // Headers identifers (and hepler functions)
  export class HeaderIdentifier {
    public constructor(public value: number) {
    }

    private highBits(): number {
      return (this.value & 0xc0);
    }

    public isUnicode(): boolean {
      return this.highBits() === HeaderIdentifier.HIGH_Unicode;
    }

    public isByteSequence(): boolean {
      return this.highBits() === HeaderIdentifier.HIGH_ByteSequence;
    }

    public isInt8(): boolean {
      return this.highBits() === HeaderIdentifier.HIGH_Int8;
    }

    public isInt32(): boolean {
      return this.highBits() === HeaderIdentifier.HIGH_Int32;
    }

    static HIGH_Unicode = 0x00;
    static HIGH_ByteSequence = 0x40;
    static HIGH_Int8 = 0x80;
    static HIGH_Int32 = 0xc0;
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
    private _kind: number;
    private _intValue: number;
    private _stringValue: string;
    private _byteSequence: ArrayBuffer;

    public constructor() {
      this.reset();
    }

    private reset(): void {
      this._kind = 0;
      this._intValue = 0;
      this._stringValue = null;
      this._byteSequence = null;
    }

    public setInt8(value: number): void {
      if (value > 0xff)
        throw new Error("Value must be smaller than 256.");
      this.reset();
      this._kind = HeaderIdentifier.HIGH_Int8;
      this._intValue = value;
    }

    public setInt32(value: number): void {
      if (value > 0xffffffff)
        throw new Error("Value must be smaller than 2^32.");
      this.reset();
      this._kind = HeaderIdentifier.HIGH_Int32;
      this._intValue = value;
    }

    public setUnicode(value: string): void {
      this.reset();
      this._kind = HeaderIdentifier.HIGH_Unicode;
      this._stringValue = value;
    }

    public setByteSequence(value: ArrayBuffer): void {
      this.reset();
      this._kind = HeaderIdentifier.HIGH_ByteSequence;
      this._byteSequence = value;
    }

    public serialize(stream: ByteStream): void {
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
    }
  }

  export class HeaderEntry {
    public constructor(
      private _identifier: HeaderIdentifier,
      private _value: HeaderValue) {
    }

    public get identifier() { return this._identifier; }
    public get value() { return this._value; }
  }

  export class HeaderList {
    private _items: HeaderEntry[] = [];

    public add(header: HeaderIdentifier): HeaderEntry {
      var value = this._items[header.value];
      if (!value) {
        value = new HeaderEntry(header, new HeaderValue());
        this._items[header.value] = value;
      }
      return value;
    }

    public forEach(action: (entry: HeaderEntry) => void): void {
      this._items.forEach((value, index) => {
        action(value);
      });
    }
  }

  export class Encoder {
    public _headerList = new HeaderList();

    public get headerList(): HeaderList {
      return this._headerList;
    }

    public serialize(stream: ByteStream): void {
      this.headerList.forEach(entry => {
        stream.add(entry.identifier.value);
        entry.value.serialize(stream);
      });
    }
  }
}
