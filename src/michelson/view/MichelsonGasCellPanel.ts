import { MICHELSON_GAS_CELL_PANEL_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * MichelsonGasCellPanel.ts
 *
 * The evacuable gas cell: the classic undergraduate measurement of the
 * refractive index of air.
 *
 * A cell of length L in one arm adds 2L(n − 1) to the path difference, because
 * the beam crosses it twice. Pumping the cell down from atmospheric pressure to
 * vacuum therefore sweeps 2L(n − 1)/λ fringes past the detector — a few dozen
 * for a 50 mm cell in red light — and counting them measures a refractivity of
 * three parts in ten thousand with nothing more than patience.
 */

import { createCheckbox } from "../../common/view/controlFactory.js";
import { plainProperty } from "../../common/view/formatters.js";
import { InterferometryLabNumberControl } from "../../common/view/InterferometryLabNumberControl.js";
import { ReadoutBlock } from "../../common/view/ReadoutBlock.js";
import { TitledPanel } from "../../common/view/TitledPanel.js";
import { GAS_CELL_PRESSURE_RANGE_KPA } from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { MichelsonModel } from "../model/MichelsonModel.js";

export class MichelsonGasCellPanel extends TitledPanel {
  public constructor(model: MichelsonModel, contentWidth: number) {
    const strings = StringManager.getInstance();
    const michelson = strings.getMichelsonStrings();
    const units = strings.getUnits();
    const a11y = strings.getMichelsonA11yStrings().controls;

    const insertCheckbox = createCheckbox(
      model.gasCellEnabledProperty,
      michelson.insertCellStringProperty,
      a11y.insertCellStringProperty,
    );

    const pressureControl = new InterferometryLabNumberControl(
      michelson.pressureStringProperty,
      model.gasCellPressureProperty,
      GAS_CELL_PRESSURE_RANGE_KPA,
      {
        accessibleName: a11y.pressureStringProperty,
        valuePattern: units.kilopascalsStringProperty,
        decimals: 1,
        delta: MICHELSON_GAS_CELL_PANEL_SETTINGS.PRESSURE_CONTROL_DELTA,
        keyboardStep: MICHELSON_GAS_CELL_PANEL_SETTINGS.PRESSURE_CONTROL_KEYBOARD_STEP,
        shiftKeyboardStep: MICHELSON_GAS_CELL_PANEL_SETTINGS.PRESSURE_CONTROL_SHIFT_KEYBOARD_STEP,
        pageKeyboardStep: MICHELSON_GAS_CELL_PANEL_SETTINGS.PRESSURE_CONTROL_PAGE_KEYBOARD_STEP,
        enabledProperty: model.gasCellEnabledProperty,
      },
    );

    // Six decimals: air's refractivity is 2.9 × 10⁻⁴, so anything less shows a
    // flat 1.000 no matter what the pressure does.
    const readouts = new ReadoutBlock([
      {
        label: michelson.indexOfRefractionStringProperty,
        value: plainProperty(
          model.gasIndexProperty,
          MICHELSON_GAS_CELL_PANEL_SETTINGS.GAS_INDEX_PLAIN_PROPERTY_DECIMALS,
        ),
      },
      { label: michelson.fringesShiftedStringProperty, value: plainProperty(model.gasCellFringeShiftProperty, 1) },
    ]);

    super(michelson.gasCellStringProperty, [insertCheckbox, pressureControl, readouts], { contentWidth });
  }
}
