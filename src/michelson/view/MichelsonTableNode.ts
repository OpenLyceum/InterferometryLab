import { MICHELSON_TABLE_NODE_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * MichelsonTableNode.ts
 *
 * The optical table, seen from above: source, beam splitter, the two arms, and
 * the detector the recombined light falls on.
 *
 * The drawing is schematic and deliberately not to scale. The movable mirror's
 * whole travel is a fifth of a millimetre against a table drawn half a metre
 * wide, so showing it truthfully would show nothing at all; instead the mirror
 * slides by a visible amount proportional to its position, which keeps the
 * cause of the fringe motion visible even though the size is a fiction.
 */

import { DerivedProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { Vector2 } from "scenerystack/dot";
import { Node } from "scenerystack/scenery";
import { BeamPathNode } from "../../common/view/BeamPathNode.js";
import { pathDeltaProperty } from "../../common/view/formatters.js";
import { OpticalTableNode } from "../../common/view/OpticalTableNode.js";
import {
  createBeamSplitterNode,
  createDetectorPlateNode,
  createGasCellNode,
  createGlassPlateNode,
  createMirrorNode,
  createSourceNode,
  createTableLabel,
} from "../../common/view/opticNodes.js";
import { sourceColorProperty } from "../../common/view/sourceColor.js";
import { MICHELSON_COARSE_RANGE_NM } from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { InterferometryLabPreferencesModel } from "../../preferences/InterferometryLabPreferencesModel.js";
import type { MichelsonModel } from "../model/MichelsonModel.js";

/** Table size, view pixels. */
const TABLE_WIDTH: number = MICHELSON_TABLE_NODE_SETTINGS.TABLE_WIDTH;
const TABLE_HEIGHT: number = MICHELSON_TABLE_NODE_SETTINGS.TABLE_HEIGHT;

/** Component positions in table-local coordinates, view pixels. */
const SOURCE = new Vector2(MICHELSON_TABLE_NODE_SETTINGS.SOURCE_X, MICHELSON_TABLE_NODE_SETTINGS.SOURCE_Y);
const SPLITTER = new Vector2(MICHELSON_TABLE_NODE_SETTINGS.SPLITTER_X, MICHELSON_TABLE_NODE_SETTINGS.SPLITTER_Y);
const FIXED_MIRROR = new Vector2(
  MICHELSON_TABLE_NODE_SETTINGS.FIXED_MIRROR_X,
  MICHELSON_TABLE_NODE_SETTINGS.FIXED_MIRROR_Y,
);
const MOVABLE_MIRROR = new Vector2(
  MICHELSON_TABLE_NODE_SETTINGS.MOVABLE_MIRROR_X,
  MICHELSON_TABLE_NODE_SETTINGS.MOVABLE_MIRROR_Y,
);
const DETECTOR = new Vector2(MICHELSON_TABLE_NODE_SETTINGS.DETECTOR_X, MICHELSON_TABLE_NODE_SETTINGS.DETECTOR_Y);
const COMPENSATOR = new Vector2(
  MICHELSON_TABLE_NODE_SETTINGS.COMPENSATOR_X,
  MICHELSON_TABLE_NODE_SETTINGS.COMPENSATOR_Y,
);
const GAS_CELL = new Vector2(MICHELSON_TABLE_NODE_SETTINGS.GAS_CELL_X, MICHELSON_TABLE_NODE_SETTINGS.GAS_CELL_Y);

/** Width of the mirrors and plates, view pixels. */
const OPTIC_WIDTH: number = MICHELSON_TABLE_NODE_SETTINGS.OPTIC_WIDTH;

/**
 * How far the movable mirror slides on screen at the end of its travel, view
 * pixels. Purely illustrative — see the class comment.
 */
const MIRROR_TRAVEL_PIXELS: number = MICHELSON_TABLE_NODE_SETTINGS.MIRROR_TRAVEL_PIXELS;

export class MichelsonTableNode extends Node {
  public constructor(model: MichelsonModel, preferences: InterferometryLabPreferencesModel) {
    super();

    const strings = StringManager.getInstance();
    const common = strings.getCommon();
    const michelson = strings.getMichelsonStrings();

    const beamColor = sourceColorProperty(model.lightSource.groupsProperty);
    const table = new OpticalTableNode(TABLE_WIDTH, TABLE_HEIGHT);

    // ── Beams ────────────────────────────────────────────────────────────────
    // Drawn before the components so the hardware sits on top of the light.
    const beams = new Node({
      children: [
        new BeamPathNode([SOURCE, SPLITTER], beamColor),
        new BeamPathNode([SPLITTER, FIXED_MIRROR], beamColor),
        new BeamPathNode([SPLITTER, MOVABLE_MIRROR], beamColor),
        new BeamPathNode([SPLITTER, DETECTOR], beamColor),
      ],
    });

    // ── Components ───────────────────────────────────────────────────────────
    const source = createSourceNode(52, MICHELSON_TABLE_NODE_SETTINGS.SOURCE_HEIGHT, beamColor);
    source.translation = SOURCE;

    const splitter = createBeamSplitterNode(OPTIC_WIDTH + 10);
    splitter.translation = SPLITTER;

    // Reflective face towards the splitter, i.e. pointing back along −x.
    const fixedMirror = createMirrorNode(OPTIC_WIDTH);
    fixedMirror.rotation = -Math.PI / 2;
    fixedMirror.translation = FIXED_MIRROR;

    const movableMirror = createMirrorNode(OPTIC_WIDTH);
    movableMirror.rotation = Math.PI;

    const compensator = createGlassPlateNode(OPTIC_WIDTH + 10);
    compensator.rotation = Math.PI / 4;
    compensator.translation = COMPENSATOR;
    compensator.visibleProperty = model.compensatorPlateProperty;

    const gasFillProperty: TReadOnlyProperty<number> = new DerivedProperty(
      [model.gasCellPressureProperty],
      (pressureKPa) => pressureKPa / model.gasCellPressureProperty.range.max,
    );
    const gasCell = createGasCellNode(34, MICHELSON_TABLE_NODE_SETTINGS.GAS_CELL_HEIGHT, gasFillProperty);
    gasCell.rotation = Math.PI / 2;
    gasCell.translation = GAS_CELL;
    gasCell.visibleProperty = model.gasCellEnabledProperty;

    const detector = createDetectorPlateNode(OPTIC_WIDTH);
    detector.translation = DETECTOR;

    // The mirror's drawn position tracks its real one, scaled up enormously so
    // that the control visibly does something.
    model.mirrorOffsetProperty.link((offsetNm) => {
      const fraction = offsetNm / MICHELSON_COARSE_RANGE_NM.max;
      movableMirror.translation = MOVABLE_MIRROR.plusXY(0, -MIRROR_TRAVEL_PIXELS * fraction);
    });

    // ── Labels ───────────────────────────────────────────────────────────────
    const sourceLabel = createTableLabel(common.sourceStringProperty);
    sourceLabel.centerX = SOURCE.x - MICHELSON_TABLE_NODE_SETTINGS.CONSTRUCTOR_CENTER_X_OFFSET;
    sourceLabel.bottom = SOURCE.y - MICHELSON_TABLE_NODE_SETTINGS.CONSTRUCTOR_BOTTOM_OFFSET;

    const splitterLabel = createTableLabel(common.beamSplitterStringProperty);
    splitterLabel.centerX = SPLITTER.x + 4;
    splitterLabel.top = SPLITTER.y + MICHELSON_TABLE_NODE_SETTINGS.CONSTRUCTOR_TOP_OFFSET;

    const movableLabel = createTableLabel("M₁");
    movableLabel.right = MOVABLE_MIRROR.x - MICHELSON_TABLE_NODE_SETTINGS.CONSTRUCTOR_RIGHT_OFFSET;
    movableLabel.centerY = MOVABLE_MIRROR.y;

    const fixedLabel = createTableLabel("M₂");
    fixedLabel.centerX = FIXED_MIRROR.x;
    fixedLabel.bottom = FIXED_MIRROR.y - 30;

    const detectorLabel = createTableLabel(common.detectorStringProperty);
    detectorLabel.centerX = DETECTOR.x + 4;
    detectorLabel.top = DETECTOR.y + 12;

    const compensatorLabel = createTableLabel(michelson.compensatorPlateStringProperty);
    compensatorLabel.centerX = COMPENSATOR.x + 10;
    compensatorLabel.bottom = COMPENSATOR.y - 28;
    compensatorLabel.visibleProperty = model.compensatorPlateProperty;
    compensatorLabel.maxWidth = MICHELSON_TABLE_NODE_SETTINGS.MAX_WIDTH_MAX_WIDTH;

    const gasCellLabel = createTableLabel(michelson.gasCellStringProperty);
    gasCellLabel.left = GAS_CELL.x + MICHELSON_TABLE_NODE_SETTINGS.CONSTRUCTOR_LEFT_OFFSET;
    gasCellLabel.centerY = GAS_CELL.y;
    gasCellLabel.visibleProperty = model.gasCellEnabledProperty;

    // ── Path-difference contributions ────────────────────────────────────────
    // Optional, because the numbers are already in the readouts and a permanent
    // second copy on the table would be clutter. Switched on they answer the
    // question the readouts cannot: *where* the path difference is coming from.
    // Both are doubled, because both are in an arm the light crosses twice —
    // which is the single most common slip in reading a Michelson, and drawing
    // it next to the element makes the factor of two hard to miss.
    const mirrorPathLabel = createTableLabel(pathDeltaProperty(model.mirrorPathProperty, 1));
    mirrorPathLabel.left = MOVABLE_MIRROR.x + 30;
    mirrorPathLabel.centerY = MOVABLE_MIRROR.y;
    mirrorPathLabel.visibleProperty = preferences.showOpticalPathProperty;

    // Left of the cell rather than under it: below is where the compensator's
    // own label runs, and the two would collide.
    const cellPathLabel = createTableLabel(
      pathDeltaProperty(model.gasCellOpdProperty, MICHELSON_TABLE_NODE_SETTINGS.CELL_PATH_LABEL_DECIMALS),
    );
    cellPathLabel.right = GAS_CELL.x - 24;
    cellPathLabel.centerY = GAS_CELL.y;
    cellPathLabel.visibleProperty = new DerivedProperty(
      [preferences.showOpticalPathProperty, model.gasCellEnabledProperty],
      (show, enabled) => show && enabled,
    );

    this.children = [
      table,
      beams,
      source,
      splitter,
      compensator,
      gasCell,
      fixedMirror,
      movableMirror,
      detector,
      sourceLabel,
      splitterLabel,
      movableLabel,
      fixedLabel,
      detectorLabel,
      compensatorLabel,
      gasCellLabel,
      mirrorPathLabel,
      cellPathLabel,
    ];
  }
}
