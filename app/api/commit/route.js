// POST /api/commit — Document Commitment Service
// Accepts text, chunks it, hashes with Poseidon, builds Merkle tree

import { commitDocument } from '@/lib/store';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const body = await request.json();
    let { text } = body;

    // If no text provided, load the sample document
    if (!text || text.trim().length === 0) {
      const samplePath = path.join(process.cwd(), 'data', 'sample-document.txt');
      text = fs.readFileSync(samplePath, 'utf-8');
    }

    const result = await commitDocument(text);

    return Response.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Commit error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
