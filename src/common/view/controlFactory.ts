import { CONTROL_FACTORY_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * controlFactory.ts
 *
 * Themed checkboxes and push buttons.
 *
 * These wrap the sun components with this sim's colours and fonts and make the
 * accessible name a required argument rather than an option — a control without
 * one is a bug, and the type system is a better place to catch that than a
 * review checklist.
 */

import type { PhetioProperty, Property, TReadOnlyProperty } from "scenerystack/axon";
import { Text } from "scenerystack/scenery";
import { PhetFont, TimeControlNode } from "scenerystack/scenery-phet";
import { Checkbox, RectangularPushButton } from "scenerystack/sun";
import InterferometryLabColors from "../../InterferometryLabColors.js";
import { LABEL_FONT_SIZE, MIRROR_TILT_RANGE_URAD } from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import {
  FLAT_PLAY_PAUSE_STEP_BUTTON_OPTIONS,
  FLAT_RECTANGULAR_BUTTON_OPTIONS,
  LIGHT_SURFACE_TEXT_FILL,
} from "../InterferometryLabButtonOptions.js";
import { InterferometryLabNumberControl } from "./InterferometryLabNumberControl.js";

/**
 * A checkbox with a text label, themed for the sim's panels.
 *
 * @param property - the boolean it toggles
 * @param label - visible label text
 * @param accessibleName - name announced by a screen reader
 */
export function createCheckbox(
  property: PhetioProperty<boolean>,
  label: TReadOnlyProperty<string>,
  accessibleName: TReadOnlyProperty<string>,
): Checkbox {
  return new Checkbox(
    property,
    new Text(label, {
      font: new PhetFont(LABEL_FONT_SIZE),
      fill: InterferometryLabColors.textColorProperty,
      maxWidth: CONTROL_FACTORY_SETTINGS.CREATE_CHECKBOX_MAX_WIDTH,
    }),
    {
      accessibleName,
      // Light tick/border on the dark panel fill — not controlSurfaceText, which
      // is for labels on white chrome.
      checkboxColor: InterferometryLabColors.textColorProperty,
      checkboxColorBackground: InterferometryLabColors.panelBackgroundColorProperty,
      spacing: CONTROL_FACTORY_SETTINGS.CREATE_CHECKBOX_SPACING,
      boxWidth: CONTROL_FACTORY_SETTINGS.CREATE_CHECKBOX_BOX_WIDTH,
    },
  );
}

/**
 * A flat push button with a text label, themed for the sim's panels.
 *
 * @param label - visible label text
 * @param listener - called when the button fires
 * @param accessibleName - name announced by a screen reader
 */
export function createPushButton(
  label: TReadOnlyProperty<string>,
  listener: () => void,
  accessibleName: TReadOnlyProperty<string>,
): RectangularPushButton {
  return new RectangularPushButton({
    ...FLAT_RECTANGULAR_BUTTON_OPTIONS,
    content: new Text(label, {
      font: new PhetFont(LABEL_FONT_SIZE),
      fill: LIGHT_SURFACE_TEXT_FILL,
      maxWidth: CONTROL_FACTORY_SETTINGS.CREATE_PUSH_BUTTON_MAX_WIDTH,
    }),
    baseColor: InterferometryLabColors.controlSurfaceColorProperty,
    listener,
    accessibleName,
    xMargin: CONTROL_FACTORY_SETTINGS.CREATE_PUSH_BUTTON_X_MARGIN,
    yMargin: CONTROL_FACTORY_SETTINGS.CREATE_PUSH_BUTTON_Y_MARGIN,
  });
}

/**
 * Play / pause with a step-forward button, themed flat like the rest of the sim.
 *
 * Both of the sim's time-evolving screens want the same thing: the ability to
 * stop what the clock is doing and then advance it in single frames — one
 * frame's worth of photons, or one three-hundredth of a cavity sweep. Neither
 * screen wants a speed selector, because the step button already gives finer
 * control than a slow speed would.
 *
 * `TimeControlNode` supplies its own accessible heading; `accessibleHeading`
 * here replaces the generic "Time Controls" with what this particular clock
 * drives.
 *
 * @param isPlayingProperty - the clock's run state
 * @param stepOnce - advances the model by one frame while paused
 * @param accessibleHeading - names what the clock controls, for a screen reader
 */
export function createTimeControl(
  isPlayingProperty: Property<boolean>,
  stepOnce: () => void,
  accessibleHeading: TReadOnlyProperty<string>,
): TimeControlNode {
  return new TimeControlNode(isPlayingProperty, {
    accessibleHeading,
    playPauseStepButtonOptions: {
      ...FLAT_PLAY_PAUSE_STEP_BUTTON_OPTIONS,
      includeStepForwardButton: true,
      stepForwardButtonOptions: {
        ...FLAT_PLAY_PAUSE_STEP_BUTTON_OPTIONS.stepForwardButtonOptions,
        listener: stepOnce,
      },
    },
  });
}

/**
 * A mirror-tilt slider, µrad. Shared by the Michelson and Mach-Zehnder screens,
 * where the same control drives the same physics: a tilt α wedges the
 * wavefronts by 2α, so the path difference grows linearly across the beam and
 * the fringes straighten. The keyboard steps favour the small end — only
 * shift-arrow reaches the wedge that produces a handful of bars rather than a
 * blur — so they are pinned here rather than left to NumberControl's defaults.
 *
 * @param title - visible label, e.g. "Tilt horizontal"
 * @param valueProperty - the µrad value this slider drives
 * @param accessibleName - name announced by a screen reader
 */
export function createTiltControl(
  title: TReadOnlyProperty<string>,
  valueProperty: PhetioProperty<number>,
  accessibleName: TReadOnlyProperty<string>,
): InterferometryLabNumberControl {
  return new InterferometryLabNumberControl(title, valueProperty, MIRROR_TILT_RANGE_URAD, {
    accessibleName,
    valuePattern: StringManager.getInstance().getUnits().microradiansStringProperty,
    decimals: 0,
    delta: 1,
    keyboardStep: CONTROL_FACTORY_SETTINGS.CREATE_TILT_CONTROL_KEYBOARD_STEP,
    shiftKeyboardStep: 1,
    pageKeyboardStep: CONTROL_FACTORY_SETTINGS.CREATE_TILT_CONTROL_PAGE_KEYBOARD_STEP,
    majorTicks: [{ value: 0, label: "0" }],
  });
}
