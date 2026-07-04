import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createX402Middleware } from './utils/x402.js';
import { registerAgentIdentity, getAgentRegistryInfo } from './utils/erc8004.js';
import { deployAgentWallet, isAgentWalletDeployed, getAgentAddress } from './utils/web3.js';

dotenv.config();

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Target configuration for x402 payment requirements
const MERCHANT_USDC_RECEIVER = '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'; // Simulated merchant receiver wallet
const TOKEN_ADDRESS = process.env.MOCK_USDC_ADDRESS || '0x534b2f3A21130d7a60830c2Df862319e593943A3';

console.log(`[Sandbox] Configured x402 payment recipient: ${MERCHANT_USDC_RECEIVER}`);
console.log(`[Sandbox] Configured x402 payment token: ${TOKEN_ADDRESS}`);

// 1. Premium Endpoint: Gated with x402 Payment Required middleware (0.1 USDC)
const x402Middleware = createX402Middleware({
  tokenAddress: TOKEN_ADDRESS,
  recipientAddress: MERCHANT_USDC_RECEIVER,
  amount: '0.1' // requires 0.1 USDC micropayment
});

app.get('/api/premium-info', x402Middleware, (req, res) => {
  res.json({
    success: true,
    data: {
      secretMessage: 'This is premium trading signal data! Monad parallel execution metrics show 10,000 TPS adoption rate!',
      timestamp: new Date().toISOString()
    }
  });
});

// 2. Initialize burner wallet if not deployed
app.post('/api/sandbox/deploy-wallet', (req, res) => {
  try {
    if (!isAgentWalletDeployed()) {
      const wallet = deployAgentWallet();
      return res.json({ success: true, message: 'New burner wallet deployed.', address: wallet.address });
    }
    res.json({ success: true, message: 'Burner wallet already active.', address: getAgentAddress() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Register ERC-8004 Identity endpoint
app.post('/api/agent/erc8004-register', async (req, res) => {
  const { metadataUri, registryAddress } = req.body;
  if (!metadataUri) {
    return res.status(400).json({ error: 'Missing metadataUri parameter' });
  }

  try {
    const result = await registerAgentIdentity(metadataUri, registryAddress);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Identity registration failed' });
  }
});

// 4. Retrieve ERC-8004 Identity Status endpoint
app.get('/api/agent/erc8004-status', async (req, res) => {
  const { registryAddress } = req.query;
  try {
    const status = await getAgentRegistryInfo(registryAddress as string | undefined);
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch identity status' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Monad Agent Sandbox Server Online' });
});

app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`🚀 Monad x402 & ERC-8004 Sandbox Server online on port ${PORT}`);
  console.log(`Try accessing: http://localhost:${PORT}/api/premium-info`);
  console.log(`=============================================================`);
});
