/**
 * InterferometryLabPreferencesModel.ts
 *
 * Model for the simulation-specific preferences shown in Preferences →
 * Simulation. Each preference Property takes its initial value from the
 * corresponding query parameter in interferometryLabQueryParameters.
 */

import { BooleanProperty } from "scenerystack/axon";
import type { Tandem } from "scenerystack/tandem";
import InterferometryLabNamespace from "../InterferometryLabNamespace.js";
import interferometryLabQueryParameters from "./interferometryLabQueryParameters.js";

export class InterferometryLabPreferencesModel {
  /** Whether beam segments carry an optical-path-length label on the table. */
  public readonly showOpticalPathProperty: BooleanProperty;

  public constructor(tandem?: Tandem) {
    this.showOpticalPathProperty = new BooleanProperty(
      interferometryLabQueryParameters.showOpticalPath,
      tandem ? { tandem: tandem.createTandem("showOpticalPathProperty") } : undefined,
    );
  }

  public reset(): void {
    this.showOpticalPathProperty.reset();
  }
}

InterferometryLabNamespace.register("InterferometryLabPreferencesModel", InterferometryLabPreferencesModel);
