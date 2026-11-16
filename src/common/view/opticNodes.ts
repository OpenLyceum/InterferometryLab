import { OPTIC_NODES_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * opticNodes.ts
 *
 * Factories for the pieces of hardware drawn on the optical table: the source,
 * mirrors, beam splitters, glass inserts and detectors.
 *
 * Each returns a plain Node drawn about its own origin, so a screen can position
 * it with `center`, `translation` or a rotation without unpicking its internals.
 * The table is drawn looking straight down, so a mirror is a line, a beam
 * splitter is a line at 45°, and the beams are line segments between them.
 *
 * These are schematic, not to scale. The whole point of an interferometer is
 * that a nanometre of mirror travel changes the output completely, and a
 * nanometre is invisible next to a table drawn a few hundred pixels wide, so
 * mirror motion is exaggerated by a fixed factor where it is shown at all.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Shape } from "scenerystack/kite";
import { Circle, type Color, Line, Node, Path, Rectangle, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import InterferometryLabColors from "../../InterferometryLabColors.js";
import { LABEL_FONT_SIZE } from "../../InterferometryLabConstants.js";

/** Thickness of a mirror's reflective plate, in view pixels. */
const MIRROR_THICKNESS: number = OPTIC_NODES_SETTINGS.MIRROR_THICKNESS;

/** Depth of the mount block drawn behind a mirror, in view pixels. */
const MOUNT_DEPTH: number = OPTIC_NODES_SETTINGS.MOUNT_DEPTH;

/** Thickness of a glass plate (beam splitter, compensator, slide), in view pixels. */
const GLASS_THICKNESS: number = OPTIC_NODES_SETTINGS.GLASS_THICKNESS;

/**
 * A mirror: a reflective plate with a mount behind it. Drawn centred on the
 * origin with the reflective face pointing towards −y, so a caller rotates it
 * into place.
 *
 * @param length - width of the reflective face, view pixels
 * @param options.partial - draw as partially transmitting (an etalon mirror)
 */
export function createMirrorNode(length: number, options?: { partial?: boolean }): Node {
  const mount = new Rectangle(-length / 2, 0, length, MOUNT_DEPTH, {
    fill: InterferometryLabColors.mountColorProperty,
    cornerRadius: 1,
  });

  const face = new Rectangle(-length / 2, -MIRROR_THICKNESS, length, MIRROR_THICKNESS, {
    fill: options?.partial ? InterferometryLabColors.glassColorProperty : InterferometryLabColors.mirrorColorProperty,
    stroke: options?.partial ? InterferometryLabColors.glassStrokeColorProperty : null,
    lineWidth: 1,
  });

  return new Node({ children: [mount, face] });
}

/**
 * A beam splitter: a glass plate drawn at 45° to the incoming beam, centred on
 * the origin. The half-silvered face is marked so the drawing shows *which*
 * surface does the splitting — the side it is on decides which output port
 * picks up the extra half-wave, and that is what makes one Mach-Zehnder port
 * dark while the other is bright.
 *
 * @param length - width of the plate, view pixels
 */
export function createBeamSplitterNode(length: number): Node {
  const plate = new Rectangle(-length / 2, -GLASS_THICKNESS / 2, length, GLASS_THICKNESS, {
    fill: InterferometryLabColors.glassColorProperty,
    stroke: InterferometryLabColors.glassStrokeColorProperty,
    lineWidth: 1,
  });

  const coating = new Line(-length / 2, -GLASS_THICKNESS / 2, length / 2, -GLASS_THICKNESS / 2, {
    stroke: InterferometryLabColors.mirrorColorProperty,
    lineWidth: OPTIC_NODES_SETTINGS.COATING_LINE_WIDTH,
    lineDash: [OPTIC_NODES_SETTINGS.COATING_LINE_DASH_DASH, 2],
  });

  return new Node({ children: [plate, coating], rotation: Math.PI / 4 });
}

/**
 * A plain glass plate — a compensator, or a sample slide. Same drawing as a beam
 * splitter's substrate without the coating.
 *
 * @param length - width of the plate, view pixels
 * @param thickness - drawn thickness, view pixels
 */
export function createGlassPlateNode(length: number, thickness: number = GLASS_THICKNESS): Node {
  return new Rectangle(-length / 2, -thickness / 2, length, thickness, {
    fill: InterferometryLabColors.glassColorProperty,
    stroke: InterferometryLabColors.glassStrokeColorProperty,
    lineWidth: 1,
  });
}

/**
 * The source housing, with an aperture that glows in the colour of the light it
 * is currently emitting. Drawn with the aperture at the origin, emitting towards
 * +x.
 *
 * @param length - length of the housing, view pixels
 * @param height - height of the housing, view pixels
 * @param colorProperty - colour of the emitted light
 */
export function createSourceNode(length: number, height: number, colorProperty: TReadOnlyProperty<Color>): Node {
  const body = new Rectangle(-length, -height / 2, length, height, {
    fill: InterferometryLabColors.sourceBodyColorProperty,
    stroke: InterferometryLabColors.tableBorderColorProperty,
    cornerRadius: OPTIC_NODES_SETTINGS.BODY_CORNER_RADIUS,
    lineWidth: 1,
  });

  const aperture = new Circle(height * 0.28, {
    fill: colorProperty,
    x: -1,
  });

  return new Node({ children: [body, aperture] });
}

/**
 * A gas cell: a windowed tube whose fill brightens with pressure. Centred on the
 * origin, running along x.
 *
 * @param length - length along the beam, view pixels
 * @param height - height across the beam, view pixels
 * @param fillFractionProperty - 0 (evacuated) to 1 (full pressure)
 */
export function createGasCellNode(
  length: number,
  height: number,
  fillFractionProperty: TReadOnlyProperty<number>,
): Node {
  const body = new Rectangle(-length / 2, -height / 2, length, height, {
    fill: InterferometryLabColors.glassColorProperty,
    stroke: InterferometryLabColors.glassStrokeColorProperty,
    lineWidth: OPTIC_NODES_SETTINGS.BODY_LINE_WIDTH,
  });

  const gas = new Rectangle(-length / 2 + 2, -height / 2 + 2, length - 4, height - 4, {
    fill: InterferometryLabColors.gasFillColorProperty,
  });
  fillFractionProperty.link((fraction) => {
    // Even a full cell stays faint: it is a gas, and the beam has to be visible
    // through it.
    gas.opacity = 0.05 + 0.35 * fraction;
  });

  const windows = [-length / 2, length / 2].map(
    (x) =>
      new Line(x, -height / 2, x, height / 2, {
        stroke: InterferometryLabColors.mirrorColorProperty,
        lineWidth: OPTIC_NODES_SETTINGS.WINDOWS_LINE_WIDTH,
      }),
  );

  return new Node({ children: [body, gas, ...windows] });
}

/**
 * The face of a detector as seen edge-on from above: a dark plate on a mount.
 *
 * @param length - width of the face, view pixels
 */
export function createDetectorPlateNode(length: number): Node {
  const mount = new Rectangle(-length / 2, 0, length, MOUNT_DEPTH, {
    fill: InterferometryLabColors.mountColorProperty,
    cornerRadius: 1,
  });

  const face = new Rectangle(-length / 2, OPTIC_NODES_SETTINGS.FACE_Y, length, OPTIC_NODES_SETTINGS.FACE_HEIGHT, {
    fill: InterferometryLabColors.detectorFaceColorProperty,
    stroke: InterferometryLabColors.tableBorderColorProperty,
    lineWidth: 1,
  });

  return new Node({ children: [mount, face] });
}

/**
 * A converging lens, drawn as a lens-shaped outline centred on the origin with
 * its axis along x.
 *
 * @param height - clear aperture, view pixels
 * @param bulge - how far each face bows out, view pixels
 */
export function createLensNode(height: number, bulge: number): Node {
  const shape = new Shape()
    .moveTo(0, -height / 2)
    .quadraticCurveTo(bulge, 0, 0, height / 2)
    .quadraticCurveTo(-bulge, 0, 0, -height / 2)
    .close();

  return new Path(shape, {
    fill: InterferometryLabColors.glassColorProperty,
    stroke: InterferometryLabColors.glassStrokeColorProperty,
    lineWidth: 1,
  });
}

/**
 * A label for a component on the table, in the table's own muted label colour.
 */
export function createTableLabel(text: TReadOnlyProperty<string> | string): Text {
  return new Text(text, {
    font: new PhetFont(LABEL_FONT_SIZE),
    fill: InterferometryLabColors.tableLabelColorProperty,
  });
}
