/**
 * TransmissionSpectrumNode.ts
 *
 * Transmission of the cavity against wavelength, with the source's lines drawn
 * on top of it.
 *
 * The ring pattern shows what the etalon does at one wavelength across many
 * angles; this plot shows what it does at one angle across many wavelengths, and
 * that is the view in which "resolving power" means anything. Two lines are
 * resolved when the cavity's peaks are narrow enough to sit on one and not the
 * other — something you can see happen here as the reflectance rises, and cannot
 * see at all in the rings.
 */

import { DerivedProperty, Multilink, type TReadOnlyProperty, type UnknownMultilink } from "scenerystack/axon";
import { ChartRectangle, ChartTransform, LinePlot } from "scenerystack/bamboo";
import { Bounds2, Range, Vector2 } from "scenerystack/dot";
import { Line, Node, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import InterferometryLabColors from "../../InterferometryLabColors.js";
import { LABEL_FONT_SIZE, PANEL_CORNER_RADIUS, PM_PER_NM } from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { FabryPerotModel } from "../model/FabryPerotModel.js";

/** Number of points the transmission curve is sampled at. */
const SAMPLE_COUNT = 700;

/** How many free spectral ranges the plot spans with a single source line. */
const SPAN_IN_FSR = 2.2;

/**
 * With two lines the plot zooms in to this multiple of their separation, so the
 * question the screen is asking — are these two peaks distinguishable? — is
 * actually visible. Across a whole free spectral range a picometre-scale pair is
 * a single hairline.
 */
const TWIN_LINE_SPAN_FACTOR = 8;

export type TransmissionSpectrumNodeOptions = {
  readonly width: number;
  readonly height: number;
};

export class TransmissionSpectrumNode extends VBox {
  private readonly multilink: UnknownMultilink;
  private readonly resolutionProperty: TReadOnlyProperty<string>;

  public constructor(model: FabryPerotModel, options: TransmissionSpectrumNodeOptions) {
    const strings = StringManager.getInstance();
    const fabryPerot = strings.getFabryPerotStrings();

    const chartTransform = new ChartTransform({
      viewWidth: options.width,
      viewHeight: options.height,
      modelXRange: new Range(-1, 1),
      modelYRange: new Range(0, 1.05),
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

    // Vertical markers for the source's lines, drawn full height so it is
    // obvious which peaks they do and do not land on.
    const lineMarkers = new Node();

    const clipped = new Node({
      children: [curve, lineMarkers],
      clipArea: chartRectangle.getShape(),
    });

    /**
     * Redraws the curve and the markers.
     *
     * The horizontal axis is measured in free spectral ranges away from the
     * source's central wavelength rather than in nanometres. The interesting
     * comparison is always "how wide is a peak next to the gap between peaks",
     * and that is a ratio; plotting it in absolute nanometres would make the
     * whole picture rescale every time the spacing changed.
     */
    const update = (): void => {
      const centerNm = model.wavelengthProperty.value;
      const fsrNm = model.freeSpectralRangeProperty.value;
      const fullSpanNm = (SPAN_IN_FSR * fsrNm) / 2;

      // Zoomed in on the pair when there is one, but never wider than the free
      // spectral range — beyond that the neighbouring order wraps into view and
      // the picture stops meaning anything.
      const separationNm = model.lineSeparationProperty.value / PM_PER_NM;
      const limitNm = model.resolutionLimitProperty.value / PM_PER_NM;
      const halfSpanNm = model.twinLineProperty.value
        ? Math.min(fullSpanNm, (TWIN_LINE_SPAN_FACTOR * Math.max(separationNm, limitNm)) / 2)
        : fullSpanNm;

      const points: Vector2[] = [];
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const fraction = i / (SAMPLE_COUNT - 1);
        const wavelengthNm = centerNm - halfSpanNm + 2 * halfSpanNm * fraction;
        const x = (wavelengthNm - centerNm) / halfSpanNm;
        points.push(new Vector2(x, model.transmissionAt(wavelengthNm)));
      }
      curve.setDataSet(points);

      lineMarkers.children = model.linesProperty.value.map((group) => {
        const x = (group.wavelengthNm - centerNm) / halfSpanNm;
        const viewX = chartTransform.modelToViewX(x);
        return new Line(viewX, 0, viewX, options.height, {
          stroke: InterferometryLabColors.valueColorProperty,
          lineWidth: 1.2,
          lineDash: [4, 3],
        });
      });
    };

    const multilink = Multilink.multilinkAny(
      [model.fringeSpecProperty, model.freeSpectralRangeProperty, model.resolutionLimitProperty],
      update,
    );

    const chart = new Node({
      children: [chartRectangle, clipped],
      localBounds: new Bounds2(0, 0, options.width, options.height),
    });

    const title = new Text(fabryPerot.spectrumStringProperty, {
      font: new PhetFont({ size: LABEL_FONT_SIZE, weight: "bold" }),
      fill: InterferometryLabColors.textColorProperty,
    });

    const axisLabel = new Text(StringManager.getInstance().getCommon().wavelengthStringProperty, {
      font: new PhetFont(LABEL_FONT_SIZE - 1),
      fill: InterferometryLabColors.plotAxisColorProperty,
    });

    const resolutionProperty = resolutionTextProperty(model);
    const resolutionLabel = new Text(resolutionProperty, {
      font: new PhetFont(LABEL_FONT_SIZE),
      fill: InterferometryLabColors.textColorProperty,
      maxWidth: options.width,
      visibleProperty: model.twinLineProperty,
    });

    super({ spacing: 5, align: "center", children: [title, chart, axisLabel, resolutionLabel] });
    this.multilink = multilink;
    this.resolutionProperty = resolutionProperty;
  }

  public override dispose(): void {
    this.multilink.dispose();
    this.resolutionProperty.dispose();
    super.dispose();
  }
}

/** "The two lines are (not) resolved", following the model's own criterion. */
function resolutionTextProperty(model: FabryPerotModel): TReadOnlyProperty<string> {
  const fabryPerot = StringManager.getInstance().getFabryPerotStrings();
  return new DerivedProperty(
    [model.resolvedProperty, fabryPerot.resolvedStringProperty, fabryPerot.unresolvedStringProperty],
    (resolved, resolvedText, unresolvedText) => (resolved ? resolvedText : unresolvedText),
  );
}
