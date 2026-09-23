#!/bin/bash
set -e

# ZK-RAG Trusted Setup Script
# Compiles the Merkle inclusion circuit and generates Groth16 proving/verification keys

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CIRCUIT_DIR="$PROJECT_DIR/circuits"
BUILD_DIR="$PROJECT_DIR/circuits/build"
PUBLIC_DIR="$PROJECT_DIR/public"

echo "🔐 ZK-RAG Trusted Setup"
echo "========================"
echo ""

# Ensure circom is available
source "$HOME/.cargo/env" 2>/dev/null || true
if ! command -v circom &> /dev/null; then
    echo "❌ circom not found. Install it first:"
    echo "   git clone https://github.com/iden3/circom.git && cd circom && cargo install --path circom"
    exit 1
fi

# Ensure snarkjs is available
if ! command -v snarkjs &> /dev/null; then
    echo "⚠️  snarkjs not found globally, using npx..."
    SNARKJS="npx snarkjs"
else
    SNARKJS="snarkjs"
fi

echo "✅ circom version: $(circom --version)"
echo ""

# Create build directory
mkdir -p "$BUILD_DIR"
mkdir -p "$PUBLIC_DIR"

# Step 1: Compile the circuit
echo "📐 Step 1: Compiling circuit..."
circom "$CIRCUIT_DIR/merkle_inclusion.circom" \
    --r1cs --wasm --sym \
    -o "$BUILD_DIR" \
    -l "$PROJECT_DIR/node_modules"

echo "   ✅ Circuit compiled ($(wc -c < "$BUILD_DIR/merkle_inclusion.r1cs" | tr -d ' ') bytes R1CS)"
echo ""

# Step 2: Powers of Tau ceremony
echo "🏛️  Step 2: Powers of Tau ceremony..."
PTAU_FILE="$BUILD_DIR/pot12_0000.ptau"
PTAU_FINAL="$BUILD_DIR/pot12_final.ptau"

if [ -f "$PTAU_FINAL" ]; then
    echo "   ⏩ Reusing existing Powers of Tau file"
else
    $SNARKJS powersoftau new bn128 12 "$PTAU_FILE" -v
    echo "   Contributing randomness..."
    $SNARKJS powersoftau contribute "$PTAU_FILE" "$BUILD_DIR/pot12_0001.ptau" \
        --name="ZK-RAG Demo" -v -e="$(head -c 64 /dev/urandom | xxd -p -c 128)"
    echo "   Preparing phase 2..."
    $SNARKJS powersoftau prepare phase2 "$BUILD_DIR/pot12_0001.ptau" "$PTAU_FINAL" -v
    echo "   ✅ Powers of Tau complete"
fi
echo ""

# Step 3: Groth16 setup
echo "🔑 Step 3: Groth16 setup..."
ZKEY_INIT="$BUILD_DIR/merkle_inclusion_0000.zkey"
ZKEY_FINAL="$BUILD_DIR/merkle_inclusion_final.zkey"

$SNARKJS groth16 setup "$BUILD_DIR/merkle_inclusion.r1cs" "$PTAU_FINAL" "$ZKEY_INIT"
echo "   Contributing to zkey..."
$SNARKJS zkey contribute "$ZKEY_INIT" "$ZKEY_FINAL" \
    --name="ZK-RAG Contributor" -v -e="$(head -c 64 /dev/urandom | xxd -p -c 128)"
echo "   ✅ Groth16 setup complete"
echo ""

# Step 4: Export verification key
echo "📤 Step 4: Exporting verification key..."
$SNARKJS zkey export verificationkey "$ZKEY_FINAL" "$BUILD_DIR/verification_key.json"
echo "   ✅ Verification key exported"
echo ""

# Step 5: Copy artifacts to public directory
echo "📦 Step 5: Copying artifacts to public/..."
cp "$BUILD_DIR/merkle_inclusion_js/merkle_inclusion.wasm" "$PUBLIC_DIR/circuit.wasm"
cp "$ZKEY_FINAL" "$PUBLIC_DIR/circuit_final.zkey"
cp "$BUILD_DIR/verification_key.json" "$PUBLIC_DIR/verification_key.json"

echo "   ✅ circuit.wasm          → public/circuit.wasm"
echo "   ✅ circuit_final.zkey    → public/circuit_final.zkey"
echo "   ✅ verification_key.json → public/verification_key.json"
echo ""

# Summary
echo "========================"
echo "🎉 Trusted setup complete!"
echo ""
echo "Circuit info:"
$SNARKJS r1cs info "$BUILD_DIR/merkle_inclusion.r1cs"
echo ""
echo "You can now run: npm run dev"
