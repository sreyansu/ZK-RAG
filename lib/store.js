// In-memory document store (singleton)
// Stores committed documents with chunks, embeddings, Merkle data

import { splitIntoChunks } from './chunker.js';
import { hashChunk } from './poseidon.js';
import { buildMerkleTree, getMerklePath } from './merkle.js';
import { embedChunks } from './embeddings.js';

// Global store - persists across API calls in dev mode
let globalStore = null;

function getStore() {
  if (!globalStore) {
    globalStore = {
      documents: {},
      nextDocId: 1,
    };
  }
  return globalStore;
}

/**
 * Commit a document: chunk it, hash chunks, build Merkle tree, compute embeddings.
 * Returns document metadata including Merkle root.
 */
export async function commitDocument(text) {
  const store = getStore();
  const docId = `doc-${store.nextDocId++}`;

  // Step 1: Split into chunks
  const chunks = splitIntoChunks(text);

  // Step 2: Hash each chunk with Poseidon
  const chunkHashes = [];
  for (const chunk of chunks) {
    const hash = await hashChunk(chunk.text);
    chunkHashes.push(hash);
  }

  // Step 3: Build Merkle tree
  const merkleTree = await buildMerkleTree(chunkHashes);

  // Step 4: Get Merkle paths for each chunk
  const merklePaths = chunks.map((_, i) => getMerklePath(merkleTree, i));

  // Step 5: Compute embeddings
  const { embeddings, metadata: embeddingMetadata } = await embedChunks(chunks);

  // Store everything
  store.documents[docId] = {
    id: docId,
    originalText: text,
    chunks,
    originalChunkTexts: chunks.map(c => c.text), // Keep originals for tamper reset
    chunkHashes,
    merkleTree,
    merkleRoot: merkleTree.root,
    merklePaths,
    embeddings,
    embeddingMetadata,
    committedAt: new Date().toISOString(),
  };

  return {
    documentId: docId,
    merkleRoot: merkleTree.root,
    chunkCount: chunks.length,
    chunks: chunks.map((c, i) => ({
      id: i,
      preview: c.text.substring(0, 100) + (c.text.length > 100 ? '...' : ''),
      hash: chunkHashes[i],
    })),
  };
}

/**
 * Get a document by ID.
 */
export function getDocument(docId) {
  const store = getStore();
  return store.documents[docId] || null;
}

/**
 * Get a specific chunk from a document.
 */
export function getChunk(docId, chunkId) {
  const doc = getDocument(docId);
  if (!doc || chunkId < 0 || chunkId >= doc.chunks.length) return null;

  return {
    id: chunkId,
    text: doc.chunks[chunkId].text,
    hash: doc.chunkHashes[chunkId],
    merklePath: doc.merklePaths[chunkId],
    merkleRoot: doc.merkleRoot,
  };
}

/**
 * Tamper with a chunk's text (for the tamper demo).
 * Only modifies the stored text, NOT the hash or Merkle tree.
 */
export function tamperChunk(docId, chunkId, newText) {
  const doc = getDocument(docId);
  if (!doc || chunkId < 0 || chunkId >= doc.chunks.length) return false;

  doc.chunks[chunkId] = {
    ...doc.chunks[chunkId],
    text: newText,
    tampered: true,
  };

  return true;
}

/**
 * Reset a tampered chunk to its original text.
 */
export function resetTamper(docId, chunkId) {
  const doc = getDocument(docId);
  if (!doc || chunkId < 0 || chunkId >= doc.chunks.length) return false;

  doc.chunks[chunkId] = {
    ...doc.chunks[chunkId],
    text: doc.originalChunkTexts[chunkId],
    tampered: false,
  };

  return true;
}

/**
 * Get the first (or only) committed document ID.
 */
export function getFirstDocumentId() {
  const store = getStore();
  const ids = Object.keys(store.documents);
  return ids.length > 0 ? ids[0] : null;
}

/**
 * Check if any document is committed.
 */
export function hasDocuments() {
  const store = getStore();
  return Object.keys(store.documents).length > 0;
}
