import { generateKeyBetween } from 'fractional-indexing';

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function jitter(): string {
  const first = DIGITS[Math.floor(Math.random() * DIGITS.length)];
  // Last char must not be DIGITS[0] ('0'): fractional-indexing rejects any key
  // ending in the alphabet's first digit, which would break a later insert.
  const last = DIGITS[1 + Math.floor(Math.random() * (DIGITS.length - 1))];
  return first + last;
}

export function positionBetween(a: string | null, b: string | null): string {
  return generateKeyBetween(a, b) + jitter();
}
