import { FABRY_PEROT_SCREEN_VIEW_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * FabryPerotScreenView.ts
 *
 * The cavity on the left, the rings it produces in the middle, and the
 * transmission spectrum on the right.
 *
 * The two right-hand panes are the same physics seen along two different axes —
 * rings vary with angle at fixed wavelength, the plot varies with wavelength at
 * fixed angle — and putting them side by side is what lets a sharp peak in one
 * be recognised as a sharp ring in the other.
 */

import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { HBox, Node } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/InterferometryLabButtonOptions.js";
import { DetectorScreenNode } from "../../common/view/DetectorScreenNode.js";
import { lengthProperty, percentProperty, plainProperty, unitProperty } from "../../common/view/formatters.js";
import { ReadoutBlock } from "../../common/view/ReadoutBlock.js";
import { TitledPanel } from "../../common/view/TitledPanel.js";
import { CONTROL_PANEL_WIDTH, PANEL_SPACING, SCREEN_VIEW_MARGIN } from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { InterferometryLabPreferencesModel } from "../../preferences/InterferometryLabPreferencesModel.js";
import type { FabryPerotModel } from "../model/FabryPerotModel.js";
import { FabryPerotCavityPanel } from "./FabryPerotCavityPanel.js";
import { FabryPerotScreenSummaryContent } from "./FabryPerotScreenSummaryContent.js";
import { FabryPerotSourcePanel } from "./FabryPerotSourcePanel.js";
import { FabryPerotTableNode } from "./FabryPerotTableNode.js";
import { TransmissionSpectrumNode } from "./TransmissionSpectrumNode.js";

export type FabryPerotScreenViewOptions = ScreenViewOptions;

/** Width of each panel's content in the bottom row, view pixels. */
const PANEL_CONTENT_WIDTH = CONTROL_PANEL_WIDTH - 24;

/** Side length of the ring pattern, view pixels. */
const RING_SIZE: number = FABRY_PEROT_SCREEN_VIEW_SETTINGS.RING_SIZE;

/** Size of the transmission plot, view pixels. */
const PLOT_WIDTH: number = FABRY_PEROT_SCREEN_VIEW_SETTINGS.PLOT_WIDTH;
const PLOT_HEIGHT: number = FABRY_PEROT_SCREEN_VIEW_SETTINGS.PLOT_HEIGHT;

export class FabryPerotScreenView extends ScreenView {
  public constructor(
    model: FabryPerotModel,
    preferences: InterferometryLabPreferencesModel,
    providedOptions?: FabryPerotScreenViewOptions,
  ) {
    const options = optionize<FabryPerotScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      { screenSummaryContent: new FabryPerotScreenSummaryContent(model) },
      providedOptions,
    );
    super(options);

    const strings = StringManager.getInstance();
    const common = strings.getCommon();
    const fabryPerot = strings.getFabryPerotStrings();
    const units = strings.getUnits();

    const tableNode = new FabryPerotTableNode(model, preferences);

    const detectorNode = new DetectorScreenNode(model.fringeSpecProperty, {
      size: RING_SIZE,
      title: common.detectorStringProperty,
    });

    const spectrumNode = new TransmissionSpectrumNode(model, { width: PLOT_WIDTH, height: PLOT_HEIGHT });

    const topRow = new HBox({
      spacing: PANEL_SPACING + FABRY_PEROT_SCREEN_VIEW_SETTINGS.TOP_ROW_SPACING_OFFSET,
      align: "top",
      children: [tableNode, detectorNode, spectrumNode],
    });
    topRow.left = this.layoutBounds.minX + SCREEN_VIEW_MARGIN;
    topRow.top = this.layoutBounds.minY + SCREEN_VIEW_MARGIN;

    const sourcePanel = new FabryPerotSourcePanel(model, PANEL_CONTENT_WIDTH);
    const cavityPanel = new FabryPerotCavityPanel(model, PANEL_CONTENT_WIDTH);

    // The derived numbers, in the order they build on one another: finesse from
    // the mirrors alone, free spectral range from the spacing alone, then the
    // order and the resolving power that combine them.
    const readouts = new ReadoutBlock([
      { label: fabryPerot.finesseStringProperty, value: plainProperty(model.finesseProperty, 1) },
      {
        label: fabryPerot.freeSpectralRangeStringProperty,
        value: lengthProperty(
          model.freeSpectralRangeProperty,
          FABRY_PEROT_SCREEN_VIEW_SETTINGS.FREE_SPECTRAL_RANGE_LENGTH_PROPERTY_DECIMALS,
        ),
      },
      { label: fabryPerot.orderStringProperty, value: plainProperty(model.orderProperty, 0) },
      { label: fabryPerot.resolvingPowerStringProperty, value: plainProperty(model.resolvingPowerProperty, 0) },
      {
        label: fabryPerot.lineSeparationStringProperty,
        value: unitProperty(model.resolutionLimitProperty, units.picometersStringProperty, 1),
      },
      {
        label: fabryPerot.peakTransmissionStringProperty,
        value: percentProperty(model.peakTransmissionProperty, 0),
      },
    ]);

    const readoutPanel = new TitledPanel(common.readingsStringProperty, [readouts], {
      contentWidth: PANEL_CONTENT_WIDTH + 60,
    });

    const controlRow = new HBox({
      spacing: PANEL_SPACING,
      align: "top",
      children: [sourcePanel, cavityPanel, readoutPanel],
    });
    controlRow.left = this.layoutBounds.minX + SCREEN_VIEW_MARGIN;
    controlRow.top = topRow.bottom + PANEL_SPACING;

    const resetAllButton = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      listener: () => {
        model.reset();
        this.reset();
      },
      right: this.layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      bottom: this.layoutBounds.maxY - SCREEN_VIEW_MARGIN,
    });

    this.children = [topRow, controlRow, resetAllButton];

    this.addChild(
      new Node({
        pdomOrder: [sourcePanel, cavityPanel, resetAllButton],
      }),
    );
  }

  public reset(): void {
    // All state lives in the model.
  }

  public override step(_dt: number): void {
    // The scan is advanced by the model; the view repaints on change.
  }
}
