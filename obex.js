// Obex component: Obex is a transport protocol conceptually similar to HTTP.
// It is a request/response message protocol where each request/response
// message is a set of headers followed by a body.
var Obex = {};
(function (Obex) {
  var Headers = function () {
    function Headers() {
    }
    Headers.Count = 0xc0;
    Headers.Type = 0x42;
    Headers.Name = 0x01;
    Headers.Length = 0xc3;
    return Headers;
  }();
  Obex.Headers = Headers;

  var Encoder = function () {
    function Encoder() {
    }

    return Encoder;
  }();
  Obex.Encoder = Encoder;

  var Decoder = function () {
    function Decoder() {
    }

    return Decoder;
  }();
  Obex.Decoder = Decoder;
})(Obex);
