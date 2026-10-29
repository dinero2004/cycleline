import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Invisible bot check for guest AI use: the browser finds a nonce so that
 * sha256(challenge + nonce) starts with DIFFICULTY zero bits (well under a second on a phone),
 * which makes scripted abuse cost real CPU without any puzzle for people.
 */
export const POW_DIFFICULTY = Number(process.env.AI_POW_BITS ?? 14);
const TTL_MS = 10 * 60 * 1000;
const used = new Map<string, number>();

const secret = () => process.env.AUTH_SECRET ?? "cycleline-development-secret";
const sign = (value: string) => createHmac("sha256", secret()).update(`pow:${value}`).digest("base64url").slice(0, 24);

export function issueChallenge(now = Date.now()): { challenge: string; difficulty: number } {
  const body = `${now}.${randomBytes(9).toString("base64url")}`;
  return { challenge: `${body}.${sign(body)}`, difficulty: POW_DIFFICULTY };
}

export function leadingZeroBits(buffer: Buffer): number {
  let bits = 0;
  for (const byte of buffer) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(byte) - 24;
    break;
  }
  return bits;
}

/** True once per valid, unexpired, correctly solved challenge. */
export function verifySolution(challenge: string, nonce: string, now = Date.now()): boolean {
  const parts = challenge.split(".");
  if (parts.length !== 3 || !/^\d{1,16}$/.test(nonce)) return false;
  const [ts, rand, sig] = parts;
  const expected = Buffer.from(sign(`${ts}.${rand}`));
  if (expected.length !== Buffer.from(sig).length || !timingSafeEqual(expected, Buffer.from(sig))) return false;
  if (now - Number(ts) > TTL_MS || Number(ts) > now + 60_000) return false;
  if (used.has(challenge)) return false;
  if (leadingZeroBits(createHash("sha256").update(challenge + nonce).digest()) < POW_DIFFICULTY) return false;
  used.set(challenge, now);
  for (const [key, at] of used) if (now - at > TTL_MS) used.delete(key);
  return true;
}
