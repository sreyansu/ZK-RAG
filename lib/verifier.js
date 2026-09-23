// SNARK proof verifier
// Recomputes Poseidon hash of chunk text and verifies Groth16 proof

import path from 'path';
import fs from 'fs';
import { hashChunk } from './poseidon.js';

/**
 * Verify a Groth16 proof that a chunk's text belongs to a committed document.
 * Works standalone - only needs the chunk text, proof, publicSignals, and merkleRoot.
 *
 * @param {string} chunkText - The text of the cited chunk
 * @param {object} proof - The Groth16 proof object
 * @param {string[]} publicSignals - The public signals from proof generation
 * @param {string} merkleRoot - The published Merkle root of the document
 * @returns {{ valid, recomputedHash, expectedLeafHash, rootMatch, timingMs }}
 */
export async function verifyProof(chunkText, proof, publicSignals, merkleRoot) {
  const snarkjs = await import('snarkjs');
  const startTime = performance.now();

  // Step 1: Recompute the Poseidon hash of the chunk text
  const recomputedHash = await hashChunk(chunkText);

  // Step 2: Check that the recomputed hash matches the leaf in the public signals
  // Public signals from our circuit: [root, leaf]
  const proofRoot = publicSignals[0];
  const proofLeaf = publicSignals[1];

  const hashMatches = recomputedHash === proofLeaf;
  const rootMatches = merkleRoot === proofRoot;

  // Step 3: Verify the SNARK proof cryptographically
  const vkeyPath = path.join(process.cwd(), 'public', 'verification_key.json');

  if (!fs.existsSync(vkeyPath)) {
    throw new Error(
      'Verification key not found. Run `bash scripts/setup.sh` first.'
    );
  }

  const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'));
  const snarkValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

  const timingMs = performance.now() - startTime;

  // The citation is valid only if ALL three conditions hold:
  // 1. The SNARK proof is cryptographically valid
  // 2. The recomputed hash matches the proven leaf
  // 3. The proven root matches the published root
  const valid = snarkValid && hashMatches && rootMatches;

  return {
    valid,
    snarkValid,
    hashMatches,
    rootMatches,
    recomputedHash,
    expectedLeafHash: proofLeaf,
    proofRoot,
    expectedRoot: merkleRoot,
    timingMs: Math.round(timingMs * 100) / 100,
  };
}
