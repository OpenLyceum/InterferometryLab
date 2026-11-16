import { INTERFEROMETRY_LAB_PREFERENCES_NODE_SETTINGS } from "../InterferometryLabConstants.js";
/**
 * InterferometryLabPreferencesNode.ts
 *
 * Custom preferences UI shown in Preferences → Simulation. Controls are bound
 * to InterferometryLabPreferencesModel Properties (whose initial values come from
 * interferometryLabQueryParameters).
 */

import { Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Checkbox } from "scenerystack/sun";
import type { Tandem } from "scenerystack/tandem";
import InterferometryLabColors from "../InterferometryLabColors.js";
import InterferometryLabNamespace from "../InterferometryLabNamespace.js";
import { StringManager } from "../i18n/StringManager.js";
import type { InterferometryLabPreferencesModel } from "./InterferometryLabPreferencesModel.js";

export class InterferometryLabPreferencesNode extends VBox {
  public constructor(preferencesModel: InterferometryLabPreferencesModel, tandem?: Tandem) {
    const prefStrings = StringManager.getInstance().getPreferences();

    // The Preferences dialog is always white, so use the dark "light control surface"
    // colors (readable on white in both default and projector profiles), not textColorProperty
    // (which is near-white in default mode and would be invisible on the white dialog).
    const header = new Text(prefStrings.titleStringProperty, {
      font: new PhetFont({ size: INTERFEROMETRY_LAB_PREFERENCES_NODE_SETTINGS.HEADER_FONT_SIZE, weight: "bold" }),
      fill: InterferometryLabColors.controlSurfaceTextColorProperty,
    });

    const showOpticalPathCheckbox = new Checkbox(
      preferencesModel.showOpticalPathProperty,
      new Text(prefStrings.showOpticalPathStringProperty, {
        font: new PhetFont(INTERFEROMETRY_LAB_PREFERENCES_NODE_SETTINGS.SHOW_OPTICAL_PATH_CHECKBOX_FONT_SIZE),
        fill: InterferometryLabColors.controlSurfaceTextColorProperty,
      }),
      {
        checkboxColor: InterferometryLabColors.controlSurfaceTextColorProperty,
        checkboxColorBackground: InterferometryLabColors.controlSurfaceColorProperty,
        spacing: INTERFEROMETRY_LAB_PREFERENCES_NODE_SETTINGS.SHOW_OPTICAL_PATH_CHECKBOX_SPACING,
        accessibleHelpText: prefStrings.showOpticalPathDescriptionStringProperty,
        ...(tandem && { tandem: tandem.createTandem("showOpticalPathCheckbox") }),
      },
    );

    super({
      align: "left",
      spacing: INTERFEROMETRY_LAB_PREFERENCES_NODE_SETTINGS.CONSTRUCTOR_SPACING,
      children: [header, showOpticalPathCheckbox],
    });
  }
}

InterferometryLabNamespace.register("InterferometryLabPreferencesNode", InterferometryLabPreferencesNode);
