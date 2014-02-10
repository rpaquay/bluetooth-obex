module Core {
  export class StringMap<V> implements Map<string, V> {
    private _container = Object.create(null);
    private _size = 0;

    public clear(): void {
      this._container = Object.create(null);
      this._size = 0;
    }

    public delete(key: string): boolean {
      var value = this._container[key];
      if (typeof value === "undefined")
        return false;
      delete this._container[key];
      this._size--;
      return true;
    }

    public forEach(callbackfn: (value: V, index: string, map: StringMap<V>) => void, thisArg?: any): void {
      for (var key in this._container) {
        callbackfn(this._container[key], key, this);
      }
    }

    public get(key: string): V {
      return this._container[key];
    }

    public has(key: string): boolean {
      var value = this._container[key];
      return (typeof value !== "undefined");
    }

    public set(key: string, value: V): StringMap<V> {
      var previous = this._container[key];
      this._container[key] = value;
      if (typeof previous === "undefined") {
        this._size++;
      }
      return this;
    }

    public get size(): number { return this._size; }
  }
}