function toQuantityHex(n) {
  const bi = typeof n === "bigint" ? n : BigInt(n);
  return "0x" + bi.toString(16);
}

module.exports = { toQuantityHex };

