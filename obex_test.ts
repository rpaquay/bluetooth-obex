/// <reference path="obex.ts"/>
import Obex = require("./obex")

module Assert {
  function assertImpl(value: boolean, msg?: string) {
    if (!value) {
      throw new Error("Assertion failure (msg=" + msg + ")");
    }
  }

  export function IsTrue(value: boolean, msg?: string): void {
    assertImpl(value);
  }

  export function IsFalse(value: boolean, msg?: string): void {
    assertImpl(!value);
  }

  export function IsNull(value: any, msg?: string): void {
    assertImpl(value === null);
  }

  export function IsNotNull(value: any, msg?: string): void {
    assertImpl(value !== null);
  }
}

module Tests {
  export function Run(title: string, action: ()=>void) {
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
  Tests.Run("Headers", () => {
    Assert.IsTrue(Obex.Headers.Name.IsUnicode());
    Assert.IsFalse(Obex.Headers.Name.IsByteSequence());
    Assert.IsFalse(Obex.Headers.Count.IsUnicode());
    Assert.IsTrue(Obex.Headers.Count.IsInt32());
    Assert.IsFalse(Obex.Headers.Length.IsUnicode());
    Assert.IsTrue(Obex.Headers.Length.IsInt32());
    Assert.IsFalse(Obex.Headers.Type.IsUnicode());
    Assert.IsTrue(Obex.Headers.Type.IsByteSequence());
  });

  Tests.Run("Encoder", () => {
    var encoder = new Obex.Encoder();
    Assert.IsNotNull(encoder.GetBytes());
  });
}
