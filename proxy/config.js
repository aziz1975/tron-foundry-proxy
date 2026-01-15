const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

function stripTrailingSlash(u) {
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

/**
 * Load .env from a few common locations so it works whether you run:
 * - node proxy/index.js       (cwd = project root)
 * - cd proxy && node index.js (cwd = proxy)
 */
function loadEnv() {
  const candidates = [
    path.join(process.cwd(), ".env"),          // wherever you run node from
    path.join(__dirname, ".env"),              // proxy/.env
    path.resolve(__dirname, "..", ".env"),     // project root .env (parent of proxy/)
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      return;
    }
  }

  // last fallback: default dotenv behavior (cwd/.env)
  dotenv.config();
}

loadEnv();

const PORT = Number(process.env.PORT || 8545);

/**
 * Prefer CHAINSTACK_BASE_ENDPOINT.
 * If user has TRON_RPC_URL that ends with /jsonrpc, derive the base automatically.
 */
function deriveBaseEndpoint() {
  let base =
    (process.env.CHAINSTACK_BASE_ENDPOINT || process.env.TRON_NODE_BASE || "").trim();

  if (!base) {
    const rpc = (process.env.TRON_RPC_URL || "").trim();
    if (rpc) {
      base = rpc.replace(/\/(jsonrpc|wallet|walletsolidity)\/?$/i, "");
    }
  }

  base = stripTrailingSlash(base);
  return base;
}

const CHAINSTACK_BASE_ENDPOINT = deriveBaseEndpoint();

if (!CHAINSTACK_BASE_ENDPOINT.startsWith("http")) {
  throw new Error(
    "Missing/invalid CHAINSTACK_BASE_ENDPOINT. Add one of these to your .env:\n" +
      '  CHAINSTACK_BASE_ENDPOINT="https://tron-nile.core.chainstack.com/<token>"\n' +
      "or\n" +
      '  TRON_RPC_URL="https://tron-nile.core.chainstack.com/<token>/jsonrpc"'
  );
}

const UPSTREAM_JSONRPC = `${CHAINSTACK_BASE_ENDPOINT}/jsonrpc`;
const TRON_NODE_BASE = CHAINSTACK_BASE_ENDPOINT;

/**
 * Private key: allow either TRON_PRIVATE_KEY or PRIVATE_KEY (your Foundry env).
 */
const TRON_PRIVATE_KEY = (process.env.TRON_PRIVATE_KEY || process.env.PRIVATE_KEY || "").trim();
if (!TRON_PRIVATE_KEY) {
  throw new Error(
    'Missing TRON_PRIVATE_KEY (or PRIVATE_KEY). Add to your .env:\n  TRON_PRIVATE_KEY="0x..."'
  );
}

const FEE_LIMIT_SUN = Number(process.env.FEE_LIMIT_SUN || 150000000);
const ORIGIN_ENERGY_LIMIT = Number(process.env.ORIGIN_ENERGY_LIMIT || 10000000);
const USER_FEE_PERCENTAGE = Number(process.env.USER_FEE_PERCENTAGE || 100);

const CONTRACT_NAME = process.env.CONTRACT_NAME || "Contract";
const FOUNDRY_ARTIFACT_PATH = process.env.FOUNDRY_ARTIFACT_PATH || "";

module.exports = {
  PORT,
  CHAINSTACK_BASE_ENDPOINT,
  UPSTREAM_JSONRPC,
  TRON_NODE_BASE,
  TRON_PRIVATE_KEY,
  FEE_LIMIT_SUN,
  ORIGIN_ENERGY_LIMIT,
  USER_FEE_PERCENTAGE,
  CONTRACT_NAME,
  FOUNDRY_ARTIFACT_PATH,
};
