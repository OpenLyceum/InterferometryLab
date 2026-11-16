import { READOUT_BLOCK_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * ReadoutBlock.ts
 *
 * A block of "label … value" rows, laid out on a two-column grid so that every
 * value in a panel lines up on the same left edge no matter how long its label
 * is.
 *
 * Values are given as string Properties rather than numbers: the caller has
 * already decided how many digits and which unit are meaningful, which is
 * information this class has no way to recover.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { GridBox, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import InterferometryLabColors from "../../InterferometryLabColors.js";
import { LABEL_FONT_SIZE, READOUT_FONT_SIZE } from "../../InterferometryLabConstants.js";

export type ReadoutRow = {
  /** Left-hand label. */
  readonly label: TReadOnlyProperty<string> | string;

  /** Right-hand value, already formatted with its unit. */
  readonly value: TReadOnlyProperty<string> | string;
};

export class ReadoutBlock extends GridBox {
  public constructor(rows: readonly ReadoutRow[]) {
    super({
      columns: [[], []],
      xSpacing: READOUT_BLOCK_SETTINGS.CONSTRUCTOR_X_SPACING,
      ySpacing: READOUT_BLOCK_SETTINGS.CONSTRUCTOR_Y_SPACING,
      xAlign: "left",
    });

    rows.forEach((row, index) => {
      this.addChild(
        new Text(row.label, {
          font: new PhetFont(LABEL_FONT_SIZE),
          fill: InterferometryLabColors.textColorProperty,
          layoutOptions: { column: 0, row: index, xAlign: "left" },
        }),
      );
      this.addChild(
        new Text(row.value, {
          font: new PhetFont({ size: READOUT_FONT_SIZE, weight: "bold" }),
          fill: InterferometryLabColors.valueColorProperty,
          layoutOptions: { column: 1, row: index, xAlign: "right" },
        }),
      );
    });
  }
}
