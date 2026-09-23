// POST /api/tamper — Tamper with a chunk (for demo purposes)
// DELETE /api/tamper — Reset a tampered chunk

import { tamperChunk, resetTamper, getDocument } from '@/lib/store';

export async function POST(request) {
  try {
    const { chunkId, documentId, tamperedText } = await request.json();

    if (chunkId === undefined || !documentId || !tamperedText) {
      return Response.json(
        { success: false, error: 'Missing chunkId, documentId, or tamperedText' },
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

    const originalText = doc.chunks[chunkId].text;
    const success = tamperChunk(documentId, chunkId, tamperedText);

    if (!success) {
      return Response.json(
        { success: false, error: 'Failed to tamper chunk' },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      chunkId,
      originalText,
      tamperedText,
      message: 'Chunk text has been tampered. The baseline system will still cite it, but ZK verification will fail.',
    });
  } catch (error) {
    console.error('Tamper error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { chunkId, documentId } = await request.json();

    if (chunkId === undefined || !documentId) {
      return Response.json(
        { success: false, error: 'Missing chunkId or documentId' },
        { status: 400 }
      );
    }

    const success = resetTamper(documentId, chunkId);

    if (!success) {
      return Response.json(
        { success: false, error: 'Failed to reset chunk' },
        { status: 400 }
      );
    }

    const doc = getDocument(documentId);

    return Response.json({
      success: true,
      chunkId,
      restoredText: doc.chunks[chunkId].text,
      message: 'Chunk text restored to original.',
    });
  } catch (error) {
    console.error('Reset tamper error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
