# ZK-RAG: Complete Application Flow Guide

This document breaks down the exact technical workflow of the ZK-RAG application from start to finish. It is divided into four main phases: **Commitment**, **Retrieval**, **Proof Generation**, and **Verification**.

---

## 1. Document Commitment (The "Before" Phase)
*Before any questions can be asked, a document must be processed and cryptographically committed.*

**Endpoint:** `POST /api/commit`
**File:** `lib/store.js` -> `commitDocument()`

1. **Chunking**: The document text is passed to `lib/chunker.js`. It splits the text into smaller, meaningful chunks (usually around 200-400 tokens) based on paragraphs and sentences.
2. **Poseidon Hashing**: Each chunk's text is converted into a buffer, packed into field elements, and hashed using the ZK-friendly **Poseidon** hash function (`lib/poseidon.js`).
3. **Merkle Tree Construction**:
   - The chunk hashes are taken as the "leaves" of a Merkle Tree.
   - The tree is padded with "zero hashes" until it reaches exactly **16 leaves** (this forces the tree to be exactly 4 levels deep, matching our fixed Circom circuit depth).
   - The nodes are hashed together pairwise up the tree until a single **Merkle Root** is produced (`lib/merkle.js`).
4. **Embedding Generation**: The text of each chunk is sent to the OpenAI Embeddings API (or processed locally via TF-IDF fallback if no API key is present) to create vector embeddings (`lib/embeddings.js`).
5. **Storage**: The chunks, hashes, Merkle root, Merkle paths (siblings needed for verification), and embeddings are saved in the in-memory `store.js`.
6. **Output**: The application displays the **Merkle Root** as a public, immutable "certificate" of the document.

---

## 2. RAG Query (The "Retrieval" Phase)
*The user asks a question, and the system acts like a standard RAG application.*

**Endpoint:** `POST /api/query`
**File:** `app/api/query/route.js`

1. **Query Embedding**: The user's question is embedded using the exact same embedding model used during the commitment phase.
2. **Vector Search (Cosine Similarity)**: The system computes the cosine similarity between the query embedding and all the chunk embeddings in the store. It selects the Top-K (e.g., top 3) most relevant chunks (`lib/embeddings.js`).
3. **LLM Generation**: The retrieved chunk texts are injected into a prompt as context. This prompt is sent to `gpt-4o-mini` (or a fallback generator) to produce the final answer.
4. **Output**: The user sees the LLM's answer alongside the **Citations** (the specific chunks that were retrieved). At this point, the citations are just plain text—there is no cryptographic guarantee yet.

---

## 3. ZK Proof Generation (The "Prove" Phase)
*The user clicks "Verify (ZK)" on a specific citation to demand proof of its authenticity.*

**Endpoint:** `POST /api/prove`
**File:** `lib/prover.js`

1. **Data Gathering**: The backend looks up the specific cited chunk in the `store.js`. It retrieves:
   - The chunk's original **Poseidon Hash** (the leaf).
   - The **Merkle Path** (the hashes of the sibling nodes all the way up the tree).
   - The public **Merkle Root**.
2. **Circuit Execution (snarkjs)**: 
   - These values are formatted as inputs and passed into the compiled WebAssembly circuit (`public/circuit.wasm`).
   - The circuit (`circuits/merkle_inclusion.circom`) mathematically verifies that if you start with the chunk's hash and apply the Merkle Path, you end up exactly at the Merkle Root.
3. **Groth16 Proving**: Using `snarkjs.groth16.fullProve()` alongside the trusted setup key (`public/circuit_final.zkey`), the system generates a tiny cryptographic proof.
4. **Output**: The server returns the **Proof** and the **Public Signals** (the Root and the Leaf Hash) to the frontend.

---

## 4. Standalone Verification (The "Verify" Phase)
*The system independently verifies the proof without needing access to the original, full document.*

**Endpoint:** `POST /api/verify`
**File:** `lib/verifier.js`

> **Note:** In a real-world scenario, this verification could happen entirely in the user's browser, on a smart contract, or on a completely separate third-party server. It requires *only* the text of the citation, the proof, and the public Merkle Root.

1. **Recomputing the Hash**: The verifier takes the raw text of the citation provided on the screen and hashes it using Poseidon. 
2. **Signal Matching**: The verifier checks that:
   - The recomputed hash perfectly matches the "Leaf Hash" claimed in the Public Signals.
   - The public Merkle Root provided matches the "Root" claimed in the Public Signals.
3. **SNARK Verification**: The verifier uses `snarkjs.groth16.verify()` with the `verification_key.json` to cryptographically ensure the proof is valid.
4. **Final Decision**:
   - If **ALL** checks pass (Hash matches AND Root matches AND SNARK is valid), the frontend displays a green ✅ **Cryptographically Verified** badge.
   - If the text was tampered with (even by a single character), Step 1 generates a completely different hash, which breaks the SNARK verification, resulting in a red ❌ **Provenance Invalid** badge.
