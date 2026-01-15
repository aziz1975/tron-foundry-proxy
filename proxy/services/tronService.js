const TronWebPkg = require("tronweb");
const TronWeb = TronWebPkg.TronWeb || TronWebPkg.default || TronWebPkg;

function makeTronService({
  tronNodeBase,
  tronPrivateKey,
  feeLimitSun,
  originEnergyLimit,
  userFeePercentage,
  contractName,
  deployAbi,
}) {
  const tronWeb = new TronWeb({
    fullHost: tronNodeBase,
    privateKey: tronPrivateKey,
  });

  const proxySignerBase58 = tronWeb.defaultAddress.base58;
  const proxySignerHex = tronWeb.defaultAddress.hex; // 41 + 20 bytes
  const proxySignerEvm = "0x" + proxySignerHex.slice(2);

  async function deployFromBytecode(bytecodeHexNo0x) {
    const unsigned = await tronWeb.transactionBuilder.createSmartContract(
      {
        abi: deployAbi || [],
        bytecode: bytecodeHexNo0x,
        feeLimit: feeLimitSun,
        callValue: 0,
        userFeePercentage,
        originEnergyLimit,
        name: contractName,
      },
      proxySignerBase58
    );

    const signed = await tronWeb.trx.sign(unsigned);
    return tronWeb.trx.sendRawTransaction(signed);
  }

  async function triggerSmartContract({ contractEvm0x, ownerEvm0x, dataHexNo0x, feeLimitSunOverride }) {
    const contractHex41 = "41" + contractEvm0x.slice(2).toLowerCase();
    const ownerHex41 = "41" + ownerEvm0x.slice(2).toLowerCase();

    const unsignedWrap = await tronWeb.fullNode.request(
      "wallet/triggersmartcontract",
      {
        contract_address: contractHex41,
        owner_address: ownerHex41,
        data: dataHexNo0x,
        call_value: 0,
        fee_limit: feeLimitSunOverride ?? feeLimitSun,
        visible: false,
      },
      "post"
    );

    const unsignedTx = unsignedWrap?.transaction || unsignedWrap;
    const signed = await tronWeb.trx.sign(unsignedTx);
    return tronWeb.trx.sendRawTransaction(signed);
  }

  return {
    tronWeb,
    proxySignerBase58,
    proxySignerHex,
    proxySignerEvm,
    deployFromBytecode,
    triggerSmartContract,
  };
}

module.exports = { makeTronService };
