import { OPTICAL_TABLE_NODE_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * OpticalTableNode.ts
 *
 * The breadboard every screen's layout sits on: a dark rectangle ruled with the
 * grid of mounting holes that real optical tables have.
 *
 * It exists mostly to give the beams a consistently dark ground to be bright
 * against, and to make the top-down viewpoint obvious at a glance.
 */

import { Shape } from "scenerystack/kite";
import { Node, Path, Rectangle } from "scenerystack/scenery";
import InterferometryLabColors from "../../InterferometryLabColors.js";
import { PANEL_CORNER_RADIUS } from "../../InterferometryLabConstants.js";

/** Spacing of the mounting-hole grid, view pixels. */
const GRID_SPACING: number = OPTICAL_TABLE_NODE_SETTINGS.GRID_SPACING;

export class OpticalTableNode extends Node {
  /**
   * @param width - table width, view pixels
   * @param height - table height, view pixels
   */
  public constructor(width: number, height: number) {
    super();

    const surface = new Rectangle(0, 0, width, height, {
      fill: InterferometryLabColors.tableColorProperty,
      stroke: InterferometryLabColors.tableBorderColorProperty,
      lineWidth: 1,
      cornerRadius: PANEL_CORNER_RADIUS,
    });

    const gridShape = new Shape();
    for (let x = GRID_SPACING; x < width; x += GRID_SPACING) {
      gridShape.moveTo(x, 0).lineTo(x, height);
    }
    for (let y = GRID_SPACING; y < height; y += GRID_SPACING) {
      gridShape.moveTo(0, y).lineTo(width, y);
    }

    const grid = new Path(gridShape, {
      stroke: InterferometryLabColors.tableGridColorProperty,
      lineWidth: OPTICAL_TABLE_NODE_SETTINGS.GRID_LINE_WIDTH,
      // Keep the grid inside the rounded corners.
      clipArea: Shape.roundRect(0, 0, width, height, PANEL_CORNER_RADIUS, PANEL_CORNER_RADIUS),
    });

    this.children = [surface, grid];
  }
}
