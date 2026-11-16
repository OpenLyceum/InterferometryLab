import { FABRY_PEROT_TABLE_NODE_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * FabryPerotTableNode.ts
 *
 * The etalon on the table: a source, two partly reflecting mirrors facing each
 * other, a lens, and the screen the rings land on.
 *
 * The bounces between the mirrors are drawn explicitly, stepped down in
 * brightness. It is a schematic — a real cavity's beams overlap exactly — but
 * the staircase is the one picture that makes "many beams, each weaker and later
 * than the last" concrete, and everything sharp about the output follows from it.
 */

import { DerivedProperty } from "scenerystack/axon";
import { Vector2 } from "scenerystack/dot";
import { Node } from "scenerystack/scenery";
import { BeamPathNode } from "../../common/view/BeamPathNode.js";
import { pathDeltaProperty } from "../../common/view/formatters.js";
import { OpticalTableNode } from "../../common/view/OpticalTableNode.js";
import {
  createDetectorPlateNode,
  createLensNode,
  createMirrorNode,
  createSourceNode,
  createTableLabel,
} from "../../common/view/opticNodes.js";
import { sourceColorProperty } from "../../common/view/sourceColor.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { InterferometryLabPreferencesModel } from "../../preferences/InterferometryLabPreferencesModel.js";
import type { FabryPerotModel } from "../model/FabryPerotModel.js";

/** Table size, view pixels. */
const TABLE_WIDTH: number = FABRY_PEROT_TABLE_NODE_SETTINGS.TABLE_WIDTH;
const TABLE_HEIGHT: number = FABRY_PEROT_TABLE_NODE_SETTINGS.TABLE_HEIGHT;

/** Layout along the optical axis, table-local coordinates. */
const AXIS_Y: number = FABRY_PEROT_TABLE_NODE_SETTINGS.AXIS_Y;
const SOURCE_X: number = FABRY_PEROT_TABLE_NODE_SETTINGS.SOURCE_X;
const FIRST_MIRROR_X: number = FABRY_PEROT_TABLE_NODE_SETTINGS.FIRST_MIRROR_X;
const SECOND_MIRROR_X: number = FABRY_PEROT_TABLE_NODE_SETTINGS.SECOND_MIRROR_X;
const LENS_X: number = FABRY_PEROT_TABLE_NODE_SETTINGS.LENS_X;
const SCREEN_X: number = FABRY_PEROT_TABLE_NODE_SETTINGS.SCREEN_X;

/** Height of the mirrors and screen, view pixels. */
const OPTIC_HEIGHT: number = FABRY_PEROT_TABLE_NODE_SETTINGS.OPTIC_HEIGHT;

/** How many internal round trips are drawn before the beam is too faint to see. */
const DRAWN_BOUNCES: number = FABRY_PEROT_TABLE_NODE_SETTINGS.DRAWN_BOUNCES;

/** Vertical offset between successive drawn bounces, view pixels. */
const BOUNCE_STEP: number = FABRY_PEROT_TABLE_NODE_SETTINGS.BOUNCE_STEP;

export class FabryPerotTableNode extends Node {
  public constructor(model: FabryPerotModel, preferences: InterferometryLabPreferencesModel) {
    super();

    const strings = StringManager.getInstance();
    const common = strings.getCommon();
    const fabryPerot = strings.getFabryPerotStrings();

    const beamColor = sourceColorProperty(model.linesProperty);
    const table = new OpticalTableNode(TABLE_WIDTH, TABLE_HEIGHT);

    const beams: Node[] = [
      new BeamPathNode([new Vector2(SOURCE_X, AXIS_Y), new Vector2(FIRST_MIRROR_X, AXIS_Y)], beamColor),
    ];

    // Inside the cavity: each round trip is drawn slightly above the last so the
    // separate passes can be told apart, and each is dimmer by a factor of R².
    for (let bounce = 0; bounce < DRAWN_BOUNCES; bounce++) {
      const y = AXIS_Y - (bounce + 1) * BOUNCE_STEP;
      const brightnessProperty = new DerivedProperty([model.reflectanceProperty], (reflectance) =>
        Math.max(0.08, reflectance ** (2 * bounce)),
      );

      beams.push(
        new BeamPathNode([new Vector2(FIRST_MIRROR_X, y), new Vector2(SECOND_MIRROR_X, y)], beamColor, {
          intensityProperty: brightnessProperty,
        }),
      );

      // The part that leaks out towards the screen at this bounce.
      const leakProperty = new DerivedProperty([model.reflectanceProperty], (reflectance) =>
        Math.max(0.06, (1 - reflectance) * reflectance ** (2 * bounce) * 3),
      );
      beams.push(
        new BeamPathNode([new Vector2(SECOND_MIRROR_X, y), new Vector2(LENS_X, y)], beamColor, {
          intensityProperty: leakProperty,
        }),
      );
    }

    beams.push(new BeamPathNode([new Vector2(LENS_X, AXIS_Y), new Vector2(SCREEN_X, AXIS_Y)], beamColor));

    const source = createSourceNode(46, FABRY_PEROT_TABLE_NODE_SETTINGS.SOURCE_HEIGHT, beamColor);
    source.translation = new Vector2(SOURCE_X, AXIS_Y);

    const firstMirror = createMirrorNode(OPTIC_HEIGHT, { partial: true });
    firstMirror.rotation = Math.PI / 2;
    firstMirror.translation = new Vector2(FIRST_MIRROR_X, AXIS_Y);

    const secondMirror = createMirrorNode(OPTIC_HEIGHT, { partial: true });
    secondMirror.rotation = -Math.PI / 2;
    secondMirror.translation = new Vector2(SECOND_MIRROR_X, AXIS_Y);

    const lens = createLensNode(FABRY_PEROT_TABLE_NODE_SETTINGS.LENS_HEIGHT, 9);
    lens.translation = new Vector2(LENS_X, AXIS_Y);

    const screen = createDetectorPlateNode(OPTIC_HEIGHT);
    screen.rotation = -Math.PI / 2;
    screen.translation = new Vector2(SCREEN_X, AXIS_Y);

    const sourceLabel = createTableLabel(common.sourceStringProperty);
    sourceLabel.centerX = SOURCE_X - FABRY_PEROT_TABLE_NODE_SETTINGS.CONSTRUCTOR_CENTER_X_OFFSET;
    sourceLabel.top = AXIS_Y + FABRY_PEROT_TABLE_NODE_SETTINGS.CONSTRUCTOR_TOP_OFFSET;

    const cavityLabel = createTableLabel(fabryPerot.cavityStringProperty);
    cavityLabel.centerX = (FIRST_MIRROR_X + SECOND_MIRROR_X) / 2;
    cavityLabel.top = AXIS_Y + 44;

    // The cavity's contribution is the round trip 2nd, not the spacing d — which
    // is exactly the distinction the order m = 2nd/λ readout depends on, and the
    // one that is easiest to lose when reading the spacing slider.
    const cavityPathLabel = createTableLabel(pathDeltaProperty(model.roundTripPathProperty, 1));
    cavityPathLabel.centerX = (FIRST_MIRROR_X + SECOND_MIRROR_X) / 2;
    cavityPathLabel.top = AXIS_Y + 60;
    cavityPathLabel.visibleProperty = preferences.showOpticalPathProperty;

    const screenLabel = createTableLabel(common.screenStringProperty);
    screenLabel.centerX = SCREEN_X - 6;
    screenLabel.top = AXIS_Y + 44;

    this.children = [
      table,
      new Node({ children: beams }),
      source,
      firstMirror,
      secondMirror,
      lens,
      screen,
      sourceLabel,
      cavityLabel,
      cavityPathLabel,
      screenLabel,
    ];
  }
}
