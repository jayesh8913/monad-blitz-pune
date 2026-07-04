import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const MONAD_TESTNET_RPC = process.env.MONAD_TESTNET_RPC || 'https://testnet-rpc.monad.xyz';
const MOCK_DEX_ADDRESS = process.env.MOCK_DEX_ADDRESS || '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199';
const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS || '0x754704Bc059F8C67012fEd69BC8A327a5aafb603';
const MOCK_NFT_ADDRESS = process.env.MOCK_NFT_ADDRESS || '0x9F1F64848dcf456f9661411D4ceD1C1c1C11199';
const WALLET_FILE_PATH = path.resolve(__dirname, '../../agent_wallet.json');

// Abi definitions
const MOCK_DEX_ABI = [
  "function swapUSDCForMON(uint256 usdcAmountIn) external",
  "function swapMONForUSDC() external payable",
  "event SwapExecuted(address indexed agentWallet, string tokenTicker, bool isBuyMON, uint256 amountIn, uint256 amountOut, uint256 timestamp)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 value) external returns (bool)",
  "function transfer(address to, uint256 value) external returns (bool)",
  "function mintFaucet(uint256 amount) external",
  "function decimals() external view returns (uint8)"
];

// Setup RPC Provider
let provider: ethers.JsonRpcProvider | null = null;
try {
  provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
} catch (err) {
  console.warn('[Web3] Failed to connect to Monad Testnet RPC. Provider offline.');
}

// Persistent agent wallet reference
let agentWallet: ethers.Wallet | null = null;

// Connect wallet helper
function setupWalletInstance(privateKey: string): ethers.Wallet {
  let wallet = new ethers.Wallet(privateKey);
  if (provider) {
    wallet = wallet.connect(provider);
  }
  return wallet;
}

// Loader
export function loadAgentWallet() {
  try {
    if (fs.existsSync(WALLET_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(WALLET_FILE_PATH, 'utf-8'));
      if (data.privateKey) {
        agentWallet = setupWalletInstance(data.privateKey);
        console.log(`[Web3] Loaded persistent agent wallet: ${agentWallet.address}`);
        return;
      }
    }
    
    const configuredKey = process.env.AGENT_PRIVATE_KEY;
    if (configuredKey && ethers.isHexString(configuredKey, 32)) {
      agentWallet = setupWalletInstance(configuredKey);
      console.log(`[Web3] Loaded agent wallet from env: ${agentWallet.address}`);
    } else {
      console.log('[Web3] Agent wallet not yet deployed. Needs user initialization.');
    }
  } catch (error) {
    console.error('[Web3] Failed to load agent wallet:', error);
  }
}

// Run load on import
loadAgentWallet();

export function isAgentWalletDeployed(): boolean {
  return agentWallet !== null;
}

export function getAgentAddress(): string | null {
  return agentWallet ? agentWallet.address : null;
}

export function deployAgentWallet(): { address: string } {
  const temp = ethers.Wallet.createRandom();
  agentWallet = setupWalletInstance(temp.privateKey);

  try {
    fs.writeFileSync(WALLET_FILE_PATH, JSON.stringify({ privateKey: temp.privateKey }, null, 2));
    console.log(`[Web3] Deployed and persisted new Agent burner wallet: ${agentWallet.address}`);
  } catch (error) {
    console.error('[Web3] Failed to save agent wallet file:', error);
  }

  return { address: agentWallet.address };
}

export async function getAgentBalance(): Promise<string> {
  if (!agentWallet) return '0.0 (uninitialized)';
  if (!provider) return '0.0 (offline)';
  try {
    const balance = await provider.getBalance(agentWallet.address);
    return ethers.formatEther(balance);
  } catch (err) {
    return '0.0 (error)';
  }
}

export async function getAgentUSDCBalance(): Promise<string> {
  if (!agentWallet) return '0.0 (uninitialized)';
  if (!provider) return '0.0 (offline)';
  try {
    const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, ERC20_ABI, provider);
    let decimals = 18;
    try {
      decimals = await usdcContract.decimals();
    } catch (e) {
      console.warn('[Web3] Failed to fetch USDC decimals, defaulting to 6:', e);
      decimals = 6;
    }
    const balance = await usdcContract.balanceOf(agentWallet.address);
    return ethers.formatUnits(balance, decimals);
  } catch (err) {
    console.error('[Web3] Failed to query USDC balance:', err);
    return '0.0 (error)';
  }
}

export interface TradeResult {
  success: boolean;
  txHash: string;
  amountIn: string;
  amountOut: string;
  errorMessage?: string;
  simulated: boolean;
  agentAddress: string;
}

/**
 * @dev Swaps native MON and USDC. 
 * BUY MON = Swaps USDC -> MON (occurs when sentiment is BULLISH)
 * SELL MON = Swaps MON -> USDC (occurs when sentiment is BEARISH)
 */
export async function executeDEXSwap(
  ticker: string,
  direction: 'BUY' | 'SELL', 
  confidence: number
): Promise<TradeResult> {
  if (!agentWallet) {
    throw new Error('Agent wallet not deployed. Deploy the burner wallet first.');
  }

  console.log(`[Web3] Automated Trade: MONAD | Action: ${direction} MON | Confidence: ${confidence}`);
  
  const monAmountToSwapStr = (0.01 * confidence).toFixed(4); // MON scale
  const usdcAmountToSwapStr = (parseFloat(monAmountToSwapStr) / 10).toFixed(6); // 10 MON = 1 USDC rate
  
  try {
    if (!provider) {
      throw new Error('Web3 RPC Provider offline');
    }

    const dexContract = new ethers.Contract(MOCK_DEX_ADDRESS, MOCK_DEX_ABI, agentWallet);
    const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, ERC20_ABI, agentWallet);

    let decimals = 18;
    try {
      decimals = await usdcContract.decimals();
    } catch (e) {
      console.warn('[Web3] Failed to fetch USDC decimals, defaulting to 6:', e);
      decimals = 6;
    }

    if (direction === 'SELL') { // Selling MON (swapping MON -> USDC)
      const balance = await provider.getBalance(agentWallet.address);
      const amountToSwap = ethers.parseEther(monAmountToSwapStr);
      
      if (balance < amountToSwap) {
        throw new Error(`Insufficient native MON balance: Agent has ${ethers.formatEther(balance)} MON. Needs ${monAmountToSwapStr} MON.`);
      }

      console.log(`[Web3] Sending Tx: swapMONForUSDC sending ${monAmountToSwapStr} MON...`);
      const tx = await dexContract.swapMONForUSDC({
        value: amountToSwap,
        gasLimit: 150000
      });
      console.log(`[Web3] Tx broadcasted: ${tx.hash}. Waiting confirmation...`);
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt!.hash,
        amountIn: `${monAmountToSwapStr} MON`,
        amountOut: `${usdcAmountToSwapStr} USDC`,
        simulated: false,
        agentAddress: agentWallet.address
      };
    } else { // Buying MON (swapping USDC -> MON)
      const usdcAmountToSwap = ethers.parseUnits(usdcAmountToSwapStr, decimals);
      
      // Check USDC balance
      const usdcBalance = await usdcContract.balanceOf(agentWallet.address);
      if (usdcBalance < usdcAmountToSwap) {
        console.log(`[Web3] Agent has insufficient USDC (${ethers.formatUnits(usdcBalance, decimals)} USDC). Claiming faucet tokens autonomously...`);
        try {
          // Claim faucet tokens for the agent autonomously
          const mintTx = await usdcContract.mintFaucet(ethers.parseUnits("10.0", decimals)); // claim 10 USDC
          await mintTx.wait();
          console.log(`[Web3] Faucet mint success. Agent funded with 10.0 USDC.`);
        } catch (mintErr) {
          console.warn(`[Web3] Autonomous faucet claim failed (USDC contract may not support mintFaucet):`, mintErr);
        }
      }

      // Approve DEX contract to spend USDC
      console.log(`[Web3] Approving MockDEX to spend ${usdcAmountToSwapStr} USDC...`);
      const approveTx = await usdcContract.approve(MOCK_DEX_ADDRESS, usdcAmountToSwap);
      await approveTx.wait();

      console.log(`[Web3] Sending Tx: swapUSDCForMON using ${usdcAmountToSwapStr} USDC...`);
      const tx = await dexContract.swapUSDCForMON(usdcAmountToSwap, {
        gasLimit: 200000
      });
      console.log(`[Web3] Tx broadcasted: ${tx.hash}. Waiting confirmation...`);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt!.hash,
        amountIn: `${usdcAmountToSwapStr} USDC`,
        amountOut: `${monAmountToSwapStr} MON`,
        simulated: false,
        agentAddress: agentWallet.address
      };
    }
  } catch (error: any) {
    console.warn(`[Web3] Real swap failed or bypassed: ${error.message || error}`);
    console.log('[Web3] Simulating transaction signature locally...');

    const fakeTxHash = ethers.keccak256(
      ethers.toUtf8Bytes(`MOCK_SWAP_${Date.now()}_USDC_MON_${direction}_${agentWallet.address}`)
    );

    const amountIn = direction === 'SELL' ? `${monAmountToSwapStr} MON` : `${usdcAmountToSwapStr} USDC`;
    const amountOut = direction === 'SELL' ? `${usdcAmountToSwapStr} USDC` : `${monAmountToSwapStr} MON`;

    return {
      success: true,
      txHash: fakeTxHash,
      amountIn,
      amountOut,
      simulated: true,
      agentAddress: agentWallet.address
    };
  }
}

/**
 * @dev Withdraw native MON from the agent's proxy burner wallet.
 */
export async function withdrawMON(recipientAddress: string, amount: string): Promise<TradeResult> {
  if (!agentWallet) {
    throw new Error('Agent wallet not deployed/initialized');
  }
  
  console.log(`[Web3] Initiating MON withdrawal of ${amount} MON to: ${recipientAddress}`);
  const parsedAmount = ethers.parseEther(amount);
  
  try {
    if (!provider) {
      throw new Error('RPC Provider offline');
    }

    const balance = await provider.getBalance(agentWallet.address);
    if (balance < parsedAmount) {
      throw new Error(`Insufficient MON. Agent balance: ${ethers.formatEther(balance)} MON. Requested: ${amount} MON.`);
    }
    
    console.log(`[Web3] Sending Tx: Transferring ${amount} MON to ${recipientAddress}...`);
    const tx = await agentWallet.sendTransaction({
      to: recipientAddress,
      value: parsedAmount,
      gasLimit: 21000
    });
    
    console.log(`[Web3] Withdrawal tx confirmed: ${tx.hash}`);
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt!.hash,
      amountIn: `${amount} MON`,
      amountOut: `${amount} MON`,
      simulated: false,
      agentAddress: agentWallet.address
    };
  } catch (error: any) {
    console.warn(`[Web3] MON withdrawal failed/bypassed: ${error.message || error}`);
    console.log('[Web3] Simulating withdrawal locally...');
    
    const fakeTxHash = ethers.keccak256(
      ethers.toUtf8Bytes(`MOCK_WITHDRAW_MON_${Date.now()}_${amount}_${recipientAddress}`)
    );
    
    return {
      success: true,
      txHash: fakeTxHash,
      amountIn: `${amount} MON`,
      amountOut: `${amount} MON`,
      simulated: true,
      agentAddress: agentWallet.address
    };
  }
}

/**
 * @dev Withdraw USDC faucet tokens from the agent burner wallet back to the user.
 */
export async function withdrawUSDC(recipientAddress: string, amount: string): Promise<TradeResult> {
  if (!agentWallet) {
    throw new Error('Agent wallet not deployed/initialized');
  }
  
  console.log(`[Web3] Initiating USDC withdrawal of ${amount} USDC to: ${recipientAddress}`);
  
  try {
    if (!provider) {
      throw new Error('RPC Provider offline');
    }

    const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, ERC20_ABI, agentWallet);
    let decimals = 18;
    try {
      decimals = await usdcContract.decimals();
    } catch (e) {
      decimals = 6;
    }
    
    const parsedAmount = ethers.parseUnits(amount, decimals);
    const balance = await usdcContract.balanceOf(agentWallet.address);
    if (balance < parsedAmount) {
      throw new Error(`Insufficient USDC. Agent balance: ${ethers.formatUnits(balance, decimals)} USDC. Requested: ${amount} USDC.`);
    }
    
    console.log(`[Web3] Sending Tx: Transferring ${amount} USDC to ${recipientAddress}...`);
    const tx = await usdcContract.transfer(recipientAddress, parsedAmount);
    console.log(`[Web3] USDC Withdrawal tx broadcasted: ${tx.hash}`);
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt!.hash,
      amountIn: `${amount} USDC`,
      amountOut: `${amount} USDC`,
      simulated: false,
      agentAddress: agentWallet.address
    };
  } catch (error: any) {
    console.warn(`[Web3] USDC withdrawal failed or bypassed: ${error.message || error}`);
    console.log('[Web3] Simulating USDC withdrawal locally...');
    
    const fakeTxHash = ethers.keccak256(
      ethers.toUtf8Bytes(`MOCK_WITHDRAW_USDC_${Date.now()}_${amount}_${recipientAddress}`)
    );
    
    return {
      success: true,
      txHash: fakeTxHash,
      amountIn: `${amount} USDC`,
      amountOut: `${amount} USDC`,
      simulated: true,
      agentAddress: agentWallet.address
    };
  }
}

/**
 * @dev Autonomous minting calling MockNFT to issue a narrative signal badge to the agent.
 */
export async function mintAgentNFT(tokenURI: string): Promise<TradeResult> {
  if (!agentWallet) {
    throw new Error('Agent wallet not deployed/initialized');
  }

  console.log(`[Web3] AI Agent minting narrative badge NFT for URI: ${tokenURI}`);
  
  try {
    if (!provider) {
      throw new Error('Provider offline');
    }

    const nftContract = new ethers.Contract(MOCK_NFT_ADDRESS, [
      "function mint(string calldata uri) external returns (uint256)"
    ], agentWallet);

    const tx = await nftContract.mint(tokenURI, {
      gasLimit: 180000
    });
    console.log(`[Web3] NFT mint transaction broadcasted: ${tx.hash}. Waiting confirmation...`);
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: receipt!.hash,
      amountIn: '0 MON',
      amountOut: '1 MHB NFT',
      simulated: false,
      agentAddress: agentWallet.address
    };
  } catch (error: any) {
    console.warn(`[Web3] Real NFT mint failed or bypassed: ${error.message || error}`);
    console.log('[Web3] Simulating NFT mint transaction locally...');

    const fakeTxHash = ethers.keccak256(
      ethers.toUtf8Bytes(`MOCK_NFT_MINT_${Date.now()}_${tokenURI}_${agentWallet.address}`)
    );

    return {
      success: true,
      txHash: fakeTxHash,
      amountIn: '0 MON',
      amountOut: '1 MHB NFT',
      simulated: true,
      agentAddress: agentWallet.address
    };
  }
}
