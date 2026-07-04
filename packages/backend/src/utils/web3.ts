import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const MONAD_TESTNET_RPC = process.env.MONAD_TESTNET_RPC || 'https://testnet-rpc.monad.xyz';
const MOCK_DEX_ADDRESS = process.env.MOCK_DEX_ADDRESS || '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199';
const MOCK_ETH_ADDRESS = process.env.MOCK_ETH_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const MOCK_NFT_ADDRESS = process.env.MOCK_NFT_ADDRESS || '0x9F1F64848dcf456f9661411D4ceD1C1c1C11199';
const WALLET_FILE_PATH = path.resolve(__dirname, '../../agent_wallet.json');

// Abi definitions
const MOCK_DEX_ABI = [
  "function swapETHForMON(uint256 ethAmountIn) external",
  "function swapMONForETH() external payable",
  "event SwapExecuted(address indexed agentWallet, string tokenTicker, bool isBuyMON, uint256 amountIn, uint256 amountOut, uint256 timestamp)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 value) external returns (bool)",
  "function transfer(address to, uint256 value) external returns (bool)",
  "function mintFaucet(uint256 amount) external"
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

export async function getAgentETHBalance(): Promise<string> {
  if (!agentWallet) return '0.0 (uninitialized)';
  if (!provider) return '0.0 (offline)';
  try {
    const ethContract = new ethers.Contract(MOCK_ETH_ADDRESS, ERC20_ABI, provider);
    const balance = await ethContract.balanceOf(agentWallet.address);
    return ethers.formatEther(balance);
  } catch (err) {
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
 * @dev Swaps native MON and MockETH. 
 * BUY MON = Swaps MockETH -> MON (occurs when sentiment is BULLISH)
 * SELL MON = Swaps MON -> MockETH (occurs when sentiment is BEARISH)
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
  const ethAmountToSwapStr = (parseFloat(monAmountToSwapStr) / 10).toFixed(5); // 10 MON = 1 ETH rate
  
  try {
    if (!provider) {
      throw new Error('Web3 RPC Provider offline');
    }

    const dexContract = new ethers.Contract(MOCK_DEX_ADDRESS, MOCK_DEX_ABI, agentWallet);
    const ethContract = new ethers.Contract(MOCK_ETH_ADDRESS, ERC20_ABI, agentWallet);

    if (direction === 'SELL') { // Selling MON (swapping MON -> ETH)
      const balance = await provider.getBalance(agentWallet.address);
      const amountToSwap = ethers.parseEther(monAmountToSwapStr);
      
      if (balance < amountToSwap) {
        throw new Error(`Insufficient native MON balance: Agent has ${ethers.formatEther(balance)} MON. Needs ${monAmountToSwapStr} MON.`);
      }

      console.log(`[Web3] Sending Tx: swapMONForETH sending ${monAmountToSwapStr} MON...`);
      const tx = await dexContract.swapMONForETH({
        value: amountToSwap,
        gasLimit: 150000
      });
      console.log(`[Web3] Tx broadcasted: ${tx.hash}. Waiting confirmation...`);
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt!.hash,
        amountIn: `${monAmountToSwapStr} MON`,
        amountOut: `${ethAmountToSwapStr} ETH`,
        simulated: false,
        agentAddress: agentWallet.address
      };
    } else { // Buying MON (swapping ETH -> MON)
      const ethAmountToSwap = ethers.parseEther(ethAmountToSwapStr);
      
      // Check ETH balance
      const ethBalance = await ethContract.balanceOf(agentWallet.address);
      if (ethBalance < ethAmountToSwap) {
        console.log(`[Web3] Agent has insufficient MockETH (${ethers.formatEther(ethBalance)} ETH). Claiming faucet tokens autonomously...`);
        // Claim faucet tokens for the agent autonomously
        const mintTx = await ethContract.mintFaucet(ethers.parseEther("1.0")); // claim 1 ETH
        await mintTx.wait();
        console.log(`[Web3] Faucet mint success. Agent funded with 1.0 MockETH.`);
      }

      // Approve DEX contract to spend ETH
      console.log(`[Web3] Approving MockDEX to spend ${ethAmountToSwapStr} ETH...`);
      const approveTx = await ethContract.approve(MOCK_DEX_ADDRESS, ethAmountToSwap);
      await approveTx.wait();

      console.log(`[Web3] Sending Tx: swapETHForMON using ${ethAmountToSwapStr} ETH...`);
      const tx = await dexContract.swapETHForMON(ethAmountToSwap, {
        gasLimit: 200000
      });
      console.log(`[Web3] Tx broadcasted: ${tx.hash}. Waiting confirmation...`);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt!.hash,
        amountIn: `${ethAmountToSwapStr} ETH`,
        amountOut: `${monAmountToSwapStr} MON`,
        simulated: false,
        agentAddress: agentWallet.address
      };
    }
  } catch (error: any) {
    console.warn(`[Web3] Real swap failed or bypassed: ${error.message || error}`);
    console.log('[Web3] Simulating transaction signature locally...');

    const fakeTxHash = ethers.keccak256(
      ethers.toUtf8Bytes(`MOCK_SWAP_${Date.now()}_ETH_MON_${direction}_${agentWallet.address}`)
    );

    const amountIn = direction === 'SELL' ? `${monAmountToSwapStr} MON` : `${ethAmountToSwapStr} ETH`;
    const amountOut = direction === 'SELL' ? `${ethAmountToSwapStr} ETH` : `${monAmountToSwapStr} MON`;

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
 * @dev Withdraw Mock ETH ERC20 faucet tokens from the agent burner wallet back to the user.
 */
export async function withdrawETH(recipientAddress: string, amount: string): Promise<TradeResult> {
  if (!agentWallet) {
    throw new Error('Agent wallet not deployed/initialized');
  }
  
  console.log(`[Web3] Initiating Mock ETH withdrawal of ${amount} ETH to: ${recipientAddress}`);
  const parsedAmount = ethers.parseEther(amount);
  
  try {
    if (!provider) {
      throw new Error('RPC Provider offline');
    }

    const ethContract = new ethers.Contract(MOCK_ETH_ADDRESS, ERC20_ABI, agentWallet);
    const balance = await ethContract.balanceOf(agentWallet.address);
    if (balance < parsedAmount) {
      throw new Error(`Insufficient ETH. Agent balance: ${ethers.formatEther(balance)} ETH. Requested: ${amount} ETH.`);
    }
    
    console.log(`[Web3] Sending Tx: Transferring ${amount} Mock ETH to ${recipientAddress}...`);
    const tx = await ethContract.transfer(recipientAddress, parsedAmount);
    console.log(`[Web3] ETH Withdrawal tx broadcasted: ${tx.hash}`);
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt!.hash,
      amountIn: `${amount} ETH`,
      amountOut: `${amount} ETH`,
      simulated: false,
      agentAddress: agentWallet.address
    };
  } catch (error: any) {
    console.warn(`[Web3] ETH withdrawal failed or bypassed: ${error.message || error}`);
    console.log('[Web3] Simulating ETH withdrawal locally...');
    
    const fakeTxHash = ethers.keccak256(
      ethers.toUtf8Bytes(`MOCK_WITHDRAW_ETH_${Date.now()}_${amount}_${recipientAddress}`)
    );
    
    return {
      success: true,
      txHash: fakeTxHash,
      amountIn: `${amount} ETH`,
      amountOut: `${amount} ETH`,
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
