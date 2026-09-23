// Embeddings and vector search utilities
// Uses OpenAI embeddings when API key is available, falls back to a simple TF-IDF

let globalMetadata = null;
let globalVocab = [];
let globalVocabIndex = {};
let globalDf = [];
let globalDocCount = 0;

/**
 * Update global TF-IDF vocabulary with new texts
 */
function updateTfIdfVocabulary(texts) {
  const allWords = new Set(globalVocab);
  const textWords = texts.map(text => {
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    words.forEach(w => allWords.add(w));
    return words;
  });

  globalVocab = Array.from(allWords);
  globalVocabIndex = {};
  globalVocab.forEach((w, i) => { globalVocabIndex[w] = i; });

  // Recompute DF (this is an approximation for incremental updates)
  globalDf = new Array(globalVocab.length).fill(0);
  globalDocCount += texts.length;
}

function textToTfIdf(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const tf = new Array(globalVocab.length).fill(0);
  words.forEach(w => {
    if (globalVocabIndex[w] !== undefined) tf[globalVocabIndex[w]]++;
  });

  const maxTf = Math.max(...tf, 1);
  return tf.map((t, i) => {
    const normalizedTf = t / maxTf;
    // Using a simple IDF approximation since true global DF is complex incrementally
    const idf = Math.log((globalDocCount + 1) / (globalDf[i] || 1 + 1)) + 1;
    return normalizedTf * idf;
  });
}

/**
 * Generate embeddings for an array of strings.
 * Uses OpenAI if available, otherwise simple incremental TF-IDF.
 */
export async function generateEmbeddings(texts) {
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
          input: texts,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

      const data = await response.json();
      globalMetadata = { type: 'openai' };
      return data.data.map(d => d.embedding);
    } catch (error) {
      console.warn('OpenAI embeddings failed, falling back to TF-IDF:', error.message);
    }
  }

  // Fallback to incremental TF-IDF
  updateTfIdfVocabulary(texts);
  globalMetadata = { type: 'tfidf' };
  
  return texts.map(t => textToTfIdf(t));
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a, b) {
  if (!a || !b) return 0;
  // Pad shorter vector with 0s (for incremental TF-IDF size mismatches)
  const len = Math.max(a.length, b.length);
  const vecA = [...a, ...new Array(len - a.length).fill(0)];
  const vecB = [...b, ...new Array(len - b.length).fill(0)];

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}
