// Groth16 proof generator using snarkjs
// Generates ZK proofs that a chunk's hash is included in a Merkle tree

import path from 'path';
import fs from 'fs';

/**
 * Generate a Groth16 proof of Merkle inclusion.
 *
 * @param {string} leafHash - The Poseidon hash of the chunk (as BigInt string)
 * @param {string} merkleRoot - The Merkle root (as BigInt string)
 * @param {object} merklePath - { pathElements: string[], pathIndices: number[] }
 * @returns {{ proof, publicSignals, timingMs }}
 */
export async function generateProof(leafHash, merkleRoot, merklePath) {
  const snarkjs = await import('snarkjs');
  const startTime = performance.now();

  // Circuit input
  const input = {
    root: merkleRoot,
    leaf: leafHash,
    pathElements: merklePath.pathElements,
    pathIndices: merklePath.pathIndices,
  };

  // Paths to circuit artifacts
  const wasmPath = path.join(process.cwd(), 'public', 'circuit.wasm');
  const zkeyPath = path.join(process.cwd(), 'public', 'circuit_final.zkey');

  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
    throw new Error(
      'Circuit artifacts not found. Run `bash scripts/setup.sh` first to compile the circuit and generate proving keys.'
    );
  }

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  const timingMs = performance.now() - startTime;

  return {
    proof,
    publicSignals,
    timingMs: Math.round(timingMs * 100) / 100,
  };
}
