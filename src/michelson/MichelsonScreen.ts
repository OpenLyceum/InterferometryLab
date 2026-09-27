/**
 * MichelsonScreen.ts
 *
 * The top-level Screen component. It wires together the model and view
 * factories and passes screen-level options (name, background color, tandem)
 * to the parent Screen class.
 *
 * Registered in the screens array in src/main.ts. Its home-screen and navigation-bar
 * icons come from createMichelsonIcon() in src/common/InterferometryLabScreenIcons.ts
 * (see SceneryStackTemplate doc/multi-screen.md).
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createMichelsonIcon } from "../common/InterferometryLabScreenIcons.js";
import { InterferometryLabKeyboardHelpContent } from "../common/view/InterferometryLabKeyboardHelpContent.js";
import InterferometryLabColors from "../InterferometryLabColors.js";
import type { InterferometryLabPreferencesModel } from "../preferences/InterferometryLabPreferencesModel.js";
import { MichelsonModel } from "./model/MichelsonModel.js";
import { MichelsonScreenView } from "./view/MichelsonScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type MichelsonScreenOptions = ScreenOptions & { tandem: Tandem };

export class MichelsonScreen extends Screen<MichelsonModel, MichelsonScreenView> {
  /**
   * @param preferences - simulation preferences the view reads; the optical-path
   *                      labels are a preference, so the view needs to see them
   * @param options
   */
  public constructor(preferences: InterferometryLabPreferencesModel, options: MichelsonScreenOptions) {
    super(
      // Model factory — called once when the screen is first shown
      () => new MichelsonModel(),
      // View factory — receives the model instance
      (model) =>
        new MichelsonScreenView(model, preferences, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<MichelsonScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: InterferometryLabColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new InterferometryLabKeyboardHelpContent(),
          homeScreenIcon: createMichelsonIcon(),
          navigationBarIcon: createMichelsonIcon(),
        },
        options,
      ),
    );
  }
}
