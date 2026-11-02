/**
 * InterferometryLabButtonOptions.ts
 *
 * Shared flat button appearance for the sim. Rectangular and round push buttons
 * default to SceneryStack's 3-D appearance; pass these options (or spread them
 * into nested button options) for a flat look everywhere.
 *
 * Template-owned toolkit: each sim uses only some of these, so every export is tagged
 * `@public` to tell dead-code checkers (knip) that an unused one is not dead code.
 */

import type { PlayPauseStepButtonGroupOptions, TimeControlNodeOptions } from "scenerystack/scenery-phet";
import { ButtonNode, type ComboBoxOptions } from "scenerystack/sun";
import InterferometryLabColors from "../InterferometryLabColors.js";

/** @public */
export const FLAT_BUTTON_APPEARANCE_OPTIONS = {
  buttonAppearanceStrategy: ButtonNode.FlatAppearanceStrategy,
} as const;

/** Text on flat push buttons and combo-box items (always on a light control surface). @public */
export const LIGHT_SURFACE_TEXT_FILL = InterferometryLabColors.controlSurfaceTextColorProperty;

/**
 * Combo-box chrome for panels. Item labels must use {@link LIGHT_SURFACE_TEXT_FILL}, not
 * {@link InterferometryLabColors.textColorProperty} — that color is for labels on the dark panel fill.
 *
 * @public
 */
export const INTERFEROMETRY_LAB_COMBO_BOX_OPTIONS = {
  buttonFill: InterferometryLabColors.controlSurfaceColorProperty,
  listFill: InterferometryLabColors.controlSurfaceColorProperty,
  buttonStroke: InterferometryLabColors.panelBorderColorProperty,
  listStroke: InterferometryLabColors.panelBorderColorProperty,
} satisfies Pick<ComboBoxOptions, "buttonFill" | "listFill" | "buttonStroke" | "listStroke">;

/** Options for RectangularPushButton and NumberControl arrow buttons. @public */
export const FLAT_RECTANGULAR_BUTTON_OPTIONS = { ...FLAT_BUTTON_APPEARANCE_OPTIONS } as const;

/** Options for ResetAllButton (extends RoundPushButton). @public */
export const FLAT_RESET_ALL_BUTTON_OPTIONS = { ...FLAT_BUTTON_APPEARANCE_OPTIONS } as const;

/** Nested options for TimeControlNode play / pause / step round buttons. @public */
export const FLAT_PLAY_PAUSE_STEP_BUTTON_OPTIONS = {
  playPauseButtonOptions: FLAT_BUTTON_APPEARANCE_OPTIONS,
  stepForwardButtonOptions: FLAT_BUTTON_APPEARANCE_OPTIONS,
  stepBackwardButtonOptions: FLAT_BUTTON_APPEARANCE_OPTIONS,
} satisfies PlayPauseStepButtonGroupOptions;

/**
 * Speed radio labels for TimeControlNode. SceneryStack Text defaults to black, which
 * is low-contrast on the sim's dark Default-mode panels.
 *
 * @public
 */
export const TIME_CONTROL_SPEED_RADIO_OPTIONS = {
  speedRadioButtonGroupOptions: {
    labelOptions: { fill: InterferometryLabColors.textColorProperty },
  },
} satisfies Pick<TimeControlNodeOptions, "speedRadioButtonGroupOptions">;
