const ethersPkg = require("ethers");
const ethers = ethersPkg.ethers ?? ethersPkg;

const { toQuantityHex } = require("../utils/hex");

require("dotenv").config();

/**
 * Loads findArtifacts from ../utils/artifactPath.js.
 * - If artifactPath.js is CommonJS: require() works.
 * - If artifactPath.js is ESM: we fall back to dynamic import().
 */
let _findArtifactsFn = null;
async function getFindArtifacts() {
  if (_findArtifactsFn) return _findArtifactsFn;

  try {
    // CommonJS path
    // eslint-disable-next-line global-require
    const mod = require("../utils/artifactPath.js");
    _findArtifactsFn = mod.findArtifacts;
    return _findArtifactsFn;
  } catch (_) {
    // ESM path
    const mod = await import("../utils/artifactPath.js");
    _findArtifactsFn = mod.findArtifacts;
    return _findArtifactsFn;
  }
}

function makeEthHandlers({ store, tronService, upstreamService, setFoundryArtifactPath }) {
  const { proxySignerEvm, tronWeb } = tronService;

  async function eth_getTransactionCount(params) {
    const addr = (params?.[0] || "").toLowerCase();
    return toQuantityHex(store.getNextNonce(addr));
  }

  async function eth_estimateGas() {
    return toQuantityHex(8_000_000n);
  }

  async function eth_gasPrice() {
    return "0x2540be400";
  }

  function getConstructorAbi(abi) {
    if (!Array.isArray(abi)) return null;
    return abi.find((x) => x && x.type === "constructor") || null;
  }

  function normalizeValue(value, abiInput) {
    const t = String(abiInput.type);

    if (t === "address") {
      const evm = String(value).toLowerCase();
      const tronHex = "41" + evm.slice(2);
      return tronWeb.address.fromHex(tronHex);
    }

    if (t.startsWith("uint") || t.startsWith("int")) {
      return typeof value === "bigint" ? value.toString() : String(value);
    }

    if (t === "string") return String(value);
    if (t === "bool") return Boolean(value);

    if (t.startsWith("bytes")) {
      if (typeof value === "string") return value;
      return "0x" + Buffer.from(value).toString("hex");
    }

    if (t.endsWith("]")) {
      const baseType = t.replace(/\[[^\]]*\]$/, "");
      const baseInput = { ...abiInput, type: baseType };
      return Array.from(value).map((v) => normalizeValue(v, baseInput));
    }

    if (t.startsWith("tuple")) {
      const comps = abiInput.components || [];
      const arr = Array.from(value);
      return comps.map((c, i) => normalizeValue(arr[i], c));
    }

    return value;
  }

  async function eth_sendRawTransaction(params) {
    // Foundry workflow: automatically search for artifact match and update proxy artifact path.
    const FOUNDRY_WORKFLOW = true;

    if (FOUNDRY_WORKFLOW === true) {
      const artifactsFolder = process.env.FOUNDRY_ARTIFACT_PATH;

      // Decode RLP and extract the "data"/initcode field for matching.
      const decodedRLP = ethers.decodeRlp(params[0]);
      const byteCodeToMatch = decodedRLP[5];

      const findArtifacts = await getFindArtifacts();

      console.log("Looking for an artifact match...");
      const matches = await findArtifacts(artifactsFolder, byteCodeToMatch);

      if (!matches || matches.length === 0) {
        console.log(`No artifacts found containing "${byteCodeToMatch}"`);
      } else {
        console.log("Found in!");
        const foundryArtifact = matches[0];
        console.log(foundryArtifact);

        if (typeof setFoundryArtifactPath === "function") {
          setFoundryArtifactPath(foundryArtifact);
        }
      }
    }

    const rawTxHex = params?.[0];
    if (typeof rawTxHex !== "string" || !rawTxHex.startsWith("0x")) {
      throw new Error("eth_sendRawTransaction expects a 0x... hex string");
    }

    const tx = ethers.Transaction.from(rawTxHex);
    if (!tx.hash || !tx.from) {
      throw new Error("Failed to parse raw tx. Ensure forge uses --legacy.");
    }

    const senderLower = tx.from.toLowerCase();

    if (proxySignerEvm && senderLower !== proxySignerEvm.toLowerCase()) {
      throw new Error(
        `Sender mismatch. RawTx sender=${senderLower} but proxy key maps to ${proxySignerEvm}.`
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
      const abi = tronService.getAbi();
      const ctor = getConstructorAbi(abi);
      const creationNo0x = tronService.getCreationBytecode();

      const fullNo0x = dataHex.slice(2);

      if (!creationNo0x || !fullNo0x.startsWith(creationNo0x)) {
        throw new Error(
          "Cannot split constructor args from tx.data. " +
            "Make sure FOUNDRY_ARTIFACT_PATH points to the correct contract artifact and that the contract was recompiled."
        );
      }

      const argsNo0x = fullNo0x.slice(creationNo0x.length);

      let ctorParams = [];
      if (ctor && Array.isArray(ctor.inputs) && ctor.inputs.length > 0) {
        const types = ctor.inputs.map((inp) => ethers.ParamType.from(inp).format("full"));
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(types, "0x" + argsNo0x);
        ctorParams = ctor.inputs.map((inp, i) => normalizeValue(decoded[i], inp));
      }

      result = await tronService.deployWithAbiAndParams({
        bytecodeNo0x: creationNo0x,
        constructorAbi: ctor,
        constructorParams: ctorParams,
      });
    } else {
      const toEvmLower = tx.to.toLowerCase();
      result = await tronService.triggerSmartContract({
        contractEvm0x: toEvmLower,
        ownerEvm0x: senderLower,
        dataHexNo0x: dataHex.slice(2),
      });
    }

    if (!result?.result) {
      throw new Error("TRON broadcast failed: " + JSON.stringify(result));
    }

    return "0x" + String(result.txid);
  }

  async function eth_getTransactionReceipt(params) {
    const txHash = params?.[0];
    const forwarded = await upstreamService.forward("eth_getTransactionReceipt", [txHash], 1);
    return forwarded?.result ?? null;
  }

  async function eth_getCode(params) {
    const addr = params?.[0];
    const tag = normalizeBlockTag(params?.[1]);
    const forwarded = await upstreamService.forward("eth_getCode", [addr, tag], 1);
    return forwarded?.result ?? "0x";
  }

  function normalizeBlockTag(tag) {
    if (tag == null) return "latest";
    if (typeof tag === "string") {
      if (tag === "latest" || tag === "earliest" || tag === "pending") return tag;
      if (tag.startsWith("0x")) return "latest";
      return "latest";
    }
    return "latest";
  }

  async function eth_getBalance(params) {
    const addr = params?.[0];
    const tag = normalizeBlockTag(params?.[1]);
    const forwarded = await upstreamService.forward("eth_getBalance", [addr, tag], 1);
    return forwarded?.result ?? "0x0";
  }

  async function eth_getStorageAt(params) {
    const addr = params?.[0];
    const slot = params?.[1];
    const tag = normalizeBlockTag(params?.[2]);
    const forwarded = await upstreamService.forward("eth_getStorageAt", [addr, slot, tag], 1);
    return forwarded?.result ?? "0x0";
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
    eth_getBalance,
    eth_getStorageAt,
    eth_getTransactionReceipt,
    eth_getCode,
    eth_getTransactionByHash,
  };
}

module.exports = { makeEthHandlers };
