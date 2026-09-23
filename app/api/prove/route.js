import { NextResponse } from 'next/server';
import { getChunkForProof } from '../../../lib/store.js';
import { generateProof } from '../../../lib/prover.js';

export async function POST(req) {
  try {
    const { chunkId, documentId } = await req.json();

    if (chunkId === undefined || !documentId) {
      return NextResponse.json({ success: false, error: 'chunkId and documentId required' }, { status: 400 });
    }

    // 1. Get the exact path elements and original hash from the specific document tree
    const chunkData = getChunkForProof(documentId, chunkId);
    
    // 2. Generate the Groth16 zk-SNARK proof
    const { proof, publicSignals, timingMs } = await generateProof(
      chunkData.leafHash,
      chunkData.merkleRoot,
      {
        pathElements: chunkData.pathElements,
        pathIndices: chunkData.pathIndices
      }
    );

    return NextResponse.json({
      success: true,
      proof,
      publicSignals,
      leafHash: chunkData.leafHash,
      merkleRoot: chunkData.merkleRoot,
      proofGenerationMs: timingMs
    });

  } catch (error) {
    console.error('Prove error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
