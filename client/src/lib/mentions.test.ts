import { describe, it, expect } from 'vitest';
import { splitMentions, getActiveMention, applyMention } from './mentions';

describe('splitMentions', () => {
  it('splits a body into text and mention segments in order', () => {
    expect(splitMentions('hi @[u1] and @[u2]!')).toEqual([
      { type: 'text', value: 'hi ' },
      { type: 'mention', userId: 'u1' },
      { type: 'text', value: ' and ' },
      { type: 'mention', userId: 'u2' },
      { type: 'text', value: '!' },
    ]);
  });

  it('returns a single text segment when there are no mentions', () => {
    expect(splitMentions('plain text')).toEqual([{ type: 'text', value: 'plain text' }]);
  });

  it('accepts ids with dashes and underscores', () => {
    expect(splitMentions('@[a-b_c9]')).toEqual([{ type: 'mention', userId: 'a-b_c9' }]);
  });
});

describe('getActiveMention', () => {
  it('detects an @query at the caret after whitespace', () => {
    expect(getActiveMention('hello @ali', 10)).toEqual({ start: 6, query: 'ali' });
  });

  it('detects an @query at the start of the text', () => {
    expect(getActiveMention('@bob', 4)).toEqual({ start: 0, query: 'bob' });
  });

  it('returns null when there is no active mention', () => {
    expect(getActiveMention('hello world', 11)).toBeNull();
  });

  it('ignores an @ that is not preceded by whitespace (e.g. an email)', () => {
    expect(getActiveMention('mail x@y', 8)).toBeNull();
  });
});

describe('applyMention', () => {
  it('replaces the active @query with an @[userId] token plus a trailing space', () => {
    expect(applyMention('hi @al', 6, 'u9')).toEqual({ text: 'hi @[u9] ', caret: 9 });
  });

  it('is a no-op when there is no active mention', () => {
    expect(applyMention('hi there', 8, 'u9')).toEqual({ text: 'hi there', caret: 8 });
  });
});
