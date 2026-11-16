import { DETECTOR_SCREEN_NODE_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * DetectorScreenNode.ts
 *
 * A detector screen: a titled, bezelled square showing the fringe pattern.
 *
 * The bezel matters more than it looks. The pattern is the one part of the
 * simulation that is genuinely photometric — its brightness means something —
 * so it needs a frame that separates it from the sim's own background and stops
 * the eye reading the surrounding panel colour as part of the image.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Shape } from "scenerystack/kite";
import { Node, Rectangle, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import InterferometryLabColors from "../../InterferometryLabColors.js";
import { LABEL_FONT_SIZE, PANEL_CORNER_RADIUS } from "../../InterferometryLabConstants.js";
import type { FringeSpec } from "../model/FringeSpec.js";
import { FringePatternNode } from "./FringePatternNode.js";

/** Width of the bezel drawn around the pattern, view pixels. */
const BEZEL_WIDTH: number = DETECTOR_SCREEN_NODE_SETTINGS.BEZEL_WIDTH;

export type DetectorScreenNodeOptions = {
  /** Side length of the pattern itself, view pixels. */
  readonly size: number;

  /** Caption shown above the screen. */
  readonly title?: TReadOnlyProperty<string> | string;
};

export class DetectorScreenNode extends VBox {
  /** The rendered pattern, exposed so a screen can size overlays to match it. */
  public readonly patternNode: FringePatternNode;

  /**
   * An empty layer drawn on top of the pattern and clipped to it, for marks a
   * screen wants to add — individual photon detections, for instance.
   */
  public readonly overlayLayer: Node;

  public constructor(specProperty: TReadOnlyProperty<FringeSpec>, options: DetectorScreenNodeOptions) {
    const size = options.size;

    const patternNode = new FringePatternNode(specProperty, { size });

    const overlayLayer = new Node({ clipArea: Shape.rect(0, 0, size, size) });

    const bezel = new Rectangle(-BEZEL_WIDTH, -BEZEL_WIDTH, size + 2 * BEZEL_WIDTH, size + 2 * BEZEL_WIDTH, {
      fill: InterferometryLabColors.mountColorProperty,
      stroke: InterferometryLabColors.tableBorderColorProperty,
      lineWidth: 1,
      cornerRadius: PANEL_CORNER_RADIUS,
    });

    // A black backing behind the pattern, so a fully dark fringe reads as dark
    // rather than as whatever happens to be behind the canvas.
    const backing = new Rectangle(0, 0, size, size, {
      fill: InterferometryLabColors.detectorFaceColorProperty,
    });

    const framed = new Node({ children: [bezel, backing, patternNode, overlayLayer] });

    const children: Node[] = [];
    if (options.title !== undefined) {
      children.push(
        new Text(options.title, {
          font: new PhetFont({ size: LABEL_FONT_SIZE, weight: "bold" }),
          fill: InterferometryLabColors.textColorProperty,
        }),
      );
    }
    children.push(framed);

    super({ spacing: DETECTOR_SCREEN_NODE_SETTINGS.CONSTRUCTOR_SPACING, align: "center", children });

    this.patternNode = patternNode;
    this.overlayLayer = overlayLayer;
  }
}
