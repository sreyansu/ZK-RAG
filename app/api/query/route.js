import { NextResponse } from 'next/server';
import { searchAllChunks } from '../../../lib/store.js';
import { generateEmbeddings } from '../../../lib/embeddings.js';

// Minimal LLM interaction (uses OpenAI if key exists, otherwise simple response)
async function generateAnswer(query, contextChunks) {
  const apiKey = process.env.OPENAI_API_KEY;
  const contextText = contextChunks.map((c, i) => `[Source: ${c.documentName} | Chunk ${c.chunkId}]\n${c.text}`).join('\n\n');
  
  if (!apiKey || apiKey === 'your-key-here') {
    return `(TF-IDF Fallback Mode - No LLM API Key)\n\nBased on your query "${query}", I found the following relevant information in our verified sources:\n\n${contextText}`;
  }

  const prompt = `You are a helpful AI assistant. Answer the user's question using ONLY the provided context from our verified knowledge base. 
If the answer is not in the context, say you don't know. Cite your sources using the document names.

Context:
${contextText}

Question: ${query}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });
    
    if (!res.ok) throw new Error('OpenAI API Error');
    const data = await res.json();
    return data.choices[0].message.content;
  } catch (e) {
    return `(Error calling LLM: ${e.message})\n\nFallback context:\n${contextText}`;
  }
}

export async function POST(req) {
  const startTotal = Date.now();
  try {
    const { query } = await req.json();
    if (!query) throw new Error('Query is required');

    // 1. Embed query
    const queryVector = (await generateEmbeddings([query]))[0];

    // 2. Retrieve top chunks globally from Knowledge Base
    const startRetrieval = Date.now();
    const topChunks = searchAllChunks(queryVector, 3);
    const retrievalMs = Date.now() - startRetrieval;

    if (topChunks.length === 0) {
      return NextResponse.json({ success: true, answer: 'No relevant information found in the knowledge base.', citations: [] });
    }

    // 3. Generate Answer
    const startLlm = Date.now();
    const answer = await generateAnswer(query, topChunks);
    const llmMs = Date.now() - startLlm;

    // 4. Format citations for frontend
    const citations = topChunks.map(c => ({
      documentId: c.documentId,
      documentName: c.documentName,
      chunkId: c.chunkId,
      similarity: c.similarity.toFixed(3),
      preview: c.text.substring(0, 150) + '...',
      text: c.text,
      tampered: c.tampered
    }));

    return NextResponse.json({
      success: true,
      answer,
      citations,
      timing: {
        retrievalMs,
        llmMs,
        totalMs: Date.now() - startTotal
      }
    });

  } catch (error) {
    console.error('Query Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
