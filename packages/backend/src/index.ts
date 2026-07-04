import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { fetchYoutubeTranscript } from './utils/transcript.js';
import { analyzeTranscript } from './utils/ai.js';
import { fetchWhaleTweets, fetchRedditPosts } from './utils/social.js';
import { 
  getAgentAddress, 
  getAgentBalance, 
  getAgentUSDCBalance,
  executeDEXSwap, 
  isAgentWalletDeployed, 
  deployAgentWallet,
  withdrawMON,
  withdrawUSDC,
  mintAgentNFT
} from './utils/web3.js';
import { logToLedger } from './utils/logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json()); // Trigger reload

// Endpoint to retrieve agent burner wallet details and balances
app.get('/api/agent-wallet', async (req, res) => {
  try {
    const isDeployed = isAgentWalletDeployed();
    const address = getAgentAddress();
    const balance = isDeployed ? await getAgentBalance() : '0.0';
    const usdcBalance = isDeployed ? await getAgentUSDCBalance() : '0.0';
    res.json({ 
      isDeployed, 
      address, 
      balance, 
      usdcBalance,
      tokenAddress: process.env.MOCK_USDC_ADDRESS || '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
      dexAddress: process.env.MOCK_DEX_ADDRESS || '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
      nftAddress: process.env.MOCK_NFT_ADDRESS || '0x9F1F64848dcf456f9661411D4ceD1C1c1C11199'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch agent wallet details' });
  }
});

// Endpoint to deploy/initialize a new AI agent wallet
app.post('/api/agent/deploy', (req, res) => {
  try {
    const result = deployAgentWallet();
    res.json({ success: true, address: result.address });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to deploy agent wallet' });
  }
});

// Endpoint to withdraw native MON or USDC from agent proxy back to user
app.post('/api/agent/withdraw', async (req, res) => {
  const { recipientAddress, amount, token } = req.body; // token: 'MON' | 'USDC'
  if (!recipientAddress || !amount) {
    return res.status(400).json({ error: 'Missing recipientAddress or amount' });
  }

  const selectedToken = token === 'USDC' ? 'USDC' : 'MON';

  try {
    let result;
    if (selectedToken === 'USDC') {
      result = await withdrawUSDC(recipientAddress, amount);
    } else {
      result = await withdrawMON(recipientAddress, amount);
    }
    
    // Log to local context.md ledger
    logToLedger({
      timestamp: new Date().toISOString(),
      youtubeUrl: 'WITHDRAWAL_ACTION',
      tokenTicker: selectedToken,
      sentiment: 'NEUTRAL',
      confidence: 1.0,
      actionTxHash: result.txHash,
      justification: `Withdrew ${amount} ${selectedToken} to user address ${recipientAddress}`
    });

    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Withdrawal execution failed' });
  }
});

// Manual trade action API endpoint has been taken down as per user request.

// Process YouTube URL, analyze transcript, and swap native MON and Mock ETH on MockDEX
app.post('/api/analyze', async (req, res) => {
  const { youtubeUrl } = req.body;
  
  if (!youtubeUrl) {
    return res.status(400).json({ error: 'Missing youtubeUrl in request body' });
  }

  if (!isAgentWalletDeployed()) {
    return res.status(400).json({ error: 'Agent wallet is not initialized. Please deploy the agent wallet first.' });
  }

  console.log(`\n--- [API POST /api/analyze] Received request for: ${youtubeUrl} ---`);
  
  try {
    // 1. Fetch transcript
    const transcript = await fetchYoutubeTranscript(youtubeUrl);
    const transcriptSnippet = transcript.slice(0, 300) + '...';

    // 2. Query Groq AI Model
    const analysis = await analyzeTranscript(transcript);
    console.log(`[API] AI Sentiment Analysis:`, analysis);

    // 3. Evaluate trading criteria
    const isBullish = analysis.sentiment === 'BULLISH';
    const isBearish = analysis.sentiment === 'BEARISH';
    const isConfident = analysis.confidence >= 0.75;
    
    let tradeResult = null;
    let tradeExecuted = false;
    let nftResult = null;
    let nftMinted = false;

    // Trigger swap based on sentiment
    if ((isBullish || isBearish) && isConfident) {
      tradeExecuted = true;
      // BUY = swap USDC -> MON (Bullish), SELL = swap MON -> USDC (Bearish)
      const direction = isBullish ? 'BUY' : 'SELL';
      
      console.log(`[API] Triggering autonomous swap on Monad Testnet: ${direction} MON`);
      tradeResult = await executeDEXSwap(
        'MON',
        direction,
        analysis.confidence
      );

      // Autonomously mint narrative badge NFT
      try {
        nftMinted = true;
        nftResult = await mintAgentNFT(youtubeUrl);
        console.log(`[API] Autonomously minted commemorative NFT. Tx: ${nftResult.txHash}`);
      } catch (nftError) {
        console.warn('[API] Autonomous NFT minting failed:', nftError);
      }
    } else {
      console.log('[API] Sentiment conditions not met for executing automated trade.');
    }

    // 4. Log to local context.md ledger
    const timestamp = new Date().toISOString();
    const txHash = tradeResult?.success ? tradeResult.txHash : (tradeExecuted ? 'FAILED' : 'NO_TRADE');
    
    logToLedger({
      timestamp,
      youtubeUrl,
      tokenTicker: 'MON',
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      actionTxHash: txHash,
      justification: analysis.justification
    });

    // 5. Send response to frontend client, returning full transcript for storage
    res.json({
      youtubeUrl,
      transcript,
      transcriptSnippet,
      analysis,
      tradeExecuted,
      tradeResult,
      nftMinted,
      nftResult,
      timestamp
    });

  } catch (error: any) {
    console.error('[API] Error in analysis pipeline:', error);
    res.status(500).json({ error: error.message || 'Pipeline processing failed' });
  }
});

// Endpoint to fetch, analyze, and trade on social media whale accounts (Twitter / Reddit)
app.post('/api/analyze-social', async (req, res) => {
  const { twitterHandles, subreddits } = req.body; // Array of handles, array of subreddits

  if (!twitterHandles && !subreddits) {
    return res.status(400).json({ error: 'Missing twitterHandles or subreddits parameters in request body' });
  }

  if (!isAgentWalletDeployed()) {
    return res.status(400).json({ error: 'Agent wallet is not initialized. Please deploy the agent wallet first.' });
  }

  console.log(`\n--- [API POST /api/analyze-social] Scanning Social Feeds ---`);
  
  try {
    const handles = twitterHandles || [];
    const subs = subreddits || [];
    
    // 1. Gather all social posts
    const tweets = await fetchWhaleTweets(handles);
    const redditPosts = await fetchRedditPosts(subs);
    const allPosts = [...tweets, ...redditPosts];

    if (allPosts.length === 0) {
      return res.status(400).json({ error: 'No social posts retrieved from targeted sources.' });
    }

    // 2. Synthesize social feed into a single text block
    const synthesizedText = allPosts
      .map(p => `[${p.source}] Author: ${p.author}\nDate: ${p.timestamp}\nContent: ${p.content}\n---`)
      .join('\n\n');

    console.log(`[API-Social] Synthesized ${allPosts.length} social posts. Running sentiment scanner...`);

    // 3. Query LLM (reuses the Llama parsing engine)
    const analysis = await analyzeTranscript(synthesizedText);
    console.log(`[API-Social] AI Sentiment Analysis:`, analysis);

    // 4. Trade Execution Criteria
    const isBullish = analysis.sentiment === 'BULLISH';
    const isBearish = analysis.sentiment === 'BEARISH';
    const isConfident = analysis.confidence >= 0.75;
    
    let tradeResult = null;
    let tradeExecuted = false;
    let nftResult = null;
    let nftMinted = false;

    if ((isBullish || isBearish) && isConfident) {
      tradeExecuted = true;
      const direction = isBullish ? 'BUY' : 'SELL';
      
      console.log(`[API-Social] Autonomous swap triggered: ${direction} MON`);
      tradeResult = await executeDEXSwap(
        'MON',
        direction,
        analysis.confidence
      );

      // Autonomous commemorative NFT mint
      try {
        nftMinted = true;
        const mockURI = `social-scan://${handles.join('-') || 'reddit-' + subs.join('-')}`;
        nftResult = await mintAgentNFT(mockURI);
        console.log(`[API-Social] Commemorative NFT minted. Tx: ${nftResult.txHash}`);
      } catch (nftError) {
        console.warn('[API-Social] NFT minting failed:', nftError);
      }
    } else {
      console.log('[API-Social] Sentiment conditions not met for executing automated trade.');
    }

    // 5. Log to ledger
    const timestamp = new Date().toISOString();
    const txHash = tradeResult?.success ? tradeResult.txHash : (tradeExecuted ? 'FAILED' : 'NO_TRADE');
    
    logToLedger({
      timestamp,
      youtubeUrl: `SOCIAL_SCAN_HANDLES_${handles.join('_')}`,
      tokenTicker: 'MON',
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      actionTxHash: txHash,
      justification: analysis.justification
    });

    res.json({
      sources: { handles, subs },
      postsCount: allPosts.length,
      posts: allPosts,
      synthesizedText,
      analysis,
      tradeExecuted,
      tradeResult,
      nftMinted,
      nftResult,
      timestamp
    });

  } catch (error: any) {
    console.error('[API-Social] Error in social analysis pipeline:', error);
    res.status(500).json({ error: error.message || 'Social pipeline processing failed' });
  }
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Monad Autonomous Agent Backend online on port ${PORT}`);
  console.log(`Agent Deployed status: ${isAgentWalletDeployed()}`);
  if (isAgentWalletDeployed()) {
    console.log(`Agent Burner Wallet: ${getAgentAddress()}`);
  }
  console.log(`Mock DEX Target: ${process.env.MOCK_DEX_ADDRESS || '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'}`);
  console.log(`Mock USDC Faucet Target: ${process.env.MOCK_USDC_ADDRESS || '0x754704Bc059F8C67012fEd69BC8A327a5aafb603'}`);
  console.log(`==================================================`);
});
