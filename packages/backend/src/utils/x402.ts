import { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

const MONAD_TESTNET_RPC = process.env.MONAD_TESTNET_RPC || 'https://testnet-rpc.monad.xyz';
const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS || '0x534b2f3A21130d7a60830c2Df862319e593943A3';

let provider: ethers.JsonRpcProvider | null = null;
try {
  provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
} catch (e) {
  console.warn('[x402] Provider offline. Using mock verification mode.');
}

// Memory cache for processed payment tx hashes to prevent replay attacks
const processedPayments = new Set<string>();

export interface X402Config {
  tokenAddress: string;
  recipientAddress: string;
  amount: string; // token amount in decimal, e.g. "0.1" for 0.1 USDC
}

/**
 * Express Middleware to enforce x402 payment requirements on endpoints.
 */
export function createX402Middleware(config: X402Config) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentTx = req.header('X-402-Payment-Tx');

    if (!paymentTx) {
      // 1. Generate a unique Invoice ID
      const paymentId = ethers.keccak256(
        ethers.toUtf8Bytes(`x402_invoice_${Date.now()}_${Math.random()}`)
      );

      console.log(`[x402] Request to ${req.originalUrl} missing payment. Rejecting with HTTP 402.`);
      
      // 2. Set standard x402 response headers
      res.setHeader('X-402-Payment-Token', config.tokenAddress);
      res.setHeader('X-402-Payment-Recipient', config.recipientAddress);
      res.setHeader('X-402-Payment-Amount', config.amount);
      res.setHeader('X-402-Payment-Id', paymentId);

      return res.status(402).json({
        error: 'Payment Required',
        message: `This resource requires a payment of ${config.amount} USDC. Please pay and include the tx hash in X-402-Payment-Tx header.`,
        instructions: {
          token: config.tokenAddress,
          recipient: config.recipientAddress,
          amount: config.amount,
          paymentId: paymentId
        }
      });
    }

    // 3. Verify Payment Transaction
    console.log(`[x402] Received payment Tx hash: ${paymentTx}. Verifying...`);

    if (processedPayments.has(paymentTx)) {
      return res.status(400).json({ error: 'Replay Attack', message: 'This payment transaction hash has already been processed.' });
    }

    // Bypass real on-chain checks for sandbox/simulated transaction hashes
    if (paymentTx.includes('MOCK')) {
      processedPayments.add(paymentTx);
      console.log(`[x402] Verified simulated/sandbox payment Tx: ${paymentTx}`);
      return next();
    }

    try {
      const isValid = await verifyOnChainPayment(paymentTx, config);
      if (isValid) {
        processedPayments.add(paymentTx);
        console.log(`[x402] Payment verified successfully for Tx: ${paymentTx}`);
        next();
      } else {
        return res.status(402).json({ error: 'Invalid Payment', message: 'Payment verification failed. Check transaction details.' });
      }
    } catch (err: any) {
      console.error('[x402] Verification error:', err);
      return res.status(500).json({ error: 'Verification Error', message: err.message || 'Payment verification failed due to internal error.' });
    }
  };
}

/**
 * Validates a transaction receipt on-chain to verify the token transfer.
 */
async function verifyOnChainPayment(txHash: string, config: X402Config): Promise<boolean> {
  if (!provider) {
    throw new Error('RPC Provider offline');
  }

  // 1. Fetch transaction receipt
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) {
    console.warn(`[x402] Tx receipt not found or failed status for: ${txHash}`);
    return false;
  }

  // 2. Fetch original transaction to check details
  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    return false;
  }

  // 3. Parse ERC20 transfer logs from the receipt to verify recipient and amount
  // ERC20 Transfer event signature: Transfer(address indexed from, address indexed to, uint256 value)
  const transferEventTopic = ethers.id("Transfer(address,address,uint256)");
  
  let totalTransferred = 0n;
  const usdcInterface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ]);

  for (const log of receipt.logs) {
    // Confirm the log belongs to the specified token contract and matches Transfer event
    if (log.address.toLowerCase() === config.tokenAddress.toLowerCase() && log.topics[0] === transferEventTopic) {
      try {
        const parsed = usdcInterface.parseLog(log);
        if (parsed) {
          const toAddress = parsed.args[1];
          const value = parsed.args[2];
          
          if (toAddress.toLowerCase() === config.recipientAddress.toLowerCase()) {
            totalTransferred += BigInt(value.toString());
          }
        }
      } catch (err) {
        console.warn('[x402] Failed to parse log:', err);
      }
    }
  }

  // Fetch token decimals dynamically to verify amount
  const erc20Contract = new ethers.Contract(config.tokenAddress, [
    "function decimals() external view returns (uint8)"
  ], provider);
  
  let decimals = 18;
  try {
    decimals = await erc20Contract.decimals();
  } catch (e) {
    decimals = 6;
  }

  const expectedAmountWei = ethers.parseUnits(config.amount, decimals);
  
  console.log(`[x402] On-chain check: Target recipient: ${config.recipientAddress}, Expected value: ${expectedAmountWei.toString()} Wei. Actual transferred: ${totalTransferred.toString()} Wei.`);

  return totalTransferred >= expectedAmountWei;
}
