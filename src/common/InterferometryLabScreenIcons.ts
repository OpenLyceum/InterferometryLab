/**
 * InterferometryLabScreenIcons.ts
 *
 * Programmatic home-screen / navigation-bar icons for each screen.
 * Drawn on the standard PhET 548 × 373 canvas using InterferometryLabColors.
 *
 * Each icon is a miniature of what that screen's detector actually shows, which
 * is the only thing about the three screens a learner can tell apart at a
 * glance. They have to survive being shrunk to navigation-bar size, so the three
 * differ in shape as well as colour: broad rings, a pair of complementary
 * patches, and narrow rings.
 */
import { Circle, Node, Rectangle } from "scenerystack/scenery";
import { ScreenIcon } from "scenerystack/sim";
import InterferometryLabColors from "../InterferometryLabColors.js";
import { INTERFEROMETRY_LAB_SCREEN_ICONS_SETTINGS } from "../InterferometryLabConstants.js";

const W = 548;
const H = 373;

/** Side of the detector square each icon is built around, view units. */
const FACE_SIZE: number = INTERFEROMETRY_LAB_SCREEN_ICONS_SETTINGS.FACE_SIZE;

function background(): Rectangle {
  return new Rectangle(0, 0, W, H, { fill: InterferometryLabColors.backgroundColorProperty });
}

/** A detector face: the dark square a pattern is drawn on. */
function face(size: number, centerX: number): Rectangle {
  return new Rectangle(centerX - size / 2, (H - size) / 2, size, size, {
    fill: InterferometryLabColors.detectorFaceColorProperty,
    stroke: InterferometryLabColors.tableBorderColorProperty,
    lineWidth: INTERFEROMETRY_LAB_SCREEN_ICONS_SETTINGS.FACE_LINE_WIDTH,
  });
}

/**
 * Concentric fringes of equal inclination, clipped to a detector face.
 *
 * Radii go as √n because that is where the rings actually fall: the path
 * difference varies as cos θ, so successive orders crowd together outwards. It
 * costs nothing to draw them correctly and it is the shape the screen produces.
 */
function rings(count: number, lineWidth: number, color: Rectangle["fill"], centerX: number): Node {
  const children: Node[] = [];
  const maxRadius = FACE_SIZE * 0.72;

  for (let n = 1; n <= count; n++) {
    children.push(
      new Circle(maxRadius * Math.sqrt(n / count), {
        centerX,
        centerY: H / 2,
        stroke: color,
        lineWidth,
      }),
    );
  }

  return new Node({
    children,
    clipArea: new Rectangle(centerX - FACE_SIZE / 2, (H - FACE_SIZE) / 2, FACE_SIZE, FACE_SIZE).getShape(),
  });
}

function iconFrom(content: Node): ScreenIcon {
  return new ScreenIcon(content, {
    maxIconWidthProportion: 1,
    maxIconHeightProportion: 1,
    fill: InterferometryLabColors.backgroundColorProperty,
  });
}

/** Broad circular fringes — what a Michelson with parallel mirrors puts on its screen. */
export function createMichelsonIcon(): ScreenIcon {
  return iconFrom(
    new Node({
      children: [
        background(),
        face(FACE_SIZE, W / 2),
        rings(
          7,
          INTERFEROMETRY_LAB_SCREEN_ICONS_SETTINGS.CREATE_MICHELSON_ICON_LINE_WIDTH,
          InterferometryLabColors.accentColorProperty,
          W / 2,
        ),
      ],
    }),
  );
}

/**
 * Two detectors carrying complementary straight fringes: bright where the other
 * is dark. The pair is the Mach-Zehnder screen's whole subject.
 */
export function createMachZehnderIcon(): ScreenIcon {
  const portSize: number = INTERFEROMETRY_LAB_SCREEN_ICONS_SETTINGS.PORT_SIZE;
  const gap = 44;
  const leftX = W / 2 - (portSize + gap) / 2;
  const rightX = W / 2 + (portSize + gap) / 2;
  const barCount: number = INTERFEROMETRY_LAB_SCREEN_ICONS_SETTINGS.BAR_COUNT;
  const barWidth = portSize / (2 * barCount);

  const bars = (centerX: number, offset: number): Node => {
    const children: Node[] = [];
    for (let i = 0; i < barCount; i++) {
      children.push(
        new Rectangle(centerX - portSize / 2 + (2 * i + offset) * barWidth, (H - portSize) / 2, barWidth, portSize, {
          fill: InterferometryLabColors.accentColorProperty,
        }),
      );
    }
    return new Node({ children });
  };

  return iconFrom(
    new Node({
      children: [
        background(),
        face(portSize, leftX),
        bars(leftX, 0),
        face(portSize, rightX),
        // Offset by one bar: where port A is bright, port B is dark.
        bars(rightX, 1),
      ],
    }),
  );
}

/**
 * Narrow, sharp rings. The same geometry as the Michelson's, drawn thin and
 * numerous, because that is exactly what raising the mirror reflectance does to
 * the Airy pattern — and the difference between the two icons is the difference
 * between two-beam and multi-beam interference.
 */
export function createFabryPerotIcon(): ScreenIcon {
  return iconFrom(
    new Node({
      children: [
        background(),
        face(FACE_SIZE, W / 2),
        rings(
          9,
          INTERFEROMETRY_LAB_SCREEN_ICONS_SETTINGS.CREATE_FABRY_PEROT_ICON_LINE_WIDTH,
          InterferometryLabColors.valueColorProperty,
          W / 2,
        ),
      ],
    }),
  );
}
