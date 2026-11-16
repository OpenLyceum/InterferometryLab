import { INTERFEROMETRY_LAB_PANEL_SETTINGS } from "../InterferometryLabConstants.js";
/**
 * InterferometryLabPanel.ts
 *
 * A pre-themed Panel that automatically uses InterferometryLabColors for background and
 * border. Use this for all control panels and info boxes in the sim so that
 * default / projector mode switching is handled automatically.
 *
 * ── Basic usage ───────────────────────────────────────────────────────────────
 *
 *   import { InterferometryLabPanel } from "../../common/InterferometryLabPanel.js";
 *   import { VBox, Text } from "scenerystack/scenery";
 *
 *   const content = new VBox({
 *     children: [ new Text("label"), slider ],
 *     spacing: 8,
 *   });
 *   const panel = new InterferometryLabPanel(content);
 *
 * ── Overriding defaults ───────────────────────────────────────────────────────
 *
 *   // Wider margins, sharper corners, custom stroke
 *   const panel = new InterferometryLabPanel(content, { xMargin: 20, cornerRadius: 0 });
 *
 *   // Transparent background (decorative border only)
 *   const panel = new InterferometryLabPanel(content, { fill: "transparent" });
 */

import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { Node } from "scenerystack/scenery";
import { Panel, type PanelOptions } from "scenerystack/sun";
import InterferometryLabColors from "../InterferometryLabColors.js";
import { PANEL_CORNER_RADIUS } from "../InterferometryLabConstants.js";

export type InterferometryLabPanelOptions = PanelOptions;

export class InterferometryLabPanel extends Panel {
  public constructor(content: Node, providedOptions?: InterferometryLabPanelOptions) {
    const options = optionize<InterferometryLabPanelOptions, EmptySelfOptions, PanelOptions>()(
      {
        fill: InterferometryLabColors.panelBackgroundColorProperty,
        stroke: InterferometryLabColors.panelBorderColorProperty,
        cornerRadius: PANEL_CORNER_RADIUS,
        xMargin: INTERFEROMETRY_LAB_PANEL_SETTINGS.OPTIONS_X_MARGIN,
        yMargin: INTERFEROMETRY_LAB_PANEL_SETTINGS.OPTIONS_Y_MARGIN,
      },
      providedOptions,
    );
    super(content, options);
  }
}
