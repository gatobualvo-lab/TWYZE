/** Opens a chat with the team. (International format, no leading zero or plus.) */
export const SUPPORT_WHATSAPP_URL = 'https://wa.me/254113476311';

export interface SupportContext {
  email?: string | null;
  /** The plan's name, e.g. "Business". */
  plan?: string | null;
  /** The page the person was on. */
  page?: string | null;
  /** What they last asked the Guide. */
  question?: string | null;
}

const clean = (value: string | null | undefined, max: number) => (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * The WhatsApp link to the team, with a message already written so they can start helping straight
 * away. Only what the person already knows about themselves goes in (never business data), and they
 * see and can edit the message in WhatsApp before sending it.
 */
export function buildSupportUrl(context: SupportContext = {}): string {
  const lines = ['Hi TrackWyze team, I need help.'];
  const email = clean(context.email, 120);
  const plan = clean(context.plan, 30);
  const page = clean(context.page, 60);
  const question = clean(context.question, 300);
  if (email) lines.push(`Email: ${email}`);
  if (plan) lines.push(`Plan: ${plan}`);
  if (page) lines.push(`Page: ${page}`);
  if (question) lines.push(`My question: ${question}`);
  return `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(lines.join('\n'))}`;
}
