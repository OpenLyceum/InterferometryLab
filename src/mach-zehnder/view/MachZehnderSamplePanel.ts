import { MACH_ZEHNDER_SAMPLE_PANEL_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * MachZehnderSamplePanel.ts
 *
 * The insertable sample slide — the interferometer used as a measuring
 * instrument rather than a demonstration.
 *
 * A slide of thickness t and index n replaces t of air with t of glass, adding
 * t(n − 1) to that arm and shifting the fringes by t(n − 1)/λ of a period.
 * Twenty micrometres of ordinary crown glass is worth about eighteen fringes at
 * 633 nm, which is why this is a practical way to measure the thickness of
 * something far too thin to put a micrometer on.
 *
 * Tilting the slide lengthens the route through it, so the shift can be swept
 * continuously instead of jumping between whatever thicknesses are to hand.
 */

import { createCheckbox } from "../../common/view/controlFactory.js";
import { lengthProperty } from "../../common/view/formatters.js";
import { InterferometryLabNumberControl } from "../../common/view/InterferometryLabNumberControl.js";
import { ReadoutBlock } from "../../common/view/ReadoutBlock.js";
import { TitledPanel } from "../../common/view/TitledPanel.js";
import {
  SAMPLE_INDEX_RANGE,
  SAMPLE_THICKNESS_RANGE_UM,
  SAMPLE_TILT_RANGE_DEG,
} from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { MachZehnderModel } from "../model/MachZehnderModel.js";

export class MachZehnderSamplePanel extends TitledPanel {
  public constructor(model: MachZehnderModel, contentWidth: number) {
    const strings = StringManager.getInstance();
    const machZehnder = strings.getMachZehnderStrings();
    const units = strings.getUnits();
    const a11y = strings.getMachZehnderA11yStrings().controls;

    const insertCheckbox = createCheckbox(
      model.sampleEnabledProperty,
      machZehnder.insertSampleStringProperty,
      a11y.insertSampleStringProperty,
    );

    const thicknessControl = new InterferometryLabNumberControl(
      machZehnder.thicknessStringProperty,
      model.sampleThicknessProperty,
      SAMPLE_THICKNESS_RANGE_UM,
      {
        accessibleName: a11y.thicknessStringProperty,
        valuePattern: units.micrometersStringProperty,
        decimals: 1,
        delta: MACH_ZEHNDER_SAMPLE_PANEL_SETTINGS.THICKNESS_CONTROL_DELTA,
        keyboardStep: 1,
        shiftKeyboardStep: MACH_ZEHNDER_SAMPLE_PANEL_SETTINGS.THICKNESS_CONTROL_SHIFT_KEYBOARD_STEP,
        pageKeyboardStep: MACH_ZEHNDER_SAMPLE_PANEL_SETTINGS.THICKNESS_CONTROL_PAGE_KEYBOARD_STEP,
        enabledProperty: model.sampleEnabledProperty,
      },
    );

    const indexControl = new InterferometryLabNumberControl(
      machZehnder.indexStringProperty,
      model.sampleIndexProperty,
      SAMPLE_INDEX_RANGE,
      {
        accessibleName: a11y.indexStringProperty,
        decimals: 3,
        delta: MACH_ZEHNDER_SAMPLE_PANEL_SETTINGS.INDEX_CONTROL_DELTA,
        keyboardStep: MACH_ZEHNDER_SAMPLE_PANEL_SETTINGS.INDEX_CONTROL_KEYBOARD_STEP,
        shiftKeyboardStep: MACH_ZEHNDER_SAMPLE_PANEL_SETTINGS.INDEX_CONTROL_SHIFT_KEYBOARD_STEP,
        pageKeyboardStep: MACH_ZEHNDER_SAMPLE_PANEL_SETTINGS.INDEX_CONTROL_PAGE_KEYBOARD_STEP,
        enabledProperty: model.sampleEnabledProperty,
      },
    );

    const tiltControl = new InterferometryLabNumberControl(
      machZehnder.slideTiltStringProperty,
      model.sampleTiltProperty,
      SAMPLE_TILT_RANGE_DEG,
      {
        accessibleName: a11y.slideTiltStringProperty,
        valuePattern: units.degreesStringProperty,
        decimals: 1,
        delta: MACH_ZEHNDER_SAMPLE_PANEL_SETTINGS.TILT_CONTROL_DELTA,
        keyboardStep: 1,
        shiftKeyboardStep: MACH_ZEHNDER_SAMPLE_PANEL_SETTINGS.TILT_CONTROL_SHIFT_KEYBOARD_STEP,
        pageKeyboardStep: MACH_ZEHNDER_SAMPLE_PANEL_SETTINGS.TILT_CONTROL_PAGE_KEYBOARD_STEP,
        enabledProperty: model.sampleEnabledProperty,
      },
    );

    const readouts = new ReadoutBlock([
      {
        label: machZehnder.addedPathStringProperty,
        value: lengthProperty(model.samplePathProperty, MACH_ZEHNDER_SAMPLE_PANEL_SETTINGS.READOUTS_DECIMALS),
      },
    ]);

    super(machZehnder.sampleStringProperty, [insertCheckbox, thicknessControl, indexControl, tiltControl, readouts], {
      contentWidth,
    });
  }
}
