/**
 * Base62 encoding for short codes.
 * toBase62 always pads to 7 chars with the alphabet's first char ("0"),
 * so small ids sort/read consistently and codes never collide with
 * shorter reserved words.
 */
export const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const BASE = BigInt(ALPHABET.length);
const PAD_LENGTH = 7;

export function toBase62(n: bigint | number): string {
  let value = typeof n === "number" ? BigInt(n) : n;
  if (value < 0n) {
    throw new RangeError("toBase62: n must be non-negative");
  }
  if (value === 0n) {
    return ALPHABET[0]!.repeat(PAD_LENGTH);
  }
  let out = "";
  while (value > 0n) {
    const digit = Number(value % BASE);
    out = ALPHABET[digit] + out;
    value /= BASE;
  }
  return out.padStart(PAD_LENGTH, ALPHABET[0]);
}
