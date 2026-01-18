const express = require("express");
const fs = require("fs");
const path = require("path");

const config = require("./config");
const store = require("./store");

const { makeUpstreamService } = require("./services/upstreamService");
const { makeTronService } = require("./services/tronService");
const { makeEthHandlers } = require("./handlers/ethHandlers");
const { makeRpcRouter } = require("./handlers/rpcRouter");

let artifactCache = {
  abi: [],
  contractName: "Contract",
  creationBytecodeNo0x: "",
  mtimeMs: 0,
};

function loadArtifact() {
  if (!config.FOUNDRY_ARTIFACT_PATH) return artifactCache;

  const p = path.resolve(config.FOUNDRY_ARTIFACT_PATH);
  if (!fs.existsSync(p)) return artifactCache;

  const stat = fs.statSync(p);
  if (stat.mtimeMs === artifactCache.mtimeMs && artifactCache.creationBytecodeNo0x) {
    return artifactCache;
  }

  const artifact = JSON.parse(fs.readFileSync(p, "utf8"));

  const contractName = path.basename(p, ".json");
  const abi = artifact.abi || [];

  // Foundry artifacts usually keep creation bytecode here:
  // artifact.bytecode.object (string) OR artifact.bytecode (string)
  const bytecodeObj =
    (artifact.bytecode && artifact.bytecode.object) ||
    artifact.bytecode ||
    "";

  const creationBytecodeNo0x = String(bytecodeObj).startsWith("0x")
    ? String(bytecodeObj).slice(2)
    : String(bytecodeObj);

  artifactCache = {
    abi,
    contractName: contractName || "Contract",
    creationBytecodeNo0x: creationBytecodeNo0x || "",
    mtimeMs: stat.mtimeMs,
  };

  console.log("Loaded artifact:", p);
  console.log("Contract name:", artifactCache.contractName);

  return artifactCache;
}

function getDeployAbi() {
  return loadArtifact().abi;
}

function getContractName() {
  return loadArtifact().contractName;
}

function getCreationBytecodeNo0x() {
  return loadArtifact().creationBytecodeNo0x;
}

loadArtifact();

const upstreamService = makeUpstreamService({ upstreamJsonRpcUrl: config.UPSTREAM_JSONRPC });

const tronService = makeTronService({
  tronNodeBase: config.TRON_NODE_BASE,
  tronPrivateKey: config.TRON_PRIVATE_KEY,
  feeLimitSun: config.FEE_LIMIT_SUN,
  originEnergyLimit: config.ORIGIN_ENERGY_LIMIT,
  userFeePercentage: config.USER_FEE_PERCENTAGE,
  getDeployAbi,
  getContractName,
  getCreationBytecodeNo0x,
});

console.log("Proxy signer (EVM 0x):", tronService.proxySignerEvm);

const ethHandlers = makeEthHandlers({ store, tronService, upstreamService });
const rpcRouter = makeRpcRouter({ ethHandlers, upstreamService });

const app = express();
app.use(express.json({ limit: "4mb" }));
app.post("/", rpcRouter);

app.listen(config.PORT, "127.0.0.1", () => {
  console.log(`tron-ethrpc-proxy listening on http://127.0.0.1:${config.PORT}`);
  console.log(`Forwarding reads to: ${config.UPSTREAM_JSONRPC}`);
});
