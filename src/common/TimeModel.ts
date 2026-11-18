/**
 * TimeModel.ts
 *
 * A reusable, composable timing model for simulations that need play/pause,
 * elapsed-time tracking and (optionally) a slow/normal/fast speed control.
 * Compose it into your screen model rather than extending it.
 *
 * This file is template-owned: Baton's drift check requires every sim that keeps
 * it to match the template exactly. Configure it through the constructor options
 * below; behavior that does not fit belongs in your own model, not in a fork.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *
 *   // In YourModel.ts
 *   import { TimeModel } from "../../common/TimeModel.js";
 *
 *   export class YourModel implements TModel {
 *     public readonly timer = new TimeModel();
 *
 *     public step( dt: number ): void {
 *       if ( !this.timer.isPlayingProperty.value ) { return; }
 *       this.stepOnce( dt );
 *     }
 *
 *     // Advances regardless of play/pause, so step-forward can drive it.
 *     public stepOnce( dt: number ): void {
 *       this.timer.advance( dt );
 *       // integrate the physics by dt …
 *     }
 *
 *     public reset(): void {
 *       this.timer.reset();
 *       // reset other state …
 *     }
 *   }
 *
 *   Gate the whole of step() on isPlayingProperty. A step() that only calls
 *   timer.step() stops the *clock* when paused but keeps integrating the physics
 *   below it, so the sim animates through a pause with every sample stamped at
 *   the same frozen time. A model with no physics of its own can simply call
 *   timer.step( dt ).
 *
 * ── Speed control ─────────────────────────────────────────────────────────────
 *
 *   new TimeModel( {
 *     timeSpeedMultipliers: new Map( [
 *       [ TimeSpeed.FAST, 2 ],
 *       [ TimeSpeed.NORMAL, 1 ],
 *       [ TimeSpeed.SLOW, 0.25 ],
 *     ] ),
 *   } );
 *
 *   The map's keys are the selectable speeds, in display order; its values are
 *   simulation seconds per wall-clock second. step() and scaledDt() apply the
 *   multiplier; advance() does not, so a caller that pre-scales dt (or a
 *   step-forward button) gets exactly the dt it passes. Read speedMultiplier to
 *   scale anything else (a solver, an animation) by the same factor.
 *
 * ── View wiring ───────────────────────────────────────────────────────────────
 *
 *   SceneryStack ships a TimeControlNode that binds directly to the timer.
 *   Point step-forward at a method that advances while paused — step() does
 *   nothing then:
 *
 *   import { TimeControlNode } from "scenerystack/scenery-phet";
 *
 *   const timeControl = new TimeControlNode( model.timer.isPlayingProperty, {
 *     timeSpeedProperty: model.timer.timeSpeedProperty, // only with timeSpeedMultipliers
 *     timeSpeeds: model.timer.timeSpeeds,
 *     playPauseStepButtonOptions: {
 *       stepForwardButtonOptions: {
 *         listener: () => model.stepOnce( 1 / 60 ),
 *       },
 *     },
 *   } );
 *
 * ── Options ───────────────────────────────────────────────────────────────────
 *
 *   initiallyPlaying     false   starts paused (most physics sims)
 *   units                "s"     units metadata on timeProperty; null when the
 *                                caller's clock is not in seconds
 *   timeSpeedMultipliers NORMAL→1  selectable speeds and their multipliers
 *   initialTimeSpeed     NORMAL  must be a key of timeSpeedMultipliers
 */

import { BooleanProperty, EnumerationProperty, NumberProperty, type Units } from "scenerystack/axon";
import { optionize } from "scenerystack/phet-core";
import { TimeSpeed } from "scenerystack/scenery-phet";

type TimeModelOptions = {
  /** Whether the clock runs as soon as the sim starts. */
  initiallyPlaying?: boolean;
  /** Units metadata for timeProperty; null when the caller's clock is not in seconds. */
  units?: Units | null;
  /** Selectable speeds in display order, mapped to simulation seconds per wall-clock second. */
  timeSpeedMultipliers?: ReadonlyMap<TimeSpeed, number>;
  /** Speed selected on startup and after reset(). */
  initialTimeSpeed?: TimeSpeed;
};

const NORMAL_SPEED_ONLY: ReadonlyMap<TimeSpeed, number> = new Map([[TimeSpeed.NORMAL, 1]]);

/** Composable play/pause + elapsed-time + speed model for animated sims. @public */
export class TimeModel {
  /** Whether the simulation clock is running. Bind to TimeControlNode. */
  public readonly isPlayingProperty: BooleanProperty;

  /** Elapsed simulation time (seconds unless `units` says otherwise). Resets to 0 on reset(). */
  public readonly timeProperty: NumberProperty;

  /** Selected playback speed. Bind to TimeControlNode's timeSpeedProperty. */
  public readonly timeSpeedProperty: EnumerationProperty<TimeSpeed>;

  /** Selectable speeds in display order. Pass to TimeControlNode's timeSpeeds. */
  public readonly timeSpeeds: readonly TimeSpeed[];

  private readonly timeSpeedMultipliers: ReadonlyMap<TimeSpeed, number>;

  public constructor(providedOptions?: TimeModelOptions) {
    const options = optionize<TimeModelOptions>()(
      {
        initiallyPlaying: false,
        units: "s",
        timeSpeedMultipliers: NORMAL_SPEED_ONLY,
        initialTimeSpeed: TimeSpeed.NORMAL,
      },
      providedOptions,
    );
    if (!options.timeSpeedMultipliers.has(options.initialTimeSpeed)) {
      throw new Error("TimeModel: initialTimeSpeed must be a key of timeSpeedMultipliers");
    }

    this.timeSpeedMultipliers = options.timeSpeedMultipliers;
    this.timeSpeeds = [...options.timeSpeedMultipliers.keys()];
    this.isPlayingProperty = new BooleanProperty(options.initiallyPlaying);
    this.timeProperty = new NumberProperty(0, { units: options.units });
    this.timeSpeedProperty = new EnumerationProperty(options.initialTimeSpeed, {
      validValues: [...this.timeSpeeds],
    });
  }

  /** Simulation seconds per wall-clock second at the selected speed. */
  public get speedMultiplier(): number {
    return this.timeSpeedMultipliers.get(this.timeSpeedProperty.value) ?? 1;
  }

  /** The simulation time a frame of dt wall-clock seconds covers: 0 while paused. */
  public scaledDt(dt: number): number {
    return this.isPlayingProperty.value ? dt * this.speedMultiplier : 0;
  }

  /**
   * Advance the clock by one frame of dt wall-clock seconds, scaled by the selected
   * speed. Does nothing while paused, or for a non-finite or non-positive dt.
   */
  public step(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }
    this.timeProperty.value += this.scaledDt(dt);
  }

  /**
   * Advance the clock by exactly dt (no speed scaling), playing or not: for a
   * step button, or a model that pre-scales dt or steps in whole increments.
   * A negative dt steps the clock backward.
   */
  public advance(dt: number): void {
    this.timeProperty.value += dt;
  }

  /** Resets clock, speed and playback state to their initial values. */
  public reset(): void {
    this.isPlayingProperty.reset();
    this.timeSpeedProperty.reset();
    this.timeProperty.reset();
  }

  /** Call when the model is no longer needed to free AXON listeners. */
  public dispose(): void {
    this.isPlayingProperty.dispose();
    this.timeSpeedProperty.dispose();
    this.timeProperty.dispose();
  }
}
