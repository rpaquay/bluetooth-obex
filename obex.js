// Obex component: Obex is a transport protocol conceptually similar to HTTP.
// It is a request/response message protocol where each request/response
// message is a set of headers followed by a body.
// Headers identifers (and hepler functions)
var HeaderIdentifier = (function () {
    function HeaderIdentifier(value) {
        this.value = value;
    }
    HeaderIdentifier.prototype.HiBits = function () {
        return (this.value & 0xc0);
    };

    HeaderIdentifier.prototype.IsUnicode = function () {
        return this.HiBits() === HeaderIdentifier.HIGH_Unicode;
    };

    HeaderIdentifier.prototype.IsByteSequence = function () {
        return this.HiBits() === HeaderIdentifier.HIGH_ByteSequence;
    };

    HeaderIdentifier.prototype.IsInt8 = function () {
        return this.HiBits() === HeaderIdentifier.HIGH_Int8;
    };

    HeaderIdentifier.prototype.IsInt32 = function () {
        return this.HiBits() === HeaderIdentifier.HIGH_Int32;
    };

    HeaderIdentifier.HIGH_Unicode = 0x00;
    HeaderIdentifier.HIGH_ByteSequence = 0x40;
    HeaderIdentifier.HIGH_Int8 = 0x80;
    HeaderIdentifier.HIGH_Int32 = 0xc0;
    return HeaderIdentifier;
})();
exports.HeaderIdentifier = HeaderIdentifier;

var Headers = (function () {
    function Headers() {
    }
    Headers.Count = new HeaderIdentifier(0xc0);
    Headers.Name = new HeaderIdentifier(0x01);
    Headers.Type = new HeaderIdentifier(0x42);
    Headers.Length = new HeaderIdentifier(0xc3);
    return Headers;
})();
exports.Headers = Headers;

var Encoder = (function () {
    function Encoder() {
    }
    Encoder.prototype.AddUnicodeHeader = function (header, value) {
    };

    Encoder.prototype.GetBytes = function () {
        var result = new ArrayBuffer(100);
        return result;
    };
    return Encoder;
})();
exports.Encoder = Encoder;
