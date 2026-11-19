import { createHmac } from 'crypto';

/**
 * Minimal RFC 6238 TOTP generator.
 *
 * Deliberately dependency-free (Node's built-in crypto only) rather than pulling
 * in otplib/speakeasy — this suite's only need is "produce the 6-digit code an
 * authenticator app would show right now" for the MFA sign-in tests, and adding a
 * runtime dependency for ~40 lines of HMAC isn't worth the supply-chain surface.
 *
 * The secret comes from .env (see TEST_TOTP_SECRET_* keys). It is the same base32
 * string the QR code encodes during MFA enrolment.
 */

/** RFC 4648 base32 alphabet, as used by every authenticator app. */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decode a base32 secret to bytes.
 *
 * Authenticator secrets are routinely shown to users in lowercase and in
 * space-separated groups of four, so normalise both before decoding. Padding
 * ('=') is stripped rather than validated — the bit-accumulator below only ever
 * emits whole bytes, so trailing partial groups are discarded correctly either way.
 */
function base32Decode(secret: string): Buffer {
  const normalised = secret.toUpperCase().replace(/\s+/g, '').replace(/=+$/, '');

  const invalid = normalised.split('').filter(c => !BASE32_ALPHABET.includes(c));
  if (invalid.length > 0) {
    throw new Error(
      `TOTP secret contains characters outside the base32 alphabet: ${[...new Set(invalid)].join(', ')}`
    );
  }

  const bytes: number[] = [];
  let accumulator = 0;
  let bitsHeld = 0;

  for (const char of normalised) {
    accumulator = (accumulator << 5) | BASE32_ALPHABET.indexOf(char);
    bitsHeld += 5;
    if (bitsHeld >= 8) {
      bitsHeld -= 8;
      bytes.push((accumulator >> bitsHeld) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

export interface TotpOptions {
  /** Seconds per code. Authenticator apps and the backend both use 30. */
  stepSeconds?: number;
  /** Code length. 6 everywhere in this app. */
  digits?: number;
  /**
   * Whole steps to shift from "now". 0 = the code currently displayed,
   * -1 = the previous code. Used to test that a stale code is rejected.
   */
  stepOffset?: number;
  /** Milliseconds since epoch. Injectable so tests can pin the clock. */
  nowMs?: number;
}

/**
 * Generate the TOTP code for `secret` at the given moment.
 *
 * SHA-1 is hard-coded because that is what RFC 6238 specifies as the default and
 * what authenticator apps use — it is not a security choice we're making here,
 * it's the interop contract with the enrolled device.
 */
export function generateTotp(secret: string, options: TotpOptions = {}): string {
  const { stepSeconds = 30, digits = 6, stepOffset = 0, nowMs = Date.now() } = options;

  const counter = Math.floor(nowMs / 1000 / stepSeconds) + stepOffset;

  // The counter is a 64-bit big-endian value. Node's writeBigUInt64BE avoids the
  // precision loss a manual 32-bit split would risk.
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();

  // RFC 6238 dynamic truncation: the low nibble of the last byte picks the offset
  // of the 4 bytes to read; the top bit is masked off to keep the result positive.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

/**
 * Milliseconds until the current code rolls over.
 *
 * Tests use this to avoid the classic flake: generating a code with 0.4s left in
 * its window, then having the form submit it after it has already expired.
 */
export function msUntilNextTotpWindow(stepSeconds = 30, nowMs = Date.now()): number {
  return stepSeconds * 1000 - (nowMs % (stepSeconds * 1000));
}
