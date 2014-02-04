/// <reference path="obex.ts"/>
var Obex = require("./obex");

var Assert;
(function (Assert) {
    function assertImpl(value, msg) {
        if (!value) {
            throw new Error("Assertion failure (msg=" + msg + ")");
        }
    }

    function IsTrue(value, msg) {
        assertImpl(value);
    }
    Assert.IsTrue = IsTrue;

    function IsFalse(value, msg) {
        assertImpl(!value);
    }
    Assert.IsFalse = IsFalse;

    function IsNull(value, msg) {
        assertImpl(value === null);
    }
    Assert.IsNull = IsNull;

    function IsNotNull(value, msg) {
        assertImpl(value !== null);
    }
    Assert.IsNotNull = IsNotNull;
})(Assert || (Assert = {}));

var Tests;
(function (Tests) {
    function Run(title, action) {
        console.log(">>>>>>>>>> Running \"" + title + "\" tests <<<<<<<<<<<<");
        try  {
            action();
        } catch (e) {
            console.log(">>>>>>>>>> Failure <<<<<<<<<<<<");
            throw e;
        }
        console.log(">>>>>>>>>> Success <<<<<<<<<<<<");
    }
    Tests.Run = Run;
})(Tests || (Tests = {}));

var ObexTests;
(function (ObexTests) {
    Tests.Run("Headers", function () {
        Assert.IsTrue(Obex.Headers.Name.IsUnicode());
        Assert.IsFalse(Obex.Headers.Name.IsByteSequence());
        Assert.IsFalse(Obex.Headers.Count.IsUnicode());
        Assert.IsTrue(Obex.Headers.Count.IsInt32());
        Assert.IsFalse(Obex.Headers.Length.IsUnicode());
        Assert.IsTrue(Obex.Headers.Length.IsInt32());
        Assert.IsFalse(Obex.Headers.Type.IsUnicode());
        Assert.IsTrue(Obex.Headers.Type.IsByteSequence());
    });

    Tests.Run("Encoder", function () {
        var encoder = new Obex.Encoder();
        Assert.IsNotNull(encoder.GetBytes());
    });
})(ObexTests || (ObexTests = {}));
