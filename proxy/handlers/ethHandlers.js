const ethersPkg = require("ethers");
const ethers = ethersPkg.ethers ?? ethersPkg;

const { toQuantityHex } = require("../utils/hex");

function makeEthHandlers({ store, tronService, upstreamService }) {
  const { proxySignerEvm } = tronService;

  async function eth_getTransactionCount(params) {
    const addr = (params?.[0] || "").toLowerCase();
    return toQuantityHex(store.getNextNonce(addr));
  }

  async function eth_estimateGas() {
    return toQuantityHex(8_000_000n);
  }

  async function eth_gasPrice() {
    return "0x2540be400"; // 10 gwei
  }

  /**
   * IMPORTANT: we return TRON txid as the "tx hash" to Forge:
   *   txHash = 0x + tronTxid
   *
   * Then Forge will call eth_getTransactionReceipt(txHash),
   * and we forward that to Chainstack /jsonrpc which DOES support it
   * and returns receipt.contractAddress -> so Forge won't throw "contract was not deployed".
   */
  async function eth_sendRawTransaction(params) {
    const rawTxHex = params?.[0];
    if (typeof rawTxHex !== "string" || !rawTxHex.startsWith("0x")) {
      throw new Error("eth_sendRawTransaction expects a 0x... hex string");
    }

    const tx = ethers.Transaction.from(rawTxHex);
    if (!tx.hash || !tx.from) {
      throw new Error("Failed to parse raw tx. Ensure forge uses --legacy.");
    }

    const senderLower = tx.from.toLowerCase();

    // Safety: proxy signer must match Forge sender
    if (proxySignerEvm && senderLower !== proxySignerEvm.toLowerCase()) {
      throw new Error(
        `Sender mismatch. RawTx sender=${senderLower} but proxy key maps to ${proxySignerEvm}. ` +
        `Use the same private key in forge and proxy.`
      );
    }

    store.bumpNonce(senderLower, BigInt(tx.nonce ?? 0));

    if (tx.value && tx.value !== 0n) {
      throw new Error("Non-zero tx.value not supported in this proxy.");
    }

    const dataHex = tx.data || "0x";
    const isCreate = tx.to == null;

    let result;
    if (isCreate) {
      const bytecodeNo0x = dataHex.startsWith("0x") ? dataHex.slice(2) : dataHex;
      result = await tronService.deployFromBytecode(bytecodeNo0x);
    } else {
      const toEvmLower = tx.to.toLowerCase();
      const dataNo0x = dataHex.slice(2);
      result = await tronService.triggerSmartContract({
        contractEvm0x: toEvmLower,
        ownerEvm0x: senderLower,
        dataHexNo0x: dataNo0x,
      });
    }

    if (!result?.result) {
      throw new Error("TRON broadcast failed: " + JSON.stringify(result));
    }

    // Return TRON txid as the tx hash to Forge
    const txHash = "0x" + String(result.txid);
    return txHash;
  }

  /**
   * Just forward to Chainstack TRON /jsonrpc.
   * You confirmed it returns contractAddress for deployments.
   */
  async function eth_getTransactionReceipt(params) {
    const txHash = params?.[0];
    const forwarded = await upstreamService.forward("eth_getTransactionReceipt", [txHash], 1);
    return forwarded?.result ?? null;
  }

  async function eth_getCode(params) {
    const addr = params?.[0];
    const tag = params?.[1] ?? "latest";
    const forwarded = await upstreamService.forward("eth_getCode", [addr, tag], 1);
    return forwarded?.result ?? "0x";
  }

  async function eth_getTransactionByHash(params) {
    const txHash = params?.[0];
    const forwarded = await upstreamService.forward("eth_getTransactionByHash", [txHash], 1);
    return forwarded?.result ?? null;
  }

  return {
    eth_getTransactionCount,
    eth_estimateGas,
    eth_gasPrice,
    eth_sendRawTransaction,
    eth_getTransactionReceipt,
    eth_getCode,
    eth_getTransactionByHash,
  };
}

module.exports = { makeEthHandlers };
