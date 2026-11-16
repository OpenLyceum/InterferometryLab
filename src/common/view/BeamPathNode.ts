import { BEAM_PATH_NODE_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * BeamPathNode.ts
 *
 * A beam of light travelling across the optical table, drawn as a bright core
 * inside a soft halo. The halo does the work of making the line read as emitted
 * light rather than as a drawn wire; without it a 2 px stroke on a dark table
 * looks like a diagram of a beam instead of a beam.
 *
 * The path itself is fixed once a screen lays out its table — mirrors move by
 * nanometres, which is far below one pixel — so only the colour and brightness
 * are reactive.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import type { Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { type Color, Node, Path } from "scenerystack/scenery";

/** Stroke width of the bright core of a beam, view pixels. */
const CORE_WIDTH: number = BEAM_PATH_NODE_SETTINGS.CORE_WIDTH;

/** Stroke width of the halo around a beam, view pixels. */
const HALO_WIDTH: number = BEAM_PATH_NODE_SETTINGS.HALO_WIDTH;

/** Opacity of the halo at full beam intensity. */
const HALO_OPACITY: number = BEAM_PATH_NODE_SETTINGS.HALO_OPACITY;

export type BeamPathNodeOptions = {
  /** Relative brightness of this beam, 0–1. Defaults to a constant 1. */
  readonly intensityProperty?: TReadOnlyProperty<number>;
};

export class BeamPathNode extends Node {
  private readonly core: Path;
  private readonly halo: Path;
  private readonly intensityProperty?: TReadOnlyProperty<number>;
  private readonly intensityListener?: (intensity: number) => void;

  /**
   * @param points - the beam's vertices in view coordinates, in travel order
   * @param colorProperty - colour of the light, normally derived from its wavelength
   * @param options
   */
  public constructor(
    points: readonly Vector2[],
    colorProperty: TReadOnlyProperty<Color>,
    options?: BeamPathNodeOptions,
  ) {
    super();

    const shape = new Shape();
    points.forEach((point, index) => {
      if (index === 0) {
        shape.moveToPoint(point);
      } else {
        shape.lineToPoint(point);
      }
    });

    this.halo = new Path(shape, {
      stroke: colorProperty,
      lineWidth: HALO_WIDTH,
      lineCap: "round",
      lineJoin: "round",
      opacity: HALO_OPACITY,
    });

    this.core = new Path(shape, {
      stroke: colorProperty,
      lineWidth: CORE_WIDTH,
      lineCap: "round",
      lineJoin: "round",
    });

    this.children = [this.halo, this.core];

    if (options?.intensityProperty) {
      this.intensityProperty = options.intensityProperty;
      this.intensityListener = (intensity: number) => {
        const clamped = intensity <= 0 ? 0 : Math.min(intensity, 1);
        this.core.opacity = clamped;
        this.halo.opacity = HALO_OPACITY * clamped;
      };
      this.intensityProperty.link(this.intensityListener);
    }
  }

  public override dispose(): void {
    if (this.intensityProperty && this.intensityListener) {
      this.intensityProperty.unlink(this.intensityListener);
    }
    super.dispose();
  }
}
