import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { chunkText } from './chunker.js';
import { poseidonHashStr } from './poseidon.js';
import { buildMerkleTree, getMerklePath } from './merkle.js';
import { generateEmbeddings } from './embeddings.js';

// In-memory knowledge base
let isInitialized = false;
let documents = {}; // documentId -> { name, root, chunks, tree }

/**
 * Initialize the knowledge base by reading all text files in the data/ directory,
 * chunking them, hashing them, and building their Merkle trees and embeddings.
 */
export async function initKnowledgeBase() {
  if (isInitialized) return getKnowledgeBaseStatus();

  console.log('Initializing Knowledge Base...');
  const dataDir = path.join(process.cwd(), 'data');
  
  if (!fs.existsSync(dataDir)) {
    throw new Error('Data directory not found');
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.txt'));
  
  for (const file of files) {
    if (file === 'sample-document.txt') continue; // Skip the old single-doc demo file

    const filePath = path.join(dataDir, file);
    const text = fs.readFileSync(filePath, 'utf-8');
    
    const docId = crypto.randomUUID();
    const docName = file.replace('.txt', '');
    
    console.log(`Processing document: ${docName}...`);

    // 1. Chunking
    const textChunks = chunkText(text);
    
    // 2. Poseidon Hashing
    const leafHashes = [];
    for (const chunkText of textChunks) {
      const hash = await poseidonHashStr(chunkText);
      leafHashes.push(hash);
    }
    
    // 3. Merkle Tree Construction
    const tree = await buildMerkleTree(leafHashes);
    
    // 4. Generate Embeddings
    const embeddings = await generateEmbeddings(textChunks);
    
    // 5. Store document data
    const chunks = textChunks.map((text, i) => {
      const pathData = getMerklePath(tree, i);
      return {
        id: i,
        text,
        hash: leafHashes[i],
        embedding: embeddings[i],
        pathElements: pathData.pathElements,
        pathIndices: pathData.pathIndices,
        tampered: false,
      };
    });

    documents[docId] = {
      id: docId,
      name: docName,
      root: tree.root,
      chunks,
      tree,
    };
  }

  isInitialized = true;
  console.log(`Knowledge Base initialized with ${Object.keys(documents).length} documents.`);
  return getKnowledgeBaseStatus();
}

/**
 * Return summary status of the knowledge base
 */
export function getKnowledgeBaseStatus() {
  return {
    initialized: isInitialized,
    documentCount: Object.keys(documents).length,
    documents: Object.values(documents).map(d => ({
      id: d.id,
      name: d.name,
      root: d.root,
      chunkCount: d.chunks.length,
    }))
  };
}

/**
 * Retrieve the top-K chunks across ALL documents based on vector similarity
 */
export function searchAllChunks(queryEmbedding, topK = 3) {
  if (!isInitialized) throw new Error('Knowledge Base not initialized');

  const allChunks = [];
  
  // Flatten chunks from all documents and compute similarities
  for (const doc of Object.values(documents)) {
    for (const chunk of doc.chunks) {
      const sim = cosineSimilarity(queryEmbedding, chunk.embedding);
      allChunks.push({
        documentId: doc.id,
        documentName: doc.name,
        chunkId: chunk.id,
        text: chunk.text,
        similarity: sim,
        tampered: chunk.tampered,
      });
    }
  }

  // Sort by similarity descending
  allChunks.sort((a, b) => b.similarity - a.similarity);
  return allChunks.slice(0, topK);
}

/**
 * Get a specific chunk from a specific document for ZK Proving
 */
export function getChunkForProof(documentId, chunkId) {
  const doc = documents[documentId];
  if (!doc) throw new Error('Document not found');
  
  const chunk = doc.chunks.find(c => c.id === chunkId);
  if (!chunk) throw new Error('Chunk not found');
  
  if (chunk.tampered) {
    throw new Error('Chunk has been tampered with. ZK proof will fail, so generation is aborted.');
  }

  return {
    leafHash: chunk.hash,
    pathElements: chunk.pathElements,
    pathIndices: chunk.pathIndices,
    merkleRoot: doc.root,
    text: chunk.text,
  };
}

/**
 * Tamper with a chunk's text (for demo purposes)
 */
export function tamperChunk(documentId, chunkId, tamperedText) {
  const doc = documents[documentId];
  if (!doc) throw new Error('Document not found');
  
  const chunk = doc.chunks.find(c => c.id === chunkId);
  if (!chunk) throw new Error('Chunk not found');

  if (!chunk.originalText) {
    chunk.originalText = chunk.text;
  }
  
  chunk.text = tamperedText;
  chunk.tampered = true;
  return true;
}

/**
 * Restore a chunk's original text
 */
export function resetChunk(documentId, chunkId) {
  const doc = documents[documentId];
  if (!doc) throw new Error('Document not found');
  
  const chunk = doc.chunks.find(c => c.id === chunkId);
  if (!chunk) throw new Error('Chunk not found');

  if (chunk.originalText) {
    chunk.text = chunk.originalText;
    chunk.tampered = false;
  }
  return chunk.text;
}

// Utility
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
