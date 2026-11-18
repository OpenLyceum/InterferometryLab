/**
 * TimeModel.test.ts
 *
 * Sample unit test shipped with the template so new sims are testable by default.
 * Exercises the composable play/pause + elapsed-time model in src/common/TimeModel.ts.
 * Delete or replace these when building a real sim — but keep at least one test so the
 * fleet-wide CI "test" step has something to run.
 */

import { describe, expect, it } from "vitest";
import { TimeModel } from "../src/common/TimeModel.js";

describe("TimeModel", () => {
  it("starts paused at time 0 by default", () => {
    const model = new TimeModel();
    expect(model.isPlayingProperty.value).toBe(false);
    expect(model.timeProperty.value).toBe(0);
    model.dispose();
  });

  it("can start playing when constructed with initiallyPlaying", () => {
    const model = new TimeModel({ initiallyPlaying: true });
    expect(model.isPlayingProperty.value).toBe(true);
    model.dispose();
  });

  it("does not advance time while paused", () => {
    const model = new TimeModel();
    model.step(1);
    expect(model.timeProperty.value).toBe(0);
    model.dispose();
  });

  it("accumulates time while playing", () => {
    const model = new TimeModel({ initiallyPlaying: true });
    model.step(0.5);
    model.step(0.25);
    expect(model.timeProperty.value).toBeCloseTo(0.75);
    model.dispose();
  });

  it("reset() restores the initial playback state and clears time", () => {
    const model = new TimeModel();
    model.isPlayingProperty.value = true;
    model.step(2);
    model.reset();
    expect(model.isPlayingProperty.value).toBe(false);
    expect(model.timeProperty.value).toBe(0);
    model.dispose();
  });
});
