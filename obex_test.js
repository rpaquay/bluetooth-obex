var obex = require("./obex");
var Obex = obex.Obex;

var Assert;
(function (Assert) {
    function fail(msg) {
        throw new Error(msg);
    }
    Assert.fail = fail;

    function assertImpl(value, msg) {
        if (!value) {
            fail("Assertion failure (msg=" + msg + ")");
        }
    }

    function isTrue(value, msg) {
        assertImpl(value);
    }
    Assert.isTrue = isTrue;

    function isFalse(value, msg) {
        assertImpl(!value);
    }
    Assert.isFalse = isFalse;

    function isNull(value, msg) {
        assertImpl(value === null);
    }
    Assert.isNull = isNull;

    function isNotNull(value, msg) {
        assertImpl(value !== null);
    }
    Assert.isNotNull = isNotNull;

    function isEqual(expected, value, msg) {
        if (value != expected) {
            Assert.fail("Expected value " + expected + " instead of " + value);
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
    Tests.run("Headers", function () {
        Assert.isTrue(Obex.HeaderIdentifiers.Name.isUnicode);
        Assert.isFalse(Obex.HeaderIdentifiers.Name.isByteSequence);
        Assert.isFalse(Obex.HeaderIdentifiers.Count.isUnicode);
        Assert.isTrue(Obex.HeaderIdentifiers.Count.isInt32);
        Assert.isFalse(Obex.HeaderIdentifiers.Length.isUnicode);
        Assert.isTrue(Obex.HeaderIdentifiers.Length.isInt32);
        Assert.isFalse(Obex.HeaderIdentifiers.Type.isUnicode);
        Assert.isTrue(Obex.HeaderIdentifiers.Type.isByteSequence);
    });

    Tests.run("ByteStream", function () {
        var stream = new Obex.ByteStream();
        stream.add8(5);
        var buffer = stream.toBuffer();
        Assert.isNotNull(buffer);
        Assert.isEqual(1, buffer.byteLength);
    });

    Tests.run("Encoder1", function () {
        var encoder = new Obex.HeaderListBuilder();
        var stream = new Obex.ByteStream();
        encoder.serialize(stream);
        var buffer = stream.toBuffer();
        Assert.isNotNull(buffer);
        Assert.isEqual(0, buffer.byteLength);
    });

    Tests.run("Encoder2", function () {
        var encoder = new Obex.HeaderListBuilder();
        encoder.headerList.add(Obex.HeaderIdentifiers.Count).value.setInt32(1);

        var stream = new Obex.ByteStream();
        encoder.serialize(stream);
        var buffer = stream.toBuffer();
        Assert.isNotNull(buffer);
        Assert.isEqual(5, buffer.byteLength);
    });

    Tests.run("Encoder3", function () {
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

    Tests.run("ConnectRequestBuilder", function () {
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
})(ObexTests || (ObexTests = {}));
