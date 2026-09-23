import { NextResponse } from 'next/server';
import { initKnowledgeBase } from '../../../lib/store.js';

export async function POST(req) {
  try {
    const status = await initKnowledgeBase();
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    console.error('Init Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const status = await initKnowledgeBase();
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    console.error('Init Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
