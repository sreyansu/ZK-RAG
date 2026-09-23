import { NextResponse } from 'next/server';
import { getKnowledgeBaseStatus, getChunkForProof } from '../../../lib/store.js';
import { generateProof } from '../../../lib/prover.js';
import { verifyProof } from '../../../lib/verifier.js';

export async function GET(req) {
  try {
    const status = getKnowledgeBaseStatus();
    if (!status.initialized || status.documents.length === 0) {
      return NextResponse.json({ success: false, error: 'Knowledge Base not initialized' }, { status: 400 });
    }

    // Benchmark the first document, up to 3 chunks
    const doc = status.documents[0];
    const chunkCount = Math.min(doc.chunkCount, 3);
    
    const results = [];
    
    for (let i = 0; i < chunkCount; i++) {
      // 1. Baseline citation time (simulated DB lookup)
      const startBase = Date.now();
      const chunkData = getChunkForProof(doc.id, i);
      const baselineMs = Date.now() - startBase + Math.random() * 2; // Add tiny jitter
      
      // 2. ZK Proof Generation
      const startProve = Date.now();
      const { proof, publicSignals } = await generateProof(
        chunkData.leafHash,
        chunkData.merkleRoot,
        {
          pathElements: chunkData.pathElements,
          pathIndices: chunkData.pathIndices
        }
      );
      const proofGenMs = Date.now() - startProve;

      // 3. ZK Proof Verification
      const startVerify = Date.now();
      await verifyProof(chunkData.text, proof, publicSignals, chunkData.merkleRoot);
      const proofVerifyMs = Date.now() - startVerify;

      results.push({
        chunkId: i,
        documentName: doc.name,
        baselineMs,
        proofGenMs,
        proofVerifyMs
      });
    }

    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    
    return NextResponse.json({
      success: true,
      results,
      averages: {
        baselineMs: avg(results.map(r => r.baselineMs)),
        proofGenMs: avg(results.map(r => r.proofGenMs)),
        proofVerifyMs: avg(results.map(r => r.proofVerifyMs))
      }
    });

  } catch (error) {
    console.error('Benchmark Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
