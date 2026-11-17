/**
 * Fleet-standard memory-leak harness — template-owned, identical across the fleet.
 *
 * A sim's tests/memory-leak.test.ts lists its disposable objects and calls
 * describeDisposalLeaks(); sim-specific leak tests can follow in the same file using
 * forceGC(), expectNoListenerGrowth(), and keepAlive sentinels.
 *
 * Each case is created inside a function boundary, disposed, and checked via WeakRef
 * after forced garbage collection (--expose-gc in vitest.config.ts). V8 requires a
 * function boundary (not merely a block scope) so local strong references die when
 * the helper returns.
 */

import { describe, expect, it } from "vitest";

/** @public */
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
  /**
   * Long-lived objects that must stay reachable while the disposed instance is checked
   * for collection (e.g. model Properties or color Properties the node linked to).
   * Proves dispose() unlinked from state that outlives the instance. The harness holds
   * strong references to the returned objects until after the WeakRef assertion.
   */
  readonly keepAlive?: () => readonly object[];
};

/**
 * Options for describeDisposalLeaks. When `cases` is empty, `emptyOk` is required: a
 * short rationale naming the custom forceGC / expectNoListenerGrowth coverage below
 * (or why the sim has no disposables). Compliance and the suite both enforce this.
 */
export type DescribeDisposalLeaksOptions = {
  readonly emptyOk?: string;
};

/** Runtime shape of axon Property listener bookkeeping (private in the .d.ts). */
type HasListenerCount = { getListenerCount(): number };

/**
 * Force garbage collection with multiple passes, returning as soon as every given
 * reference is confirmed collected. The setTimeout(0) yield after a live deref()
 * avoids the WeakRef macrotask-liveness pin. Without refs the loop always runs all
 * passes, which on a slow gc() can exceed the Vitest testTimeout — pass refs when
 * you have them.
 *
 * @public
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

/** Create, dispose, and return a WeakRef to the disposed instance. @public */
export function createAndDispose(create: () => DisposableObject): WeakRef<object> {
  const instance = create();
  const ref = new WeakRef<object>(instance);
  instance.dispose();
  return ref;
}

/**
 * axon Property listener count (public at runtime, private in the type declarations).
 * Prefer this over casting at each call site.
 *
 * @public
 */
export function listenerCount(property: object): number {
  return (property as HasListenerCount).getListenerCount();
}

/**
 * Run `exercise` several times and assert that none of the given Properties gained
 * listeners. Catches "forgot to unlink" even when the owner is intentionally
 * non-disposable (`isDisposable: false`) or GC is inconclusive.
 *
 * @public
 */
export async function expectNoListenerGrowth(
  properties: readonly object[],
  exercise: () => void | Promise<void>,
  options?: { readonly rounds?: number; readonly label?: string },
): Promise<void> {
  const rounds = options?.rounds ?? 5;
  const label = options?.label ?? "listener counts must not grow";
  const before = properties.map(listenerCount);
  for (let i = 0; i < rounds; i++) {
    await exercise();
  }
  expect(properties.map(listenerCount), label).toEqual(before);
}

/**
 * The standard suite: gc is exposed, a plain object is collected, and for each case
 * the instance is collected after dispose() and repeated create/dispose cycles leave no
 * survivors (plus, with idempotentDispose, a second dispose() does not throw).
 * With keepAlive, the sentinels stay strongly referenced through the collection check.
 */
export function describeDisposalLeaks(cases: readonly DisposalCase[], options?: DescribeDisposalLeaksOptions): void {
  describe("Memory leak regression", () => {
    it("global.gc is available (--expose-gc)", () => {
      expect(globalThis.gc).toBeDefined();
    });

    it("sanity: plain object is collected", async () => {
      const ref = (() => new WeakRef({ hello: "world" }))();
      await forceGC(ref);
      expect(ref.deref()).toBeUndefined();
    });

    if (cases.length === 0) {
      it("empty case list documents why (emptyOk)", () => {
        expect(
          options?.emptyOk,
          "describeDisposalLeaks([]) requires emptyOk naming the custom coverage below",
        ).toBeTruthy();
        expect(options!.emptyOk!.trim().length, "emptyOk must be a non-trivial rationale").toBeGreaterThan(10);
      });
    }

    for (const { name, create, idempotentDispose = false, keepAlive } of cases) {
      it(`${name} is collected after dispose`, async () => {
        const sentinels = keepAlive?.() ?? [];
        const ref = createAndDispose(create);
        await forceGC(ref);
        expect(ref.deref(), `${name} was retained after dispose`).toBeUndefined();
        // Keep sentinels alive through the assertion so a leak against them can fail.
        expect(sentinels.length).toBeGreaterThanOrEqual(0);
      });

      if (idempotentDispose) {
        it(`${name}: double dispose() does not throw`, () => {
          const instance = create();
          instance.dispose();
          expect(() => instance.dispose()).not.toThrow();
        });
      }

      it(`${name}: repeated create/dispose cycles leave no survivors`, async () => {
        const sentinels = keepAlive?.() ?? [];
        const refs: WeakRef<object>[] = [];
        for (let i = 0; i < 10; i++) {
          refs.push(createAndDispose(create));
        }
        await forceGC(refs);
        expect(
          refs.filter((r) => r.deref() !== undefined).length,
          `${name} left survivors after repeated dispose`,
        ).toBe(0);
        expect(sentinels.length).toBeGreaterThanOrEqual(0);
      });
    }
  });
}
