# TRON Foundry Demo (Foundry + TRON via Local JSON-RPC Proxy)

This repo demonstrates how to use **Foundry (forge/cast)** to **compile and deploy Solidity contracts to TRON (Nile)** using a small **Node.js JSON-RPC proxy**.

The key idea is:

- Foundry expects Ethereum-style RPC methods like `eth_sendRawTransaction` and `eth_getTransactionCount`.
- Many TRON JSON-RPC endpoints do not support those write methods directly.
- This proxy accepts Foundry’s `eth_sendRawTransaction` requests, converts them into **TRON-native deploy/broadcast** calls using **TronWeb**, and forwards read-only RPC calls to a **TRON JSON-RPC `/jsonrpc`** endpoint (e.g., TronGrid).

---

## Project Structure

```
.
├── .env
├── .env.sample
├── .github
│   └── workflows
├── .gitignore
├── .gitmodules
├── .husky
│   ├── _
│   └── pre-commit
├── README.md
├── foundry.lock
├── foundry.toml
├── lib
│   ├── forge-std
│   └── openzeppelin-contracts
├── package-lock.json
├── package.json
├── proxy
│   ├── config.js
│   ├── handlers
│   ├── index.js
│   ├── services
│   ├── store.js
│   └── utils
├── script
│   └── Counter.s.sol
├── src
│   ├── Counter.sol
│   ├── Greeter.sol
│   └── OZCounter.sol
├── test
│   └── Counter.t.sol
└── tools
    └── tron-solc
```

---

## Useful links

- Repo: https://github.com/aziz1975/tron-foundry-proxy
- Foundry: https://getfoundry.sh/
- `forge create` reference: https://getfoundry.sh/forge/reference/create/
- Foundry CI guide: https://getfoundry.sh/config/continuous-integration/
- TronGrid docs: https://www.trongrid.io/documents
- OpenZeppelin Contracts: https://github.com/OpenZeppelin/openzeppelin-contracts

---

## Requirements

- Node.js (Node 20+)
- Foundry (forge/cast)
- TRON endpoint (TronGrid): base endpoint + `/jsonrpc`
- TRX on Nile for the deployer address
- TRON Solidity compiler binary: `tools/tron-solc/solc-tron-0.8.23` (for deployment builds)

---

## Install Foundry (forge/cast)

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Verify:

```bash
forge --version
cast --version
```

---

## Clone Repository

```bash
git clone [https://github.com/aziz1975/tron-foundry-proxy](https://github.com/aziz1975/tron-foundry-proxy)
cd tron-foundry-proxy
```

## Install dependencies

```bash
npm install #Proxy dependencies
forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.5.0 #Contracts dependencies
```

---

## Configure TRON endpoint (TronGrid example)

- Nile: `https://nile.trongrid.io`
- Shasta: `https://api.shasta.trongrid.io`
- Mainnet: `https://api.trongrid.io`

Your proxy will forward reads to: `<BASE>/jsonrpc`.

---

## Environment Variables (`.env`)

Copy sample:

```bash
cp .env.sample .env
```

Adjust EnvVars if needed e.g:

* `TRON_BASE_ENDPOINT`
* `FOUNDRY_ARTIFACT_PATH`

Every time you change `.env`, reload it in your terminal **and restart the proxy**:

```bash
set -a; source .env; set +a
node proxy/index.js
```

## Run the proxy

Open a separate terminal window and keep the ethjsonrpc-tron proxy running:

`node proxy/index.js`

## Create a Keystore

We can use a keystore encrypted with a password for enhanced security.

`cast wallet import yourKeyName --private-key 0xYOUR_PRIVATE_KEY`

## Build artifacts before deploying

```bash
forge clean
forge build
```

## Deploy contracts via Foundry (through the proxy)

### Counter (no constructor args)

```bash
forge create src/Counter.sol:Counter --keystore ~/.foundry/keystores/yourKeyName --legacy --broadcast -vvvv
```

After deployment, Forge prints output similar to this:

```text
Deployer: 0xE57Ea93173DeA454EfF302E48E58DbA4F942dDBb
Deployed to: 0xb73d26849904b82435b64eE5F44A132873e6A4ad
Transaction hash: 0x2fab7cc68e1e5c9983508a58810dc6ea3e18f861834ad98402ea4ea6cd920f4a
```

To check the transaction on Tronscan, copy the **Transaction hash**, remove the `0x` prefix, and search the remaining value (the txid) on Tronscan.

### Greeter (constructor string)

```bash
forge create src/Greeter.sol:Greeter --keystore ~/.foundry/keystores/yourKeyName --legacy --broadcast --constructor-args "Hello World" -vvvv
```

### OZCounter (imports OpenZeppelin, constructor address)

Optional: Generate `DEPLOYER_ADDRESS` (owner) in .env file:

```bash
echo "DEPLOYER_ADDRESS=$(cast wallet address --keystore ~/.foundry/keystores/yourKeyName)" >> .env
```

Deploy:

```bash
forge create src/OZCounter.sol:OZCounter --keystore ~/.foundry/keystores/yourKeyName --legacy --broadcast --constructor-args "$DEPLOYER_ADDRESS_IN_HEX" -vvvv
```

---

## Tests (EVM only)

### Why a special profile?

TRON’s compiler produces bytecode that the local EVM test runner may not execute.
So tests must use standard Solidity compilation.
Use the `test` profile (standard solc). **Run `forge clean` before `forge test`**.

```bash
forge clean
FOUNDRY_PROFILE="test" forge test
```

Interactive debug:

```bash
forge clean
FOUNDRY_PROFILE="test" forge test --debug   --match-contract "CounterTest"   --match-test "test_increment_usesLibrary"   -vvvv
```

---

## Limitations and next improvements

### Feature support matrix


| Feature / Command                                               | Supported by this proxy | Notes / Workaround                                                               |
| --------------------------------------------------------------- | ----------------------: | -------------------------------------------------------------------------------- |
| `forge create` (deploy)                                         |                  ✅ Yes | Works via`eth_sendRawTransaction` translation to TRON-native deploy/broadcast.   |
| `forge create` + constructor args                               |                  ✅ Yes | Works.                                                                           |
| Imports (local`import "./MathLib.sol"`), Imports (OpenZeppelin) |                  ✅ Yes | Works.                                                                           |
| forge debug                                                     |            ⚠️ Partial | Works with standard Solidity compiler. Using the command`forge test --debug ...` |
| `forge test` using **TRON solc**                                |                   ❌ No | TRON compiler output is not compatible with Foundry’s local EVM runner.         |
| `forge test` using standard solc (`FOUNDRY_PROFILE=test`)       |                  ✅ Yes | Recommended workflow for unit tests. Run`forge clean` first.                     |
| `forge coverage`                                                |                  ✅ Yes | Works                                                                            |
| `forge fmt`                                                     |                  ✅ Yes | Works                                                                            |
| Forking /`anvil --fork-url ...`                                 |                   ❌ No | Requires much broader RPC parity than this proxy provides.                       |
| `forge verify-contract`                                         |                   ❌ No | Use Tronscan verification flow instead.                                          |

---

## CI (GitHub Actions)

The workflow installs OpenZeppelin and runs build/test using profile `ci` (standard solc). See `.github/workflows/test.yml`.

---

## Common Commands (Quick Reference)

### Load environment variables into the shell

```bash
set -a; source .env; set +a
```

### Start the proxy server

```bash
node proxy/index.js
```

### Clean and build artifacts

```bash
forge clean
forge build
```

### Deploy Counter

```bash
forge create src/Counter.sol:Counter --keystore ~/.foundry/keystores/yourKeyName --legacy --broadcast -vvvv

```

### Deploy Greeter with constructor args

```bash
forge create src/Greeter.sol:Greeter --keystore ~/.foundry/keystores/yourKeyName --legacy --broadcast --constructor-args "Hello World" -vvvv

```

### Deploy OZCounter with constructor args

```bash
forge create src/OZCounter.sol:OZCounter --keystore ~/.foundry/keystores/yourKeyName --legacy --broadcast --constructor-args "$DEPLOYER_ADDRESS_IN_HEX" -vvvv

```

### Install OpenZeppelin

```bash
forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.5.0
```

### Generate deployer address for OZCounter

```bash
echo "DEPLOYER_ADDRESS=$(cast wallet address --keystore ~/.foundry/keystores/yourKeyName)" >> .env
```

### Run tests with standard solc

```bash
FOUNDRY_PROFILE="test" forge test
```

### Debug a test

```bash
FOUNDRY_PROFILE="test" forge test --debug --match-contract "CounterTest" --match-test "test_increment_usesLibrary" -vvvv
```

### Code coverage

```bash
FOUNDRY_PROFILE="test" forge coverage
```

### Code format

```bash
forge fmt
```

---

## Notes / Troubleshooting

### 1) “Cannot split constructor args from tx.data”

This usually means:

- The automated artifacted finder in the proxy had a problem to locate your contract json artifact.

Fix:

1. Make sure you compiled contracts properly
2. Limitation on how the artifact finder script works, debug on wether your bytecode contains a "000000000" string, constructor strip function in artifactPath.js might have encounter an exception there.

### 2) Tronscan “No Data” (no Read/Write UI)

This usually means Tronscan doesn’t have the ABI metadata.
Option A is easiest: upload/verify ABI on Tronscan.

### 3) After changing `.env`

Always:

```bash
set -a; source .env; set +a
node proxy/index.js
```

### 4) OpenZeppelin import errors in CI

Make sure CI installs OZ or runs `forge install`. This repo’s workflow installs OZ explicitly.

---

## License

MIT
