/**
 * ===============================================
 * INTAKE - TERMINAL ANIMATION EFFECTS
 * ===============================================
 * @file src/features/client/intake/terminal-effects.ts
 *
 * Boot sequence and terminal-style animation helpers.
 */

import {
  showAvatarIntro,
  addBootMessage,
  addBootstrapMessage,
  stopBootstrapPulsing,
  delay
} from '../terminal-intake-ui';

/**
 * Run the terminal boot sequence animation.
 * Shows avatar intro, bootstrap loading dots, and boot messages.
 */
export async function runBootSequence(chatContainer: HTMLElement): Promise<void> {
  await showAvatarIntro(chatContainer);
  await delay(150);

  const bootstrapElement = addBootstrapMessage(chatContainer);
  await delay(1000);

  addBootMessage(chatContainer, '  \u2713 Loading intake module');
  await delay(700);

  addBootMessage(chatContainer, '  \u2713 Initializing question flow');
  await delay(700);

  addBootMessage(chatContainer, '  \u2713 Ready to collect project details');

  stopBootstrapPulsing(bootstrapElement);
  await delay(200);

  addBootMessage(chatContainer, '');
}

/**
 * Run the resume boot sequence (shorter, for returning sessions)
 */
export async function runResumeBootSequence(
  chatContainer: HTMLElement
): Promise<void> {
  const bootstrapElement = addBootstrapMessage(chatContainer);
  await delay(300);

  addBootMessage(chatContainer, '  \u2713 Previous session detected');
  stopBootstrapPulsing(bootstrapElement);
  await delay(400);
}

/**
 * Add a single boot message to the chat container
 */
export function addBootMessageToChat(chatContainer: HTMLElement, text: string): void {
  addBootMessage(chatContainer, text);
}
