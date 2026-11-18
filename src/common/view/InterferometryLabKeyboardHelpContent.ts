/**
 * InterferometryLabKeyboardHelpContent.ts
 *
 * Content for the keyboard-help dialog (the "?" button in the navigation bar),
 * shared by all three screens.
 *
 * The slider section carries the weight here. Every quantity that matters on
 * every screen is set with a slider, and several controls — mirror tilt, the
 * Michelson micrometer, the Fabry-Pérot spacing — only do anything interesting
 * in their smallest steps, which are reached with shift-arrow. A user who
 * drags with the mouse alone will never find them.
 *
 * The Mach-Zehnder and Fabry-Pérot screens also run a clock through a
 * TimeControlNode, whose play/pause button binds the global Alt+K toggle; those
 * screens pass `includeTimeControls` so the dialog documents it. Michelson has
 * no clock.
 */

import {
  BasicActionsKeyboardHelpSection,
  type KeyboardHelpSection,
  SliderControlsKeyboardHelpSection,
  TimeControlsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";

export type InterferometryLabKeyboardHelpContentOptions = {
  /** Document the TimeControlNode's Alt+K play/pause (screens with a clock only). */
  includeTimeControls?: boolean;
};

export class InterferometryLabKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor(options?: InterferometryLabKeyboardHelpContentOptions) {
    const rightSections: KeyboardHelpSection[] = [];
    if (options?.includeTimeControls) {
      rightSections.push(new TimeControlsKeyboardHelpSection());
    }
    rightSections.push(new BasicActionsKeyboardHelpSection());
    super([new SliderControlsKeyboardHelpSection()], rightSections);
  }
}
