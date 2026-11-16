import { FORMATTERS_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * formatters.ts
 *
 * Turns model numbers into the strings the readouts display.
 *
 * Every optical length in the model is in nanometres, which is the right unit
 * for the physics and the wrong unit for most of the readouts — nobody wants to
 * read a cavity spacing as 50000 nm. These helpers pick a unit that keeps the
 * number in a readable range and format it there, reacting to locale changes
 * like any other string Property.
 */

import { DerivedProperty, type TReadOnlyProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { StringUtils } from "scenerystack/phetcommon";
import { NM_PER_MM, NM_PER_UM } from "../../InterferometryLabConstants.js";
import { StringManager } from "../../i18n/StringManager.js";

/** Above this many nanometres a length is shown in micrometres. */
const MICROMETER_THRESHOLD_NM: number = FORMATTERS_SETTINGS.MICROMETER_THRESHOLD_NM;

/** Above this many nanometres a length is shown in millimetres. */
const MILLIMETER_THRESHOLD_NM = 2 * NM_PER_MM;

/**
 * Formats an optical length given in nanometres, choosing nm, µm or mm so the
 * displayed number stays between roughly 1 and 2000.
 *
 * @param nanometersProperty - the length, nm
 * @param decimals - digits after the decimal point in the chosen unit
 */
export function lengthProperty(nanometersProperty: TReadOnlyProperty<number>, decimals = 1): TReadOnlyProperty<string> {
  const units = StringManager.getInstance().getUnits();
  const common = StringManager.getInstance().getCommon();

  return new DerivedProperty(
    [
      nanometersProperty,
      units.nanometersStringProperty,
      units.micrometersStringProperty,
      units.millimetersStringProperty,
      common.unlimitedStringProperty,
    ],
    (nanometers, nmPattern, umPattern, mmPattern, unlimited) => {
      if (!Number.isFinite(nanometers)) {
        return unlimited;
      }
      const magnitude = Math.abs(nanometers);
      if (magnitude >= MILLIMETER_THRESHOLD_NM) {
        return StringUtils.fillIn(mmPattern, { value: toFixed(nanometers / NM_PER_MM, decimals) });
      }
      if (magnitude >= MICROMETER_THRESHOLD_NM) {
        return StringUtils.fillIn(umPattern, { value: toFixed(nanometers / NM_PER_UM, decimals) });
      }
      return StringUtils.fillIn(nmPattern, { value: toFixed(nanometers, decimals) });
    },
  );
}

/**
 * Formats a number into a unit pattern that contains a `{{value}}` placeholder.
 *
 * @param valueProperty - the number to show
 * @param patternProperty - a pattern from the `units` string group
 * @param decimals - digits after the decimal point
 */
export function unitProperty(
  valueProperty: TReadOnlyProperty<number>,
  patternProperty: TReadOnlyProperty<string>,
  decimals = 1,
): TReadOnlyProperty<string> {
  return new DerivedProperty([valueProperty, patternProperty], (value, pattern) =>
    StringUtils.fillIn(pattern, { value: toFixed(value, decimals) }),
  );
}

/**
 * Formats a number that has no unit, falling back to a dash when it is not
 * finite — which happens legitimately here: the coherence length of an ideal
 * monochromatic source, or the finesse at a reflectance of 1.
 */
export function plainProperty(valueProperty: TReadOnlyProperty<number>, decimals = 1): TReadOnlyProperty<string> {
  const units = StringManager.getInstance().getUnits();
  const common = StringManager.getInstance().getCommon();

  return new DerivedProperty(
    [valueProperty, units.plainStringProperty, common.unlimitedStringProperty],
    (value, pattern, unlimited) =>
      Number.isFinite(value) ? StringUtils.fillIn(pattern, { value: toFixed(value, decimals) }) : unlimited,
  );
}

/**
 * Formats a fraction (0–1) as a percentage.
 */
export function percentProperty(fractionProperty: TReadOnlyProperty<number>, decimals = 0): TReadOnlyProperty<string> {
  const units = StringManager.getInstance().getUnits();
  return new DerivedProperty([fractionProperty, units.percentStringProperty], (fraction, pattern) =>
    StringUtils.fillIn(pattern, { value: toFixed(100 * fraction, decimals) }),
  );
}

/**
 * Formats a path difference as a number of wavelengths.
 *
 * A path difference in micrometres is a length; in wavelengths it is a fringe
 * count, and that is the form in which it answers the question the screen is
 * actually about. It is also the conversion students most often get wrong,
 * because for a Michelson the mirror has only moved half as far.
 *
 * @param nanometersProperty - the path difference, nm
 * @param wavelengthProperty - the wavelength to divide by, nm
 * @param decimals - digits after the decimal point
 */
export function wavesProperty(
  nanometersProperty: TReadOnlyProperty<number>,
  wavelengthProperty: TReadOnlyProperty<number>,
  decimals = 1,
): TReadOnlyProperty<string> {
  const units = StringManager.getInstance().getUnits();

  return new DerivedProperty(
    [nanometersProperty, wavelengthProperty, units.wavesStringProperty],
    (nanometers, wavelengthNm, pattern) =>
      StringUtils.fillIn(pattern, {
        value: toFixed(wavelengthNm > 0 ? nanometers / wavelengthNm : 0, decimals),
      }),
  );
}

/**
 * Formats an optical length as a labelled path-difference contribution, "Δ 29.3 µm".
 *
 * Used for the labels drawn on the optical table, where the element the number
 * belongs to is right beside it and only the quantity needs naming.
 */
export function pathDeltaProperty(
  nanometersProperty: TReadOnlyProperty<number>,
  decimals = 1,
): TReadOnlyProperty<string> {
  const units = StringManager.getInstance().getUnits();
  const length = lengthProperty(nanometersProperty, decimals);

  return new DerivedProperty([length, units.pathDeltaStringProperty], (value, pattern) =>
    StringUtils.fillIn(pattern, { value }),
  );
}

/**
 * Formats an integer count with no unit.
 */
export function countProperty(valueProperty: TReadOnlyProperty<number>): TReadOnlyProperty<string> {
  const units = StringManager.getInstance().getUnits();
  return new DerivedProperty([valueProperty, units.plainStringProperty], (value, pattern) =>
    StringUtils.fillIn(pattern, { value: Math.round(value).toString() }),
  );
}
