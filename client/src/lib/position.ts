import { generateKeyBetween } from 'fractional-indexing';

export function positionBetween(a: string | null, b: string | null): string {
  return generateKeyBetween(a, b);
}
