import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/passwords.js';

describe('passwords', () => {
  it('hashes to a bcrypt string that is not the plaintext', () => {
    const hash = hashPassword('hunter2!');
    expect(hash).not.toBe('hunter2!');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('verifies a correct password', () => {
    const hash = hashPassword('hunter2!');
    expect(verifyPassword('hunter2!', hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashPassword('hunter2!');
    expect(verifyPassword('wrong', hash)).toBe(false);
  });
});
