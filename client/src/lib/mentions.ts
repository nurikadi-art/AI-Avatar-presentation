export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; userId: string };

const TOKEN = /@\[([A-Za-z0-9_-]+)\]/g;
const ACTIVE = /(?:^|\s)@([^\s@[\]]*)$/;

export function splitMentions(body: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let last = 0;
  for (const m of body.matchAll(TOKEN)) {
    const index = m.index ?? 0;
    if (index > last) segments.push({ type: 'text', value: body.slice(last, index) });
    segments.push({ type: 'mention', userId: m[1] });
    last = index + m[0].length;
  }
  if (last < body.length) segments.push({ type: 'text', value: body.slice(last) });
  return segments;
}

export function getActiveMention(text: string, caret: number): { start: number; query: string } | null {
  const match = ACTIVE.exec(text.slice(0, caret));
  if (!match) return null;
  const query = match[1];
  return { start: caret - query.length - 1, query };
}

export function applyMention(
  text: string,
  caret: number,
  userId: string,
): { text: string; caret: number } {
  const active = getActiveMention(text, caret);
  if (!active) return { text, caret };
  const head = `${text.slice(0, active.start)}@[${userId}] `;
  return { text: head + text.slice(caret), caret: head.length };
}
