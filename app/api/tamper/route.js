import { NextResponse } from 'next/server';
import { tamperChunk, resetChunk } from '../../../lib/store.js';

export async function POST(req) {
  try {
    const { chunkId, documentId, tamperedText } = await req.json();
    
    if (chunkId === undefined || !documentId || !tamperedText) {
      return NextResponse.json({ success: false, error: 'chunkId, documentId, and tamperedText required' }, { status: 400 });
    }

    tamperChunk(documentId, chunkId, tamperedText);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { chunkId, documentId } = await req.json();
    
    if (chunkId === undefined || !documentId) {
      return NextResponse.json({ success: false, error: 'chunkId and documentId required' }, { status: 400 });
    }

    const restoredText = resetChunk(documentId, chunkId);
    
    return NextResponse.json({ success: true, restoredText });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
