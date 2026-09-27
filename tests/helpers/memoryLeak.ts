/**
 * Fleet-standard memory-leak harness — template-owned, identical across the fleet.
 *
 * A sim's tests/memory-leak.test.ts lists its disposable objects and calls
 * describeDisposalLeaks(); sim-specific leak tests can follow in the same file using
 * forceGC() directly.
 *
 * Each case is created inside a function boundary, disposed, and checked via WeakRef
 * after forced garbage collection (--expose-gc in vitest.config.ts). V8 requires a
 * function boundary (not merely a block scope) so local strong references die when
 * the helper returns.
 */

import { describe, expect, it } from "vitest";

export type DisposableObject = { dispose(): void };

export type DisposalCase = {
  /** Shown in test names, e.g. "LabModel". */
  readonly name: string;
  /** Builds a fresh instance. Must not keep references to it elsewhere. */
  readonly create: () => DisposableObject;
  /**
   * Also check that a second dispose() does not throw. Opt-in: axon Properties (and
   * PhET's Disposable) treat double disposal as a bug, so most objects legitimately
   * throw; set this for objects that promise idempotent disposal.
   */
  readonly idempotentDispose?: boolean;
};

/**
 * Force garbage collection with multiple passes, returning as soon as every given
 * reference is confirmed collected. The setTimeout(0) yield after a live deref()
 * avoids the WeakRef macrotask-liveness pin. Without refs the loop always runs all
 * passes, which on a slow gc() can exceed the Vitest testTimeout — pass refs when
 * you have them.
 */
export async function forceGC(earlyExitRefs?: WeakRef<object> | readonly WeakRef<object>[]): Promise<void> {
  const refs = earlyExitRefs === undefined ? [] : Array.isArray(earlyExitRefs) ? earlyExitRefs : [earlyExitRefs];
  for (let i = 0; i < 15; i++) {
    globalThis.gc?.();
    await new Promise<void>((r) => setTimeout(r, 50));
    if (refs.length > 0 && refs.every((ref) => ref.deref() === undefined)) {
      return;
    }
    if (refs.length > 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }
}

/** Create, dispose, and return a WeakRef to the disposed instance. */
export function createAndDispose(create: () => DisposableObject): WeakRef<object> {
  const instance = create();
  const ref = new WeakRef<object>(instance);
  instance.dispose();
  return ref;
}

/**
 * The standard suite: gc is exposed, a plain object is collected, and for each case
 * the instance is collected after dispose() and repeated create/dispose cycles leave no
 * survivors (plus, with idempotentDispose, a second dispose() does not throw).
 */
export function describeDisposalLeaks(cases: readonly DisposalCase[]): void {
  describe("Memory leak regression", () => {
    it("global.gc is available (--expose-gc)", () => {
      expect(globalThis.gc).toBeDefined();
    });

    it("sanity: plain object is collected", async () => {
      const ref = (() => new WeakRef({ hello: "world" }))();
      await forceGC(ref);
      expect(ref.deref()).toBeUndefined();
    });

    for (const { name, create, idempotentDispose = false } of cases) {
      it(`${name} is collected after dispose`, async () => {
        const ref = createAndDispose(create);
        await forceGC(ref);
        expect(ref.deref()).toBeUndefined();
      });

      if (idempotentDispose) {
        it(`${name}: double dispose() does not throw`, () => {
          const instance = create();
          instance.dispose();
          expect(() => instance.dispose()).not.toThrow();
        });
      }

      it(`${name}: repeated create/dispose cycles leave no survivors`, async () => {
        const refs: WeakRef<object>[] = [];
        for (let i = 0; i < 10; i++) {
          refs.push(createAndDispose(create));
        }
        await forceGC(refs);
        expect(refs.filter((r) => r.deref() !== undefined).length).toBe(0);
      });
    }
  });
}
