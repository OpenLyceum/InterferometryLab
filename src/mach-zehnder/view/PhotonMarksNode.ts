import { PHOTON_MARKS_NODE_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * PhotonMarksNode.ts
 *
 * The record of individual photon detections building up on a detector.
 *
 * Drawn to a canvas rather than as scenery nodes because there can be thousands
 * of marks and they are never interactive — one repaint of a flat list beats
 * several thousand Nodes in the scene graph.
 *
 * Marks are drawn with partial opacity so that overlapping detections build up
 * density the way a photographic plate does: the fringes appear as the places
 * where the dots pile up, which is exactly the observation being reproduced.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Bounds2 } from "scenerystack/dot";
import { CanvasNode, type CanvasNodeOptions } from "scenerystack/scenery";
import InterferometryLabColors from "../../InterferometryLabColors.js";
import type { PhotonMark } from "../model/MachZehnderModel.js";

/** Side length of a single detection mark, view pixels. */
const MARK_SIZE: number = PHOTON_MARKS_NODE_SETTINGS.MARK_SIZE;

/** Opacity of one mark, so overlapping detections accumulate. */
const MARK_OPACITY: number = PHOTON_MARKS_NODE_SETTINGS.MARK_OPACITY;

export class PhotonMarksNode extends CanvasNode {
  private readonly marks: readonly PhotonMark[];
  private readonly revisionProperty: TReadOnlyProperty<number>;
  private readonly size: number;
  private readonly revisionListener: () => void;

  /**
   * @param marks - the live array the model appends to
   * @param revisionProperty - bumped whenever `marks` changes
   * @param size - side length of the detector, view pixels
   * @param providedOptions
   */
  public constructor(
    marks: readonly PhotonMark[],
    revisionProperty: TReadOnlyProperty<number>,
    size: number,
    providedOptions?: CanvasNodeOptions,
  ) {
    super({ canvasBounds: new Bounds2(0, 0, size, size), ...providedOptions });

    this.marks = marks;
    this.revisionProperty = revisionProperty;
    this.size = size;

    this.revisionListener = () => this.invalidatePaint();
    this.revisionProperty.link(this.revisionListener);
  }

  public override paintCanvas(context: CanvasRenderingContext2D): void {
    if (this.marks.length === 0) {
      return;
    }

    const half = this.size / 2;
    context.fillStyle = InterferometryLabColors.photonMarkColorProperty.value.toCSS();
    context.globalAlpha = MARK_OPACITY;

    // Squares rather than arcs: at several thousand marks the per-path overhead
    // of beginPath/arc/fill dominates, and at two pixels across nobody can tell.
    for (const mark of this.marks) {
      // Detector coordinates run −1 to +1; the canvas runs 0 to size.
      const x = half * (1 + mark.position.x);
      const y = half * (1 + mark.position.y);
      context.fillRect(x, y, MARK_SIZE, MARK_SIZE);
    }

    context.globalAlpha = 1;
  }

  public override dispose(): void {
    this.revisionProperty.unlink(this.revisionListener);
    super.dispose();
  }
}
