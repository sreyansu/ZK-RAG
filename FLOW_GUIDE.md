# ZK-RAG: Query-First Knowledge Base Flow

This document explains the technical workflow of our newly updated ZK-RAG application, which operates like a verifiable search engine. Instead of a user uploading a document to ask questions about, the system comes pre-loaded with a library of verified sources.

## 1. Knowledge Base Initialization (The "Indexing" Phase)
*When the application starts, it builds the cryptographic foundation for all its sources.*

**Endpoint:** `GET /api/init`
**File:** `lib/store.js` -> `initKnowledgeBase()`

1. **Document Loading**: The system reads multiple verified text files (e.g., `creatine.txt`, `ai-alignment.txt`, `quantum.txt`) from the `data/` directory.
2. **Chunking**: Each document is independently split into smaller chunks (sentences/paragraphs) using `lib/chunker.js`.
3. **Hashing & Merkle Trees**: 
   - Each chunk in a document is hashed using the ZK-friendly **Poseidon** hash function.
   - For *each* document, a separate Merkle Tree is constructed.
   - The system publishes the **Merkle Root** of each document. These act as public "certificates of authenticity" for those specific sources.
4. **Embeddings**: Vector embeddings are generated for every chunk across all documents (`lib/embeddings.js`).

---

## 2. Search & Answer (The "Query" Phase)
*The user asks an open-ended question (e.g., "Is creatine good for daily consumption?").*

**Endpoint:** `POST /api/query`
**File:** `app/api/query/route.js`

1. **Query Embedding**: The user's question is converted into a vector.
2. **Global Vector Search**: The system searches across the *entire* Knowledge Base (all chunks from all documents) using Cosine Similarity. It retrieves the top 3 most relevant chunks.
3. **LLM Generation**: The top chunks are injected into a prompt for the LLM (e.g., `gpt-4o-mini`).
4. **Citation**: The LLM generates an answer, and the UI displays exactly which chunks from which documents (e.g., `creatine.txt`) were used as sources.

---

## 3. ZK Proof Generation (The "Prove" Phase)
*The user doesn't just trust the AI; they click "Verify Source (ZK)" to prove the citation genuinely came from the original published document.*

**Endpoint:** `POST /api/prove`
**File:** `lib/prover.js`

1. **Data Lookup**: The backend looks up the cited chunk. It retrieves:
   - The chunk's Poseidon Hash.
   - The Merkle Path (siblings up the tree).
   - The specific document's **Merkle Root**.
2. **Circuit Execution (snarkjs)**: The values are passed into our compiled `merkle_inclusion.circom` circuit. The circuit proves that if you start with the chunk's hash and apply the Merkle Path, you perfectly arrive at the document's Merkle Root.
3. **Groth16 Proving**: The system generates a cryptographic proof of this mathematical relationship.

---

## 4. Standalone Verification (The "Verify" Phase)
*The frontend verifies the proof against the raw text.*

**Endpoint:** `POST /api/verify`
**File:** `lib/verifier.js`

1. **Re-Hashing**: The verifier takes the raw text of the citation shown on the screen and hashes it.
2. **Signal Check**: It verifies that this hash matches the "Leaf Hash" in the proof, and the document's public root matches the "Root" in the proof.
3. **SNARK Check**: It uses `snarkjs.groth16.verify()` to validate the cryptographic math.
4. **Result**:
   - If everything aligns, the user sees ✅ **Source Authentic**. They have mathematically proven the AI didn't hallucinate the text and that it came from the officially published document.
   - If the text was tampered with (via the "Edit Source Demo"), the re-hashed value completely changes, causing the SNARK to fail, resulting in ❌ **Source Forged**.
