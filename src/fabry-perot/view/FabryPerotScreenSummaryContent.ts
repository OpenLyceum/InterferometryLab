import { FABRY_PEROT_SCREEN_SUMMARY_CONTENT_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * FabryPerotScreenSummaryContent.ts
 *
 * The accessible screen summary for the Fabry-Pérot screen.
 *
 * The live paragraph leads with reflectance and finesse rather than with the
 * picture, because on this screen the picture is a consequence: how sharp the
 * rings look, and whether two lines can be told apart, both follow from those
 * two numbers, and they are the ones a student is being asked to reason about.
 */

import { DerivedProperty } from "scenerystack/axon";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { lengthProperty, percentProperty, plainProperty } from "../../common/view/formatters.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { FabryPerotModel } from "../model/FabryPerotModel.js";

export class FabryPerotScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: FabryPerotModel) {
    const strings = StringManager.getInstance();
    const a11y = strings.getFabryPerotA11yStrings();

    const resolutionDetailProperty = new DerivedProperty(
      [
        model.twinLineProperty,
        model.resolvedProperty,
        a11y.singleLineDetailStringProperty,
        a11y.resolvedDetailStringProperty,
        a11y.unresolvedDetailStringProperty,
      ],
      (twinLine, resolved, singleLine, resolvedText, unresolvedText) =>
        !twinLine ? singleLine : resolved ? resolvedText : unresolvedText,
    );

    const currentDetailsProperty = new DerivedProperty(
      [
        a11y.currentDetailsStringProperty,
        percentProperty(model.reflectanceProperty, 0),
        plainProperty(model.finesseProperty, 1),
        lengthProperty(model.effectiveSpacingProperty, 1),
        lengthProperty(
          model.freeSpectralRangeProperty,
          FABRY_PEROT_SCREEN_SUMMARY_CONTENT_SETTINGS.FREE_SPECTRAL_RANGE_LENGTH_PROPERTY_DECIMALS,
        ),
        resolutionDetailProperty,
      ],
      (pattern, reflectance, finesse, spacing, freeSpectralRange, resolutionDetail) =>
        StringUtils.fillIn(pattern, { reflectance, finesse, spacing, freeSpectralRange, resolutionDetail }),
    );

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetailsProperty,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
  }
}
