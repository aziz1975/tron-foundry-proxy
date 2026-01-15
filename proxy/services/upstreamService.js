const axios = require("axios");

function makeUpstreamService({ upstreamJsonRpcUrl }) {
  async function forward(method, params, id = 1) {
    const payload = { jsonrpc: "2.0", id, method, params: params ?? [] };
    const r = await axios.post(upstreamJsonRpcUrl, payload, { timeout: 20_000 });
    return r.data;
  }
  return { forward };
}

module.exports = { makeUpstreamService };
