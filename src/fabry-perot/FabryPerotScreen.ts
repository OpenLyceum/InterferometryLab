/**
 * FabryPerotScreen.ts
 *
 * The top-level Screen component. It wires together the model and view
 * factories and passes screen-level options (name, background color, tandem)
 * to the parent Screen class.
 *
 * Registered in the screens array in src/main.ts. Its home-screen and navigation-bar
 * icons come from createFabryPerotIcon() in src/common/InterferometryLabScreenIcons.ts
 * (see SceneryStackTemplate doc/multi-screen.md).
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createFabryPerotIcon } from "../common/InterferometryLabScreenIcons.js";
import { InterferometryLabKeyboardHelpContent } from "../common/view/InterferometryLabKeyboardHelpContent.js";
import InterferometryLabColors from "../InterferometryLabColors.js";
import type { InterferometryLabPreferencesModel } from "../preferences/InterferometryLabPreferencesModel.js";
import { FabryPerotModel } from "./model/FabryPerotModel.js";
import { FabryPerotScreenView } from "./view/FabryPerotScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type FabryPerotScreenOptions = ScreenOptions & { tandem: Tandem };

export class FabryPerotScreen extends Screen<FabryPerotModel, FabryPerotScreenView> {
  /**
   * @param preferences - simulation preferences the view reads; the optical-path
   *                      labels are a preference, so the view needs to see them
   * @param options
   */
  public constructor(preferences: InterferometryLabPreferencesModel, options: FabryPerotScreenOptions) {
    super(
      // Model factory — called once when the screen is first shown
      () => new FabryPerotModel(),
      // View factory — receives the model instance
      (model) =>
        new FabryPerotScreenView(model, preferences, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<FabryPerotScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: InterferometryLabColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new InterferometryLabKeyboardHelpContent(),
          homeScreenIcon: createFabryPerotIcon(),
          navigationBarIcon: createFabryPerotIcon(),
        },
        options,
      ),
    );
  }
}
