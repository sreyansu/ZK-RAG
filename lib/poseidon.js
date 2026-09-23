// Poseidon hash utilities using circomlibjs
// Singleton pattern to avoid rebuilding Poseidon on every call

let poseidonInstance = null;
let poseidonPromise = null;

async function getPoseidon() {
  if (poseidonInstance) return poseidonInstance;
  if (poseidonPromise) return poseidonPromise;

  poseidonPromise = (async () => {
    const circomlibjs = await import('circomlibjs');
    const poseidon = await circomlibjs.buildPoseidon();
    poseidonInstance = poseidon;
    return poseidon;
  })();

  return poseidonPromise;
}

/**
 * Pack a text string into field elements (31 bytes per element).
 * This matches what the circuit expects.
 */
export function textToFieldElements(text) {
  const bytes = Buffer.from(text, 'utf-8');
  const BYTES_PER_ELEMENT = 31; // max safe packing for BN254
  const elements = [];

  for (let i = 0; i < bytes.length; i += BYTES_PER_ELEMENT) {
    const chunk = bytes.slice(i, i + BYTES_PER_ELEMENT);
    let packed = 0n;
    for (let j = 0; j < chunk.length; j++) {
      packed += BigInt(chunk[j]) << BigInt(8 * j);
    }
    elements.push(packed);
  }

  return elements;
}

/**
 * Hash a text chunk using Poseidon.
 * Packs text into field elements, then hashes them in a chain:
 *   h = Poseidon(el[0], el[1])
 *   h = Poseidon(h, el[2])
 *   ...etc
 * Returns the hash as a BigInt string.
 */
export async function hashChunk(text) {
  const poseidon = await getPoseidon();
  const elements = textToFieldElements(text);

  if (elements.length === 0) {
    return '0';
  }

  if (elements.length === 1) {
    const hash = poseidon([elements[0], 0n]);
    return poseidon.F.toString(hash);
  }

  // Chain hash: start with first two, then fold in remaining
  let currentHash = poseidon([elements[0], elements[1]]);

  for (let i = 2; i < elements.length; i++) {
    currentHash = poseidon([poseidon.F.toObject(currentHash), elements[i]]);
  }

  return poseidon.F.toString(currentHash);
}

/**
 * Hash two field elements together using Poseidon.
 * Used for building Merkle tree internal nodes.
 */
export async function hashTwo(left, right) {
  const poseidon = await getPoseidon();
  const hash = poseidon([BigInt(left), BigInt(right)]);
  return poseidon.F.toString(hash);
}

/**
 * Get the zero hash (hash of 0,0) used for padding Merkle tree leaves.
 */
export async function zeroHash() {
  const poseidon = await getPoseidon();
  const hash = poseidon([0n, 0n]);
  return poseidon.F.toString(hash);
}
