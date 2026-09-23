import "./globals.css";

export const metadata = {
  title: "ZK-RAG — Zero-Knowledge Retrieval-Augmented Generation",
  description: "Prove an AI's cited source chunk cryptographically exists inside a hashed document, without revealing the rest of the document. Merkle commitment + SNARK proof replaces bare citation links with mathematical guarantees of provenance.",
  keywords: "zero-knowledge, ZK-SNARK, RAG, retrieval augmented generation, Poseidon hash, Merkle tree, Groth16, provenance",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
