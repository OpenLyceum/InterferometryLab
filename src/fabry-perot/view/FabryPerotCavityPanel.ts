import { FABRY_PEROT_CAVITY_PANEL_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * FabryPerotCavityPanel.ts
 *
 * The cavity's own parameters: how reflective its mirrors are, how lossy, and
 * how far apart.
 *
 * Reflectance is the control worth spending time on. Everything else here trades
 * one property for another — wider spacing buys resolution and spends free
 * spectral range — but raising R improves the resolving power at no cost in free
 * spectral range at all. The only thing it costs is light, and the absorption
 * slider is here so that limit is visible too: with even a percent of loss in the
 * coatings, a very high reflectance leaves peaks that are beautifully sharp and
 * almost too dim to use.
 */

import { UnitConversionProperty } from "scenerystack/axon";
import { Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { createTimeControl } from "../../common/view/controlFactory.js";
import { InterferometryLabNumberControl } from "../../common/view/InterferometryLabNumberControl.js";
import { TitledPanel } from "../../common/view/TitledPanel.js";
import InterferometryLabColors from "../../InterferometryLabColors.js";
import { ABSORPTANCE_RANGE, LABEL_FONT_SIZE, NM_PER_UM, REFLECTANCE_RANGE } from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { FabryPerotModel } from "../model/FabryPerotModel.js";

export class FabryPerotCavityPanel extends TitledPanel {
  public constructor(model: FabryPerotModel, contentWidth: number) {
    const strings = StringManager.getInstance();
    const fabryPerot = strings.getFabryPerotStrings();
    const units = strings.getUnits();
    const a11y = strings.getFabryPerotA11yStrings().controls;

    const reflectanceControl = new InterferometryLabNumberControl(
      fabryPerot.reflectanceStringProperty,
      model.reflectanceProperty,
      REFLECTANCE_RANGE,
      {
        accessibleName: a11y.reflectanceStringProperty,
        decimals: 2,
        delta: FABRY_PEROT_CAVITY_PANEL_SETTINGS.REFLECTANCE_CONTROL_DELTA,
        keyboardStep: FABRY_PEROT_CAVITY_PANEL_SETTINGS.REFLECTANCE_CONTROL_KEYBOARD_STEP,
        shiftKeyboardStep: FABRY_PEROT_CAVITY_PANEL_SETTINGS.REFLECTANCE_CONTROL_SHIFT_KEYBOARD_STEP,
        pageKeyboardStep: FABRY_PEROT_CAVITY_PANEL_SETTINGS.REFLECTANCE_CONTROL_PAGE_KEYBOARD_STEP,
        majorTicks: [
          { value: REFLECTANCE_RANGE.min, label: "0.04" },
          { value: REFLECTANCE_RANGE.max, label: "0.99" },
        ],
      },
    );

    const absorptanceControl = new InterferometryLabNumberControl(
      fabryPerot.absorptanceStringProperty,
      model.absorptanceProperty,
      ABSORPTANCE_RANGE,
      {
        accessibleName: a11y.absorptanceStringProperty,
        decimals: 3,
        delta: FABRY_PEROT_CAVITY_PANEL_SETTINGS.ABSORPTANCE_CONTROL_DELTA,
        keyboardStep: FABRY_PEROT_CAVITY_PANEL_SETTINGS.ABSORPTANCE_CONTROL_KEYBOARD_STEP,
        shiftKeyboardStep: FABRY_PEROT_CAVITY_PANEL_SETTINGS.ABSORPTANCE_CONTROL_SHIFT_KEYBOARD_STEP,
        pageKeyboardStep: FABRY_PEROT_CAVITY_PANEL_SETTINGS.ABSORPTANCE_CONTROL_PAGE_KEYBOARD_STEP,
      },
    );

    // The model keeps every optical length in nanometres; a spacing that reads
    // "100000 nm" helps nobody, so the control drives a micrometre view of it.
    const spacingMicrometersProperty = new UnitConversionProperty(model.spacingProperty, {
      factor: 1 / NM_PER_UM,
    });

    const spacingControl = new InterferometryLabNumberControl(
      fabryPerot.spacingStringProperty,
      spacingMicrometersProperty,
      spacingMicrometersProperty.range,
      {
        accessibleName: a11y.spacingStringProperty,
        valuePattern: units.micrometersStringProperty,
        decimals: 1,
        delta: FABRY_PEROT_CAVITY_PANEL_SETTINGS.SPACING_CONTROL_DELTA,
        keyboardStep: FABRY_PEROT_CAVITY_PANEL_SETTINGS.SPACING_CONTROL_KEYBOARD_STEP,
        shiftKeyboardStep: FABRY_PEROT_CAVITY_PANEL_SETTINGS.SPACING_CONTROL_SHIFT_KEYBOARD_STEP,
        pageKeyboardStep: FABRY_PEROT_CAVITY_PANEL_SETTINGS.SPACING_CONTROL_PAGE_KEYBOARD_STEP,
      },
    );

    // The sweep is a clock, not a setting, so it gets a clock's controls. Being
    // able to stop it is the point: a transmission peak is narrow at high
    // finesse and goes past in a fraction of a second, and the step button walks
    // onto one a frame at a time.
    const scanControl = new VBox({
      align: "left",
      spacing: FABRY_PEROT_CAVITY_PANEL_SETTINGS.SCAN_CONTROL_SPACING,
      children: [
        new Text(fabryPerot.scanCavityStringProperty, {
          font: new PhetFont(LABEL_FONT_SIZE),
          fill: InterferometryLabColors.textColorProperty,
          maxWidth: contentWidth,
        }),
        createTimeControl(model.timer.isPlayingProperty, () => model.stepOnce(), a11y.scanCavityStringProperty),
      ],
    });

    super(fabryPerot.cavityStringProperty, [reflectanceControl, absorptanceControl, spacingControl, scanControl], {
      contentWidth,
    });
  }
}
