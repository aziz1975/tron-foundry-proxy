const express = require("express");
const fs = require("fs");
const path = require("path");

const config = require("./config");
const store = require("./store");

const { makeUpstreamService } = require("./services/upstreamService");
const { makeTronService } = require("./services/tronService");
const { makeEthHandlers } = require("./handlers/ethHandlers");
const { makeRpcRouter } = require("./handlers/rpcRouter");

// Artifact cache (ABI + contract name) with auto-reload by mtime
let artifactCache = {
  abi: [],
  contractName: "Contract",
  mtimeMs: 0,
};

function loadArtifact() {
  if (!config.FOUNDRY_ARTIFACT_PATH) return artifactCache;

  const artifactPath = path.resolve(config.FOUNDRY_ARTIFACT_PATH);
  if (!fs.existsSync(artifactPath)) return artifactCache;

  const stat = fs.statSync(artifactPath);
  if (stat.mtimeMs === artifactCache.mtimeMs && artifactCache.abi.length) {
    return artifactCache;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Derive name from file: out/Counter.sol/Counter.json -> "Counter"
  const derivedName = path.basename(artifactPath, ".json");

  artifactCache = {
    abi: artifact.abi || [],
    contractName: derivedName || "Contract",
    mtimeMs: stat.mtimeMs,
  };

  console.log("Loaded artifact from:", artifactPath);
  console.log("Contract name:", artifactCache.contractName);

  return artifactCache;
}

function getDeployAbi() {
  return loadArtifact().abi;
}

function getContractName() {
  return loadArtifact().contractName;
}

// Initial load (optional)
loadArtifact();

const upstreamService = makeUpstreamService({
  upstreamJsonRpcUrl: config.UPSTREAM_JSONRPC,
});

const tronService = makeTronService({
  tronNodeBase: config.TRON_NODE_BASE,
  tronPrivateKey: config.TRON_PRIVATE_KEY,
  feeLimitSun: config.FEE_LIMIT_SUN,
  originEnergyLimit: config.ORIGIN_ENERGY_LIMIT,
  userFeePercentage: config.USER_FEE_PERCENTAGE,
  getDeployAbi,
  getContractName, 
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
