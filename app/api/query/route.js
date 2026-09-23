// POST /api/query — RAG Pipeline (baseline + ZK-enhanced)
// Retrieves relevant chunks, calls LLM, returns answer with citations

import { getDocument } from '@/lib/store';
import { retrieveTopK } from '@/lib/embeddings';

export async function POST(request) {
  try {
    const { query, documentId } = await request.json();

    if (!query || !documentId) {
      return Response.json(
        { success: false, error: 'Missing query or documentId' },
        { status: 400 }
      );
    }

    const doc = getDocument(documentId);
    if (!doc) {
      return Response.json(
        { success: false, error: 'Document not found. Commit a document first.' },
        { status: 404 }
      );
    }

    const startTime = performance.now();

    // Retrieve top-k chunks
    const topChunks = await retrieveTopK(
      query,
      doc.embeddings,
      doc.embeddingMetadata,
      doc.chunks,
      3
    );

    const retrievalMs = performance.now() - startTime;

    // Build context for LLM
    const context = topChunks
      .map((c, i) => `[Source ${i + 1} (Chunk #${c.chunk.id})]:\n${c.chunk.text}`)
      .join('\n\n---\n\n');

    // Try to call LLM
    let answer = '';
    let llmMs = 0;
    const llmStart = performance.now();

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey !== 'your-key-here') {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant. Answer the question based ONLY on the provided source documents. Cite which source(s) you used in your answer using [Source N] notation. Be concise but thorough.',
              },
              {
                role: 'user',
                content: `Question: ${query}\n\nSource Documents:\n${context}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 500,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          answer = data.choices[0].message.content;
        } else {
          throw new Error(`OpenAI API error: ${response.status}`);
        }
      } catch (error) {
        console.warn('LLM call failed:', error.message);
        answer = generateFallbackAnswer(query, topChunks);
      }
    } else {
      answer = generateFallbackAnswer(query, topChunks);
    }

    llmMs = performance.now() - llmStart;
    const totalMs = performance.now() - startTime;

    return Response.json({
      success: true,
      answer,
      citations: topChunks.map(c => ({
        chunkId: c.chunk.id,
        text: c.chunk.text,
        preview: c.chunk.text.substring(0, 150) + '...',
        similarity: Math.round(c.similarity * 1000) / 1000,
        tampered: c.chunk.tampered || false,
      })),
      timing: {
        retrievalMs: Math.round(retrievalMs * 100) / 100,
        llmMs: Math.round(llmMs * 100) / 100,
        totalMs: Math.round(totalMs * 100) / 100,
      },
      merkleRoot: doc.merkleRoot,
      documentId,
    });
  } catch (error) {
    console.error('Query error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function generateFallbackAnswer(query, topChunks) {
  const snippets = topChunks
    .slice(0, 2)
    .map((c, i) => `[Source ${i + 1}] ${c.chunk.text.substring(0, 200)}`)
    .join('\n\n');

  return `Based on the retrieved sources:\n\n${snippets}\n\n(Note: This is a retrieval-only response. Set OPENAI_API_KEY in .env.local for full LLM-generated answers.)`;
}
