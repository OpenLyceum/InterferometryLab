import { FABRY_PEROT_SOURCE_PANEL_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * FabryPerotSourcePanel.ts
 *
 * The source: one tunable line, or two a settable distance apart.
 *
 * The pair is the point. A single line only ever shows that the etalon has sharp
 * peaks; two of them turn that sharpness into a measurement, because whether the
 * instrument can tell them apart is a yes-or-no question with a calculable
 * answer. The separation is set in picometres, which is the scale at which a
 * good etalon earns its keep.
 */

import { createCheckbox } from "../../common/view/controlFactory.js";
import { InterferometryLabNumberControl } from "../../common/view/InterferometryLabNumberControl.js";
import { TitledPanel } from "../../common/view/TitledPanel.js";
import { LINE_SEPARATION_RANGE_PM, WAVELENGTH_RANGE_NM } from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { FabryPerotModel } from "../model/FabryPerotModel.js";

export class FabryPerotSourcePanel extends TitledPanel {
  public constructor(model: FabryPerotModel, contentWidth: number) {
    const strings = StringManager.getInstance();
    const fabryPerot = strings.getFabryPerotStrings();
    const units = strings.getUnits();
    const a11y = strings.getFabryPerotA11yStrings().controls;

    const wavelengthControl = new InterferometryLabNumberControl(
      strings.getCommon().wavelengthStringProperty,
      model.wavelengthProperty,
      WAVELENGTH_RANGE_NM,
      {
        accessibleName: a11y.wavelengthStringProperty,
        valuePattern: units.nanometersStringProperty,
        decimals: 0,
        delta: 1,
        keyboardStep: FABRY_PEROT_SOURCE_PANEL_SETTINGS.WAVELENGTH_CONTROL_KEYBOARD_STEP,
        shiftKeyboardStep: 1,
        pageKeyboardStep: FABRY_PEROT_SOURCE_PANEL_SETTINGS.WAVELENGTH_CONTROL_PAGE_KEYBOARD_STEP,
      },
    );

    const twinLineCheckbox = createCheckbox(
      model.twinLineProperty,
      fabryPerot.twinLineStringProperty,
      a11y.twinLineStringProperty,
    );

    const separationControl = new InterferometryLabNumberControl(
      fabryPerot.lineSeparationStringProperty,
      model.lineSeparationProperty,
      LINE_SEPARATION_RANGE_PM,
      {
        accessibleName: a11y.lineSeparationStringProperty,
        valuePattern: units.picometersStringProperty,
        decimals: 1,
        delta: FABRY_PEROT_SOURCE_PANEL_SETTINGS.SEPARATION_CONTROL_DELTA,
        keyboardStep: 1,
        shiftKeyboardStep: FABRY_PEROT_SOURCE_PANEL_SETTINGS.SEPARATION_CONTROL_SHIFT_KEYBOARD_STEP,
        pageKeyboardStep: FABRY_PEROT_SOURCE_PANEL_SETTINGS.SEPARATION_CONTROL_PAGE_KEYBOARD_STEP,
        enabledProperty: model.twinLineProperty,
      },
    );

    super(fabryPerot.sourceLinesStringProperty, [wavelengthControl, twinLineCheckbox, separationControl], {
      contentWidth,
    });
  }
}
