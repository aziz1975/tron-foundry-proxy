const { rpcResult, rpcError } = require("../utils/jsonrpc");

function makeRpcRouter({ ethHandlers, upstreamService }) {
  return async function rpcRouter(req, res) {
    const { id, jsonrpc, method, params } = req.body || {};

    if (jsonrpc !== "2.0" || typeof method !== "string") {
      return res.status(400).json(rpcError(id ?? null, -32600, "Invalid Request"));
    }

    try {
      if (method === "eth_getTransactionCount") {
        return res.json(rpcResult(id, await ethHandlers.eth_getTransactionCount(params)));
      }
      if (method === "eth_estimateGas") {
        return res.json(rpcResult(id, await ethHandlers.eth_estimateGas(params)));
      }
      if (method === "eth_gasPrice") {
        return res.json(rpcResult(id, await ethHandlers.eth_gasPrice(params)));
      }
      if (method === "eth_sendRawTransaction") {
        return res.json(rpcResult(id, await ethHandlers.eth_sendRawTransaction(params)));
      }
      if (method === "eth_getTransactionReceipt") {
        return res.json(rpcResult(id, await ethHandlers.eth_getTransactionReceipt(params)));
      }
      if (method === "eth_getCode") {
        return res.json(rpcResult(id, await ethHandlers.eth_getCode(params)));
      }
      if (method === "eth_getTransactionByHash") {
        return res.json(rpcResult(id, await ethHandlers.eth_getTransactionByHash(params)));
      }

      // forward everything else
      const forwarded = await upstreamService.forward(method, params, id);
      return res.json(forwarded);
    } catch (e) {
      return res.json(rpcError(id, -32603, "Internal error", String(e?.message || e)));
    }
  };
}

module.exports = { makeRpcRouter };
