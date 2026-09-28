/**
 * main.ts
 *
 * Entry point for the simulation. Initializes SceneryStack, creates the
 * screens, and starts the main event loop.
 *
 * !! CRITICAL IMPORT ORDER !!
 * brand.js MUST be the first import. Each module imports the next, so the import nesting is
 *
 *   main → brand → splash → assert → init
 *
 * and therefore the actual EXECUTION order (deepest import runs first) is the reverse:
 *
 *   init → assert → splash → brand → main
 *
 * SceneryStack requires this exact load order. Never reorder these imports.
 */

// brand.js MUST be first; importing it runs the whole chain (init→assert→splash→brand) before main.
import "./brand.js";

import { onReadyToLaunch, PreferencesModel, Sim } from "scenerystack/sim";
import { Tandem } from "scenerystack/tandem";
import { FabryPerotScreen } from "./fabry-perot/FabryPerotScreen.js";
import InterferometryLabColors from "./InterferometryLabColors.js";
import { StringManager } from "./i18n/StringManager.js";
import { MachZehnderScreen } from "./mach-zehnder/MachZehnderScreen.js";
import { MichelsonScreen } from "./michelson/MichelsonScreen.js";
import { InterferometryLabPreferencesModel } from "./preferences/InterferometryLabPreferencesModel.js";
import { InterferometryLabPreferencesNode } from "./preferences/InterferometryLabPreferencesNode.js";

onReadyToLaunch(() => {
  const stringManager = StringManager.getInstance();

  // Simulation-specific preferences; initial values come from interferometryLabQueryParameters.
  const simPreferences = new InterferometryLabPreferencesModel(Tandem.ROOT.createTandem("preferences"));

  const screens = [
    new MichelsonScreen(simPreferences, {
      // The screen name Property updates automatically when the locale changes
      name: stringManager.getScreenNames().michelsonStringProperty,
      tandem: Tandem.ROOT.createTandem("michelsonScreen"),
      backgroundColorProperty: InterferometryLabColors.backgroundColorProperty,
    }),
    new MachZehnderScreen(simPreferences, {
      // The screen name Property updates automatically when the locale changes
      name: stringManager.getScreenNames().machZehnderStringProperty,
      tandem: Tandem.ROOT.createTandem("machZehnderScreen"),
      backgroundColorProperty: InterferometryLabColors.backgroundColorProperty,
    }),
    new FabryPerotScreen(simPreferences, {
      // The screen name Property updates automatically when the locale changes
      name: stringManager.getScreenNames().fabryPerotStringProperty,
      tandem: Tandem.ROOT.createTandem("fabryPerotScreen"),
      backgroundColorProperty: InterferometryLabColors.backgroundColorProperty,
    }),
  ];

  const sim = new Sim(stringManager.getTitleStringProperty(), screens, {
    preferencesModel: new PreferencesModel({
      visualOptions: {
        // Adds a "Projector Mode" toggle in Preferences → Visual
        supportsProjectorMode: true,
        // Enables keyboard-navigation highlight outlines
        supportsInteractiveHighlights: true,
      },
      simulationOptions: {
        customPreferences: [
          {
            createContent: (tandem: Tandem) => new InterferometryLabPreferencesNode(simPreferences, tandem),
          },
        ],
      },
      localizationOptions: {
        // Adds a language picker in Preferences → Language
        supportsDynamicLocale: true,
      },
    }),

    // Optional: fill in credits shown in Help → About
    credits: {
      leadDesign: "",
      softwareDevelopment: "",
      team: "",
      qualityAssurance: "",
    },
  });

  sim.start();
});
