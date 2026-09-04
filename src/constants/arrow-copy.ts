/**
 * ARROW'S VOICE — plain-language contact-form feedback.
 *
 * Arrow is the mascot who pops up beside the contact form. Everything she says
 * is written for someone who does not know (and should not have to care) what
 * a CSRF token, a 429, or an XSS filter is. Three rules for anything added:
 *
 *   1. ACTION FIRST. Say what to DO, not what is wrong. "Check that email"
 *      beats "invalid email address" — one is an instruction, the other is a
 *      verdict the reader still has to translate into an action.
 *   2. Never name the mechanism. No status codes, no field names, no "tokens".
 *   3. Never blame the visitor for something the site did. A server fault is
 *      "on me", not "your input".
 *
 * The raw strings these replace still exist in contact-service.ts and are what
 * gets logged — this module only changes what a person reads.
 */

import { getContactEmail } from '../config/branding';

/**
 * Character counts that switch the bubble between its three sizes. Tuned to
 * the measured text box: at the mono face the short box holds ~2 lines, the
 * medium ~3, the long ~4. Exported so the module that applies them and the
 * copy they measure stay in one file.
 */
export const ARROW_SIZE_STEPS = {
  SHORT_MAX_CHARS: 48,
  MEDIUM_MAX_CHARS: 88
} as const;

/** Sent successfully. The one message that isn't a problem. */
export const ARROW_SUCCESS = 'Got it! Noelle will get back to you within 48 business hours.';

/**
 * Field-level validation, keyed by the raw message from
 * ContactService.validateFormData(). Matched case-insensitively on substrings
 * so a reworded source string degrades to the generic line instead of showing
 * a visitor the developer copy.
 *
 * Each entry carries TWO phrasings, because one problem and three problems are
 * different sentences. `alone` is the whole instruction, for when it is the
 * only thing wrong. `action` is the bare verb phrase that reads correctly when
 * several are strung into one sentence.
 */
interface FieldCopy {
  /** Substring matched against the validator's raw message. */
  readonly match: string;
  /**
   * Which input this is about. Arrow says at most ONE thing per field: two
   * rules about the same box can contradict each other outright ("write me a
   * message, and trim that message down"), and even when they agree, being
   * given two instructions for one input is just confusing.
   */
  readonly field: 'name' | 'email' | 'message';
  /** The whole instruction, for when this is the only thing wrong. */
  readonly alone: string;
  /** Bare verb phrase, for when several are strung into one sentence. */
  readonly action: string;
}

const FIELD_COPY: readonly FieldCopy[] = [
  {
    match: 'name is required',
    field: 'name',
    alone: 'Add your name for me and we’re good.',
    action: 'add your name'
  },
  {
    match: 'email is required',
    field: 'email',
    alone: 'Add an email so I know where to write back.',
    action: 'add your email'
  },
  {
    match: 'valid email',
    field: 'email',
    alone: 'Check that email for me — it’s not quite right.',
    action: 'check that email'
  },
  {
    match: 'message is required',
    field: 'message',
    alone: 'Tell me what you’re after in the message box.',
    action: 'write me a message'
  },
  {
    match: 'at least 10 characters',
    field: 'message',
    alone: 'Use a few more words and I’ll take it.',
    action: 'use a few more words'
  },
  {
    match: 'invalid characters',
    field: 'message',
    alone: 'Take out the code-looking bits and I’ll take it.',
    action: 'take out the code-looking bits'
  },
  {
    match: 'too long',
    field: 'message',
    alone: 'Trim that message down a bit and try again.',
    action: 'trim that message down'
  }
];

/** Fallback when a validation string doesn't match anything above. */
const FIELD_FALLBACK = 'Have a look at the fields in red and try again?';

/**
 * Nothing has been filled in at all.
 *
 * This case used to fall through to the multi-problem sentence and come out as
 * "Almost there! Add your name, add your email, and write me a message." —
 * which is not almost anywhere. The phrase is for someone most of the way
 * through, and reading it on an untouched form is either a joke at the
 * visitor's expense or a sign the site is not paying attention. A blank form
 * is not an error the visitor made; it is a form they have not started.
 */
const BLANK_FORM = 'Nothing to send yet — give me your name, an email, and a message.';

/** The three "you have not filled this in" matches, in field order. */
const REQUIRED_MATCHES = ['name is required', 'email is required', 'message is required'] as const;

/** "a, b and c" — the join a person would write, not `Array.join(', ')`. */
function toSentenceList(parts: readonly string[]): string {
  if (parts.length === 1) {
    return parts[0];
  }
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/** Capitalise the first letter without touching the rest of the sentence. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Turn the validator's raw error list into one thing Arrow says.
 *
 * She NAMES every problem. Pointing at colour ("I've outlined them in red")
 * is not an instruction — it tells someone that something is wrong without
 * telling them what, and it is useless to anyone who cannot pick the red
 * outlines out. The red fields say WHERE; Arrow says WHAT TO DO.
 */
export function arrowSayValidation(errors: readonly string[]): string {
  if (errors.length === 0) {
    return FIELD_FALLBACK;
  }

  const hits = errors
    .map((error) => FIELD_COPY.find((copy) => error.toLowerCase().includes(copy.match)))
    .filter((hit): hit is FieldCopy => hit !== undefined);

  // One instruction per input. The validator's own rules are already mutually
  // exclusive per field (its message checks are an else-if chain), but the
  // security checks push from a separate path, so nothing upstream guarantees
  // it — and the failure mode is Arrow flatly contradicting herself. First
  // match wins: FIELD_COPY is ordered so the more fundamental problem
  // ("there is no message") outranks the refinement ("it is too short").
  const matched: FieldCopy[] = [];
  for (const hit of hits) {
    if (!matched.some((seen) => seen.field === hit.field)) {
      matched.push(hit);
    }
  }

  if (matched.length === 0) {
    return FIELD_FALLBACK;
  }

  if (matched.length === 1) {
    return matched[0].alone;
  }

  // Every required field empty — the form has not been started, so she does
  // not talk as though it nearly has been.
  const allBlank =
    matched.length === REQUIRED_MATCHES.length &&
    REQUIRED_MATCHES.every((required) => matched.some((copy) => copy.match === required));
  if (allBlank) {
    return BLANK_FORM;
  }

  const actions = toSentenceList(matched.map((copy) => copy.action));
  return `Almost there! ${capitalise(actions)}.`;
}

/**
 * Why a submission that passed validation still didn't land.
 *
 * `status` is the HTTP status when there was a response at all. The three the
 * server actually produces (429 rate limit, 403 stale CSRF cookie, 5xx) are
 * indistinguishable to a visitor today — they all surface as "Unable to send
 * message" — and they need three different actions, so they get three answers.
 */
export function arrowSayFailure(status: number | null, rawMessage?: string): string {
  const email = getContactEmail('fallback');

  if (status === 429) {
    return `Give it a little while and try again — or email Noelle straight at ${email}.`;
  }
  if (status === 403) {
    return 'Refresh the page and send it again. Sorry — you’ll have to retype it!';
  }
  if (status !== null && status >= 500) {
    return `Give it a minute and try again. That one’s on me, not you — or email Noelle at ${email}.`;
  }

  const raw = (rawMessage ?? '').toLowerCase();
  if (raw.includes('network') || raw.includes('failed to fetch') || raw.includes('fetch')) {
    return 'Check your connection and try again — I can’t reach the outside world right now.';
  }
  if (raw.includes('too many') || raw.includes('slow down')) {
    return 'Wait about five minutes and I’ll be ready for the next one.';
  }
  if (raw.includes('configuration')) {
    return `Email Noelle at ${email} instead — something’s broken on my end.`;
  }
  if (raw.includes('invalid input') || raw.includes('security')) {
    return 'Take out the code-looking bits and I’ll take it.';
  }
  if (raw.includes('unavailable')) {
    return `Email Noelle straight at ${email} — my mailbox is down.`;
  }

  return `Give it one more try? If it keeps failing, email Noelle at ${email}.`;
}
