# ZK-RAG: Zero-Knowledge Retrieval-Augmented Generation

**Prove an AI's cited source chunk cryptographically exists inside a hashed document, without revealing the rest of the document.**

ZK-RAG replaces bare citation links with mathematical guarantees of provenance using Poseidon hashing, Merkle trees, and Groth16 zero-knowledge proofs.

![ZK-RAG Architecture](https://img.shields.io/badge/ZK--RAG-Groth16+Poseidon+Merkle-blueviolet?style=for-the-badge)

## How It Works

### The Problem with Baseline RAG Citations

Standard RAG systems retrieve text chunks and cite them by reference (chunk ID, page number, or URL). But these citations are **just links** — they carry no cryptographic guarantee:

- Anyone can edit the stored chunk after the fact
- The link still "works" even if the text has been tampered with
- There's no proof that what's cited is what was in the original document

### The ZK-RAG Solution

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   1. COMMIT       │     │   2. RETRIEVE     │     │   3. PROVE       │
│                   │     │                   │     │                   │
│ Document          │     │ Query             │     │ For each cited    │
│   → Chunk         │     │   → Embed         │     │ chunk, generate   │
│   → Poseidon Hash │────▶│   → Cosine Sim    │────▶│ a Groth16 SNARK   │
│   → Merkle Tree   │     │   → Top-K         │     │ proving Merkle    │
│   → Publish Root  │     │   → LLM Answer    │     │ inclusion         │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                            │
                                                            ▼
                                                  ┌──────────────────┐
                                                  │   4. VERIFY       │
                                                  │                   │
                                                  │ Recompute hash    │
                                                  │ Verify SNARK      │
                                                  │ Check Merkle root │
                                                  │                   │
                                                  │ ✅ or ❌           │
                                                  └──────────────────┘
```

1. **Commit**: Split document into chunks, hash each with Poseidon (ZK-friendly hash), build a Merkle tree, publish the root as a public "certificate"
2. **Retrieve**: Standard RAG — embed query, find similar chunks, generate LLM answer with citations
3. **Prove**: For each cited chunk, generate a Groth16 SNARK proving its hash is a leaf in the Merkle tree — without revealing any other chunks
4. **Verify**: Anyone with the chunk text, proof, and published root can independently verify the citation's provenance

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Rust** (for building the circom compiler)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Install circom compiler (if not already installed)
git clone https://github.com/iden3/circom.git ~/circom
cd ~/circom && cargo install --path circom

# 3. Install snarkjs globally
npm install -g snarkjs

# 4. Run the trusted setup (compiles circuit, generates proving keys)
bash scripts/setup.sh

# 5. (Optional) Set your OpenAI API key for LLM answers
#    Edit .env.local and set OPENAI_API_KEY=sk-...
#    Without it, the app uses TF-IDF retrieval (still works, just no LLM summary)

# 6. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo Walkthrough (for seminar/presentation)

### Step 1: Commit a Document
Click **"Commit Sample Document"** — this loads a built-in article about AI safety, chunks it into ~8 pieces, Poseidon-hashes each chunk, and builds a Merkle tree. The root hash appears as a public certificate.

### Step 2: Query the Document
Ask a question like _"What is the alignment problem?"_ — the RAG pipeline retrieves relevant chunks and generates an LLM answer with citations.

### Step 3: Verify a Citation (ZK)
Click **"Verify Citation (ZK)"** on any cited chunk. The system:
1. Generates a Groth16 proof (~1-3 seconds) that this chunk's Poseidon hash is a leaf in the Merkle tree
2. Verifies the SNARK proof independently
3. Shows ✅ **Cryptographically Verified**

### Step 4: Tamper Demo (the "aha" moment)
1. Click **"Tamper Demo"** on a cited chunk
2. Change even _one character_ of the text
3. Click **"Apply Tamper"**
4. Notice: the baseline citation still shows the edited text (the link still "works")
5. Click **"Verify Citation (ZK)"** again
6. Observe: ❌ **Provenance Invalid** — the Poseidon hash no longer matches the Merkle tree leaf

### Step 5: Benchmarks
Click **"Run Benchmark"** to see timing comparisons across all chunks:
- Baseline citation: ~0ms (just a lookup)
- Proof generation: ~1-3 seconds (the cost of mathematical certainty)
- Proof verification: ~100-300ms (fast, practical for real-time use)

## Architecture

```
ZK-RAG/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── commit/         # Document commitment (chunk → hash → Merkle)
│   │   ├── query/          # RAG pipeline (embed → retrieve → LLM)
│   │   ├── prove/          # Groth16 proof generation
│   │   ├── verify/         # Standalone SNARK verification
│   │   ├── tamper/         # Tamper demo (modify chunk text)
│   │   └── benchmark/      # Timing benchmarks
│   ├── globals.css         # Dark glassmorphism UI theme
│   ├── layout.js           # Root layout
│   └── page.js             # Three-panel interactive UI
├── circuits/
│   └── merkle_inclusion.circom   # Poseidon Merkle inclusion circuit
├── lib/
│   ├── poseidon.js         # Poseidon hash (circomlibjs wrapper)
│   ├── merkle.js           # Merkle tree builder
│   ├── chunker.js          # Text chunker
│   ├── embeddings.js       # OpenAI embeddings + TF-IDF fallback
│   ├── store.js            # In-memory document store
│   ├── prover.js           # Groth16 proof generation
│   └── verifier.js         # SNARK proof verification
├── data/
│   └── sample-document.txt # Built-in demo document
├── public/                 # Generated ZK artifacts
│   ├── circuit.wasm
│   ├── circuit_final.zkey
│   └── verification_key.json
└── scripts/
    └── setup.sh            # Automated trusted setup
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js (App Router), React |
| Styling | Vanilla CSS (dark glassmorphism) |
| ZK Circuit | Circom 2.x (Poseidon hash, Merkle tree) |
| Proving System | Groth16 via snarkjs |
| Hash Function | Poseidon (circomlibjs) — ZK-friendly |
| Embeddings | OpenAI `text-embedding-3-small` / TF-IDF fallback |
| LLM | OpenAI `gpt-4o-mini` (optional) |
| Charts | Chart.js |

## License

MIT
