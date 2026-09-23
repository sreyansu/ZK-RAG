// POST /api/verify — Standalone SNARK verification
// Recomputes hash, verifies proof — works without access to the source document

import { verifyProof } from '@/lib/verifier';

export async function POST(request) {
  try {
    const { chunkText, proof, publicSignals, merkleRoot } = await request.json();

    if (!chunkText || !proof || !publicSignals || !merkleRoot) {
      return Response.json(
        { success: false, error: 'Missing required fields: chunkText, proof, publicSignals, merkleRoot' },
        { status: 400 }
      );
    }

    const result = await verifyProof(chunkText, proof, publicSignals, merkleRoot);

    return Response.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Verify error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
