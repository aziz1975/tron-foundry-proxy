/**
 * In-memory store for:
 * - local nonces (because TRON doesn't provide eth_getTransactionCount)
 * - tx mapping (ethHash -> tron txid, expected create address, deployed TRON contract address)
 * - code cache (expected create -> bytecode) so eth_getCode(expected) is never "0x"
 *
 * NOTE: This resets on proxy restart.
 */

// TRON doesn't provide eth_getTransactionCount; we keep a proxy-local nonce counter.
const nextNonceByEvmAddr = new Map(); // evmAddrLower -> BigInt

function getNextNonce(addrLower) {
  return nextNonceByEvmAddr.get(addrLower) ?? 0n;
}

function bumpNonce(addrLower, seenNonce) {
  const current = getNextNonce(addrLower);
  const candidate = BigInt(seenNonce) + 1n;
  if (candidate > current) nextNonceByEvmAddr.set(addrLower, candidate);
}

module.exports = { getNextNonce, bumpNonce };
