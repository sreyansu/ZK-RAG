// GET /api/benchmark — Run timing benchmarks
// Compares baseline citation vs proof generation vs verification

import { getDocument, getFirstDocumentId } from '@/lib/store';
import { generateProof } from '@/lib/prover';
import { verifyProof } from '@/lib/verifier';

export async function GET() {
  try {
    const docId = getFirstDocumentId();
    if (!docId) {
      return Response.json(
        { success: false, error: 'No committed document. Call /api/commit first.' },
        { status: 400 }
      );
    }

    const doc = getDocument(docId);
    const results = [];

    // Benchmark each chunk (up to 8 to avoid long waits)
    const maxChunks = Math.min(doc.chunks.length, 8);

    for (let i = 0; i < maxChunks; i++) {
      // Baseline citation time (essentially zero — just a lookup)
      const baselineStart = performance.now();
      const _citation = {
        chunkId: i,
        text: doc.chunks[i].text.substring(0, 100),
      };
      const baselineMs = performance.now() - baselineStart;

      // Proof generation time
      let proofGenMs = 0;
      let proofVerifyMs = 0;
      let proof = null;
      let publicSignals = null;

      try {
        const proofResult = await generateProof(
          doc.chunkHashes[i],
          doc.merkleRoot,
          doc.merklePaths[i]
        );
        proofGenMs = proofResult.timingMs;
        proof = proofResult.proof;
        publicSignals = proofResult.publicSignals;

        // Verification time
        const verifyResult = await verifyProof(
          doc.chunks[i].text,
          proof,
          publicSignals,
          doc.merkleRoot
        );
        proofVerifyMs = verifyResult.timingMs;
      } catch (error) {
        console.warn(`Benchmark: proof gen/verify failed for chunk ${i}:`, error.message);
        proofGenMs = -1;
        proofVerifyMs = -1;
      }

      results.push({
        chunkId: i,
        chunkSize: doc.chunks[i].text.length,
        baselineMs: Math.round(baselineMs * 100) / 100,
        proofGenMs,
        proofVerifyMs,
      });
    }

    // Compute averages
    const validResults = results.filter(r => r.proofGenMs >= 0);
    const avgProofGen = validResults.length > 0
      ? validResults.reduce((sum, r) => sum + r.proofGenMs, 0) / validResults.length
      : 0;
    const avgProofVerify = validResults.length > 0
      ? validResults.reduce((sum, r) => sum + r.proofVerifyMs, 0) / validResults.length
      : 0;
    const avgBaseline = results.reduce((sum, r) => sum + r.baselineMs, 0) / results.length;

    return Response.json({
      success: true,
      documentId: docId,
      chunkCount: doc.chunks.length,
      benchmarkedChunks: maxChunks,
      results,
      averages: {
        baselineMs: Math.round(avgBaseline * 100) / 100,
        proofGenMs: Math.round(avgProofGen * 100) / 100,
        proofVerifyMs: Math.round(avgProofVerify * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Benchmark error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
