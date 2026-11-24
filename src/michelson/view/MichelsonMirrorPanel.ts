import { MICHELSON_MIRROR_PANEL_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * MichelsonMirrorPanel.ts
 *
 * The movable mirror's controls: a coarse stage, a micrometer dial, and the
 * fringe counter that turns the two into a measurement.
 *
 * Two controls for one quantity looks redundant until you try to use one. The
 * coarse slider spans ±0.2 mm, which is where the interesting territory is — far
 * enough out that a sodium lamp's fringes have died and revived — but a single
 * pixel of it is worth hundreds of fringes. The micrometer covers ±2 µm, a few
 * fringes per pixel, which is the only scale at which a white-light fringe can
 * be found at all. Real interferometers are built the same way and for the same
 * reason.
 */

import { DerivedProperty, UnitConversionProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { StringUtils } from "scenerystack/phetcommon";
import { HBox } from "scenerystack/scenery";
import { createPushButton } from "../../common/view/controlFactory.js";
import { InterferometryLabNumberControl } from "../../common/view/InterferometryLabNumberControl.js";
import { ReadoutBlock } from "../../common/view/ReadoutBlock.js";
import { TitledPanel } from "../../common/view/TitledPanel.js";
import { MICHELSON_FINE_RANGE_NM, NM_PER_UM } from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { MichelsonModel } from "../model/MichelsonModel.js";

export class MichelsonMirrorPanel extends TitledPanel {
  public constructor(model: MichelsonModel, contentWidth: number) {
    const strings = StringManager.getInstance();
    const michelson = strings.getMichelsonStrings();
    const units = strings.getUnits();
    const a11y = strings.getMichelsonA11yStrings().controls;

    // The model works in nanometres; a coarse stage that reads "150000 nm" is
    // unusable, so the control drives a two-way micrometre view of the same value.
    const coarseMicrometersProperty = new UnitConversionProperty(model.coarseOffsetProperty, {
      factor: 1 / NM_PER_UM,
    });

    const coarseControl = new InterferometryLabNumberControl(
      michelson.coarseStringProperty,
      coarseMicrometersProperty,
      coarseMicrometersProperty.range,
      {
        accessibleName: a11y.coarseStringProperty,
        valuePattern: units.micrometersStringProperty,
        decimals: 2,
        delta: MICHELSON_MIRROR_PANEL_SETTINGS.COARSE_CONTROL_DELTA,
        keyboardStep: 1,
        shiftKeyboardStep: MICHELSON_MIRROR_PANEL_SETTINGS.COARSE_CONTROL_SHIFT_KEYBOARD_STEP,
        pageKeyboardStep: MICHELSON_MIRROR_PANEL_SETTINGS.COARSE_CONTROL_PAGE_KEYBOARD_STEP,
      },
    );

    const fineControl = new InterferometryLabNumberControl(
      michelson.micrometerStringProperty,
      model.fineOffsetProperty,
      MICHELSON_FINE_RANGE_NM,
      {
        accessibleName: a11y.micrometerStringProperty,
        valuePattern: units.nanometersStringProperty,
        decimals: 0,
        delta: 1,
        keyboardStep: MICHELSON_MIRROR_PANEL_SETTINGS.FINE_CONTROL_KEYBOARD_STEP,
        shiftKeyboardStep: MICHELSON_MIRROR_PANEL_SETTINGS.FINE_CONTROL_SHIFT_KEYBOARD_STEP,
        pageKeyboardStep: MICHELSON_MIRROR_PANEL_SETTINGS.FINE_CONTROL_PAGE_KEYBOARD_STEP,
      },
    );

    const zeroButton = createPushButton(
      michelson.zeroTheArmsStringProperty,
      () => model.zeroTheArms(),
      a11y.zeroTheArmsStringProperty,
    );

    const resetCountButton = createPushButton(
      michelson.resetCountStringProperty,
      () => model.resetFringeCount(),
      a11y.resetCountStringProperty,
    );

    const fringeCountTextProperty = new DerivedProperty(
      [model.fringeCountProperty, units.plainStringProperty],
      (count, pattern) => StringUtils.fillIn(pattern, { value: toFixed(count, 1) }),
    );

    // Path difference is reported once, under the detector; repeating it here
    // would just be a second copy of the same number.
    const readouts = new ReadoutBlock([
      { label: michelson.fringesCountedStringProperty, value: fringeCountTextProperty },
    ]);

    const buttons = new HBox({
      spacing: MICHELSON_MIRROR_PANEL_SETTINGS.BUTTONS_SPACING,
      children: [zeroButton, resetCountButton],
    });

    super(michelson.armStringProperty, [coarseControl, fineControl, readouts, buttons], { contentWidth });
  }
}
