// Text chunker: splits documents into ~200-400 token chunks

/**
 * Split a text document into chunks of approximately maxTokens size.
 * Prefers splitting on paragraph boundaries, then sentence boundaries.
 * Returns an array of { id, text, startChar, endChar }.
 */
export function splitIntoChunks(text, maxTokens = 300) {
  // Rough token estimation: ~4 chars per token for English
  const CHARS_PER_TOKEN = 4;
  const maxChars = maxTokens * CHARS_PER_TOKEN;

  // First split on paragraphs (double newline)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  const chunks = [];
  let currentChunk = '';
  let currentStart = 0;
  let charPos = 0;

  for (const paragraph of paragraphs) {
    const paraStart = text.indexOf(paragraph, charPos);
    const paraEnd = paraStart + paragraph.length;

    if (currentChunk.length + paragraph.length + 2 > maxChars && currentChunk.length > 0) {
      // Current chunk is full, save it
      chunks.push({
        id: chunks.length,
        text: currentChunk.trim(),
        startChar: currentStart,
        endChar: currentStart + currentChunk.trim().length,
      });
      currentChunk = paragraph;
      currentStart = paraStart;
    } else {
      if (currentChunk.length === 0) {
        currentStart = paraStart;
      }
      currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph;
    }

    charPos = paraEnd;
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      id: chunks.length,
      text: currentChunk.trim(),
      startChar: currentStart,
      endChar: currentStart + currentChunk.trim().length,
    });
  }

  // If any chunk is still too large, split on sentences
  const finalChunks = [];
  for (const chunk of chunks) {
    if (chunk.text.length > maxChars * 1.5) {
      const subChunks = splitOnSentences(chunk.text, maxChars);
      for (const sub of subChunks) {
        finalChunks.push({
          id: finalChunks.length,
          text: sub,
          startChar: chunk.startChar,
          endChar: chunk.startChar + sub.length,
        });
      }
    } else {
      finalChunks.push({
        ...chunk,
        id: finalChunks.length,
      });
    }
  }

  return finalChunks;
}

function splitOnSentences(text, maxChars) {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Rough token count estimate.
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
