declare module "node:assert/strict" {
  interface Assert {
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): void;
    throws(
      block: () => unknown,
      error?: RegExp | ((caughtError: unknown) => boolean),
      message?: string,
    ): void;
  }

  const assert: Assert;
  export default assert;
}

declare module "node:test" {
  type TestFn = () => void | Promise<void>;

  function test(name: string, fn: TestFn): void;

  export default test;
}
