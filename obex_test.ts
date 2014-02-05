/// <reference path="obex.ts"/>

module Assert {
  export function fail(msg: string): void {
    throw new Error(msg);
  }

  function assertImpl(value: boolean, msg: string) {
    if (!value) {
      if (msg)
        msg = "Assertion failure: " + msg;
      else
        msg = "Assertion failure.";
      fail(msg);
    }
  }

  export function isTrue(value: boolean, msg?: string): void {
    assertImpl(value, msg);
  }

  export function isFalse(value: boolean, msg?: string): void {
    assertImpl(!value, msg);
  }

  export function isNull(value: any, msg?: string): void {
    assertImpl(value === null, msg);
  }

  export function isNotNull(value: any, msg?: string): void {
    assertImpl(value !== null, msg);
  }

  export function isEqual<T>(expected: T, value: T, msg?: string): void {
    if (value !== expected) {
      fail("Expected value " + expected + " instead of " + value);
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
    Assert.isTrue(Obex.HeaderIdentifiers.Name.isUnicode);
    Assert.isFalse(Obex.HeaderIdentifiers.Name.isByteSequence);
    Assert.isFalse(Obex.HeaderIdentifiers.Count.isUnicode);
    Assert.isTrue(Obex.HeaderIdentifiers.Count.isInt32);
    Assert.isFalse(Obex.HeaderIdentifiers.Length.isUnicode);
    Assert.isTrue(Obex.HeaderIdentifiers.Length.isInt32);
    Assert.isFalse(Obex.HeaderIdentifiers.Type.isUnicode);
    Assert.isTrue(Obex.HeaderIdentifiers.Type.isByteSequence);
  });

  Tests.run("ByteStream1", () => {
    var stream = new Obex.ByteStream();
    stream.addByte(5);
    var buffer = stream.toBuffer();
    Assert.isNotNull(buffer);
    Assert.isEqual(1, buffer.byteLength);
  });

  Tests.run("ByteStream2", () => {
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

  Tests.run("Encoder1", () => {
    var encoder = new Obex.HeaderListBuilder();
    var stream = new Obex.ByteStream();
    encoder.serialize(stream);
    var buffer = stream.toBuffer();
    Assert.isNotNull(buffer);
    Assert.isEqual(0, buffer.byteLength);
  });

  Tests.run("Encoder2", () => {
    var encoder = new Obex.HeaderListBuilder();
    encoder.headerList.add(Obex.HeaderIdentifiers.Count).value.setInt32(1);

    var stream = new Obex.ByteStream();
    encoder.serialize(stream);
    var buffer = stream.toBuffer();
    Assert.isNotNull(buffer);
    Assert.isEqual(5, buffer.byteLength);
  });

  Tests.run("Encoder3", () => {
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

  Tests.run("ConnectRequestBuilder", () => {
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
}
