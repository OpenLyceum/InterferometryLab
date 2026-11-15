/**
 * InterferometryLabConstants.ts
 *
 * Central repository for every named numeric constant used across the
 * simulation. Bare numbers that carry semantic meaning (sizes, margins,
 * physics defaults, ranges) belong here rather than inline in model or view
 * code, so they are named, documented, and changed in one place.
 *
 * Conventions
 * ───────────
 *  - Layout / chrome values are in screen pixels.
 *  - Optical lengths are in NANOMETRES throughout the model. Interferometry
 *    spans ~9 orders of magnitude (a metre-scale table sets a nanometre-scale
 *    phase), and nanometres are the only unit in which every quantity in this
 *    sim — wavelength, optical path difference, mirror travel, cavity spacing —
 *    is a comfortable number. Controls that read out in mm / µm convert at the
 *    view boundary; the conversion factors live here.
 *  - Colour strings live in InterferometryLabColors.ts, not here.
 *  - Computed expressions (e.g. `2 * Math.PI`) may stay inline.
 */

import { Range } from "scenerystack/dot";
import InterferometryLabNamespace from "./InterferometryLabNamespace.js";

// ── Layout / chrome (screen pixels) ───────────────────────────────────────────

/** Margin between the screen edge and edge-anchored controls (e.g. Reset All). */
export const SCREEN_VIEW_MARGIN = 20;

/** Corner radius shared by control panels and dialogs. */
export const PANEL_CORNER_RADIUS = 6;

/** Vertical spacing between stacked controls inside a panel. */
export const PANEL_CONTENT_SPACING = 8;

/** Horizontal spacing between side-by-side panels. */
export const PANEL_SPACING = 8;

/** Width of the control panel column on the right of every screen. */
export const CONTROL_PANEL_WIDTH = 224;

/** Side length of the square detector screen, in view pixels. */
export const DETECTOR_VIEW_SIZE = 250;

/** Font sizes used for panel titles, control labels, and numeric readouts. */
export const TITLE_FONT_SIZE = 14;
export const LABEL_FONT_SIZE = 12;
export const READOUT_FONT_SIZE = 12;

// ── Unit conversions ──────────────────────────────────────────────────────────

/** Nanometres per micrometre. */
export const NM_PER_UM = 1e3;

/** Nanometres per millimetre. */
export const NM_PER_MM = 1e6;

/** Radians per microradian — mirror tilts are naturally microradian-scale. */
export const RAD_PER_URAD = 1e-6;

// ── Light sources ─────────────────────────────────────────────────────────────

/** Helium-neon laser line (nm) — the default source, and the classic lab laser. */
export const HENE_WAVELENGTH_NM = 632.8;

/** Frequency-doubled Nd:YAG line (nm). */
export const GREEN_LASER_WAVELENGTH_NM = 532.0;

/** Argon-ion blue line (nm). */
export const BLUE_LASER_WAVELENGTH_NM = 488.0;

/** The sodium D lines (nm): the textbook doublet for Michelson visibility beats. */
export const SODIUM_D1_WAVELENGTH_NM = 589.592;
export const SODIUM_D2_WAVELENGTH_NM = 588.995;

/** User-tunable wavelength range (nm), clipped to the visible band. */
export const WAVELENGTH_RANGE_NM = new Range(400, 700);

/**
 * Spectral width (FWHM, nm) of a "laser" line. Real single-mode HeNe lines are
 * ~0.002 nm (metres of coherence length); this floor keeps the coherence
 * envelope off-screen for the laser presets so they behave as ideal sources.
 */
export const LASER_BANDWIDTH_NM = 0.002;

/** Spectral width (FWHM, nm) of the broadband "white light" source. */
export const WHITE_LIGHT_BANDWIDTH_NM = 300;

/** Centre wavelength (nm) of the broadband source. */
export const WHITE_LIGHT_CENTER_NM = 550;

/** User-selectable bandwidth range (nm) for the filtered-lamp source. */
export const BANDWIDTH_RANGE_NM = new Range(0.5, 60);

// ── Media ─────────────────────────────────────────────────────────────────────

/** Refractive index of dry air at 0 °C and 101.325 kPa, at 589 nm. */
export const AIR_INDEX_STP = 1.000293;

/** Standard atmosphere (kPa) — the reference pressure for the gas-cell law. */
export const STANDARD_PRESSURE_KPA = 101.325;

/** Standard temperature (K) for the gas-cell law. */
export const STANDARD_TEMPERATURE_K = 273.15;

/** Room temperature (K) — the gas cell is assumed isothermal at this value. */
export const ROOM_TEMPERATURE_K = 293.15;

/** Pressure range (kPa) of the evacuable gas cell: hard vacuum to 2 atmospheres. */
export const GAS_CELL_PRESSURE_RANGE_KPA = new Range(0, 2 * STANDARD_PRESSURE_KPA);

/** Physical length (nm) of the gas cell along the beam — 50 mm of gas column. */
export const GAS_CELL_LENGTH_NM = 50 * NM_PER_MM;

// ── Detector / rendering ──────────────────────────────────────────────────────

/**
 * Effective focal length (nm) of the lens that images the source onto the
 * detector. It converts a detector radius into a ray angle (tan θ = ρ / f),
 * which is what turns optical path difference into rings.
 */
const DETECTOR_FOCAL_LENGTH_NM = 250 * NM_PER_MM;

/**
 * Half-width (nm) of the square detector — a 100 mm screen, giving a half-angle
 * of about 11°. The ring count across the screen goes as 2d(1 − cos θ_max)/λ, so
 * a wide angle is what makes the rings countable: at the far end of the mirror's
 * coarse travel this shows about a dozen of them, and they collapse into the
 * centre as the arms are equalized, which is the behaviour being taught.
 */
const DETECTOR_HALF_WIDTH_NM = 50 * NM_PER_MM;

/**
 * Ratio tan θ / ρ of detector half-width to focal length — the constant that
 * turns a detector radius into a ray angle. Every screen's FringeGeometry
 * carries the same value here, because all three instruments image the same
 * detector geometry; defining it once keeps the three models from each
 * recomputing `DETECTOR_HALF_WIDTH_NM / DETECTOR_FOCAL_LENGTH_NM`.
 */
export const DETECTOR_APERTURE_TAN_THETA = DETECTOR_HALF_WIDTH_NM / DETECTOR_FOCAL_LENGTH_NM;

/**
 * Half-width (nm) of the collimated beam on the mirrors. A mirror tilt α turns
 * into an optical path difference of 2α across the beam, so this sets how many
 * straight fringes a given tilt produces.
 */
export const BEAM_HALF_WIDTH_NM = 10 * NM_PER_MM;

/** Thickness (nm) of the beam splitter's glass substrate. */
export const BEAMSPLITTER_SUBSTRATE_NM = 5 * NM_PER_MM;

/**
 * Sample grid resolution of the fringe renderer, per side. The intensity field
 * is evaluated on this grid and scaled up to DETECTOR_VIEW_SIZE. 240 keeps a
 * monochromatic frame at ~3 ms on a 2020-era laptop; see doc/implementation-notes.md.
 */
export const FRINGE_SAMPLES_MONOCHROMATIC = 240;

/**
 * Sample grid resolution used when the source carries many spectral lines
 * (white light). Cost scales with lines × samples², so the grid is coarsened to
 * keep the frame budget; broadband fringes are low-contrast and blurred anyway,
 * so the lost resolution is not visible.
 */
export const FRINGE_SAMPLES_BROADBAND = 120;

/** Number of spectral samples used to represent a broadband source. */
export const BROADBAND_LINE_COUNT = 15;

// ── Michelson ─────────────────────────────────────────────────────────────────

/** Coarse travel range (nm) of the movable mirror: ±0.2 mm. */
export const MICHELSON_COARSE_RANGE_NM = new Range(-0.2 * NM_PER_MM, 0.2 * NM_PER_MM);

/** Fine (micrometer knob) travel range (nm) of the movable mirror: ±2 µm. */
export const MICHELSON_FINE_RANGE_NM = new Range(-2 * NM_PER_UM, 2 * NM_PER_UM);

/**
 * Tilt range (µrad) of the fixed mirror, about each transverse axis. ±300 µrad
 * is about ±1 arcminute, which across a 20 mm beam spans roughly ten straight
 * fringes — enough to see the pattern rotate and compress without becoming a
 * blur at full deflection.
 */
export const MIRROR_TILT_RANGE_URAD = new Range(-300, 300);

// ── Mach-Zehnder ──────────────────────────────────────────────────────────────

/**
 * Path-length imbalance range (nm) between the two Mach-Zehnder arms. A few
 * wavelengths either way is all that is needed: unlike a Michelson there is no
 * coherence-length hunt here, only the fringe phase.
 */
export const PATH_IMBALANCE_RANGE_NM = new Range(-3000, 3000);

/** Thickness range (µm) of the insertable sample slide. */
export const SAMPLE_THICKNESS_RANGE_UM = new Range(0, 100);

/** Refractive-index range of the insertable sample slide. */
export const SAMPLE_INDEX_RANGE = new Range(1.0, 1.8);

/** Tilt range (degrees) of the sample slide about the vertical axis. */
export const SAMPLE_TILT_RANGE_DEG = new Range(0, 30);

/**
 * Photon emission rate (photons per second) in single-photon mode. The slow end
 * is slow enough to watch detections arrive one by one; the fast end fills the
 * detector in a few seconds, because the interesting claim — that the fringes
 * are still there — only becomes visible once a few thousand have landed.
 */
export const PHOTON_RATE_RANGE = new Range(20, 2000);

/** Maximum number of detected photons retained for the build-up display. */
export const MAX_PHOTON_MARKS = 6000;

// ── Fabry-Perot ───────────────────────────────────────────────────────────────

/** Mirror (intensity) reflectance range of the etalon. */
export const REFLECTANCE_RANGE = new Range(0.04, 0.99);

/** Single-pass absorptance range of each etalon mirror coating. */
export const ABSORPTANCE_RANGE = new Range(0, 0.05);

/** Cavity spacing range (µm) of the etalon. */
export const CAVITY_SPACING_RANGE_UM = new Range(10, 200);

/**
 * Separation range (pm) between the two lines of the twin-line test source.
 *
 * The upper end is wide enough that the default cavity can just resolve a pair,
 * and the lower end is far below what it can manage — so the whole range is
 * reachable, and closing the gap is what forces the reflectance and the spacing
 * up. A range that stopped short of the default resolution limit would leave the
 * lines permanently unresolvable and the exercise pointless.
 */
export const LINE_SEPARATION_RANGE_PM = new Range(0, 200);

/** Picometres per nanometre — the twin-line separation is a picometre-scale knob. */
export const PM_PER_NM = 1e3;

InterferometryLabNamespace.register("InterferometryLabConstants", {
  SCREEN_VIEW_MARGIN,
  PANEL_CORNER_RADIUS,
  PANEL_CONTENT_SPACING,
  PANEL_SPACING,
  CONTROL_PANEL_WIDTH,
  DETECTOR_VIEW_SIZE,
  TITLE_FONT_SIZE,
  LABEL_FONT_SIZE,
  READOUT_FONT_SIZE,
  NM_PER_UM,
  NM_PER_MM,
  RAD_PER_URAD,
  HENE_WAVELENGTH_NM,
  GREEN_LASER_WAVELENGTH_NM,
  BLUE_LASER_WAVELENGTH_NM,
  SODIUM_D1_WAVELENGTH_NM,
  SODIUM_D2_WAVELENGTH_NM,
  WAVELENGTH_RANGE_NM,
  LASER_BANDWIDTH_NM,
  WHITE_LIGHT_BANDWIDTH_NM,
  WHITE_LIGHT_CENTER_NM,
  BANDWIDTH_RANGE_NM,
  AIR_INDEX_STP,
  STANDARD_PRESSURE_KPA,
  STANDARD_TEMPERATURE_K,
  ROOM_TEMPERATURE_K,
  GAS_CELL_PRESSURE_RANGE_KPA,
  GAS_CELL_LENGTH_NM,
  DETECTOR_FOCAL_LENGTH_NM,
  DETECTOR_HALF_WIDTH_NM,
  DETECTOR_APERTURE_TAN_THETA,
  BEAM_HALF_WIDTH_NM,
  BEAMSPLITTER_SUBSTRATE_NM,
  FRINGE_SAMPLES_MONOCHROMATIC,
  FRINGE_SAMPLES_BROADBAND,
  BROADBAND_LINE_COUNT,
  MICHELSON_COARSE_RANGE_NM,
  MICHELSON_FINE_RANGE_NM,
  MIRROR_TILT_RANGE_URAD,
  PATH_IMBALANCE_RANGE_NM,
  SAMPLE_THICKNESS_RANGE_UM,
  SAMPLE_INDEX_RANGE,
  SAMPLE_TILT_RANGE_DEG,
  PHOTON_RATE_RANGE,
  MAX_PHOTON_MARKS,
  REFLECTANCE_RANGE,
  ABSORPTANCE_RANGE,
  CAVITY_SPACING_RANGE_UM,
  LINE_SEPARATION_RANGE_PM,
  PM_PER_NM,
});
