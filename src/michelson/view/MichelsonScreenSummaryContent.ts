import { MICHELSON_SCREEN_SUMMARY_CONTENT_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * MichelsonScreenSummaryContent.ts
 *
 * The accessible screen summary read by screen readers.
 *
 * The "current details" paragraph is live: it reports the source, the path
 * difference, the fringe contrast, and — crucially — what *kind* of pattern is
 * on the detector. A sighted user can see at a glance whether the fringes are
 * rings, bars, or gone entirely; naming it is how a non-visual user gets the
 * same information, and it is the one thing the numbers alone do not convey.
 */

import { DerivedProperty, DynamicProperty } from "scenerystack/axon";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { opdSpread } from "../../common/model/fringeIntensity.js";
import { lengthProperty, percentProperty } from "../../common/view/formatters.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { MichelsonModel } from "../model/MichelsonModel.js";

/**
 * Below this contrast the pattern is described as washed out; the fringes are
 * still there mathematically but nobody could read them off the screen.
 */
const WASHED_OUT_VISIBILITY: number = MICHELSON_SCREEN_SUMMARY_CONTENT_SETTINGS.WASHED_OUT_VISIBILITY;

/**
 * Tilt (µrad) above which the wedge dominates the ray-angle term and the rings
 * have straightened into bars.
 */
const STRAIGHT_FRINGE_TILT_URAD: number = MICHELSON_SCREEN_SUMMARY_CONTENT_SETTINGS.STRAIGHT_FRINGE_TILT_URAD;

export class MichelsonScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: MichelsonModel) {
    const strings = StringManager.getInstance();
    const a11y = strings.getMichelsonA11yStrings();
    const common = strings.getCommon();

    // The source's localized name, picked from the common string group by the
    // current SourceType. Swapping which Property is being read when the source
    // changes — and tracking the new Property through locale switches — is what
    // DynamicProperty is for, instead of a DerivedProperty over all six labels.
    const sourceNameProperty = new DynamicProperty(model.lightSource.sourceTypeProperty, {
      derive: (type) => type.labelStringProperty(common),
    });

    const patternProperty = new DerivedProperty(
      [
        model.visibilityProperty,
        model.fringeSpecProperty,
        model.lightSource.meanWavelengthProperty,
        model.tiltHorizontalProperty,
        model.tiltVerticalProperty,
        a11y.patternRingsStringProperty,
        a11y.patternStraightStringProperty,
        a11y.patternUniformStringProperty,
        a11y.patternWashedOutStringProperty,
      ],
      (visibility, spec, wavelengthNm, tiltHorizontal, tiltVertical, rings, straight, uniform, washedOut) => {
        if (visibility < WASHED_OUT_VISIBILITY) {
          return washedOut;
        }
        // With the arms nearly equal and the mirrors parallel there is nothing
        // to make the path difference vary across the screen, so there is one
        // fringe and it covers everything. Calling that "circular fringes"
        // would describe a pattern that is not there.
        if (opdSpread(spec.geometry) < wavelengthNm) {
          return uniform;
        }
        const tilt = Math.hypot(tiltHorizontal, tiltVertical);
        return tilt >= STRAIGHT_FRINGE_TILT_URAD ? straight : rings;
      },
    );

    const currentDetailsProperty = new DerivedProperty(
      [
        a11y.currentDetailsStringProperty,
        sourceNameProperty,
        lengthProperty(model.lightSource.meanWavelengthProperty, 1),
        lengthProperty(model.pathDifferenceProperty, 1),
        percentProperty(model.visibilityProperty, 0),
        patternProperty,
      ],
      (pattern, source, wavelength, pathDifference, visibility, patternName) =>
        StringUtils.fillIn(pattern, {
          source,
          wavelength,
          pathDifference,
          visibility,
          pattern: patternName,
        }),
    );

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetailsProperty,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
  }
}
