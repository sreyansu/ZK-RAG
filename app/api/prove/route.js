// POST /api/prove — Generate Groth16 proof of Merkle inclusion

import { getDocument } from '@/lib/store';
import { generateProof } from '@/lib/prover';

export async function POST(request) {
  try {
    const { chunkId, documentId } = await request.json();

    if (chunkId === undefined || !documentId) {
      return Response.json(
        { success: false, error: 'Missing chunkId or documentId' },
        { status: 400 }
      );
    }

    const doc = getDocument(documentId);
    if (!doc) {
      return Response.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    if (chunkId < 0 || chunkId >= doc.chunks.length) {
      return Response.json(
        { success: false, error: 'Invalid chunkId' },
        { status: 400 }
      );
    }

    const leafHash = doc.chunkHashes[chunkId];
    const merklePath = doc.merklePaths[chunkId];
    const merkleRoot = doc.merkleRoot;

    const { proof, publicSignals, timingMs } = await generateProof(
      leafHash,
      merkleRoot,
      merklePath
    );

    return Response.json({
      success: true,
      proof,
      publicSignals,
      merkleRoot,
      leafHash,
      chunkId,
      proofGenerationMs: timingMs,
    });
  } catch (error) {
    console.error('Prove error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
