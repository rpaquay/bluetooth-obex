// Obex component: Obex is a transport protocol conceptually similar to HTTP.
// It is a request/response message protocol where each request/response
// message is a set of headers followed by a body.

// Headers identifers (and hepler functions)
export class HeaderIdentifier {
  public constructor(public value: number) {
  }

  private HiBits(): number {
    return (this.value & 0xc0);
  }

  public IsUnicode(): boolean {
    return this.HiBits() === HeaderIdentifier.HIGH_Unicode;
  }

  public IsByteSequence(): boolean {
    return this.HiBits() === HeaderIdentifier.HIGH_ByteSequence;
  }

  public IsInt8(): boolean {
    return this.HiBits() === HeaderIdentifier.HIGH_Int8;
  }

  public IsInt32(): boolean {
    return this.HiBits() === HeaderIdentifier.HIGH_Int32;
  }

  static HIGH_Unicode = 0x00;
  static HIGH_ByteSequence = 0x40;
  static HIGH_Int8 = 0x80;
  static HIGH_Int32 = 0xc0;
}

export class Headers {
  public static Count = new HeaderIdentifier(0xc0);
  public static Name = new HeaderIdentifier(0x01);
  public static Type = new HeaderIdentifier(0x42);
  public static Length = new HeaderIdentifier(0xc3);
}

export class Encoder {
  public AddUnicodeHeader(header: HeaderIdentifier, value: string): void {
  }

  public GetBytes(): ArrayBuffer {
    var result = new ArrayBuffer(100);
    return result;
  }
}
