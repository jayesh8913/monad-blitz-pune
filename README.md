# 🤖 Monad Sentiment Quant & NFT Hub

An autonomous video-to-chain quantitative trading and commemorative NFT minting platform built natively for the **Monad Testnet**. 

This platform leverages AI agent workflows to ingest YouTube narrative media, parse transcripts, run sentiment-model classification, execute token swaps on-chain, and issue ERC-8004 agent credentials.

---

## 🚀 Key Features

*   **🎬 Autonomous Narrative Scanning**: Extracts video transcript data and utilizes Llama-3 (Groq API) and key-phrase classifiers to determine market sentiment (`BULLISH`, `BEARISH`, `NEUTRAL`).
*   **⛓️ Quantitative On-Chain Swaps**: Automatically swaps native `MON` and mock `USDC` on the `MockDEX` contract when sentiment confidence meets the execution threshold ($\ge 75\%$).
*   **🎨 Commemorative NFT Badges**: Issues zero-dependency ERC721 NFT badges (`MockNFT`) to connected MetaMask users or autonomously signs and mints badge rewards for successful agent trade loops.
*   **💳 x402 Payment Protocol Integration**: Integrates the standard HTTP 402 Payment Required middleware (`packages/backend/src/utils/x402.ts`) to enable machine-to-machine micro-billing (in USDC stablecoins) for premium API endpoints.
*   **📇 ERC-8004 Agent Identity**: Establishes on-chain trust primitives using the ERC-8004 specification (`packages/contracts/contracts/AgentRegistry.sol`) allowing agents to register portable profiles, capability metadata URIs, and verify agent operations.

---

## 📂 Project Structure

This project is structured as an npm workspaces monorepo:

```
├── packages/
│   ├── frontend/         # React (Vite) + TypeScript + Tailwind CSS (Brutalist styling)
│   ├── backend/          # Express + TS API service running the trading & AI pipeline
│   └── contracts/        # Hardhat + Solidity smart contracts (USDC, DEX, NFT, Registry)
├── context.md            # Execution ledger & active system context configuration
└── package.json          # Root scripts and monorepo workspace configurations
```

---

## ⚙️ Deployed Contract Address Registry (Monad Testnet)

These contract addresses are configured in the environment variables and context:

*   **Mock DEX Address**: `0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199`
*   **Mock USDC Token**: `0x534b2f3A21130d7a60830c2Df862319e593943A3`
*   **Mock NFT Token**: `0xF0434bBdadcb579876Bdf77fA3e121784B19D857`
*   **ERC-8004 Agent Registry**: `0xF0434bBdadcb579876Bdf77fA3e121784B19D857`

---

## 🛠️ Getting Started

### 1. Installation
Install all dependencies from the root directory:
```bash
npm run install:all
```

### 2. Run the Backend Server
Starts the Express API server on `http://localhost:3001`:
```bash
npm run dev:backend
```

### 3. Run the Frontend Client
Launches the brutalist dashboard interface on `http://localhost:5173/`:
```bash
npm run dev:frontend
```

---

## 🧪 Testing the Primitives

### Smart Contract Tests
Run Hardhat contract test suites (verifies ERC-8004 Identity Registry logic):
```bash
cd packages/contracts
npx hardhat test
```

### x402 Micropayment & ERC-8004 Integration Sandbox
Test the HTTP 402 payment request and verification flows separately using our mock server:

1. Start the sandbox server:
   ```bash
   cd packages/backend
   npx tsx src/sandbox.ts
   ```
2. Execute the test client harness:
   ```bash
   cd packages/backend
   npx tsx src/test-sandbox.ts
   ```
This client test triggers a complete handshake simulation, requesting gated data, retrieving HTTP 402 payment headers, executing simulated Monad transfers, and bypassing the paywall upon validation.