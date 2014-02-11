var Core;
(function (Core) {
    var StringMap = (function () {
        function StringMap() {
            this._container = Object.create(null);
            this._size = 0;
        }
        StringMap.prototype.clear = function () {
            this._container = Object.create(null);
            this._size = 0;
        };

        StringMap.prototype.delete = function (key) {
            var value = this._container[key];
            if (typeof value === "undefined")
                return false;
            delete this._container[key];
            this._size--;
            return true;
        };

        StringMap.prototype.forEach = function (callbackfn, thisArg) {
            for (var key in this._container) {
                callbackfn(this._container[key], key, this);
            }
        };

        StringMap.prototype.get = function (key) {
            return this._container[key];
        };

        StringMap.prototype.has = function (key) {
            var value = this._container[key];
            return (typeof value !== "undefined");
        };

        StringMap.prototype.set = function (key, value) {
            var previous = this._container[key];
            this._container[key] = value;
            if (typeof previous === "undefined") {
                this._size++;
            }
            return this;
        };

        Object.defineProperty(StringMap.prototype, "size", {
            get: function () {
                return this._size;
            },
            enumerable: true,
            configurable: true
        });
        return StringMap;
    })();
    Core.StringMap = StringMap;
})(Core || (Core = {}));
//# sourceMappingURL=core.js.map
