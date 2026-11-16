import { INTERFEROMETRY_LAB_NUMBER_CONTROL_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * InterferometryLabNumberControl.ts
 *
 * A NumberControl themed for this sim's panels: title on the left, value on the
 * right, slider underneath.
 *
 * It exists mainly to make the keyboard steps a decision rather than a default.
 * An interferometer's controls span an awkward range — the same slider that
 * needs to travel hundreds of micrometres also needs to be nudged by a few
 * nanometres, because that is the scale on which the output changes — so every
 * control here sets its own arrow-key, shift-arrow and page-up steps.
 */

import type { PhetioProperty, TReadOnlyProperty } from "scenerystack/axon";
import { Dimension2, type Range } from "scenerystack/dot";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { type Node, Text } from "scenerystack/scenery";
import { NumberControl, type NumberControlOptions, PhetFont } from "scenerystack/scenery-phet";
import InterferometryLabColors from "../../InterferometryLabColors.js";
import { LABEL_FONT_SIZE, READOUT_FONT_SIZE } from "../../InterferometryLabConstants.js";
import { FLAT_RECTANGULAR_BUTTON_OPTIONS } from "../InterferometryLabButtonOptions.js";

/** Track size shared by every slider in the sim, view pixels. */
const TRACK_SIZE = new Dimension2(
  INTERFEROMETRY_LAB_NUMBER_CONTROL_SETTINGS.TRACK_SIZE_WIDTH,
  INTERFEROMETRY_LAB_NUMBER_CONTROL_SETTINGS.TRACK_SIZE_HEIGHT,
);

/** Thumb size shared by every slider in the sim, view pixels. */
const THUMB_SIZE = new Dimension2(
  INTERFEROMETRY_LAB_NUMBER_CONTROL_SETTINGS.THUMB_SIZE_WIDTH,
  INTERFEROMETRY_LAB_NUMBER_CONTROL_SETTINGS.THUMB_SIZE_HEIGHT,
);

type SelfOptions = {
  /** Accessible name; required, since every control needs one. */
  readonly accessibleName: TReadOnlyProperty<string>;

  /** Unit pattern containing `{{value}}`; omit for a bare number. */
  readonly valuePattern?: TReadOnlyProperty<string>;

  /** Digits after the decimal point in the readout. */
  readonly decimals?: number;

  /** Value change per arrow key press. Defaults to a hundredth of the range. */
  readonly keyboardStep?: number;

  /** Value change per shift-arrow press, for fine adjustment. */
  readonly shiftKeyboardStep?: number;

  /** Value change per page up / page down press, for coarse adjustment. */
  readonly pageKeyboardStep?: number;

  /** Granularity the value snaps to while dragging. */
  readonly delta?: number;

  /** Width of the slider track, view pixels. */
  readonly trackWidth?: number;

  /** Labelled ticks placed under the track. */
  readonly majorTicks?: readonly { value: number; label: string }[];
};

export type InterferometryLabNumberControlOptions = SelfOptions & NumberControlOptions;

export class InterferometryLabNumberControl extends NumberControl {
  public constructor(
    title: TReadOnlyProperty<string> | string,
    valueProperty: PhetioProperty<number>,
    range: Range,
    providedOptions: InterferometryLabNumberControlOptions,
  ) {
    const decimals = providedOptions.decimals ?? 1;
    const keyboardStep = providedOptions.keyboardStep ?? range.getLength() / 100;

    const options = optionize<InterferometryLabNumberControlOptions, EmptySelfOptions, NumberControlOptions>()(
      {
        layoutFunction: NumberControl.createLayoutFunction4({
          verticalSpacing: INTERFEROMETRY_LAB_NUMBER_CONTROL_SETTINGS.OPTIONS_VERTICAL_SPACING,
        }),
        delta: providedOptions.delta ?? 0,
        titleNodeOptions: {
          font: new PhetFont(LABEL_FONT_SIZE),
          fill: InterferometryLabColors.textColorProperty,
          maxWidth: INTERFEROMETRY_LAB_NUMBER_CONTROL_SETTINGS.OPTIONS_MAX_WIDTH,
        },
        numberDisplayOptions: {
          decimalPlaces: decimals,
          textOptions: {
            font: new PhetFont({ size: READOUT_FONT_SIZE, weight: "bold" }),
            fill: InterferometryLabColors.valueColorProperty,
          },
          backgroundFill: null,
          backgroundStroke: null,
          ...(providedOptions.valuePattern && { valuePattern: providedOptions.valuePattern }),
        },
        arrowButtonOptions: FLAT_RECTANGULAR_BUTTON_OPTIONS,
        sliderOptions: {
          trackSize: new Dimension2(providedOptions.trackWidth ?? TRACK_SIZE.width, TRACK_SIZE.height),
          thumbSize: THUMB_SIZE,
          trackFillEnabled: InterferometryLabColors.textColorProperty,
          thumbFill: InterferometryLabColors.accentColorProperty,
          keyboardStep,
          shiftKeyboardStep: providedOptions.shiftKeyboardStep ?? keyboardStep / 10,
          pageKeyboardStep: providedOptions.pageKeyboardStep ?? keyboardStep * 10,
          ...(providedOptions.majorTicks && {
            majorTicks: providedOptions.majorTicks.map((tick) => ({
              value: tick.value,
              label: new Text(tick.label, {
                font: new PhetFont(LABEL_FONT_SIZE - 2),
                fill: InterferometryLabColors.textColorProperty,
              }) as Node,
            })),
          }),
        },
      },
      providedOptions,
    );

    super(title, valueProperty, range, options);
  }
}
