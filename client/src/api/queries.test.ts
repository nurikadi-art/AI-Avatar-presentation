import { describe, it, expect } from 'vitest';
import { qk } from './queries';

describe('query keys', () => {
  it('match the contract shapes exactly', () => {
    expect(qk.me).toEqual(['me']);
    expect(qk.boards).toEqual(['boards']);
    expect(qk.board('b1')).toEqual(['board', 'b1']);
    expect(qk.card('c1')).toEqual(['card', 'c1']);
    expect(qk.notifications).toEqual(['notifications']);
    expect(qk.search('hello')).toEqual(['search', 'hello']);
  });
});
