// Embeddings and vector search utilities
// Uses OpenAI embeddings when API key is available, falls back to TF-IDF

/**
 * Simple TF-IDF based embeddings (fallback when no API key).
 * Creates a vocabulary from all chunks, then represents each as a TF-IDF vector.
 */
function buildTfIdfEmbeddings(chunks) {
  // Build vocabulary from all chunks
  const allWords = new Set();
  const chunkWords = chunks.map(c => {
    const words = c.text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);
    words.forEach(w => allWords.add(w));
    return words;
  });

  const vocab = Array.from(allWords);
  const vocabIndex = {};
  vocab.forEach((w, i) => { vocabIndex[w] = i; });

  // Document frequency
  const df = new Array(vocab.length).fill(0);
  chunkWords.forEach(words => {
    const seen = new Set(words);
    seen.forEach(w => { df[vocabIndex[w]]++; });
  });

  // TF-IDF vectors
  const embeddings = chunkWords.map(words => {
    const tf = new Array(vocab.length).fill(0);
    words.forEach(w => { tf[vocabIndex[w]]++; });

    // Normalize TF and apply IDF
    const maxTf = Math.max(...tf, 1);
    return tf.map((t, i) => {
      const normalizedTf = t / maxTf;
      const idf = Math.log((chunks.length + 1) / (df[i] + 1)) + 1;
      return normalizedTf * idf;
    });
  });

  return { embeddings, vocab, vocabIndex, df };
}

/**
 * Compute TF-IDF embedding for a query using existing vocabulary.
 */
function queryToTfIdf(query, vocab, vocabIndex, df, docCount) {
  const words = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const tf = new Array(vocab.length).fill(0);
  words.forEach(w => {
    if (vocabIndex[w] !== undefined) {
      tf[vocabIndex[w]]++;
    }
  });

  const maxTf = Math.max(...tf, 1);
  return tf.map((t, i) => {
    const normalizedTf = t / maxTf;
    const idf = Math.log((docCount + 1) / (df[i] + 1)) + 1;
    return normalizedTf * idf;
  });
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

/**
 * Embed chunks - uses OpenAI if API key available, otherwise TF-IDF.
 * Returns { embeddings, metadata } where metadata contains vocab info for TF-IDF.
 */
export async function embedChunks(chunks) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey && apiKey !== 'your-key-here') {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: chunks.map(c => c.text),
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        embeddings: data.data.map(d => d.embedding),
        metadata: { type: 'openai' },
      };
    } catch (error) {
      console.warn('OpenAI embeddings failed, falling back to TF-IDF:', error.message);
    }
  }

  // Fallback to TF-IDF
  const { embeddings, vocab, vocabIndex, df } = buildTfIdfEmbeddings(chunks);
  return {
    embeddings,
    metadata: { type: 'tfidf', vocab, vocabIndex, df, docCount: chunks.length },
  };
}

/**
 * Embed a single query to match against stored embeddings.
 */
export async function embedQuery(query, metadata) {
  if (metadata.type === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: [query],
      }),
    });

    const data = await response.json();
    return data.data[0].embedding;
  }

  // TF-IDF query embedding
  return queryToTfIdf(
    query,
    metadata.vocab,
    metadata.vocabIndex,
    metadata.df,
    metadata.docCount
  );
}

/**
 * Retrieve top-k most similar chunks for a query.
 */
export async function retrieveTopK(query, embeddings, embeddingMetadata, chunks, k = 3) {
  const queryEmbedding = await embedQuery(query, embeddingMetadata);

  const scored = embeddings.map((emb, i) => ({
    index: i,
    similarity: cosineSimilarity(queryEmbedding, emb),
    chunk: chunks[i],
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}
