/// <reference path="obex.ts"/>

module Assert {
  export function fail(msg: string): void {
    throw new Error(msg);
  }

  function assertImpl(value: boolean, msg?: string) {
    if (!value) {
      if (typeof msg === "undefined")
        msg = "Assertion failure.";
      else
        msg = "Assertion failure: " + msg;
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
  Tests.run("TypedArrays", () => {
    var x = new ArrayBuffer(0);
    var y1 = new Uint8Array(x, 0, 0);
    //var y2 = new DataView(x, 0, 0); // throws!
  });

  Tests.run("Headers", () => {
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

  Tests.run("ByteArrayView_emtpy", () => {
    // Prepare

    // Act
    var view = new Obex.ByteArrayView(new ArrayBuffer(0), 0, 0);

    // Assert
    Assert.isEqual(0, view.byteLength);
  });

  Tests.run("ByteArrayView_setUint8", () => {
    // Prepare
    var view = new Obex.ByteArrayView(new ArrayBuffer(20), 2, 10);

    // Act
    view.setUint8(5, 63);

    // Assert
    Assert.isEqual(10, view.byteLength);
    Assert.isEqual(63, view.getUint8(5));
  });

  Tests.run("ByteArrayView_SetData", () => {
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

  Tests.run("ByteArrayView_Subarray", () => {
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

  Tests.run("ByteArrayView_ToArrayBuffer", () => {
    // Prepare
    var empty_view = new Obex.ByteArrayView(new ArrayBuffer(10), 0, 0);
    var view = new Obex.ByteArrayView(new ArrayBuffer(5), 1, 3);

    // Act
    view.setUint8(2, 127);

    // Assert
    Assert.isEqual(0, empty_view.toArrayBuffer().byteLength);
    Assert.isEqual(3, view.toArrayBuffer().byteLength);
  });

  Tests.run("ByteStream1", () => {
    // Prepare
    var stream = new Obex.ByteStream();

    // Act
    stream.addUint8(5);
    var buffer = stream.toArrayBuffer();

    // Assert
    Assert.isNotNull(buffer);
    Assert.isEqual(1, buffer.byteLength);
  });

  Tests.run("ByteStream2", () => {
    // Prepare
    var stream = new Obex.ByteStream();

    // Act
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

  Tests.run("HeaderListBuilder1", () => {
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

  Tests.run("HeaderListBuilder2", () => {
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

  Tests.run("HeaderListBuilder3", () => {
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

  Tests.run("ConnectRequestBuilder", () => {
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

  Tests.run("ResponseParser1", () => {
    // Prepare
    var dataStream = new Obex.ByteStream();
    dataStream.addUint8(Obex.ResponseCode.Success);
    dataStream.addUint16(10); // length
    for (var i = 0; i < 7; i++) {
      dataStream.addUint8(i);
    }

    var parser = new Obex.ResponseParser();
    var responseCount = 0;
    var lastResponse: Obex.Response = null;
    parser.setHandler(response => {
      lastResponse = response;
      responseCount++;
    });

    // Act
    parser.addData(dataStream.buffer.toByteArrayView().subarray(0, 3));
    parser.addData(dataStream.buffer.toByteArrayView().subarray(3, 10));

    // Assert
    Assert.isEqual(1, responseCount);
    Assert.isNotNull(lastResponse);
    Assert.isEqual(Obex.ResponseCode.Success, lastResponse.code);
    Assert.isEqual(10, lastResponse.length);
    Assert.isEqual(7, lastResponse.data.byteLength);
  });

  Tests.run("ResponseParser2", () => {
    // Prepare
    var dataStream = new Obex.ByteStream();
    dataStream.addUint8(Obex.ResponseCode.Success);
    dataStream.addUint16(10); // length
    for (var i = 0; i < 7; i++) {
      dataStream.addUint8(i);
    }
    dataStream.addUint8(Obex.ResponseCode.Created);
    dataStream.addUint16(4); // length
    dataStream.addUint8(0xa0);

    var parser = new Obex.ResponseParser();
    var responseCount = 0;
    var lastResponse: Obex.Response = null;
    parser.setHandler(response => {
      lastResponse = response;
      responseCount++;
    });

    // Act
    parser.addData(dataStream.buffer.toByteArrayView().subarray(0, 13));

    // Assert
    Assert.isEqual(1, responseCount);
    Assert.isNotNull(lastResponse);
    Assert.isEqual(Obex.ResponseCode.Success, lastResponse.code);
    Assert.isEqual(10, lastResponse.length);
    Assert.isEqual(7, lastResponse.data.byteLength);
    lastResponse = null;

    // Act
    parser.addData(dataStream.buffer.toByteArrayView().subarray(13, 14));

    // Assert
    Assert.isEqual(2, responseCount);
    Assert.isNotNull(lastResponse);
    Assert.isEqual(Obex.ResponseCode.Created, lastResponse.code);
    Assert.isEqual(4, lastResponse.length);
    Assert.isEqual(1, lastResponse.data.byteLength);
  });

  Tests.run("HeaderParser", () => {
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

  function foo(x: number, y = x) {
  }
}
