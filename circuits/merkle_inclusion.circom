pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

// Helper: switches two inputs based on a selector bit
template PositionSwitcher() {
    signal input in[2];
    signal input s; // 0 or 1

    signal output out[2];

    // Constrain s to be binary
    s * (1 - s) === 0;

    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// Merkle inclusion proof: proves a leaf is part of a Merkle tree with given root
// Public inputs: root, leaf
// Private inputs: pathElements (sibling hashes), pathIndices (left/right bits)
template MerkleInclusion(levels) {
    // Public inputs
    signal input root;
    signal input leaf;

    // Private inputs
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component selectors[levels];
    component hashers[levels];

    signal computedHash[levels + 1];
    computedHash[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        selectors[i] = PositionSwitcher();
        selectors[i].in[0] <== computedHash[i];
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== selectors[i].out[0];
        hashers[i].inputs[1] <== selectors[i].out[1];

        computedHash[i + 1] <== hashers[i].out;
    }

    // The computed root must match the provided root
    root === computedHash[levels];
}

// Main component: 4 levels supports up to 16 chunks
component main {public [root, leaf]} = MerkleInclusion(4);
