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

/** Settings for common/InterferometryLabPanel.ts. */
export const INTERFEROMETRY_LAB_PANEL_SETTINGS = {
  /** Options x margin (px). */
  OPTIONS_X_MARGIN: 12,
  /** Options y margin (px). */
  OPTIONS_Y_MARGIN: 10,
} as const;

/** Settings for common/InterferometryLabScreenIcons.ts. */
export const INTERFEROMETRY_LAB_SCREEN_ICONS_SETTINGS = {
  CREATE_MICHELSON_ICON_LINE_WIDTH: 14, // px
  CREATE_FABRY_PEROT_ICON_LINE_WIDTH: 6, // px

  /** Side of the detector square each icon is built around, view units. */
  FACE_SIZE: 260,
  /** Face line width (px). */
  FACE_LINE_WIDTH: 2,
  /** Port size (px). */
  PORT_SIZE: 200,
  /** Bar count (count). */
  BAR_COUNT: 4,
} as const;

/** Settings for common/model/LightSourceModel.ts. */
export const LIGHT_SOURCE_MODEL_SETTINGS = {
  /** Doppler-broadened width (FWHM, nm) of a single sodium D line in a low-pressure discharge lamp. Each line on its own stays coherent over tens of millimetres; it is the *pair* that makes the fringes come and go. */
  SODIUM_LINE_BANDWIDTH_NM: 0.005,
  /** A filtered lamp narrower than this is rendered as one group: a single Gaussian whose analytic envelope is exact, and whose colour does not visibly vary across the band. Wider bands are split so their colours separate. */
  SINGLE_GROUP_BANDWIDTH_NM: 5,
  /** Wavelength (nm) of one group per this many nm of bandwidth, once split. */
  NM_PER_GROUP: 5,
  /** Wavelength bounds (nm) of the band the broadband source is sampled over. */
  BROADBAND_MIN_NM: 390,
  /** Broadband max nm (nm). */
  BROADBAND_MAX_NM: 710,
  /** Filter bandwidth default (nm). */
  FILTER_BANDWIDTH_DEFAULT: 10,
} as const;

/** Settings for common/model/spectrum.ts. */
export const SPECTRUM_SETTINGS = {
  /** Exponent below which the coherence envelope is negligible (dimensionless). */
  MIN_COHERENCE_EXPONENT: -50,
  /** Half-width, in standard deviations, of the sampled span of a narrow line. */
  SAMPLE_HALF_SPAN_SIGMA: 2.2,
} as const;

/** Settings for common/view/BeamPathNode.ts. */
export const BEAM_PATH_NODE_SETTINGS = {
  /** Stroke width of the bright core of a beam, view pixels. */
  CORE_WIDTH: 2,
  /** Stroke width of the halo around a beam, view pixels. */
  HALO_WIDTH: 8,
  /** Opacity of the halo at full beam intensity. */
  HALO_OPACITY: 0.22,
} as const;

/** Settings for common/view/DetectorScreenNode.ts. */
export const DETECTOR_SCREEN_NODE_SETTINGS = {
  /** Width of the bezel drawn around the pattern, view pixels. */
  BEZEL_WIDTH: 4,
  /** Constructor spacing (px). */
  CONSTRUCTOR_SPACING: 6,
} as const;

/** Settings for common/view/FringePatternNode.ts. */
export const FRINGE_PATTERN_NODE_SETTINGS = {
  /** Above this many spectral groups the sample grid drops to the coarse size. */
  BROADBAND_GROUP_THRESHOLD: 3,
} as const;

/** Settings for common/view/IntensityProfileNode.ts. */
export const INTENSITY_PROFILE_NODE_SETTINGS = {
  /** Sum-trace dash length (px). */
  SUM_PLOT_LINE_DASH: 5, // px
  /** Sum-trace gap length (px). */
  SUM_PLOT_LINE_GAP: 4, // px

  CREATE_LEGEND_SPACING_VARIANT_2: 4, // px

  /** Points sampled across the detector. Matched to the renderer's monochromatic grid so the trace and the image agree about how much detail there is; sampling finer would draw fringes the detector above it cannot resolve. */
  SAMPLE_COUNT: 240,
  /** Below this modulation the trace is called flat rather than fringed. A pattern this shallow is a single fringe filling the field, which is a real and commonly reached state — see `opdSpread` in the model. */
  FLAT_CONTRAST: 0.02,
  /** Lower intensity axis bound (dimensionless). */
  INTENSITY_MIN: -0.06,
  /** Upper intensity axis bound (dimensionless). */
  INTENSITY_MAX: 1.08,
  /** Spacing of the horizontal gridlines, in intensity. */
  INTENSITY_GRID_SPACING: 0.5,
  /** Series line width (px). */
  SERIES_LINE_WIDTH: 1.6,
  /** Sum plot line width (px). */
  SUM_PLOT_LINE_WIDTH: 1.4,
  /** Grid lines line width (px). */
  GRID_LINES_LINE_WIDTH: 0.5,
  /** Footer spacing (px). */
  FOOTER_SPACING: 16,
  /** Constructor spacing (px). */
  CONSTRUCTOR_SPACING: 5,
  /** Create legend spacing (px). */
  CREATE_LEGEND_SPACING: 12,
  /** Create legend end x (px). */
  CREATE_LEGEND_END_X: 14,
  /** Create legend line width (px). */
  CREATE_LEGEND_LINE_WIDTH: 2.5,
} as const;

/** Settings for common/view/InterferometryLabNumberControl.ts. */
export const INTERFEROMETRY_LAB_NUMBER_CONTROL_SETTINGS = {
  /** Track size width (px). */
  TRACK_SIZE_WIDTH: 150,
  /** Track size height (px). */
  TRACK_SIZE_HEIGHT: 3,
  /** Thumb size width (px). */
  THUMB_SIZE_WIDTH: 13,
  /** Thumb size height (px). */
  THUMB_SIZE_HEIGHT: 24,
  /** Options vertical spacing (px). */
  OPTIONS_VERTICAL_SPACING: 2,
  /** Options max width (px). */
  OPTIONS_MAX_WIDTH: 130,
} as const;

/** Settings for common/view/LightSourcePanel.ts. */
export const LIGHT_SOURCE_PANEL_SETTINGS = {
  /** Items max width (px). */
  ITEMS_MAX_WIDTH: 150,
  /** Source combo box x margin (px). */
  SOURCE_COMBO_BOX_X_MARGIN: 8,
  /** Source combo box y margin (px). */
  SOURCE_COMBO_BOX_Y_MARGIN: 4,
  /** Wavelength control keyboard step (control/model units). */
  WAVELENGTH_CONTROL_KEYBOARD_STEP: 5,
  /** Wavelength control page keyboard step (control/model units). */
  WAVELENGTH_CONTROL_PAGE_KEYBOARD_STEP: 25,
  /** Bandwidth control delta (control/model units). */
  BANDWIDTH_CONTROL_DELTA: 0.5,
  /** Bandwidth control shift keyboard step (control/model units). */
  BANDWIDTH_CONTROL_SHIFT_KEYBOARD_STEP: 0.5,
  /** Bandwidth control page keyboard step (control/model units). */
  BANDWIDTH_CONTROL_PAGE_KEYBOARD_STEP: 10,
} as const;

/** Settings for common/view/OpticalTableNode.ts. */
export const OPTICAL_TABLE_NODE_SETTINGS = {
  /** Spacing of the mounting-hole grid, view pixels. */
  GRID_SPACING: 25,
  /** Grid line width (px). */
  GRID_LINE_WIDTH: 0.5,
} as const;

/** Settings for common/view/ReadoutBlock.ts. */
export const READOUT_BLOCK_SETTINGS = {
  /** Constructor x spacing (px). */
  CONSTRUCTOR_X_SPACING: 10,
  /** Constructor y spacing (px). */
  CONSTRUCTOR_Y_SPACING: 3,
} as const;

/** Settings for common/view/controlFactory.ts. */
export const CONTROL_FACTORY_SETTINGS = {
  /** Create checkbox max width (px). */
  CREATE_CHECKBOX_MAX_WIDTH: 165,
  /** Create checkbox spacing (px). */
  CREATE_CHECKBOX_SPACING: 7,
  /** Create checkbox box width (px). */
  CREATE_CHECKBOX_BOX_WIDTH: 15,
  /** Create push button max width (px). */
  CREATE_PUSH_BUTTON_MAX_WIDTH: 150,
  /** Create push button x margin (px). */
  CREATE_PUSH_BUTTON_X_MARGIN: 10,
  /** Create push button y margin (px). */
  CREATE_PUSH_BUTTON_Y_MARGIN: 5,
  /** Create tilt control keyboard step (control/model units). */
  CREATE_TILT_CONTROL_KEYBOARD_STEP: 5,
  /** Create tilt control page keyboard step (control/model units). */
  CREATE_TILT_CONTROL_PAGE_KEYBOARD_STEP: 50,
} as const;

/** Settings for common/view/formatters.ts. */
export const FORMATTERS_SETTINGS = {
  /** Above this many nanometres a length is shown in micrometres. */
  MICROMETER_THRESHOLD_NM: 2000,
} as const;

/** Settings for common/view/opticNodes.ts. */
export const OPTIC_NODES_SETTINGS = {
  COATING_LINE_DASH_DASH: 3, // px

  /** Thickness of a mirror's reflective plate, in view pixels. */
  MIRROR_THICKNESS: 5,
  /** Depth of the mount block drawn behind a mirror, in view pixels. */
  MOUNT_DEPTH: 9,
  /** Thickness of a glass plate (beam splitter, compensator, slide), in view pixels. */
  GLASS_THICKNESS: 6,
  /** Coating line width (px). */
  COATING_LINE_WIDTH: 1.5,
  /** Body corner radius (px). */
  BODY_CORNER_RADIUS: 2,
  /** Body line width (px). */
  BODY_LINE_WIDTH: 1.5,
  /** Windows line width (px). */
  WINDOWS_LINE_WIDTH: 2,
  /** Face y (px). */
  FACE_Y: -4,
  /** Face height (px). */
  FACE_HEIGHT: 4,
} as const;

/** Settings for fabry-perot/model/FabryPerotModel.ts. */
export const FABRY_PEROT_MODEL_SETTINGS = {
  /** Initial resonant order at the sodium reference wavelength (count). */
  INITIAL_RESONANCE_ORDER: 340,
  /** Reference wavelength for the initial cavity spacing (nm). */
  INITIAL_REFERENCE_WAVELENGTH: 589,
  /** Linewidth (FWHM, nm) of each source line. Narrow enough that the etalon's own response, not the source, sets what the rings look like — which is the regime an etalon is used in. */
  SOURCE_LINEWIDTH_NM: 0.0005,
  /** How far the scan sweeps the spacing, in wavelengths. */
  SCAN_AMPLITUDE_WAVES: 1.5,
  /** Scan period, seconds. */
  SCAN_PERIOD_S: 6,
  /** Wavelength default (nm). */
  WAVELENGTH_DEFAULT: 589,
  /** Line separation default (pm). */
  LINE_SEPARATION_DEFAULT: 60,
  /** Reflectance default (dimensionless). */
  REFLECTANCE_DEFAULT: 0.85,
} as const;

/** Settings for fabry-perot/view/FabryPerotCavityPanel.ts. */
export const FABRY_PEROT_CAVITY_PANEL_SETTINGS = {
  /** Reflectance control delta (control/model units). */
  REFLECTANCE_CONTROL_DELTA: 0.01,
  /** Reflectance control keyboard step (control/model units). */
  REFLECTANCE_CONTROL_KEYBOARD_STEP: 0.01,
  /** Reflectance control shift keyboard step (control/model units). */
  REFLECTANCE_CONTROL_SHIFT_KEYBOARD_STEP: 0.005,
  /** Reflectance control page keyboard step (control/model units). */
  REFLECTANCE_CONTROL_PAGE_KEYBOARD_STEP: 0.1,
  /** Absorptance control delta (control/model units). */
  ABSORPTANCE_CONTROL_DELTA: 0.001,
  /** Absorptance control keyboard step (control/model units). */
  ABSORPTANCE_CONTROL_KEYBOARD_STEP: 0.005,
  /** Absorptance control shift keyboard step (control/model units). */
  ABSORPTANCE_CONTROL_SHIFT_KEYBOARD_STEP: 0.001,
  /** Absorptance control page keyboard step (control/model units). */
  ABSORPTANCE_CONTROL_PAGE_KEYBOARD_STEP: 0.02,
  /** Spacing control delta (control/model units). */
  SPACING_CONTROL_DELTA: 0.5,
  /** Spacing control keyboard step (control/model units). */
  SPACING_CONTROL_KEYBOARD_STEP: 5,
  /** Spacing control shift keyboard step (control/model units). */
  SPACING_CONTROL_SHIFT_KEYBOARD_STEP: 0.5,
  /** Spacing control page keyboard step (control/model units). */
  SPACING_CONTROL_PAGE_KEYBOARD_STEP: 25,
  /** Scan control spacing (px). */
  SCAN_CONTROL_SPACING: 4,
} as const;

/** Settings for fabry-perot/view/FabryPerotScreenView.ts. */
export const FABRY_PEROT_SCREEN_VIEW_SETTINGS = {
  TOP_ROW_SPACING_OFFSET: 4, // px

  FREE_SPECTRAL_RANGE_LENGTH_PROPERTY_DECIMALS: 3, // digits

  /** Side length of the ring pattern, view pixels. */
  RING_SIZE: 216,
  /** Size of the transmission plot, view pixels. */
  PLOT_WIDTH: 370,
  /** Plot height (px). */
  PLOT_HEIGHT: 196,
} as const;

/** Settings for fabry-perot/view/FabryPerotSourcePanel.ts. */
export const FABRY_PEROT_SOURCE_PANEL_SETTINGS = {
  /** Wavelength control keyboard step (control/model units). */
  WAVELENGTH_CONTROL_KEYBOARD_STEP: 5,
  /** Wavelength control page keyboard step (control/model units). */
  WAVELENGTH_CONTROL_PAGE_KEYBOARD_STEP: 25,
  /** Separation control delta (control/model units). */
  SEPARATION_CONTROL_DELTA: 0.5,
  /** Separation control shift keyboard step (control/model units). */
  SEPARATION_CONTROL_SHIFT_KEYBOARD_STEP: 0.5,
  /** Separation control page keyboard step (control/model units). */
  SEPARATION_CONTROL_PAGE_KEYBOARD_STEP: 10,
} as const;

/** Settings for fabry-perot/view/FabryPerotTableNode.ts. */
export const FABRY_PEROT_TABLE_NODE_SETTINGS = {
  CONSTRUCTOR_CENTER_X_OFFSET: 8, // px
  CONSTRUCTOR_TOP_OFFSET: 16, // px

  SOURCE_HEIGHT: 22, // px
  LENS_HEIGHT: 60, // px

  /** Table size, view pixels. */
  TABLE_WIDTH: 300,
  /** Table height (px). */
  TABLE_HEIGHT: 252,
  /** Layout along the optical axis, table-local coordinates. */
  AXIS_Y: 132,
  /** Source x (px). */
  SOURCE_X: 44,
  /** First mirror x (px). */
  FIRST_MIRROR_X: 108,
  /** Second mirror x (px). */
  SECOND_MIRROR_X: 162,
  /** Lens x (px). */
  LENS_X: 212,
  /** Screen x (px). */
  SCREEN_X: 262,
  /** Height of the mirrors and screen, view pixels. */
  OPTIC_HEIGHT: 74,
  /** How many internal round trips are drawn before the beam is too faint to see. */
  DRAWN_BOUNCES: 4,
  /** Vertical offset between successive drawn bounces, view pixels. */
  BOUNCE_STEP: 9,
} as const;

/** Settings for fabry-perot/view/TransmissionSpectrumNode.ts. */
export const TRANSMISSION_SPECTRUM_NODE_SETTINGS = {
  UPDATE_LINE_DASH_DASH: 4, // px
  CONSTRUCTOR_UPDATE_LINE_DASH_DASH: 3, // px

  /** Number of points the transmission curve is sampled at. */
  SAMPLE_COUNT: 700,
  /** How many free spectral ranges the plot spans with a single source line. */
  SPAN_IN_FSR: 2.2,
  /** Twin line span factor (dimensionless). */
  TWIN_LINE_SPAN_FACTOR: 8,
  /** Chart transform range max (control/model units). */
  CHART_TRANSFORM_RANGE_MAX: 1.05,
  /** Curve line width (px). */
  CURVE_LINE_WIDTH: 1.6,
  /** Children line width (px). */
  CHILDREN_LINE_WIDTH: 1.2,
  /** Constructor spacing (px). */
  CONSTRUCTOR_SPACING: 5,
} as const;

/** Settings for mach-zehnder/model/MachZehnderModel.ts. */
export const MACH_ZEHNDER_MODEL_SETTINGS = {
  /** Half the light takes each route. */
  ROUTE_INTENSITY: 0.5,
  /** Two equal routes peak at 2; halving puts a bright fringe at full scale. */
  EXPOSURE: 0.5,
  /** Minimum quadrature resolution along an axis with a nonzero mirror wedge. */
  MIN_PORT_SAMPLES: 24,
  /** Samples per shortest-wavelength fringe, to keep the port average free of aliasing. */
  PORT_SAMPLES_PER_FRINGE: 8,
  /** Sample thickness default (µm). */
  SAMPLE_THICKNESS_DEFAULT: 20,
  /** Sample index default (dimensionless). */
  SAMPLE_INDEX_DEFAULT: 1.5,
  /** Photon rate default (1/s). */
  PHOTON_RATE_DEFAULT: 400,
} as const;

/** Settings for mach-zehnder/view/MachZehnderArmsPanel.ts. */
export const MACH_ZEHNDER_ARMS_PANEL_SETTINGS = {
  /** Imbalance control keyboard step (control/model units). */
  IMBALANCE_CONTROL_KEYBOARD_STEP: 25,
  /** Imbalance control shift keyboard step (control/model units). */
  IMBALANCE_CONTROL_SHIFT_KEYBOARD_STEP: 5,
  /** Imbalance control page keyboard step (control/model units). */
  IMBALANCE_CONTROL_PAGE_KEYBOARD_STEP: 250,
} as const;

/** Settings for mach-zehnder/view/MachZehnderModePanel.ts. */
export const MACH_ZEHNDER_MODE_PANEL_SETTINGS = {
  /** Mode label max width (px). */
  MODE_LABEL_MAX_WIDTH: 160,
  /** Mode radio group spacing (px). */
  MODE_RADIO_GROUP_SPACING: 5,
  /** Mode radio group radius (px). */
  MODE_RADIO_GROUP_RADIUS: 7,
  /** Rate control delta (control/model units). */
  RATE_CONTROL_DELTA: 5,
  /** Rate control keyboard step (control/model units). */
  RATE_CONTROL_KEYBOARD_STEP: 10,
  /** Rate control shift keyboard step (control/model units). */
  RATE_CONTROL_SHIFT_KEYBOARD_STEP: 5,
  /** Rate control page keyboard step (control/model units). */
  RATE_CONTROL_PAGE_KEYBOARD_STEP: 50,
  /** Photon box spacing (px). */
  PHOTON_BOX_SPACING: 6,
} as const;

/** Settings for mach-zehnder/view/MachZehnderSamplePanel.ts. */
export const MACH_ZEHNDER_SAMPLE_PANEL_SETTINGS = {
  READOUTS_DECIMALS: 2, // digits

  /** Thickness control delta (control/model units). */
  THICKNESS_CONTROL_DELTA: 0.1,
  /** Thickness control shift keyboard step (control/model units). */
  THICKNESS_CONTROL_SHIFT_KEYBOARD_STEP: 0.1,
  /** Thickness control page keyboard step (control/model units). */
  THICKNESS_CONTROL_PAGE_KEYBOARD_STEP: 10,
  /** Index control delta (control/model units). */
  INDEX_CONTROL_DELTA: 0.001,
  /** Index control keyboard step (control/model units). */
  INDEX_CONTROL_KEYBOARD_STEP: 0.01,
  /** Index control shift keyboard step (control/model units). */
  INDEX_CONTROL_SHIFT_KEYBOARD_STEP: 0.001,
  /** Index control page keyboard step (control/model units). */
  INDEX_CONTROL_PAGE_KEYBOARD_STEP: 0.1,
  /** Tilt control delta (control/model units). */
  TILT_CONTROL_DELTA: 0.1,
  /** Tilt control shift keyboard step (control/model units). */
  TILT_CONTROL_SHIFT_KEYBOARD_STEP: 0.1,
  /** Tilt control page keyboard step (control/model units). */
  TILT_CONTROL_PAGE_KEYBOARD_STEP: 5,
} as const;

/** Settings for mach-zehnder/view/MachZehnderScreenView.ts. */
export const MACH_ZEHNDER_SCREEN_VIEW_SETTINGS = {
  DETECTOR_COLUMN_SPACING_OFFSET: 10, // px
  TOP_ROW_SPACING_OFFSET: 8, // px

  PATH_READOUT_DECIMALS: 2, // digits
  DETECTOR_COLUMN_ITEM_2_SPACING: 10, // px

  /** Side length of each of the two port detectors, view pixels. Smaller than the  single detector on the other screens, because there are two of them and they  share the column with the trace drawn underneath. */
  PORT_DETECTOR_SIZE: 132,
  /** Profile height (px). */
  PROFILE_HEIGHT: 68,
  /** Create port spacing (px). */
  CREATE_PORT_SPACING: 6,
  /** Detector column spacing (px). */
  DETECTOR_COLUMN_SPACING: 8,
} as const;

/** Settings for mach-zehnder/view/MachZehnderTableNode.ts. */
export const MACH_ZEHNDER_TABLE_NODE_SETTINGS = {
  CONSTRUCTOR_CENTER_X_OFFSET: 10, // px
  CONSTRUCTOR_TOP_OFFSET: 16, // px
  CONSTRUCTOR_LEFT_OFFSET: 26, // px
  CONSTRUCTOR_RIGHT_OFFSET: 26, // px
  CONSTRUCTOR_BOTTOM_OFFSET: 12, // px

  SOURCE_HEIGHT: 22, // px

  /** Table size, view pixels. */
  TABLE_WIDTH: 440,
  /** Table height (px). */
  TABLE_HEIGHT: 252,
  /** Splitter in x (px). */
  SPLITTER_IN_X: 150,
  /** Splitter in y (px). */
  SPLITTER_IN_Y: 176,
  /** Mirror upper x (px). */
  MIRROR_UPPER_X: 150,
  /** Mirror upper y (px). */
  MIRROR_UPPER_Y: 68,
  /** Mirror lower x (px). */
  MIRROR_LOWER_X: 310,
  /** Mirror lower y (px). */
  MIRROR_LOWER_Y: 176,
  /** Splitter out x (px). */
  SPLITTER_OUT_X: 310,
  /** Splitter out y (px). */
  SPLITTER_OUT_Y: 68,
  /** Source x (px). */
  SOURCE_X: 52,
  /** Source y (px). */
  SOURCE_Y: 176,
  /** Detector a x (px). */
  DETECTOR_A_X: 384,
  /** Detector a y (px). */
  DETECTOR_A_Y: 68,
  /** Detector b x (px). */
  DETECTOR_B_X: 310,
  /** Detector b y (px). */
  DETECTOR_B_Y: 26,
  /** Sample x (px). */
  SAMPLE_X: 230,
  /** Sample y (px). */
  SAMPLE_Y: 68,
  /** Width of the mirrors and plates, view pixels. */
  OPTIC_WIDTH: 42,
} as const;

/** Settings for mach-zehnder/view/PhotonMarksNode.ts. */
export const PHOTON_MARKS_NODE_SETTINGS = {
  /** Side length of a single detection mark, view pixels. */
  MARK_SIZE: 2,
  /** Opacity of one mark, so overlapping detections accumulate. */
  MARK_OPACITY: 0.55,
} as const;

/** Settings for michelson/model/MichelsonModel.ts. */
export const MICHELSON_MODEL_SETTINGS = {
  /** Initial coarse offset nm (nm). */
  INITIAL_COARSE_OFFSET_NM: 20000,
  /** Half the light goes each way at the splitter, so each route delivers half the power to the detector. */
  ROUTE_INTENSITY: 0.5,
  /** Display gain. Two equal routes give an intensity between 0 and 2, so halving it puts a bright fringe exactly at full scale. */
  EXPOSURE: 0.5,
} as const;

/** Settings for michelson/view/CoherenceEnvelopeNode.ts. */
export const COHERENCE_ENVELOPE_NODE_SETTINGS = {
  MARKER_LINE_DASH_DASH: 4, // px
  CONSTRUCTOR_MARKER_LINE_DASH_DASH: 3, // px

  /** Points sampled across the plot. */
  SAMPLE_COUNT: 500,
  /** Narrowest span, nm. White light's coherence length is about a micrometre and the curve would otherwise collapse onto the axis; a couple of wavelengths of margin keeps the needle a shape rather than a spike. */
  MIN_HALF_SPAN_NM: 2000,
  /** How much of the source's feature scale to show either side of zero. Enough to get past the first null of a doublet, or well down the tail of a Gaussian. */
  SPAN_IN_FEATURES: 1.4,
  /** Bounds of the visibility axis, padded at both ends. A laser's curve is flat at 1 and a doublet's touches 0; against the frame either would read as an empty box rather than as the answer. */
  VISIBILITY_MIN: -0.06,
  /** Visibility max (px). */
  VISIBILITY_MAX: 1.08,
  /** Spacing of the horizontal gridlines, in visibility. */
  VISIBILITY_GRID_SPACING: 0.5,
  /** Curve line width (px). */
  CURVE_LINE_WIDTH: 1.6,
  /** Marker line width (px). */
  MARKER_LINE_WIDTH: 1.4,
  /** Grid lines line width (px). */
  GRID_LINES_LINE_WIDTH: 0.5,
  /** Constructor spacing (px). */
  CONSTRUCTOR_SPACING: 5,
} as const;

/** Settings for michelson/view/MichelsonGasCellPanel.ts. */
export const MICHELSON_GAS_CELL_PANEL_SETTINGS = {
  GAS_INDEX_PLAIN_PROPERTY_DECIMALS: 6, // digits

  /** Pressure control delta (control/model units). */
  PRESSURE_CONTROL_DELTA: 0.5,
  /** Pressure control keyboard step (control/model units). */
  PRESSURE_CONTROL_KEYBOARD_STEP: 2,
  /** Pressure control shift keyboard step (control/model units). */
  PRESSURE_CONTROL_SHIFT_KEYBOARD_STEP: 0.5,
  /** Pressure control page keyboard step (control/model units). */
  PRESSURE_CONTROL_PAGE_KEYBOARD_STEP: 20,
} as const;

/** Settings for michelson/view/MichelsonMirrorPanel.ts. */
export const MICHELSON_MIRROR_PANEL_SETTINGS = {
  /** Coarse control delta (control/model units). */
  COARSE_CONTROL_DELTA: 0.01,
  /** Coarse control shift keyboard step (control/model units). */
  COARSE_CONTROL_SHIFT_KEYBOARD_STEP: 0.05,
  /** Coarse control page keyboard step (control/model units). */
  COARSE_CONTROL_PAGE_KEYBOARD_STEP: 20,
  /** Fine control keyboard step (control/model units). */
  FINE_CONTROL_KEYBOARD_STEP: 20,
  /** Fine control shift keyboard step (control/model units). */
  FINE_CONTROL_SHIFT_KEYBOARD_STEP: 2,
  /** Fine control page keyboard step (control/model units). */
  FINE_CONTROL_PAGE_KEYBOARD_STEP: 200,
  /** Buttons spacing (px). */
  BUTTONS_SPACING: 6,
} as const;

/** Settings for michelson/view/MichelsonScreenSummaryContent.ts. */
export const MICHELSON_SCREEN_SUMMARY_CONTENT_SETTINGS = {
  /** Below this contrast the pattern is described as washed out; the fringes are still there mathematically but nobody could read them off the screen. */
  WASHED_OUT_VISIBILITY: 0.08,
  /** Tilt (µrad) above which the wedge dominates the ray-angle term and the rings have straightened into bars. */
  STRAIGHT_FRINGE_TILT_URAD: 25,
} as const;

/** Settings for michelson/view/MichelsonScreenView.ts. */
export const MICHELSON_SCREEN_VIEW_SETTINGS = {
  /** The analysis column to the right of the detector, view pixels. */
  PLOT_WIDTH: 264,
  /** Plot height (px). */
  PLOT_HEIGHT: 104,
} as const;

/** Settings for michelson/view/MichelsonTableNode.ts. */
export const MICHELSON_TABLE_NODE_SETTINGS = {
  CONSTRUCTOR_CENTER_X_OFFSET: 12, // px
  CONSTRUCTOR_BOTTOM_OFFSET: 18, // px
  CONSTRUCTOR_TOP_OFFSET: 26, // px
  CONSTRUCTOR_RIGHT_OFFSET: 32, // px
  CONSTRUCTOR_LEFT_OFFSET: 24, // px

  SOURCE_HEIGHT: 24, // px
  GAS_CELL_HEIGHT: 30, // px
  CELL_PATH_LABEL_DECIMALS: 2, // digits

  /** Table size, view pixels. */
  TABLE_WIDTH: 440,
  /** Table height (px). */
  TABLE_HEIGHT: 252,
  /** Source x (px). */
  SOURCE_X: 48,
  /** Source y (px). */
  SOURCE_Y: 140,
  /** Splitter x (px). */
  SPLITTER_X: 158,
  /** Splitter y (px). */
  SPLITTER_Y: 140,
  /** Fixed mirror x (px). */
  FIXED_MIRROR_X: 360,
  /** Fixed mirror y (px). */
  FIXED_MIRROR_Y: 140,
  /** Movable mirror x (px). */
  MOVABLE_MIRROR_X: 158,
  /** Movable mirror y (px). */
  MOVABLE_MIRROR_Y: 44,
  /** Detector x (px). */
  DETECTOR_X: 158,
  /** Detector y (px). */
  DETECTOR_Y: 228,
  /** Compensator x (px). */
  COMPENSATOR_X: 252,
  /** Compensator y (px). */
  COMPENSATOR_Y: 140,
  /** Gas cell x (px). */
  GAS_CELL_X: 158,
  /** Gas cell y (px). */
  GAS_CELL_Y: 94,
  /** Width of the mirrors and plates, view pixels. */
  OPTIC_WIDTH: 46,
  /** How far the movable mirror slides on screen at the end of its travel, view pixels. Purely illustrative — see the class comment. */
  MIRROR_TRAVEL_PIXELS: 14,
  /** Max width max width (px). */
  MAX_WIDTH_MAX_WIDTH: 120,
} as const;

/** Settings for preferences/InterferometryLabPreferencesNode.ts. */
export const INTERFEROMETRY_LAB_PREFERENCES_NODE_SETTINGS = {
  /** Header font size (px). */
  HEADER_FONT_SIZE: 18,
  /** Show optical path checkbox font size (px). */
  SHOW_OPTICAL_PATH_CHECKBOX_FONT_SIZE: 14,
  /** Show optical path checkbox spacing (px). */
  SHOW_OPTICAL_PATH_CHECKBOX_SPACING: 8,
  /** Constructor spacing (px). */
  CONSTRUCTOR_SPACING: 12,
} as const;

/** Component dimensions in px; ratios and control steps are dimensionless; precision counts digits. */
export const FABRY_PEROT_SCREEN_SUMMARY_CONTENT_SETTINGS = {
  FREE_SPECTRAL_RANGE_LENGTH_PROPERTY_DECIMALS: 3, // digits
} as const;

/** Settings for mach-zehnder/model/MachZehnderModel.ts; units are documented per value. */
export const MACHZEHNDERMODEL_TIME_STEP = {
  /** Wall-clock interval advanced by Step Forward (s). */
  SECONDS: 1 / 60,
} as const;

/** Settings for fabry-perot/model/FabryPerotModel.ts; units are documented per value. */
export const FABRYPEROTMODEL_TIME_STEP = {
  /** Wall-clock interval advanced by Step Forward (s). */
  SECONDS: 1 / 60,
} as const;

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
