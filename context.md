# Monad Autonomous AI Agent Context & Execution Ledger

This document registers the complete architectural context, configuration states, and live execution history of the **Monad Sentiment Matrix & NFT Hub** platform created for the **Monad Testnet Hackathon**.

---

## 📂 System Architecture Context

The platform is structured as an EVM monorepo with three core workspaces:

### 1. 🎨 Frontend Interface (`packages/frontend`)
* **Framework**: React (Vite) + TypeScript + Tailwind CSS (Neo-brutalist styling system).
* **MetaMask Integration**: Connects dynamically to Monad Testnet (`Chain ID: 10143`), switches networks automatically, and tracks real-time user balances for native `MON` and `USDC` faucet tokens.
* **Control Panels**:
  * **Sentiment Trading**: Captures YouTube URLs, feeds them to the backend parser, displays loader timeline metrics, and logs results. Supports manual deposit/withdraw operations.
  * **NFT Minting Hub**: Allows users to input metadata URIs and mint ERC721 badges to MetaMask directly.
* **Session Cache**: Collapsible logs to inspect full raw transcripts and transaction details.

### 2. 📡 Express Backend (`packages/backend`)
* **Modules**: Express + TypeScript + Groq Llama SDK + Ethers.js (v6).
* **Burner Wallet Proxy**: Deploys and manages a local agent burner wallet (`agent_wallet.json`) with persistent private keys.
* **Sentiment Analysis Model**: Uses Groq's active `llama-3.3-70b-specdec` LLM or falls back to an offline continuous keyword-frequency parser calculating precise fractional confidence ratings (e.g. `83.17%`).
* **DEX & NFT Integrations**: Autonomously performs `USDC -> MON` swaps (on BULLISH sentiment) or `MON -> USDC` swaps (on BEARISH sentiment). Slices trading size based on the model's confidence rating (`2.5 * confidence` MON scale). Minting a commemorative ERC721 trade badge NFT is triggered on successful trades.
* **Agentic Commerce (x402 & ERC-8004)**:
  * **x402 Payment Middleware**: Integrates HTTP 402 Payment Required middleware in `src/utils/x402.ts` to gate premium endpoints (verifying on-chain USDC payment details).
  * **ERC-8004 Identity Manager**: Handles agent identity verification and registration calling the `AgentRegistry` contract via `src/utils/erc8004.ts`.
  * **Social Whale Scanner**: Aggregates, parses, and synthesizes high-influence Twitter and Reddit whale feeds (`src/utils/social.ts`) to trigger autonomous sentiment swaps.
  * **Sandbox Server**: Hosted on `src/sandbox.ts` (Port 3002) alongside `src/test-sandbox.ts` to test x402 payment loops and ERC-8004 registration separately.

### 3. ⛓️ Smart Contracts (`packages/contracts`)
* **MockUSDC.sol**: Standard ERC20 token containing `mintFaucet(uint256 amount)` to distribute test funds.
* **MockDEX.sol**: Swaps native `MON` and `USDC` using a static linear exchange rate of `2.5 MON = 1 USDC` ($1\text{ MON} = 0.40\text{ USDC}$) to emulate automated DeFi narrative execution.
* **MockNFT.sol**: Zero-dependency ERC721 contract implementing `mint(string calldata uri)` for badge issuance.
* **AgentRegistry.sol**: ERC-8004 Identity Registry contract allowing AI agents to register their public wallets on-chain and tie them to capability metadata URIs. Verified via Mocha/Chai test suite (`test/AgentRegistry.ts`).

---

## ⚙️ Active Configuration Register

```env
PORT=3001
MONAD_TESTNET_RPC=https://testnet-rpc.monad.xyz
MOCK_DEX_ADDRESS=0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199
MOCK_USDC_ADDRESS=0x534b2f3A21130d7a60830c2Df862319e593943A3
MOCK_NFT_ADDRESS=0xF0434bBdadcb579876Bdf77fA3e121784B19D857
AGENT_REGISTRY_ADDRESS=0xF0434bBdadcb579876Bdf77fA3e121784B19D857
```
