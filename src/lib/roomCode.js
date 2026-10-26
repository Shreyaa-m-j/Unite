// No look-alikes: no 0/O, 1/I/L.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
const CODE_RE = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

export function generateCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

// Uppercase, drop spaces/dashes/anything non-alphanumeric, cap the length.
export function normalizeCode(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}

export const isValidCodeFormat = (code) => CODE_RE.test(code);
