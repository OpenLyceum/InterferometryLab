/**
 * MachZehnderScreen.ts
 *
 * The top-level Screen component. It wires together the model and view
 * factories and passes screen-level options (name, background color, tandem)
 * to the parent Screen class.
 *
 * Registered in the screens array in src/main.ts. Its home-screen and navigation-bar
 * icons come from createMachZehnderIcon() in src/common/InterferometryLabScreenIcons.ts
 * (see SceneryStackTemplate doc/multi-screen.md).
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createMachZehnderIcon } from "../common/InterferometryLabScreenIcons.js";
import { InterferometryLabKeyboardHelpContent } from "../common/view/InterferometryLabKeyboardHelpContent.js";
import InterferometryLabColors from "../InterferometryLabColors.js";
import type { InterferometryLabPreferencesModel } from "../preferences/InterferometryLabPreferencesModel.js";
import { MachZehnderModel } from "./model/MachZehnderModel.js";
import { MachZehnderScreenView } from "./view/MachZehnderScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type MachZehnderScreenOptions = ScreenOptions & { tandem: Tandem };

export class MachZehnderScreen extends Screen<MachZehnderModel, MachZehnderScreenView> {
  /**
   * @param preferences - simulation preferences the view reads; the optical-path
   *                      labels are a preference, so the view needs to see them
   * @param options
   */
  public constructor(preferences: InterferometryLabPreferencesModel, options: MachZehnderScreenOptions) {
    super(
      // Model factory — called once when the screen is first shown
      () => new MachZehnderModel(),
      // View factory — receives the model instance
      (model) =>
        new MachZehnderScreenView(model, preferences, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<MachZehnderScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: InterferometryLabColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new InterferometryLabKeyboardHelpContent(),
          homeScreenIcon: createMachZehnderIcon(),
          navigationBarIcon: createMachZehnderIcon(),
        },
        options,
      ),
    );
  }
}
