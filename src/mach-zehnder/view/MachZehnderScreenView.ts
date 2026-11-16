import { MACH_ZEHNDER_SCREEN_VIEW_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * MachZehnderScreenView.ts
 *
 * The table on the left, both output ports side by side on the right, controls
 * along the bottom.
 *
 * Showing the two detectors together, always, is the layout's one real
 * commitment. Every claim this screen makes — that interference redistributes
 * light rather than destroying it, that single photons build the same pattern,
 * that knowing the path erases it — is a claim about the *pair* of ports, and it
 * is unreadable from either one alone.
 */

import { DerivedProperty } from "scenerystack/axon";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { HBox, Node, VBox } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/InterferometryLabButtonOptions.js";
import { createTimeControl } from "../../common/view/controlFactory.js";
import { DetectorScreenNode } from "../../common/view/DetectorScreenNode.js";
import { lengthProperty, percentProperty, wavesProperty } from "../../common/view/formatters.js";
import { IntensityProfileNode } from "../../common/view/IntensityProfileNode.js";
import { LightSourcePanel } from "../../common/view/LightSourcePanel.js";
import { ReadoutBlock } from "../../common/view/ReadoutBlock.js";
import InterferometryLabColors from "../../InterferometryLabColors.js";
import { CONTROL_PANEL_WIDTH, PANEL_SPACING, SCREEN_VIEW_MARGIN } from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { InterferometryLabPreferencesModel } from "../../preferences/InterferometryLabPreferencesModel.js";
import { BeamMode } from "../model/BeamMode.js";
import type { MachZehnderModel } from "../model/MachZehnderModel.js";
import { MachZehnderArmsPanel } from "./MachZehnderArmsPanel.js";
import { MachZehnderModePanel } from "./MachZehnderModePanel.js";
import { MachZehnderSamplePanel } from "./MachZehnderSamplePanel.js";
import { MachZehnderScreenSummaryContent } from "./MachZehnderScreenSummaryContent.js";
import { MachZehnderTableNode } from "./MachZehnderTableNode.js";
import { PhotonMarksNode } from "./PhotonMarksNode.js";

export type MachZehnderScreenViewOptions = ScreenViewOptions;

/** Width of each panel's content in the bottom row, view pixels. */
const PANEL_CONTENT_WIDTH = CONTROL_PANEL_WIDTH - 24;

/** Side length of each of the two port detectors, view pixels. Smaller than the
 *  single detector on the other screens, because there are two of them and they
 *  share the column with the trace drawn underneath. */
const PORT_DETECTOR_SIZE: number = MACH_ZEHNDER_SCREEN_VIEW_SETTINGS.PORT_DETECTOR_SIZE;

/** The intensity trace under the two ports, view pixels. Spans both of them. */
const PROFILE_WIDTH = 2 * PORT_DETECTOR_SIZE + PANEL_SPACING;
const PROFILE_HEIGHT: number = MACH_ZEHNDER_SCREEN_VIEW_SETTINGS.PROFILE_HEIGHT;

export class MachZehnderScreenView extends ScreenView {
  public constructor(
    model: MachZehnderModel,
    preferences: InterferometryLabPreferencesModel,
    providedOptions?: MachZehnderScreenViewOptions,
  ) {
    const options = optionize<MachZehnderScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      { screenSummaryContent: new MachZehnderScreenSummaryContent(model) },
      providedOptions,
    );
    super(options);

    const strings = StringManager.getInstance();
    const common = strings.getCommon();
    const machZehnder = strings.getMachZehnderStrings();
    const a11y = strings.getMachZehnderA11yStrings().controls;

    const popupLayer = new Node();

    const isContinuousProperty = new DerivedProperty([model.beamModeProperty], (mode) => mode === BeamMode.CONTINUOUS);
    const isSinglePhotonProperty = new DerivedProperty(
      [model.beamModeProperty],
      (mode) => mode === BeamMode.SINGLE_PHOTON,
    );

    const tableNode = new MachZehnderTableNode(model, preferences);

    /**
     * One port: the pattern, the accumulated photon marks over it, and the share
     * of the light it is receiving. In single-photon mode the continuous pattern
     * is hidden so that only the marks are visible — the whole point being that
     * the pattern is not there until the photons have drawn it.
     */
    const createPort = (
      specProperty: typeof model.portASpecProperty,
      marks: typeof model.marksA,
      title: typeof machZehnder.portAStringProperty,
      fractionProperty: typeof model.portAFractionProperty,
    ): VBox => {
      const detector = new DetectorScreenNode(specProperty, { size: PORT_DETECTOR_SIZE, title });
      detector.patternNode.visibleProperty = isContinuousProperty;

      const marksNode = new PhotonMarksNode(marks, model.photonRevisionProperty, PORT_DETECTOR_SIZE, {
        visibleProperty: isSinglePhotonProperty,
      });
      detector.overlayLayer.addChild(marksNode);

      const readout = new ReadoutBlock([
        { label: common.intensityStringProperty, value: percentProperty(fractionProperty, 0) },
      ]);

      return new VBox({
        spacing: MACH_ZEHNDER_SCREEN_VIEW_SETTINGS.CREATE_PORT_SPACING,
        align: "center",
        children: [detector, readout],
      });
    };

    const portA = createPort(
      model.portASpecProperty,
      model.marksA,
      machZehnder.portAStringProperty,
      model.portAFractionProperty,
    );
    const portB = createPort(
      model.portBSpecProperty,
      model.marksB,
      machZehnder.portBStringProperty,
      model.portBFractionProperty,
    );

    const pathReadout = new ReadoutBlock([
      { label: common.pathDifferenceStringProperty, value: lengthProperty(model.pathDifferenceProperty, 0) },
      {
        label: common.inWavelengthsStringProperty,
        value: wavesProperty(
          model.pathDifferenceProperty,
          model.lightSource.meanWavelengthProperty,
          MACH_ZEHNDER_SCREEN_VIEW_SETTINGS.PATH_READOUT_DECIMALS,
        ),
      },
      { label: common.visibilityStringProperty, value: percentProperty(model.visibilityProperty, 0) },
    ]);

    // The screen's whole argument, drawn: two traces exactly out of step and a
    // flat dashed total. Two images and two percentages can only ever suggest
    // that the ports are complementary; here it is a straight line you can look
    // at, and it stays straight when the which-path marker collapses both traces
    // to a flat half.
    const profileNode = new IntensityProfileNode(
      [
        {
          specProperty: model.portASpecProperty,
          colorProperty: InterferometryLabColors.plotTraceColorProperty,
          label: machZehnder.portAStringProperty,
        },
        {
          specProperty: model.portBSpecProperty,
          colorProperty: InterferometryLabColors.plotTraceAltColorProperty,
          label: machZehnder.portBStringProperty,
        },
      ],
      {
        width: PROFILE_WIDTH,
        height: PROFILE_HEIGHT,
        showSum: true,
        sumLabel: machZehnder.sumOfPortsStringProperty,
        descriptionSuffix: strings.getMachZehnderA11yStrings().profileComplementaryStringProperty,
      },
    );

    // Only meaningful in single-photon mode: the continuous beam has nothing
    // that evolves, so a play button there would suggest motion that is not
    // there.
    const timeControl = createTimeControl(
      model.timer.isPlayingProperty,
      () => model.stepOnce(),
      a11y.modeStringProperty,
    );
    timeControl.visibleProperty = isSinglePhotonProperty;

    // The readings and the clock sit beside the trace rather than under it. The
    // column is already four items deep — two detectors, a trace, and the
    // numbers — and stacking them all would push the control panels off the
    // bottom of the screen.
    const detectorColumn = new VBox({
      spacing: MACH_ZEHNDER_SCREEN_VIEW_SETTINGS.DETECTOR_COLUMN_SPACING,
      align: "left",
      children: [
        new HBox({ spacing: PANEL_SPACING, align: "top", children: [portA, portB] }),
        new HBox({
          spacing: PANEL_SPACING + MACH_ZEHNDER_SCREEN_VIEW_SETTINGS.DETECTOR_COLUMN_SPACING_OFFSET,
          align: "top",
          children: [
            profileNode,
            new VBox({
              spacing: MACH_ZEHNDER_SCREEN_VIEW_SETTINGS.DETECTOR_COLUMN_ITEM_2_SPACING,
              align: "left",
              children: [pathReadout, timeControl],
            }),
          ],
        }),
      ],
    });

    const topRow = new HBox({
      spacing: PANEL_SPACING + MACH_ZEHNDER_SCREEN_VIEW_SETTINGS.TOP_ROW_SPACING_OFFSET,
      align: "top",
      children: [tableNode, detectorColumn],
    });
    topRow.left = this.layoutBounds.minX + SCREEN_VIEW_MARGIN;
    topRow.top = this.layoutBounds.minY + SCREEN_VIEW_MARGIN;

    const sourcePanel = new LightSourcePanel(model.lightSource, {
      listParent: popupLayer,
      accessibleNames: {
        sourcePicker: a11y.sourcePickerStringProperty,
        wavelength: a11y.wavelengthStringProperty,
        bandwidth: a11y.bandwidthStringProperty,
      },
      contentWidth: PANEL_CONTENT_WIDTH,
    });

    const armsPanel = new MachZehnderArmsPanel(model, PANEL_CONTENT_WIDTH);
    const samplePanel = new MachZehnderSamplePanel(model, PANEL_CONTENT_WIDTH);
    const modePanel = new MachZehnderModePanel(model, PANEL_CONTENT_WIDTH);

    const controlRow = new HBox({
      spacing: PANEL_SPACING,
      align: "top",
      children: [sourcePanel, armsPanel, samplePanel, modePanel],
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

    this.children = [topRow, controlRow, resetAllButton, popupLayer];

    this.addChild(
      new Node({
        // The time control comes after the mode panel that reveals it: it is
        // only meaningful once single-photon mode is chosen.
        pdomOrder: [sourcePanel, armsPanel, samplePanel, modePanel, timeControl, resetAllButton],
      }),
    );
  }

  public reset(): void {
    // All state lives in the model.
  }

  public override step(_dt: number): void {
    // Photon emission is stepped by the model; the view only repaints on change.
  }
}
