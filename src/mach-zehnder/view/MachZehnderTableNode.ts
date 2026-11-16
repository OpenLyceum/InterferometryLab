import { MACH_ZEHNDER_TABLE_NODE_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * MachZehnderTableNode.ts
 *
 * The Mach-Zehnder layout from above: a rectangle of beam, with a splitter at
 * one corner, mirrors at two more, and the recombining splitter at the fourth.
 *
 * The two outputs leave the last splitter at right angles to each other, and the
 * drawing keeps them both — the complementary port is the whole point of this
 * geometry and hiding it would make the interference look like it destroys
 * light.
 */

import { DerivedProperty } from "scenerystack/axon";
import { Vector2 } from "scenerystack/dot";
import { Node } from "scenerystack/scenery";
import { BeamPathNode } from "../../common/view/BeamPathNode.js";
import { pathDeltaProperty } from "../../common/view/formatters.js";
import { OpticalTableNode } from "../../common/view/OpticalTableNode.js";
import {
  createBeamSplitterNode,
  createDetectorPlateNode,
  createGlassPlateNode,
  createMirrorNode,
  createSourceNode,
  createTableLabel,
} from "../../common/view/opticNodes.js";
import { sourceColorProperty } from "../../common/view/sourceColor.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { InterferometryLabPreferencesModel } from "../../preferences/InterferometryLabPreferencesModel.js";
import type { MachZehnderModel } from "../model/MachZehnderModel.js";

/** Table size, view pixels. */
const TABLE_WIDTH: number = MACH_ZEHNDER_TABLE_NODE_SETTINGS.TABLE_WIDTH;
const TABLE_HEIGHT: number = MACH_ZEHNDER_TABLE_NODE_SETTINGS.TABLE_HEIGHT;

/** The four corners of the interferometer, in table-local coordinates. */
const SPLITTER_IN = new Vector2(
  MACH_ZEHNDER_TABLE_NODE_SETTINGS.SPLITTER_IN_X,
  MACH_ZEHNDER_TABLE_NODE_SETTINGS.SPLITTER_IN_Y,
);
const MIRROR_UPPER = new Vector2(
  MACH_ZEHNDER_TABLE_NODE_SETTINGS.MIRROR_UPPER_X,
  MACH_ZEHNDER_TABLE_NODE_SETTINGS.MIRROR_UPPER_Y,
);
const MIRROR_LOWER = new Vector2(
  MACH_ZEHNDER_TABLE_NODE_SETTINGS.MIRROR_LOWER_X,
  MACH_ZEHNDER_TABLE_NODE_SETTINGS.MIRROR_LOWER_Y,
);
const SPLITTER_OUT = new Vector2(
  MACH_ZEHNDER_TABLE_NODE_SETTINGS.SPLITTER_OUT_X,
  MACH_ZEHNDER_TABLE_NODE_SETTINGS.SPLITTER_OUT_Y,
);

/** Where the light comes from and where it goes. */
const SOURCE = new Vector2(MACH_ZEHNDER_TABLE_NODE_SETTINGS.SOURCE_X, MACH_ZEHNDER_TABLE_NODE_SETTINGS.SOURCE_Y);
const DETECTOR_A = new Vector2(
  MACH_ZEHNDER_TABLE_NODE_SETTINGS.DETECTOR_A_X,
  MACH_ZEHNDER_TABLE_NODE_SETTINGS.DETECTOR_A_Y,
);
const DETECTOR_B = new Vector2(
  MACH_ZEHNDER_TABLE_NODE_SETTINGS.DETECTOR_B_X,
  MACH_ZEHNDER_TABLE_NODE_SETTINGS.DETECTOR_B_Y,
);

/** Where the sample slide sits, in the upper arm. */
const SAMPLE = new Vector2(MACH_ZEHNDER_TABLE_NODE_SETTINGS.SAMPLE_X, MACH_ZEHNDER_TABLE_NODE_SETTINGS.SAMPLE_Y);

/** Width of the mirrors and plates, view pixels. */
const OPTIC_WIDTH: number = MACH_ZEHNDER_TABLE_NODE_SETTINGS.OPTIC_WIDTH;

export class MachZehnderTableNode extends Node {
  public constructor(model: MachZehnderModel, preferences: InterferometryLabPreferencesModel) {
    super();

    const strings = StringManager.getInstance();
    const common = strings.getCommon();
    const machZehnder = strings.getMachZehnderStrings();

    const beamColor = sourceColorProperty(model.lightSource.groupsProperty);
    const table = new OpticalTableNode(TABLE_WIDTH, TABLE_HEIGHT);

    // The two output beams brighten and dim in antiphase as the path difference
    // changes, which is the clearest statement the drawing can make that the
    // light is being redistributed rather than created or destroyed.
    const portABrightness = new DerivedProperty([model.portAFractionProperty], (fraction) => 0.25 + 1.5 * fraction);
    const portBBrightness = new DerivedProperty([model.portBFractionProperty], (fraction) => 0.25 + 1.5 * fraction);

    const beams = new Node({
      children: [
        new BeamPathNode([SOURCE, SPLITTER_IN], beamColor),
        // Path 1: up the left side, then across the top.
        new BeamPathNode([SPLITTER_IN, MIRROR_UPPER, SPLITTER_OUT], beamColor),
        // Path 2: across the bottom, then up the right side.
        new BeamPathNode([SPLITTER_IN, MIRROR_LOWER, SPLITTER_OUT], beamColor),
        new BeamPathNode([SPLITTER_OUT, DETECTOR_A], beamColor, { intensityProperty: portABrightness }),
        new BeamPathNode([SPLITTER_OUT, DETECTOR_B], beamColor, { intensityProperty: portBBrightness }),
      ],
    });

    const source = createSourceNode(50, MACH_ZEHNDER_TABLE_NODE_SETTINGS.SOURCE_HEIGHT, beamColor);
    source.translation = SOURCE;

    const splitterIn = createBeamSplitterNode(OPTIC_WIDTH + 8);
    splitterIn.translation = SPLITTER_IN;

    const splitterOut = createBeamSplitterNode(OPTIC_WIDTH + 8);
    splitterOut.translation = SPLITTER_OUT;

    // Each mirror faces into the corner it turns the beam around.
    const mirrorUpper = createMirrorNode(OPTIC_WIDTH);
    mirrorUpper.rotation = -Math.PI / 4;
    mirrorUpper.translation = MIRROR_UPPER;

    const mirrorLower = createMirrorNode(OPTIC_WIDTH);
    mirrorLower.rotation = (3 * Math.PI) / 4;
    mirrorLower.translation = MIRROR_LOWER;

    const sample = createGlassPlateNode(30, 10);
    sample.translation = SAMPLE;
    sample.visibleProperty = model.sampleEnabledProperty;
    model.sampleTiltProperty.link((tiltDeg) => {
      sample.rotation = (tiltDeg * Math.PI) / 180;
    });

    const detectorA = createDetectorPlateNode(OPTIC_WIDTH);
    detectorA.rotation = -Math.PI / 2;
    detectorA.translation = DETECTOR_A;

    const detectorB = createDetectorPlateNode(OPTIC_WIDTH);
    detectorB.rotation = Math.PI;
    detectorB.translation = DETECTOR_B;

    const sourceLabel = createTableLabel(common.sourceStringProperty);
    sourceLabel.centerX = SOURCE.x - MACH_ZEHNDER_TABLE_NODE_SETTINGS.CONSTRUCTOR_CENTER_X_OFFSET;
    sourceLabel.top = SOURCE.y + MACH_ZEHNDER_TABLE_NODE_SETTINGS.CONSTRUCTOR_TOP_OFFSET;

    const portALabel = createTableLabel(machZehnder.portAStringProperty);
    portALabel.centerX = DETECTOR_A.x - 6;
    portALabel.top = DETECTOR_A.y + 26;

    const portBLabel = createTableLabel(machZehnder.portBStringProperty);
    portBLabel.left = DETECTOR_B.x + MACH_ZEHNDER_TABLE_NODE_SETTINGS.CONSTRUCTOR_LEFT_OFFSET;
    portBLabel.centerY = DETECTOR_B.y;

    const mirrorLabel = createTableLabel("M₂");
    mirrorLabel.right = MIRROR_UPPER.x - MACH_ZEHNDER_TABLE_NODE_SETTINGS.CONSTRUCTOR_RIGHT_OFFSET;
    mirrorLabel.centerY = MIRROR_UPPER.y;

    // ── Path-difference contributions ────────────────────────────────────────
    // Unlike the Michelson, nothing here is doubled: the two arms are separate
    // routes crossed once each, so the imbalance and the slide contribute
    // exactly what they are. Seeing the two screens' labels side by side is the
    // clearest statement of why a Michelson's factor of two exists at all.
    const imbalanceLabel = createTableLabel(pathDeltaProperty(model.pathImbalanceProperty, 0));
    imbalanceLabel.centerX = MIRROR_UPPER.x + 44;
    imbalanceLabel.bottom = MIRROR_UPPER.y - MACH_ZEHNDER_TABLE_NODE_SETTINGS.CONSTRUCTOR_BOTTOM_OFFSET;
    imbalanceLabel.visibleProperty = preferences.showOpticalPathProperty;

    const samplePathLabel = createTableLabel(pathDeltaProperty(model.samplePathProperty, 0));
    samplePathLabel.centerX = SAMPLE.x;
    samplePathLabel.bottom = SAMPLE.y - 14;
    samplePathLabel.visibleProperty = new DerivedProperty(
      [preferences.showOpticalPathProperty, model.sampleEnabledProperty],
      (show, enabled) => show && enabled,
    );

    const sampleLabel = createTableLabel(machZehnder.sampleStringProperty);
    sampleLabel.centerX = SAMPLE.x;
    sampleLabel.top = SAMPLE.y + MACH_ZEHNDER_TABLE_NODE_SETTINGS.CONSTRUCTOR_TOP_OFFSET;
    sampleLabel.visibleProperty = model.sampleEnabledProperty;

    this.children = [
      table,
      beams,
      source,
      splitterIn,
      splitterOut,
      mirrorUpper,
      mirrorLower,
      sample,
      detectorA,
      detectorB,
      sourceLabel,
      portALabel,
      portBLabel,
      mirrorLabel,
      sampleLabel,
      imbalanceLabel,
      samplePathLabel,
    ];
  }
}
