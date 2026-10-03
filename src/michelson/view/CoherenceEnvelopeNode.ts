/**
 * CoherenceEnvelopeNode.ts
 *
 * Fringe visibility against optical path difference — the interferogram's
 * envelope, with a marker showing where on it the instrument currently sits.
 *
 * Coherence is the hardest thing on this screen to discover by dragging. The
 * detector shows the visibility at *one* path difference, so a student hunting
 * for the edge of the fringes is sampling a curve they cannot see, one point at
 * a time, across a stage whose full travel is four hundred micrometres. The
 * shape of that curve is the whole of §2 of the model documentation, and every
 * source has a different one:
 *
 *  - a laser is flat at 1 — its coherence length is metres, so nothing the stage
 *    can do will fade the fringes, which is exactly why lasers are used;
 *  - a filtered lamp decays as a Gaussian whose width *is* its coherence length;
 *  - white light is a needle a micrometre wide, which is why the white-light
 *    fringe is so hard to find;
 *  - and sodium does not decay at all — it beats, dying and reviving with a
 *    period set by the D-line spacing. Measuring that period is the classic
 *    undergraduate determination of the doublet separation, and it is invisible
 *    without this plot.
 *
 * The horizontal span therefore cannot be fixed: metres and micrometres both
 * have to be legible. It is chosen from the source's own feature scale, the same
 * way `TransmissionSpectrumNode` rescales itself around the line separation.
 */

import { DerivedProperty, Multilink, type TReadOnlyProperty, type UnknownMultilink } from "scenerystack/axon";
import { ChartRectangle, ChartTransform, GridLineSet, LinePlot } from "scenerystack/bamboo";
import { Bounds2, Range, Vector2 } from "scenerystack/dot";
import { Orientation } from "scenerystack/phet-core";
import { StringUtils } from "scenerystack/phetcommon";
import { Line, Node, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { spectrumVisibility } from "../../common/model/spectrum.js";
import { lengthProperty, percentProperty } from "../../common/view/formatters.js";
import InterferometryLabColors from "../../InterferometryLabColors.js";
import { LABEL_FONT_SIZE, MICHELSON_COARSE_RANGE_NM, PANEL_CORNER_RADIUS } from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { MichelsonModel } from "../model/MichelsonModel.js";

/** Points sampled across the plot. */
const SAMPLE_COUNT = 500;

/**
 * Widest path difference the plot ever shows, nm. The mirror is traversed twice,
 * so the stage's travel is worth double in path difference; there is no point
 * plotting past what the instrument can actually reach.
 */
const MAX_HALF_SPAN_NM = 2 * MICHELSON_COARSE_RANGE_NM.max;

/**
 * Narrowest span, nm. White light's coherence length is about a micrometre and
 * the curve would otherwise collapse onto the axis; a couple of wavelengths of
 * margin keeps the needle a shape rather than a spike.
 */
const MIN_HALF_SPAN_NM = 2000;

/**
 * How much of the source's feature scale to show either side of zero. Enough to
 * get past the first null of a doublet, or well down the tail of a Gaussian.
 */
const SPAN_IN_FEATURES = 1.4;

/**
 * Bounds of the visibility axis, padded at both ends. A laser's curve is flat at
 * 1 and a doublet's touches 0; against the frame either would read as an empty
 * box rather than as the answer.
 */
const VISIBILITY_MIN = -0.06;
const VISIBILITY_MAX = 1.08;

/** Spacing of the horizontal gridlines, in visibility. */
const VISIBILITY_GRID_SPACING = 0.5;

export type CoherenceEnvelopeNodeOptions = {
  readonly width: number;
  readonly height: number;
};

export class CoherenceEnvelopeNode extends VBox {
  private readonly multilink: UnknownMultilink;

  /**
   * The screen-reader description and the formatter Properties feeding it. All
   * of them link model Properties, so all of them have to be let go on dispose.
   */
  private readonly description: ReturnType<typeof describeEnvelope>;

  public constructor(model: MichelsonModel, options: CoherenceEnvelopeNodeOptions) {
    const strings = StringManager.getInstance();
    const common = strings.getCommon();
    const michelson = strings.getMichelsonStrings();

    const chartTransform = new ChartTransform({
      viewWidth: options.width,
      viewHeight: options.height,
      modelXRange: new Range(-1, 1),
      modelYRange: new Range(VISIBILITY_MIN, VISIBILITY_MAX),
    });

    const chartRectangle = new ChartRectangle(chartTransform, {
      fill: InterferometryLabColors.tableColorProperty,
      stroke: InterferometryLabColors.tableBorderColorProperty,
      cornerXRadius: PANEL_CORNER_RADIUS,
      cornerYRadius: PANEL_CORNER_RADIUS,
    });

    const curve = new LinePlot(chartTransform, [], {
      stroke: InterferometryLabColors.plotTraceColorProperty,
      lineWidth: 1.6,
    });

    // Where the instrument is standing on the curve. Drawn full height so it can
    // be read against the trace without hunting for an intersection.
    const marker = new Line(0, 0, 0, options.height, {
      stroke: InterferometryLabColors.valueColorProperty,
      lineWidth: 1.4,
      lineDash: [4, 3],
    });

    // Gridlines at zero, half and full visibility, so "the fringes are gone" and
    // "the fringes are faint" are distinguishable at a glance.
    const gridLines = new GridLineSet(chartTransform, Orientation.VERTICAL, VISIBILITY_GRID_SPACING, {
      stroke: InterferometryLabColors.plotAxisColorProperty,
      lineWidth: 0.5,
    });

    const clipped = new Node({
      children: [gridLines, curve, marker],
      clipArea: chartRectangle.getShape(),
    });

    const update = (): void => {
      const spectrum = model.lightSource.spectrumProperty.value;
      const groups = model.fringeSpecProperty.value.groups;
      const halfSpanNm = halfSpan(model.lightSource.coherenceLengthProperty.value, spectrum);

      const points: Vector2[] = [];
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const fraction = i / (SAMPLE_COUNT - 1);
        const x = -1 + 2 * fraction;
        points.push(new Vector2(x, spectrumVisibility(groups, x * halfSpanNm)));
      }
      curve.setDataSet(points);

      // Off-scale means the fringes died long ago; saying so by hiding the
      // marker is better than pinning it to an edge it is not at.
      const pathDifferenceNm = model.pathDifferenceProperty.value;
      const markerX = pathDifferenceNm / halfSpanNm;
      marker.visible = Math.abs(markerX) <= 1;
      if (marker.visible) {
        const viewX = chartTransform.modelToViewX(markerX);
        marker.setLine(viewX, 0, viewX, options.height);
      }
    };

    const multilink = Multilink.multilinkAny([model.fringeSpecProperty, model.pathDifferenceProperty], update);

    const chart = new Node({
      children: [chartRectangle, clipped],
      localBounds: new Bounds2(0, 0, options.width, options.height),
    });

    const title = new Text(michelson.visibilityCurveStringProperty, {
      font: new PhetFont({ size: LABEL_FONT_SIZE, weight: "bold" }),
      fill: InterferometryLabColors.textColorProperty,
      maxWidth: options.width,
    });

    const axisLabel = new Text(common.pathDifferenceStringProperty, {
      font: new PhetFont(LABEL_FONT_SIZE - 1),
      fill: InterferometryLabColors.plotAxisColorProperty,
      maxWidth: options.width,
    });

    const description = describeEnvelope(model);

    super({
      spacing: 5,
      align: "center",
      children: [title, chart, axisLabel],
      accessibleParagraph: description.paragraph,
    });

    this.multilink = multilink;
    this.description = description;
  }

  public override dispose(): void {
    super.dispose();
    this.multilink.dispose();
    this.description.paragraph.dispose();
    for (const part of this.description.parts) {
      part.dispose();
    }
  }
}

/**
 * Half-width of the plotted path-difference range, nm.
 *
 * The scale worth showing is whichever feature arrives first: the decay of the
 * coherence envelope, or — for a doublet, which does not decay on this scale at
 * all — the beat period `λ₀²/δλ`. Either can be infinite (a perfectly
 * monochromatic line has no decay; a single line has no beat), in which case the
 * plot falls back to the full travel of the stage, where a laser correctly reads
 * as flat at full contrast.
 */
function halfSpan(coherenceLengthNm: number, spectrum: { centerNm: number; doubletSeparationNm: number }): number {
  const beatPeriodNm =
    spectrum.doubletSeparationNm > 0
      ? (spectrum.centerNm * spectrum.centerNm) / spectrum.doubletSeparationNm
      : Number.POSITIVE_INFINITY;

  const featureNm = Math.min(coherenceLengthNm, beatPeriodNm);
  if (!Number.isFinite(featureNm)) {
    return MAX_HALF_SPAN_NM;
  }
  return Math.min(MAX_HALF_SPAN_NM, Math.max(MIN_HALF_SPAN_NM, SPAN_IN_FEATURES * featureNm));
}

/**
 * The curve in words, for a reader who cannot see it.
 *
 * Returns the intermediate formatter Properties along with the description.
 * Each of them links a model Property of its own, so disposing only the
 * description would leave three live listeners holding this node in memory.
 */
function describeEnvelope(model: MichelsonModel): {
  readonly paragraph: TReadOnlyProperty<string>;
  readonly parts: readonly TReadOnlyProperty<string>[];
} {
  const a11y = StringManager.getInstance().getMichelsonA11yStrings();

  const parts = [
    percentProperty(model.visibilityProperty, 0),
    lengthProperty(model.pathDifferenceProperty, 1),
    lengthProperty(model.lightSource.coherenceLengthProperty, 1),
  ] as const;

  const paragraph = new DerivedProperty(
    [a11y.visibilityCurveStringProperty, ...parts],
    (pattern, visibility, pathDifference, coherenceLength) =>
      StringUtils.fillIn(pattern, { visibility, pathDifference, coherenceLength }),
  );

  return { paragraph, parts };
}
