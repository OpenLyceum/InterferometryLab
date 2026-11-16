import { MACH_ZEHNDER_MODE_PANEL_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * MachZehnderModePanel.ts
 *
 * Continuous beam or single photons, and the which-path marker.
 *
 * The marker is the interesting control on this screen. It does not block a
 * path, attenuate anything, or touch the geometry — it only makes the route each
 * photon took a matter of record. That alone flattens both detectors: an
 * interference pattern is a statement that the routes were not distinguishable,
 * so making them distinguishable removes it. Switching the marker off brings the
 * fringes straight back.
 */

import { DerivedProperty } from "scenerystack/axon";
import { Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { AquaRadioButtonGroup } from "scenerystack/sun";
import { createCheckbox, createPushButton } from "../../common/view/controlFactory.js";
import { countProperty } from "../../common/view/formatters.js";
import { InterferometryLabNumberControl } from "../../common/view/InterferometryLabNumberControl.js";
import { ReadoutBlock } from "../../common/view/ReadoutBlock.js";
import { TitledPanel } from "../../common/view/TitledPanel.js";
import InterferometryLabColors from "../../InterferometryLabColors.js";
import { LABEL_FONT_SIZE, PHOTON_RATE_RANGE } from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import { BeamMode } from "../model/BeamMode.js";
import type { MachZehnderModel } from "../model/MachZehnderModel.js";

export class MachZehnderModePanel extends TitledPanel {
  public constructor(model: MachZehnderModel, contentWidth: number) {
    const strings = StringManager.getInstance();
    const machZehnder = strings.getMachZehnderStrings();
    const a11y = strings.getMachZehnderA11yStrings().controls;

    const modeLabel = (text: typeof machZehnder.classicalStringProperty) =>
      new Text(text, {
        font: new PhetFont(LABEL_FONT_SIZE),
        fill: InterferometryLabColors.textColorProperty,
        maxWidth: MACH_ZEHNDER_MODE_PANEL_SETTINGS.MODE_LABEL_MAX_WIDTH,
      });

    const modeRadioGroup = new AquaRadioButtonGroup(
      model.beamModeProperty,
      [
        {
          value: BeamMode.CONTINUOUS,
          createNode: () => modeLabel(machZehnder.classicalStringProperty),
          options: { accessibleName: machZehnder.classicalStringProperty },
        },
        {
          value: BeamMode.SINGLE_PHOTON,
          createNode: () => modeLabel(machZehnder.singlePhotonStringProperty),
          options: { accessibleName: machZehnder.singlePhotonStringProperty },
        },
      ],
      {
        accessibleName: a11y.modeStringProperty,
        spacing: MACH_ZEHNDER_MODE_PANEL_SETTINGS.MODE_RADIO_GROUP_SPACING,
        radioButtonOptions: {
          selectedColor: InterferometryLabColors.accentColorProperty,
          deselectedColor: InterferometryLabColors.controlSurfaceColorProperty,
          stroke: InterferometryLabColors.panelBorderColorProperty,
          radius: MACH_ZEHNDER_MODE_PANEL_SETTINGS.MODE_RADIO_GROUP_RADIUS,
        },
      },
    );

    const isSinglePhotonProperty = new DerivedProperty(
      [model.beamModeProperty],
      (mode) => mode === BeamMode.SINGLE_PHOTON,
    );

    const rateControl = new InterferometryLabNumberControl(
      machZehnder.photonRateStringProperty,
      model.photonRateProperty,
      PHOTON_RATE_RANGE,
      {
        accessibleName: a11y.photonRateStringProperty,
        valuePattern: strings.getUnits().perSecondStringProperty,
        decimals: 0,
        delta: MACH_ZEHNDER_MODE_PANEL_SETTINGS.RATE_CONTROL_DELTA,
        keyboardStep: MACH_ZEHNDER_MODE_PANEL_SETTINGS.RATE_CONTROL_KEYBOARD_STEP,
        shiftKeyboardStep: MACH_ZEHNDER_MODE_PANEL_SETTINGS.RATE_CONTROL_SHIFT_KEYBOARD_STEP,
        pageKeyboardStep: MACH_ZEHNDER_MODE_PANEL_SETTINGS.RATE_CONTROL_PAGE_KEYBOARD_STEP,
        visibleProperty: isSinglePhotonProperty,
      },
    );

    const whichPathCheckbox = createCheckbox(
      model.whichPathProperty,
      machZehnder.whichPathStringProperty,
      a11y.whichPathStringProperty,
    );

    const counts = new ReadoutBlock([
      { label: machZehnder.photonsEmittedStringProperty, value: countProperty(model.photonsEmittedProperty) },
      { label: machZehnder.portAStringProperty, value: countProperty(model.countsAProperty) },
      { label: machZehnder.portBStringProperty, value: countProperty(model.countsBProperty) },
    ]);

    const clearButton = createPushButton(
      machZehnder.clearCountsStringProperty,
      () => model.clearCounts(),
      a11y.clearCountsStringProperty,
    );

    const photonBox = new VBox({
      align: "left",
      spacing: MACH_ZEHNDER_MODE_PANEL_SETTINGS.PHOTON_BOX_SPACING,
      children: [counts, clearButton],
      visibleProperty: isSinglePhotonProperty,
    });

    super(machZehnder.modeStringProperty, [modeRadioGroup, whichPathCheckbox, rateControl, photonBox], {
      contentWidth,
    });
  }
}
