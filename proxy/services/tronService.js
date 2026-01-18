const TronWebPkg = require("tronweb");
const TronWeb = TronWebPkg.TronWeb || TronWebPkg.default || TronWebPkg;

function makeTronService({
  tronNodeBase,
  tronPrivateKey,
  feeLimitSun,
  originEnergyLimit,
  userFeePercentage,
  getDeployAbi,
  getContractName,
  getCreationBytecodeNo0x,
}) {
  const tronWeb = new TronWeb({
    fullHost: tronNodeBase,
    privateKey: tronPrivateKey,
  });

  const proxySignerBase58 = tronWeb.defaultAddress.base58;
  const proxySignerHex = tronWeb.defaultAddress.hex; // 41 + 20 bytes
  const proxySignerEvm = "0x" + proxySignerHex.slice(2);

  function tronSuccess(info) {
    const r = info?.receipt?.result;
    return r === "SUCCESS" || r === "SUCESS";
  }

  function getAbi() {
    return typeof getDeployAbi === "function" ? getDeployAbi() : [];
  }

  function getName() {
    return typeof getContractName === "function" ? getContractName() : "Contract";
  }

  function getCreationBytecode() {
    return typeof getCreationBytecodeNo0x === "function" ? getCreationBytecodeNo0x() : "";
  }

  async function deployWithAbiAndParams({ bytecodeNo0x, constructorAbi, constructorParams }) {
    const abi = getAbi();
    const name = getName();

    const hasTuple = Array.isArray(constructorAbi?.inputs) && constructorAbi.inputs.some((i) => String(i.type).includes("tuple"));

    const options = {
      abi,
      bytecode: bytecodeNo0x,
      feeLimit: feeLimitSun,
      callValue: 0,
      userFeePercentage,
      originEnergyLimit,
      name,
    };

    if (constructorParams && constructorParams.length > 0) {
      if (hasTuple) {
        options.funcABIV2 = constructorAbi;
        options.parametersV2 = constructorParams;
      } else {
        options.parameters = constructorParams;
      }
    }

    const unsigned = await tronWeb.transactionBuilder.createSmartContract(options, proxySignerBase58);
    const signed = await tronWeb.trx.sign(unsigned);
    return tronWeb.trx.sendRawTransaction(signed);
  }

  async function getTransactionInfo(txid) {
    return tronWeb.trx.getTransactionInfo(txid);
  }

  async function getContractBytecodeByHex41(tronContractHex41) {
    try {
      const base58 = tronWeb.address.fromHex(tronContractHex41);
      const c = await tronWeb.trx.getContract(base58);

      const bc =
        c?.bytecode ||
        c?.byteCode ||
        c?.runtimeBytecode ||
        c?.runtime_bytecode ||
        null;

      if (typeof bc === "string" && bc.length > 0) {
        return bc.startsWith("0x") ? bc : "0x" + bc;
      }
    } catch {}
    return "0x";
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
    tronSuccess,
    getAbi,
    getCreationBytecode,
    deployWithAbiAndParams,
    triggerSmartContract,
    getTransactionInfo,
    getContractBytecodeByHex41,
  };
}

module.exports = { makeTronService };
