import obex = require("./obex");
var Obex = obex.Obex;

module Assert {
  export function fail(msg: string): void {
    throw new Error(msg);
  }

  function assertImpl(value: boolean, msg?: string) {
    if (!value) {
      fail("Assertion failure (msg=" + msg + ")");
    }
  }

  export function isTrue(value: boolean, msg?: string): void {
    assertImpl(value);
  }

  export function isFalse(value: boolean, msg?: string): void {
    assertImpl(!value);
  }

  export function isNull(value: any, msg?: string): void {
    assertImpl(value === null);
  }

  export function isNotNull(value: any, msg?: string): void {
    assertImpl(value !== null);
  }

  export function isEqual<T>(expected: T, value: T, msg?: string): void {
    if (value != expected) {
      Assert.fail("Expected value " + expected + " instead of " + value);
    }
  }
}

module Tests {
  export function run(title: string, action: ()=>void) {
    console.log(">>>>>>>>>> Running \"" + title + "\" tests <<<<<<<<<<<<");
    try {
      action();
    }
    catch (e) {
      console.log(">>>>>>>>>> Failure <<<<<<<<<<<<");
      throw e;
    }
    console.log(">>>>>>>>>> Success <<<<<<<<<<<<");
  }
}

module ObexTests {
  Tests.run("Headers", () => {
    Assert.isTrue(Obex.HeaderIdentifiers.Name.isUnicode());
    Assert.isFalse(Obex.HeaderIdentifiers.Name.isByteSequence());
    Assert.isFalse(Obex.HeaderIdentifiers.Count.isUnicode());
    Assert.isTrue(Obex.HeaderIdentifiers.Count.isInt32());
    Assert.isFalse(Obex.HeaderIdentifiers.Length.isUnicode());
    Assert.isTrue(Obex.HeaderIdentifiers.Length.isInt32());
    Assert.isFalse(Obex.HeaderIdentifiers.Type.isUnicode());
    Assert.isTrue(Obex.HeaderIdentifiers.Type.isByteSequence());
  });

  Tests.run("ByteStream", () => {
    var stream = new Obex.ByteStream(16000);
    stream.add(5);
    var buffer = stream.toBuffer();
    Assert.isNotNull(buffer);
    Assert.isEqual(1, buffer.byteLength);
  });

  Tests.run("Encoder1", () => {
    var encoder = new Obex.Encoder();
    var stream = new Obex.ByteStream(16000);
    encoder.serialize(stream);
    var buffer = stream.toBuffer();
    Assert.isNotNull(buffer);
    Assert.isEqual(0, buffer.byteLength);
  });

  Tests.run("Encoder2", () => {
    var encoder = new Obex.Encoder();
    encoder.headerList.add(Obex.HeaderIdentifiers.Count).value.setInt8(1);

    var stream = new Obex.ByteStream(16000);
    encoder.serialize(stream);
    var buffer = stream.toBuffer();
    Assert.isNotNull(buffer);
    Assert.isEqual(2, buffer.byteLength);
  });

  Tests.run("Encoder3", () => {
    var encoder = new Obex.Encoder();
    // 1 + 1 bytes
    encoder.headerList.add(Obex.HeaderIdentifiers.Count).value.setInt8(1);
    // 1 + 2 + 2 * 4 bytes
    encoder.headerList.add(Obex.HeaderIdentifiers.Name).value.setUnicode("toto");
    // 1 + 4 bytes
    encoder.headerList.add(Obex.HeaderIdentifiers.Length).value.setInt32(245);
    // 1 + 2 + 100 bytes
    encoder.headerList.add(Obex.HeaderIdentifiers.Body).value.setByteSequence(new ArrayBuffer(100));

    var stream = new Obex.ByteStream(16000);
    encoder.serialize(stream);
    var buffer = stream.toBuffer();
    Assert.isNotNull(buffer);
    Assert.isEqual(121, buffer.byteLength);
  });
}
