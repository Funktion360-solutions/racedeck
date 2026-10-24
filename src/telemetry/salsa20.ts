// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

/**
 * Salsa20/20 stream cipher – Gran Turismo 7 encrypts its telemetry with it.
 * Verified against the ECRYPT test vector (set 1, vector 0).
 */

const rotl = (v: number, c: number) => ((v << c) | (v >>> (32 - c))) >>> 0;

function quarter(x: Uint32Array, a: number, b: number, c: number, d: number) {
  x[b] ^= rotl((x[a] + x[d]) >>> 0, 7);
  x[c] ^= rotl((x[b] + x[a]) >>> 0, 9);
  x[d] ^= rotl((x[c] + x[b]) >>> 0, 13);
  x[a] ^= rotl((x[d] + x[c]) >>> 0, 18);
}

const state = new Uint32Array(16);
const work = new Uint32Array(16);
const block = new Uint8Array(64);

function keystreamBlock(key: Uint32Array, nonce0: number, nonce1: number, counter: number): Uint8Array {
  state[0] = 0x61707865; state[1] = key[0]; state[2] = key[1]; state[3] = key[2];
  state[4] = key[3]; state[5] = 0x3320646e; state[6] = nonce0; state[7] = nonce1;
  state[8] = counter >>> 0; state[9] = Math.floor(counter / 0x100000000) >>> 0; state[10] = 0x79622d32; state[11] = key[4];
  state[12] = key[5]; state[13] = key[6]; state[14] = key[7]; state[15] = 0x6b206574;
  work.set(state);
  for (let i = 0; i < 10; i++) {
    quarter(work, 0, 4, 8, 12); quarter(work, 5, 9, 13, 1); quarter(work, 10, 14, 2, 6); quarter(work, 15, 3, 7, 11);
    quarter(work, 0, 1, 2, 3); quarter(work, 5, 6, 7, 4); quarter(work, 10, 11, 8, 9); quarter(work, 15, 12, 13, 14);
  }
  for (let i = 0; i < 16; i++) {
    const v = (work[i] + state[i]) >>> 0;
    block[i * 4] = v & 0xff;
    block[i * 4 + 1] = (v >>> 8) & 0xff;
    block[i * 4 + 2] = (v >>> 16) & 0xff;
    block[i * 4 + 3] = (v >>> 24) & 0xff;
  }
  return block;
}

/** XORs data with the keystream (encrypt and decrypt are the same). Returns a new array. */
export function salsa20Xor(data: Uint8Array, key: Uint32Array, nonce0: number, nonce1: number): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let offset = 0, counter = 0; offset < data.length; offset += 64, counter++) {
    const ks = keystreamBlock(key, nonce0 >>> 0, nonce1 >>> 0, counter);
    const end = Math.min(offset + 64, data.length);
    for (let i = offset; i < end; i++) out[i] = data[i] ^ ks[i - offset];
  }
  return out;
}

export function keyWords(bytes: Uint8Array): Uint32Array {
  const k = new Uint32Array(8);
  for (let i = 0; i < 8; i++) {
    k[i] = (bytes[i * 4] | (bytes[i * 4 + 1] << 8) | (bytes[i * 4 + 2] << 16) | (bytes[i * 4 + 3] << 24)) >>> 0;
  }
  return k;
}

const GT7_KEY = keyWords(new Uint8Array(Array.from('Simulator Interface Packet GT7 ver 0.0'.slice(0, 32), (c) => c.charCodeAt(0))));
export const GT7_MAGIC = 0x47375330; // "0S7G"

/** IV mask by packet length: heartbeat "A" → 296 bytes, "B" → 316, "~" → 344. */
function ivMask(length: number): number | null {
  if (length === 0x128) return 0xdeadbeaf;
  if (length === 0x13c) return 0xdeadbeef;
  if (length === 0x158) return 0x55fabb4f;
  return null;
}

const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Decrypts a GT7 packet. Returns null if the length or magic number is wrong. */
export function decryptGT7(packet: Uint8Array): Uint8Array | null {
  const mask = ivMask(packet.length);
  if (mask === null) return null;
  const iv1 = u32(packet, 0x40);
  const iv2 = (iv1 ^ mask) >>> 0;
  const plain = salsa20Xor(packet, GT7_KEY, iv2, iv1);
  return u32(plain, 0) === GT7_MAGIC ? plain : null;
}

/** For tests: builds an encrypted packet the way GT7 does. */
export function encryptGT7(plain: Uint8Array, iv1: number): Uint8Array {
  const mask = ivMask(plain.length);
  if (mask === null) throw new Error('bad length');
  const enc = salsa20Xor(plain, GT7_KEY, (iv1 ^ mask) >>> 0, iv1 >>> 0);
  enc[0x40] = iv1 & 0xff; enc[0x41] = (iv1 >>> 8) & 0xff; enc[0x42] = (iv1 >>> 16) & 0xff; enc[0x43] = (iv1 >>> 24) & 0xff;
  return enc;
}
