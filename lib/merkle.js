// Merkle tree builder and path extractor using Poseidon hash

import { hashTwo, zeroHash } from './poseidon.js';

// Circuit depth — must match the `levels` parameter in merkle_inclusion.circom
const TREE_DEPTH = 4;
const MAX_LEAVES = 2 ** TREE_DEPTH; // 16

/**
 * Build a binary Merkle tree from an array of leaf hashes.
 * Always builds to exactly TREE_DEPTH levels (pads to 16 leaves).
 * Returns { root, layers, leafCount } where layers[0] = padded leaves.
 */
export async function buildMerkleTree(leafHashes) {
  if (leafHashes.length === 0) {
    throw new Error('Cannot build Merkle tree with zero leaves');
  }

  if (leafHashes.length > MAX_LEAVES) {
    throw new Error(`Too many leaves (${leafHashes.length}). Max is ${MAX_LEAVES} for circuit depth ${TREE_DEPTH}.`);
  }

  // Always pad to exactly MAX_LEAVES (16) to guarantee TREE_DEPTH levels
  const zeroH = await zeroHash();
  const paddedLeaves = [...leafHashes];
  while (paddedLeaves.length < MAX_LEAVES) {
    paddedLeaves.push(zeroH);
  }

  const layers = [paddedLeaves];

  // Build layers from bottom up
  let currentLayer = paddedLeaves;
  while (currentLayer.length > 1) {
    const nextLayer = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const hash = await hashTwo(currentLayer[i], currentLayer[i + 1]);
      nextLayer.push(hash);
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  // Sanity: layers should have exactly TREE_DEPTH + 1 entries
  if (layers.length - 1 !== TREE_DEPTH) {
    throw new Error(`Tree depth mismatch: expected ${TREE_DEPTH}, got ${layers.length - 1}`);
  }

  return {
    root: currentLayer[0],
    layers,
    leafCount: leafHashes.length,
    paddedLeafCount: MAX_LEAVES,
    depth: TREE_DEPTH,
  };
}

/**
 * Get the Merkle path (sibling hashes + position indices) for a given leaf index.
 * Always returns exactly TREE_DEPTH elements to match the circuit.
 * Returns { pathElements, pathIndices } for use as circuit inputs.
 */
export function getMerklePath(tree, leafIndex) {
  const pathElements = [];
  const pathIndices = [];

  let currentIndex = leafIndex;

  for (let i = 0; i < TREE_DEPTH; i++) {
    const layer = tree.layers[i];
    const isRight = currentIndex % 2 === 1;
    const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

    pathElements.push(layer[siblingIndex]);
    pathIndices.push(isRight ? 1 : 0);

    currentIndex = Math.floor(currentIndex / 2);
  }

  return { pathElements, pathIndices };
}
