import { INTENSITY_PROFILE_NODE_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * IntensityProfileNode.ts
 *
 * Intensity along a horizontal cut through the centre of the detector.
 *
 * The detector image is photometric but it is not a measurement: the eye is bad
 * at judging absolute brightness and worse at judging the ratio of two
 * brightnesses. This plot is the same physics read off a slit detector scanned
 * across the pattern, and in it the two numbers that matter become lengths on a
 * page. The depth of the modulation *is* the fringe visibility,
 * `(I_max − I_min)/(I_max + I_min)`; the number of ripples *is* the fringe count.
 *
 * It takes one trace per pattern, so a Michelson passes its single detector and
 * a Mach-Zehnder passes both output ports at once. With two traces the optional
 * dashed total is the point of the whole screen: the ports are in antiphase and
 * their sum is flat, so interference is moving light about rather than
 * destroying it. That claim is invisible in two separate images and obvious here.
 */

import {
  DerivedProperty,
  Multilink,
  StringProperty,
  type TReadOnlyProperty,
  type UnknownMultilink,
} from "scenerystack/axon";
import { ChartRectangle, ChartTransform, GridLineSet, LinePlot } from "scenerystack/bamboo";
import { Bounds2, Range, toFixed, Vector2 } from "scenerystack/dot";
import { Orientation } from "scenerystack/phet-core";
import { StringUtils } from "scenerystack/phetcommon";
import { type Color, HBox, Line, Node, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import InterferometryLabColors from "../../InterferometryLabColors.js";
import { LABEL_FONT_SIZE, PANEL_CORNER_RADIUS } from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { FringeSpec } from "../model/FringeSpec.js";
import { intensityProfile } from "../model/fringeIntensity.js";

/**
 * Points sampled across the detector. Matched to the renderer's monochromatic
 * grid so the trace and the image agree about how much detail there is; sampling
 * finer would draw fringes the detector above it cannot resolve.
 */
const SAMPLE_COUNT: number = INTENSITY_PROFILE_NODE_SETTINGS.SAMPLE_COUNT;

/**
 * Below this modulation the trace is called flat rather than fringed. A pattern
 * this shallow is a single fringe filling the field, which is a real and
 * commonly reached state — see `opdSpread` in the model.
 */
const FLAT_CONTRAST: number = INTENSITY_PROFILE_NODE_SETTINGS.FLAT_CONTRAST;

/**
 * Bounds of the intensity axis.
 *
 * Both ends are padded past the values the physics can reach, because the traces
 * this plot most needs to be readable are the flat ones — a dark port sitting at
 * zero, a constant total sitting at one. Drawn hard against the frame those read
 * as an empty box rather than as a result.
 */
const INTENSITY_MIN: number = INTENSITY_PROFILE_NODE_SETTINGS.INTENSITY_MIN;
const INTENSITY_MAX: number = INTENSITY_PROFILE_NODE_SETTINGS.INTENSITY_MAX;

/** Spacing of the horizontal gridlines, in intensity. */
const INTENSITY_GRID_SPACING: number = INTENSITY_PROFILE_NODE_SETTINGS.INTENSITY_GRID_SPACING;

/**
 * Stands in for a screen-specific description suffix when a screen has none, so
 * the derivation keeps a fixed dependency list.
 */
const NO_SUFFIX = new StringProperty("");

/** Detector coordinate of sample `index`, sampled at bin centres like the renderer. */
function detectorU(index: number): number {
  return (2 * (index + 0.5)) / SAMPLE_COUNT - 1;
}

/** A sampled profile as chart points. */
function toPoints(values: Float64Array): Vector2[] {
  const points: Vector2[] = [];
  values.forEach((value, index) => {
    points.push(new Vector2(detectorU(index), value));
  });
  return points;
}

export type IntensityTrace = {
  /** The pattern this trace follows. */
  readonly specProperty: TReadOnlyProperty<FringeSpec>;

  /** Stroke colour of the trace. */
  readonly colorProperty: TReadOnlyProperty<Color>;

  /** Legend label. Omit on a single-trace plot, where a legend says nothing. */
  readonly label?: TReadOnlyProperty<string>;
};

export type IntensityProfileNodeOptions = {
  readonly width: number;
  readonly height: number;

  /** Draws the dashed sum of every trace. Only meaningful with two or more. */
  readonly showSum?: boolean;

  /** Legend label for the sum. Required when `showSum` is set and traces are labelled. */
  readonly sumLabel?: TReadOnlyProperty<string>;

  /** Appended to the screen-reader description, for anything screen-specific. */
  readonly descriptionSuffix?: TReadOnlyProperty<string>;
};

export class IntensityProfileNode extends VBox {
  private readonly multilink: UnknownMultilink;

  /**
   * The screen-reader description. It links the spec Properties too, so it has to
   * be disposed alongside the multilink or the node stays reachable from a model
   * it no longer belongs to.
   */
  private readonly description: TReadOnlyProperty<string>;

  /**
   * @param traces - at least one pattern to plot; a profile of nothing is meaningless,
   *                 which the tuple type says rather than leaving to a runtime check
   * @param options
   */
  public constructor(traces: readonly [IntensityTrace, ...IntensityTrace[]], options: IntensityProfileNodeOptions) {
    const strings = StringManager.getInstance();
    const common = strings.getCommon();

    const chartTransform = new ChartTransform({
      viewWidth: options.width,
      viewHeight: options.height,
      // u runs edge to edge across the detector, exactly as the renderer uses it.
      modelXRange: new Range(-1, 1),
      modelYRange: new Range(INTENSITY_MIN, INTENSITY_MAX),
    });

    const chartRectangle = new ChartRectangle(chartTransform, {
      fill: InterferometryLabColors.tableColorProperty,
      stroke: InterferometryLabColors.tableBorderColorProperty,
      cornerXRadius: PANEL_CORNER_RADIUS,
      cornerYRadius: PANEL_CORNER_RADIUS,
    });

    // One entry per trace, each carrying its own plot and its own reusable
    // sample buffer, so nothing downstream has to index parallel arrays.
    const series = traces.map((trace) => ({
      specProperty: trace.specProperty,
      plot: new LinePlot(chartTransform, [], {
        stroke: trace.colorProperty,
        lineWidth: INTENSITY_PROFILE_NODE_SETTINGS.SERIES_LINE_WIDTH,
      }),
      buffer: new Float64Array(SAMPLE_COUNT),
    }));

    // Drawn under the traces: it is context for them, not a result of its own.
    const sumPlot = options.showSum
      ? new LinePlot(chartTransform, [], {
          stroke: InterferometryLabColors.plotSumColorProperty,
          lineWidth: INTENSITY_PROFILE_NODE_SETTINGS.SUM_PLOT_LINE_WIDTH,
          lineDash: [
            INTENSITY_PROFILE_NODE_SETTINGS.SUM_PLOT_LINE_DASH_DASH,
            INTENSITY_PROFILE_NODE_SETTINGS.CONSTRUCTOR_SUM_PLOT_LINE_DASH_DASH,
          ],
        })
      : null;

    const plots = series.map((entry) => entry.plot);

    // Gridlines at zero, half and full scale. Without them the reader has no way
    // to tell a trace pinned at zero from a trace that is simply near the bottom.
    const gridLines = new GridLineSet(chartTransform, Orientation.VERTICAL, INTENSITY_GRID_SPACING, {
      stroke: InterferometryLabColors.plotAxisColorProperty,
      lineWidth: INTENSITY_PROFILE_NODE_SETTINGS.GRID_LINES_LINE_WIDTH,
    });

    const clipped = new Node({
      children: sumPlot ? [gridLines, sumPlot, ...plots] : [gridLines, ...plots],
      clipArea: chartRectangle.getShape(),
    });

    const update = (): void => {
      for (const entry of series) {
        intensityProfile(entry.specProperty.value, SAMPLE_COUNT, entry.buffer);
        entry.plot.setDataSet(toPoints(entry.buffer));
      }

      if (sumPlot) {
        const totals: number[] = [];
        for (const entry of series) {
          entry.buffer.forEach((value, index) => {
            totals[index] = (totals[index] ?? 0) + value;
          });
        }
        sumPlot.setDataSet(totals.map((total, index) => new Vector2(detectorU(index), total)));
      }
    };

    const specProperties = traces.map((trace) => trace.specProperty);
    // Multilink rather than one link per trace, so a change to either port
    // redraws both curves and the sum in a single pass.
    const multilink = Multilink.multilinkAny(specProperties, update);

    const chart = new Node({
      children: [chartRectangle, clipped],
      localBounds: new Bounds2(0, 0, options.width, options.height),
    });

    const title = new Text(common.intensityProfileStringProperty, {
      font: new PhetFont({ size: LABEL_FONT_SIZE, weight: "bold" }),
      fill: InterferometryLabColors.textColorProperty,
      maxWidth: options.width,
    });

    const axisLabel = new Text(common.detectorPositionStringProperty, {
      font: new PhetFont(LABEL_FONT_SIZE - 1),
      fill: InterferometryLabColors.plotAxisColorProperty,
      maxWidth: options.width,
    });

    // The axis label and the legend share a row when both are present. They are
    // both one line of small print about the same chart, and the vertical space
    // a second row costs is space the control panels below need.
    const legend = createLegend(traces, options);
    const footer = legend
      ? new HBox({ spacing: INTENSITY_PROFILE_NODE_SETTINGS.FOOTER_SPACING, children: [axisLabel, legend] })
      : axisLabel;

    const children: Node[] = [title, chart, footer];

    const description = describeProfile(traces[0].specProperty, options.descriptionSuffix);

    super({
      spacing: INTENSITY_PROFILE_NODE_SETTINGS.CONSTRUCTOR_SPACING,
      align: "center",
      children,
      accessibleParagraph: description,
    });

    this.multilink = multilink;
    this.description = description;
  }

  public override dispose(): void {
    super.dispose();
    this.multilink.dispose();
    this.description.dispose();
  }
}

/**
 * A row of coloured swatches naming each trace. Returns null when the traces are
 * unlabelled — a legend for one curve is noise.
 */
function createLegend(traces: readonly IntensityTrace[], options: IntensityProfileNodeOptions): Node | null {
  const entries: { readonly label: TReadOnlyProperty<string>; readonly color: TReadOnlyProperty<Color> }[] = [];

  for (const trace of traces) {
    if (trace.label) {
      entries.push({ label: trace.label, color: trace.colorProperty });
    }
  }
  if (options.showSum && options.sumLabel) {
    entries.push({ label: options.sumLabel, color: InterferometryLabColors.plotSumColorProperty });
  }
  if (entries.length === 0) {
    return null;
  }

  return new HBox({
    spacing: INTENSITY_PROFILE_NODE_SETTINGS.CREATE_LEGEND_SPACING,
    children: entries.map(
      (entry) =>
        new HBox({
          spacing: INTENSITY_PROFILE_NODE_SETTINGS.CREATE_LEGEND_SPACING_VARIANT_2,
          children: [
            new Line(0, 0, INTENSITY_PROFILE_NODE_SETTINGS.CREATE_LEGEND_END_X, 0, {
              stroke: entry.color,
              lineWidth: INTENSITY_PROFILE_NODE_SETTINGS.CREATE_LEGEND_LINE_WIDTH,
            }),
            new Text(entry.label, {
              font: new PhetFont(LABEL_FONT_SIZE - 1),
              fill: InterferometryLabColors.textColorProperty,
            }),
          ],
        }),
    ),
  });
}

/**
 * What the trace looks like, in words: how many bright fringes cross the field
 * and how deep the modulation is. Derived from the same samples the plot draws,
 * so the two never disagree.
 */
function describeProfile(
  specProperty: TReadOnlyProperty<FringeSpec>,
  suffix?: TReadOnlyProperty<string>,
): TReadOnlyProperty<string> {
  const a11y = StringManager.getInstance().getCommonA11yStrings();
  const units = StringManager.getInstance().getUnits();

  return new DerivedProperty(
    [
      specProperty,
      a11y.intensityProfileFringesStringProperty,
      a11y.intensityProfileFlatStringProperty,
      units.percentStringProperty,
      suffix ?? NO_SUFFIX,
    ],
    (spec, fringesPattern, flatText, percentPattern, suffixText) => {
      const values = intensityProfile(spec, SAMPLE_COUNT);

      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const value of values) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      const contrast = max + min > 0 ? (max - min) / (max + min) : 0;

      if (contrast < FLAT_CONTRAST) {
        return flatText;
      }

      // Count the peaks the trace actually draws, by walking it and marking each
      // crossing back down through the midpoint. A midpoint threshold keeps
      // sampling ripple in a nearly flat trace from being counted as fringes,
      // and counting crossings rather than local maxima is immune to a plateau
      // at the top of a broad fringe being counted twice.
      const threshold = (max + min) / 2;
      let peaks = 0;
      let above = false;
      for (const value of values) {
        if (value > threshold) {
          above = true;
        } else if (above) {
          above = false;
          peaks++;
        }
      }
      // A fringe still above the midpoint when the trace runs off the edge.
      if (above) {
        peaks++;
      }

      const sentence = StringUtils.fillIn(fringesPattern, {
        count: peaks.toString(),
        contrast: StringUtils.fillIn(percentPattern, { value: toFixed(100 * contrast, 0) }),
      });
      return sentence + suffixText;
    },
  );
}
