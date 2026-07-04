import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { 
  Tv, 
  Wallet, 
  ArrowRight, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  ExternalLink, 
  Shield,
  Loader2,
  Terminal,
  PlusCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
  Droplet,
  Award,
  Fingerprint
} from 'lucide-react';

// Configuration Defaults
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const MONAD_CHAIN_ID = '0x279f'; // 10143 in decimal
const MOCK_DEX_ADDRESS = '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199';
const MOCK_USDC_ADDRESS = '0x534b2f3A21130d7a60830c2Df862319e593943A3';
const MOCK_NFT_ADDRESS = '0xF0434bBdadcb579876Bdf77fA3e121784B19D857';

const MONAD_NETWORK_PARAMS = {
  chainId: MONAD_CHAIN_ID,
  chainName: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: ['https://testnet-rpc.monad.xyz'],
  blockExplorerUrls: ['https://testnet.monadexplorer.com'],
};

interface WalletState {
  address: string | null;
  balance: string | null;
  userUsdcBalance: string | null;
  chainId: string | null;
  isConnected: boolean;
}

interface AgentState {
  isDeployed: boolean;
  address: string | null;
  balance: string;
  usdcBalance: string;
}

interface AnalysisResult {
  youtubeUrl: string;
  transcript: string;
  transcriptSnippet: string;
  analysis: {
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: number;
    token_ticker: string;
    justification: string;
  };
  tradeExecuted: boolean;
  tradeResult: {
    success: boolean;
    txHash: string;
    amountIn: string;
    amountOut: string;
    simulated: boolean;
    agentAddress: string;
  } | null;
  nftMinted?: boolean;
  nftResult?: {
    success: boolean;
    txHash: string;
    amountIn: string;
    amountOut: string;
    simulated: boolean;
    agentAddress: string;
  } | null;
  timestamp: string;
}

interface HistoryItem {
  id: string;
  url: string;
  transcript: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  txHash: string;
  timestamp: string;
  analysis: {
    justification: string;
    token_ticker: string;
  };
  nftMinted?: boolean;
  nftTxHash?: string;
}

interface NftBadge {
  tokenId: string;
  owner: string;
  uri: string;
  minter: 'USER' | 'AI_AGENT';
  timestamp: string;
}

export default function App() {
  // Wallet States
  const [userWallet, setUserWallet] = useState<WalletState>({
    address: null,
    balance: null,
    userUsdcBalance: '0.0000',
    chainId: null,
    isConnected: false,
  });

  // Agent States
  const [agentWallet, setAgentWallet] = useState<AgentState>({
    isDeployed: false,
    address: null,
    balance: '0.0000',
    usdcBalance: '0.0000',
  });

  // Dynamic contract addresses resolved from backend configs
  const [contractAddresses, setContractAddresses] = useState({
    token: MOCK_USDC_ADDRESS,
    dex: MOCK_DEX_ADDRESS,
    nft: MOCK_NFT_ADDRESS
  });

  // Tab State
  const [activeTab, setActiveTab] = useState<'trading' | 'nft' | 'social'>('trading');

  // Social scanner states
  const [handles, setHandles] = useState({
    keoneHD: true,
    monad_xyz: true,
    cryptowhale: true
  });
  const [redditSub, setRedditSub] = useState('monad');
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [socialLoadingStep, setSocialLoadingStep] = useState(0);
  const [socialResult, setSocialResult] = useState<any | null>(null);

  // Processing States
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Financial inputs
  const [depositAmount, setDepositAmount] = useState('');
  const [depositToken, setDepositToken] = useState<'MON' | 'USDC'>('MON');
  
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawToken, setWithdrawToken] = useState<'MON' | 'USDC'>('MON');
  
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isDeployingAgent, setIsDeployingAgent] = useState(false);
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);

  // NFT State Variables
  const [nftUri, setNftUri] = useState('ipfs://bafybeih3v4v2n7x7b54exqywnq2t55s2qyh6w3s7yky2d6c6e7kypv7lwa/metadata.json');
  const [isMintingNft, setIsMintingNft] = useState(false);
  const [mintedNfts, setMintedNfts] = useState<NftBadge[]>([]);

  // Result States
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [localHistory, setLocalHistory] = useState<HistoryItem[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Fetch Agent Status and contract configurations
  const fetchAgentStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/agent-wallet`);
      if (response.ok) {
        const data = await response.json();
        setAgentWallet({
          isDeployed: data.isDeployed,
          address: data.address,
          balance: data.isDeployed ? parseFloat(data.balance).toFixed(4) : '0.0000',
          usdcBalance: data.isDeployed ? parseFloat(data.usdcBalance).toFixed(4) : '0.0000',
        });
        
        if (data.tokenAddress && data.dexAddress && data.nftAddress) {
          setContractAddresses({
            token: data.tokenAddress,
            dex: data.dexAddress,
            nft: data.nftAddress
          });
        }
      }
    } catch (err) {
      console.warn('Could not contact backend for agent status:', err);
    }
  };

  // Mount effects
  useEffect(() => {
    fetchAgentStatus();
    
    // Auto-connect wallet if already authorized in session
    const autoConnect = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            await connectMetaMask();
          }
        } catch (e) {
          console.warn('Auto-connect check failed:', e);
        }
      }
    };
    autoConnect();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          connectMetaMask();
        }
      });
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, []);

  // Connect MetaMask
  const connectMetaMask = async () => {
    setError(null);
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install the browser extension.');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      
      const balanceWei = await provider.getBalance(address);
      const balance = ethers.formatEther(balanceWei);

      // Fetch latest configurations from backend
      let tokenAddr = contractAddresses.token;
      let dexAddr = contractAddresses.dex;
      let nftAddr = contractAddresses.nft;
      try {
        const res = await fetch(`${BACKEND_URL}/api/agent-wallet`);
        if (res.ok) {
          const data = await res.json();
          tokenAddr = data.tokenAddress || contractAddresses.token;
          dexAddr = data.dexAddress || contractAddresses.dex;
          nftAddr = data.nftAddress || contractAddresses.nft;
          setContractAddresses({ token: tokenAddr, dex: dexAddr, nft: nftAddr });
        }
      } catch (e) {
        console.warn('Failed to fetch configurations on connection:', e);
      }

      // Fetch user's ERC20 USDC token balance
      let userUsdcBalance = '0.0000';
      try {
        const usdcContract = new ethers.Contract(tokenAddr, [
          "function balanceOf(address account) external view returns (uint256)",
          "function decimals() external view returns (uint8)"
        ], provider);
        let decimals = 18;
        try {
          const dec = await usdcContract.decimals();
          decimals = Number(dec);
        } catch (e) {
          decimals = 6;
        }
        const userUsdcBalanceWei = await usdcContract.balanceOf(address);
        userUsdcBalance = parseFloat(ethers.formatUnits(userUsdcBalanceWei, decimals)).toFixed(4);
      } catch (e) {
        console.warn(`Could not fetch user USDC balance at contract address ${tokenAddr}:`, e);
      }

      const network = await provider.getNetwork();
      const chainIdHex = '0x' + network.chainId.toString(16);

      setUserWallet({
        address,
        balance: parseFloat(balance).toFixed(4),
        userUsdcBalance,
        chainId: chainIdHex,
        isConnected: true,
      });

      await fetchAgentStatus();

      if (chainIdHex !== MONAD_CHAIN_ID) {
        await switchNetwork();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to connect MetaMask');
    }
  };

  const disconnectWallet = () => {
    setUserWallet({
      address: null,
      balance: null,
      userUsdcBalance: '0.0000',
      chainId: null,
      isConnected: false,
    });
  };

  // Offer user to import USDC token asset in MetaMask
  const importUsdcToken = async () => {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const usdcContract = new ethers.Contract(contractAddresses.token, [
        "function decimals() external view returns (uint8)"
      ], provider);
      let decimals = 6;
      try {
        const dec = await usdcContract.decimals();
        decimals = Number(dec);
      } catch (e) {}

      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: contractAddresses.token,
            symbol: 'USDC',
            decimals: decimals,
            image: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
          },
        },
      });
    } catch (error) {
      console.error('Failed to import USDC token:', error);
    }
  };

  // Switch to Monad Network
  const switchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: MONAD_CHAIN_ID }],
      });
      await connectMetaMask();
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [MONAD_NETWORK_PARAMS],
          });
          await connectMetaMask();
        } catch (addError: any) {
          setError('Could not add Monad Testnet network parameters to MetaMask.');
        }
      } else {
        setError('Please switch MetaMask network to Monad Testnet.');
      }
    }
  };

  // Generate / Deploy Agent Wallet
  const handleDeployAgent = async () => {
    setIsDeployingAgent(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/agent/deploy`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to generate agent burner wallet.');
      }
      await fetchAgentStatus();
      await connectMetaMask(); // Refresh balances
    } catch (err: any) {
      setError(err.message || 'Burner wallet generation failed');
    } finally {
      setIsDeployingAgent(false);
    }
  };

  // Claim Faucet USDC tokens to MetaMask wallet
  const handleClaimFaucetUSDC = async () => {
    setError(null);
    if (!userWallet.address) {
      setError('Please connect your MetaMask wallet first.');
      return;
    }

    // Check if it's the official Circle USDC contract (does not support mintFaucet method)
    const isCircleUsdc = contractAddresses.token.toLowerCase() === '0x534b2f3a21130d7a60830c2df862319e593943a3';
    if (isCircleUsdc) {
      console.log('[Faucet] Redirecting user to official Circle Faucet...');
      window.open('https://faucet.circle.com/', '_blank');
      alert('Official USDC does not support direct smart contract faucet minting. Redirecting you to the Circle Faucet to claim Monad Testnet USDC. Please import the token in MetaMask to see your balance!');
      return;
    }

    setIsClaimingFaucet(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const usdcContract = new ethers.Contract(contractAddresses.token, [
        "function mintFaucet(uint256 amount) external",
        "function decimals() external view returns (uint8)"
      ], signer);

      let decimals = 18;
      try {
        const dec = await usdcContract.decimals();
        decimals = Number(dec);
      } catch (e) {
        decimals = 6;
      }

      console.log('[Faucet] Minting 10.0 Mock USDC to MetaMask...');
      const tx = await usdcContract.mintFaucet(ethers.parseUnits("10.0", decimals));
      await tx.wait();
      console.log('[Faucet] Faucet transaction confirmed!');
      
      alert('Faucet claim successful! Claimed 10.0 USDC.');
      await connectMetaMask();
    } catch (err: any) {
      console.error(err);
      window.open('https://faucet.circle.com/', '_blank');
      setError('Faucet minting is not supported on this token contract address. Redirected you to Circle Faucet instead.');
    } finally {
      setIsClaimingFaucet(false);
    }
  };

  // Deposit funds to agent burner wallet
  const handleDeposit = async () => {
    if (!userWallet.address || !agentWallet.address || !depositAmount) {
      setError('Please enter a valid deposit amount');
      return;
    }
    setIsDepositing(true);
    setError(null);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      if (depositToken === 'MON') {
        console.log(`[Web3] Transferring ${depositAmount} MON to Agent address ${agentWallet.address}`);
        const tx = await signer.sendTransaction({
          to: agentWallet.address,
          value: ethers.parseEther(depositAmount),
        });
        await tx.wait();
      } else {
        console.log(`[Web3] Transferring ${depositAmount} USDC to Agent address ${agentWallet.address}`);
        const usdcContract = new ethers.Contract(contractAddresses.token, [
          "function transfer(address to, uint256 value) external returns (bool)",
          "function decimals() external view returns (uint8)"
        ], signer);
        
        let decimals = 18;
        try {
          const dec = await usdcContract.decimals();
          decimals = Number(dec);
        } catch (e) {
          decimals = 6;
        }

        const tx = await usdcContract.transfer(agentWallet.address, ethers.parseUnits(depositAmount, decimals));
        await tx.wait();
      }

      console.log('[Web3] Deposit confirmed!');
      setDepositAmount('');
      await connectMetaMask();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Deposit transaction failed');
    } finally {
      setIsDepositing(false);
    }
  };

  // Withdraw funds from agent proxy back to user wallet
  const handleWithdraw = async () => {
    if (!userWallet.address || !withdrawAmount) {
      setError('Please enter a withdraw amount');
      return;
    }
    setIsWithdrawing(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/agent/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientAddress: userWallet.address,
          amount: withdrawAmount,
          token: withdrawToken
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to process withdrawal');
      }

      setWithdrawAmount('');
      await connectMetaMask();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Withdrawal failed');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Manual trade execution has been taken down as per user request.

  // Handle Client-Side User NFT Minting
  const handleUserMintNFT = async () => {
    setError(null);
    if (!userWallet.address) {
      setError('Please connect your MetaMask wallet first.');
      return;
    }
    setIsMintingNft(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const nftContract = new ethers.Contract(contractAddresses.nft, [
        "function mint(string calldata uri) external returns (uint256)",
        "function nextTokenId() external view returns (uint256)"
      ], signer);

      console.log('[NFT] Requesting NFT mint via MetaMask...');
      const tx = await nftContract.mint(nftUri);
      console.log('[NFT] Transaction broadcasted. Waiting confirmation...');
      await tx.wait();
      
      let tokenId = '0';
      try {
        const nextId = await nftContract.nextTokenId();
        tokenId = (nextId - 1n).toString();
      } catch (e) {
        tokenId = Math.floor(Math.random() * 1000).toString();
      }

      const newBadge: NftBadge = {
        tokenId,
        owner: userWallet.address,
        uri: nftUri,
        minter: 'USER',
        timestamp: new Date().toLocaleTimeString()
      };
      
      setMintedNfts(prev => [newBadge, ...prev]);
      alert(`NFT successfully minted on Monad Testnet! Token ID: ${tokenId}`);
      await connectMetaMask();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'NFT minting transaction failed.');
    } finally {
      setIsMintingNft(false);
    }
  };

  // Analyze social feeds pipeline
  const runSocialPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSocialLoading(true);
    setError(null);
    setSocialResult(null);

    const activeHandles = Object.entries(handles)
      .filter(([_, active]) => active)
      .map(([handle]) => `@${handle}`);

    const activeSubs = redditSub ? [redditSub] : [];

    const steps = [
      'Establishing connection to Web3 social scrapers...',
      'Aggregating whale tweets & Reddit selftext data...',
      'Synthesizing combined social text stream...',
      'Running Groq Llama narrative sentiment indexer...',
      'Determining on-chain trading signals...',
      'Executing automated swap on Monad Testnet...',
      'Mints commemorative social narrative Badge NFT...',
      'Ledger confirmation complete!'
    ];

    let currentStep = 0;
    setSocialLoadingStep(0);
    const stepInterval = setInterval(() => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        setSocialLoadingStep(currentStep);
      }
    }, 1500);

    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twitterHandles: activeHandles,
          subreddits: activeSubs
        })
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze social feeds');
      }

      const data = await response.json();
      setSocialResult(data);
      await connectMetaMask(); // Refresh balances

      // Add to local history list
      const newItem: HistoryItem = {
        id: Math.random().toString(),
        url: `Social: ${activeHandles.join(', ')}`,
        transcript: data.synthesizedText,
        sentiment: data.analysis.sentiment,
        confidence: data.analysis.confidence,
        txHash: data.tradeResult ? data.tradeResult.txHash : 'NO_TRADE',
        timestamp: new Date().toLocaleTimeString(),
        analysis: {
          justification: data.analysis.justification,
          token_ticker: data.analysis.token_ticker
        },
        nftMinted: data.nftMinted,
        nftTxHash: data.nftResult?.txHash
      };
      setLocalHistory(prev => [newItem, ...prev]);

    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || 'Social pipeline execution failed');
    } finally {
      setIsSocialLoading(false);
    }
  };

  // Analyze video transcript pipeline
  const runPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl) {
      setError('Please provide a valid YouTube URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    const steps = [
      'Extracting YouTube captions & audio metadata...',
      'Synthesizing transcript content...',
      'Calling Groq Llama-3-70b sentiment engines...',
      'Compiling structured risk parameters & ticker details...',
      'Broadcasting autonomous DEX trade transaction on Monad...',
      'Finalizing transaction block confirmations...',
      'Autonomously minting commemorative signal Badge NFT...',
      'Writing persistent transaction details to context.md ledger...'
    ];

    let currentStep = 0;
    setLoadingStep(0);
    const stepInterval = setInterval(() => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        setLoadingStep(currentStep);
      }
    }, 1800);

    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl }),
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze transcript');
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
      
      await connectMetaMask();

      const newItem: HistoryItem = {
        id: Math.random().toString(),
        url: youtubeUrl,
        transcript: data.transcript,
        sentiment: data.analysis.sentiment,
        confidence: data.analysis.confidence,
        txHash: data.tradeResult ? data.tradeResult.txHash : 'NO_TRADE',
        timestamp: new Date().toLocaleTimeString(),
        analysis: {
          justification: data.analysis.justification,
          token_ticker: data.analysis.token_ticker
        },
        nftMinted: data.nftMinted,
        nftTxHash: data.nftResult?.txHash
      };
      setLocalHistory(prev => [newItem, ...prev]);

      // If the agent autonomously minted an NFT, add it to the local collection list
      if (data.nftMinted && data.nftResult) {
        const agentBadge: NftBadge = {
          tokenId: (mintedNfts.length + 1).toString(),
          owner: agentWallet.address || '0xAgent',
          uri: youtubeUrl,
          minter: 'AI_AGENT',
          timestamp: new Date().toLocaleTimeString()
        };
        setMintedNfts(prev => [agentBadge, ...prev]);
      }

    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || 'An error occurred during pipeline execution');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-cream text-charcoal flex flex-col p-6 font-sans">
      
      {/* HEADER */}
      <header className="border-3 border-charcoal bg-cream p-6 shadow-neo flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-4 w-4 bg-monad-purple border border-charcoal rounded-full animate-pulse"></span>
            <span className="text-xs uppercase font-bold tracking-widest text-[#666]">Monad Hackathon v2</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight uppercase">
            Monad <span className="text-monad-purple">Sentiment</span> Quant
          </h1>
          <p className="text-sm mt-1 text-[#444] font-medium max-w-lg">
            Autonomous video-to-chain trading and NFT minting platform built for the Monad Testnet.
          </p>
        </div>

        {/* METAMASK CONNECTION BLOCK */}
        <div className="flex flex-col gap-2 w-full md:w-auto">
          {!userWallet.isConnected ? (
            <button
              onClick={connectMetaMask}
              className="bg-monad-purple text-cream font-bold px-6 py-3 border-2 border-charcoal shadow-neo hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#1A1A1A] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all flex items-center justify-center gap-2"
            >
              <Wallet size={18} />
              CONNECT METAMASK
            </button>
          ) : (
            <div className="border-2 border-charcoal bg-cream p-3 flex flex-col gap-1 text-xs font-mono w-full md:w-64 relative shadow-neo-sm">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#666]">USER WALLET</span>
                <span className="h-2 w-2 bg-emerald-500 rounded-full"></span>
              </div>
              <div className="text-sm font-bold truncate">{userWallet.address}</div>
              <div className="flex justify-between mt-1 text-[11px]">
                <span className="font-bold">{userWallet.balance} MON</span>
                <span className="font-bold text-monad-purple">{userWallet.userUsdcBalance} USDC</span>
              </div>
              <button 
                onClick={importUsdcToken}
                className="mt-1 text-left text-[10px] underline text-monad-purple font-bold hover:text-purple-800"
              >
                Import USDC to MetaMask
              </button>
              {userWallet.chainId !== MONAD_CHAIN_ID && (
                <button
                  onClick={switchNetwork}
                  className="mt-2 w-full bg-monad-orange text-cream font-bold py-1 border border-charcoal text-[10px] tracking-wider uppercase"
                >
                  SWITCH TO MONAD TESTNET
                </button>
              )}
              <button 
                onClick={disconnectWallet}
                className="mt-1 text-left text-[9px] underline text-[#777] hover:text-charcoal"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ERROR ALERT */}
      {error && (
        <div className="border-3 border-red-500 bg-red-50 p-4 text-xs font-bold text-red-700 flex items-start gap-2 shadow-neo-sm mb-6">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* DISCONNECTED STATE */}
      {!userWallet.isConnected ? (
        <main className="flex-1 flex items-center justify-center my-12">
          <section className="max-w-2xl border-3 border-charcoal bg-cream p-8 md:p-12 shadow-neo text-center">
            <div className="h-16 w-16 bg-[#1A1A1A] text-cream flex items-center justify-center rounded-full mx-auto mb-6">
              <Shield size={32} />
            </div>
            
            <h2 className="text-2xl font-black uppercase mb-4 tracking-tight">Autonomous Sentiment & NFT Platform</h2>
            
            <p className="text-sm text-[#444] leading-relaxed mb-8 max-w-lg mx-auto font-medium">
              A premium brutalist dapp designed for Monad Testnet:
              <br/><br/>
              - **Sentiment Trading**: Extracts video transcripts, runs keyword-ratio AI sentiment analyses, and issues swaps.
              - **NFT Minting App**: Deploys commemorative ERC721 NFT badges on Monad Testnet, supporting direct user MetaMask minting and autonomous AI agent signal badge issuance.
            </p>

            <button
              onClick={connectMetaMask}
              className="bg-charcoal text-cream font-black text-sm tracking-widest px-8 py-4 border-2 border-charcoal hover:-translate-x-1 hover:-translate-y-1 hover:shadow-neo active:translate-x-0 active:translate-y-0 active:shadow-none transition-all uppercase"
            >
              Connect MetaMask Wallet to Access Dashboard
            </button>
          </section>
        </main>
      ) : (
        /* CONNECTED DASHBOARD */
        <main className="flex-1 flex flex-col gap-8">
          
          {/* HACKATHON FAUCET SECTION */}
          <section className="border-3 border-charcoal bg-cream p-6 shadow-neo flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <Droplet size={18} className="text-monad-purple" />
                Monad Hackathon Faucet Token Drop
              </h3>
              <p className="text-xs text-[#555] mt-1 font-medium">
                Claim mock USDC faucet tokens directly to your MetaMask wallet. Deposit them to the AI agent burner to enable narrative swaps.
              </p>
            </div>
            <button
              onClick={handleClaimFaucetUSDC}
              disabled={isClaimingFaucet}
              className="bg-charcoal text-cream font-black text-xs tracking-wider px-6 py-3 border-2 border-charcoal shadow-neo hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#1A1A1A] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all uppercase flex items-center gap-2 shrink-0"
            >
              {isClaimingFaucet ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  MINTING FAUCET...
                </>
              ) : (
                <>
                  CLAIM 10.0 USDC FAUCET
                </>
              )}
            </button>
          </section>

          {/* TAB BAR SELECTOR */}
          <div className="flex gap-4 border-b-2 border-charcoal pb-4 mb-4">
            <button
              onClick={() => setActiveTab('trading')}
              className={`font-black text-xs uppercase px-5 py-3 border-2 border-charcoal shadow-neo-sm hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all
                ${activeTab === 'trading' ? 'bg-monad-purple text-cream' : 'bg-cream text-charcoal'}`}
            >
              Sentiment Trading Hub
            </button>
            <button
              onClick={() => setActiveTab('social')}
              className={`font-black text-xs uppercase px-5 py-3 border-2 border-charcoal shadow-neo-sm hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all
                ${activeTab === 'social' ? 'bg-[#FFC700] text-charcoal' : 'bg-cream text-charcoal'}`}
            >
              💬 Social Whale Scanner
            </button>
            <button
              onClick={() => setActiveTab('nft')}
              className={`font-black text-xs uppercase px-5 py-3 border-2 border-charcoal shadow-neo-sm hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all
                ${activeTab === 'nft' ? 'bg-monad-orange text-cream' : 'bg-cream text-charcoal'}`}
            >
              🚀 NFT Minting Hub
            </button>
          </div>

          {/* TRADING HUB TAB VIEW */}
          {activeTab === 'trading' ? (
            <div className="flex flex-col gap-12">
              
              {/* AGENT WALLET SETUP & CONTROL PANEL */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* LEFT PANEL: AGENT WALLET LIFECYCLE */}
                <div className="lg:col-span-7 border-3 border-charcoal bg-cream p-6 shadow-neo">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-8 bg-[#1A1A1A] flex items-center justify-center text-cream">
                      <Shield size={16} />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tight">AI Agent burner proxy lifecycle</h2>
                  </div>

                  {!agentWallet.isDeployed ? (
                    <div className="border-2 border-dashed border-charcoal p-8 text-center bg-[#FAF8F5]">
                      <p className="text-sm font-semibold text-[#555] mb-6">
                        No AI Agent burner wallet has been generated for this environment yet. 
                        Deploy one to enable autonomous trading execution.
                      </p>
                      <button
                        onClick={handleDeployAgent}
                        disabled={isDeployingAgent}
                        className="bg-monad-purple text-cream font-black text-xs tracking-wider px-6 py-3 border-2 border-charcoal shadow-neo hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#1A1A1A] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all uppercase inline-flex items-center gap-2"
                      >
                        {isDeployingAgent ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Generating Wallet...
                          </>
                        ) : (
                          <>
                            <PlusCircle size={14} />
                            Generate Agent Burner Wallet
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6">
                      
                      {/* WALLET DEPLOYED DETAILS */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="border-2 border-charcoal p-4 bg-[#FAF8F5] md:col-span-1">
                          <span className="text-[10px] uppercase font-bold text-[#666]">Agent address</span>
                          <div className="font-mono text-xs font-bold truncate mt-1 text-monad-purple">
                            {agentWallet.address}
                          </div>
                        </div>
                        <div className="border-2 border-charcoal p-4 bg-[#FAF8F5]">
                          <span className="text-[10px] uppercase font-bold text-[#666]">Agent MON Balance</span>
                          <div className="font-mono text-base font-bold mt-0.5 text-charcoal">
                            {agentWallet.balance} <span className="text-xs text-[#555]">MON</span>
                          </div>
                        </div>
                        <div className="border-2 border-charcoal p-4 bg-[#FAF8F5]">
                          <span className="text-[10px] uppercase font-bold text-[#666]">Agent USDC Balance</span>
                          <div className="font-mono text-base font-bold mt-0.5 text-monad-purple">
                            {agentWallet.usdcBalance} <span className="text-xs text-[#555]">USDC</span>
                          </div>
                        </div>
                      </div>

                      {/* DEPOSIT & WITHDRAW CONTROLS */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        
                        {/* DEPOSIT FORM */}
                        <div className="border-2 border-charcoal p-4 flex flex-col gap-3">
                          <h4 className="text-xs font-black uppercase text-[#444] flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <ArrowUpCircle size={14} className="text-emerald-600" />
                              Deposit to Agent
                            </span>
                            <div className="flex gap-2 text-[10px] font-bold">
                              <button
                                type="button"
                                onClick={() => setDepositToken('MON')}
                                className={`px-1.5 py-0.5 border ${depositToken === 'MON' ? 'bg-charcoal text-cream' : 'border-charcoal/20'}`}
                              >
                                MON
                              </button>
                              <button
                                type="button"
                                onClick={() => setDepositToken('USDC')}
                                className={`px-1.5 py-0.5 border ${depositToken === 'USDC' ? 'bg-charcoal text-cream' : 'border-charcoal/20'}`}
                              >
                                USDC
                              </button>
                            </div>
                          </h4>
                          <p className="text-[10px] text-[#666] leading-relaxed">
                            Transfer native MON gas or USDC tokens to the agent's proxy address.
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.01"
                              placeholder={`Amount in ${depositToken}`}
                              value={depositAmount}
                              onChange={(e) => setDepositAmount(e.target.value)}
                              disabled={isDepositing}
                              className="flex-1 bg-[#FAF8F5] border border-charcoal px-3 py-1.5 font-mono text-xs outline-none"
                            />
                            <button
                              onClick={handleDeposit}
                              disabled={isDepositing || !depositAmount}
                              className="bg-charcoal text-cream font-bold px-4 py-1.5 border border-charcoal text-xs hover:bg-[#333] transition-colors"
                            >
                              {isDepositing ? 'Sending...' : 'Deposit'}
                            </button>
                          </div>
                        </div>

                        {/* WITHDRAW FORM */}
                        <div className="border-2 border-charcoal p-4 flex flex-col gap-3">
                          <h4 className="text-xs font-black uppercase text-[#444] flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <ArrowDownCircle size={14} className="text-monad-orange" />
                              Withdraw from Agent
                            </span>
                            <div className="flex gap-2 text-[10px] font-bold">
                              <button
                                type="button"
                                onClick={() => setWithdrawToken('MON')}
                                className={`px-1.5 py-0.5 border ${withdrawToken === 'MON' ? 'bg-charcoal text-cream' : 'border-charcoal/20'}`}
                              >
                                MON
                              </button>
                              <button
                                type="button"
                                onClick={() => setWithdrawToken('USDC')}
                                className={`px-1.5 py-0.5 border ${withdrawToken === 'USDC' ? 'bg-charcoal text-cream' : 'border-charcoal/20'}`}
                              >
                                USDC
                              </button>
                            </div>
                          </h4>
                          <p className="text-[10px] text-[#666] leading-relaxed">
                            Retrieve gas or USDC back from the burner proxy to MetaMask.
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.01"
                              placeholder={`Amount in ${withdrawToken}`}
                              value={withdrawAmount}
                              onChange={(e) => setWithdrawAmount(e.target.value)}
                              disabled={isWithdrawing}
                              className="flex-1 bg-[#FAF8F5] border border-charcoal px-3 py-1.5 font-mono text-xs outline-none"
                            />
                            <button
                              onClick={handleWithdraw}
                              disabled={isWithdrawing || !withdrawAmount}
                              className="bg-monad-orange text-cream font-bold px-4 py-1.5 border border-charcoal text-xs hover:bg-orange-600 transition-colors"
                            >
                              {isWithdrawing ? 'Sending...' : 'Withdraw'}
                            </button>
                          </div>
                        </div>

                      </div>

                    </div>
                  )}
                </div>

                {/* RIGHT PANEL: CONTRACT INFORMATION */}
                <div className="lg:col-span-5 border-3 border-charcoal bg-cream p-6 shadow-neo flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-black uppercase mb-3 tracking-tight">Contract Information</h3>
                    <p className="text-xs text-[#555] leading-relaxed mb-4">
                      Addresses for deployed smart contracts interfacing with the Autonomous AI Sentiment Agent on Monad Testnet.
                    </p>
                  </div>

                  <div className="border-t border-charcoal/20 pt-4 mt-6 text-xs flex flex-col gap-1.5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#666] block">Mock DEX Target Address</span>
                      <span className="font-mono text-[#333] block truncate font-bold">{contractAddresses.dex}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#666] block">USDC Token Contract Address</span>
                      <span className="font-mono text-monad-purple block truncate font-bold">{contractAddresses.token}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#666] block">MHB NFT Contract Address</span>
                      <span className="font-mono text-monad-purple block truncate font-bold">{contractAddresses.nft}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* LOWER PORTION: PIPELINE SCANNER */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* SCANNING & RESULT PIPELINE */}
                <div className="lg:col-span-7 flex flex-col gap-8">
                  
                  {/* SCANNER INPUT CARD */}
                  <section className="border-3 border-charcoal bg-cream p-8 shadow-neo">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="h-8 w-8 bg-[#1A1A1A] flex items-center justify-center text-cream">
                        <Tv size={16} />
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-tight">Narrative Scanner</h2>
                    </div>
                    
                    <form onSubmit={runPipeline} className="flex flex-col gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase mb-2 tracking-wider text-[#333]">
                          YouTube Video URL
                        </label>
                        <input
                          type="url"
                          required
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={youtubeUrl}
                          onChange={(e) => setYoutubeUrl(e.target.value)}
                          disabled={isLoading || !agentWallet.isDeployed}
                          className="w-full bg-[#FAF8F5] text-charcoal border-2 border-charcoal px-4 py-3 font-mono text-sm shadow-inner outline-none focus:bg-white focus:ring-1 focus:ring-charcoal transition-all disabled:opacity-50"
                        />
                        {!agentWallet.isDeployed && (
                          <span className="text-[10px] text-red-600 font-bold block mt-1">
                            * Please initialize the AI Agent burner wallet first.
                          </span>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading || !agentWallet.isDeployed}
                        className={`w-full font-black text-sm tracking-widest uppercase border-2 border-charcoal py-4 transition-all flex items-center justify-center gap-2
                          ${isLoading || !agentWallet.isDeployed
                            ? 'bg-amber-100 cursor-not-allowed opacity-60' 
                            : 'bg-charcoal text-cream hover:-translate-x-1 hover:-translate-y-1 hover:shadow-neo active:translate-x-0 active:translate-y-0 active:shadow-none'
                          }`}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            PROCESSING PIPELINE
                          </>
                        ) : (
                          <>
                            ANALYZE TRANSCRIPT & AUTOMATE SWAP
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    </form>
                  </section>

                  {/* LOADER TIMELINE */}
                  {isLoading && (
                    <section className="border-2 border-charcoal bg-cream p-6 shadow-neo font-mono text-xs">
                      <div className="flex items-center justify-between mb-4 border-b border-charcoal pb-2">
                        <span className="font-bold uppercase tracking-wider flex items-center gap-2">
                          <Terminal size={14} className="animate-pulse text-monad-purple" />
                          Agent Execution Loop Logs
                        </span>
                        <span className="text-[10px] text-cream bg-charcoal px-1.5 py-0.5">ACTIVE</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {[
                          'Extracting YouTube captions & audio metadata...',
                          'Synthesizing transcript content...',
                          'Calling Groq Llama-3-70b sentiment engines...',
                          'Compiling structured risk parameters & ticker details...',
                          'Broadcasting autonomous DEX trade transaction on Monad...',
                          'Finalizing transaction block confirmations...',
                          'Autonomously minting commemorative signal Badge NFT...',
                          'Writing persistent transaction details to context.md ledger...'
                        ].map((stepText, idx) => {
                          const isDone = loadingStep > idx;
                          const isActive = loadingStep === idx;
                          
                          return (
                            <div key={idx} className={`flex items-center gap-3 transition-opacity duration-300 ${isDone ? 'text-emerald-700 opacity-100' : isActive ? 'text-charcoal font-bold opacity-100' : 'text-gray-400 opacity-60'}`}>
                              <div className={`h-4 w-4 rounded-full border border-charcoal flex items-center justify-center text-[8px] font-black
                                ${isDone ? 'bg-emerald-500 text-cream' : isActive ? 'bg-amber-400 text-charcoal animate-bounce' : 'bg-transparent'}`}>
                                {isDone ? '✓' : idx + 1}
                              </div>
                              <span>{stepText}</span>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* OUTPUT DETAILS DASHBOARD */}
                  {result && (
                    <section className="border-3 border-charcoal bg-cream p-8 shadow-neo flex flex-col gap-6">
                      <div className="border-b border-charcoal pb-4 flex justify-between items-start">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-[#777]">Pipeline Outcome</span>
                          <h3 className="text-xl font-black uppercase">Analysis Metrics</h3>
                        </div>
                        <span className="text-xs font-mono font-bold text-[#555]">{new Date(result.timestamp).toLocaleTimeString()}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="border-2 border-charcoal p-5 bg-cream flex flex-col justify-between shadow-neo-sm">
                          <div className="text-xs font-bold uppercase tracking-wider text-[#666] mb-2">Narrative Sentiment</div>
                          <div className="flex items-center gap-3">
                            {result.analysis.sentiment === 'BULLISH' ? (
                              <div className="h-10 w-10 rounded-full bg-emerald-500 border-2 border-charcoal flex items-center justify-center text-cream">
                                <TrendingUp size={20} />
                              </div>
                            ) : result.analysis.sentiment === 'BEARISH' ? (
                              <div className="h-10 w-10 rounded-full bg-red-500 border-2 border-charcoal flex items-center justify-center text-cream">
                                <TrendingDown size={20} />
                              </div>
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-200 border-2 border-charcoal flex items-center justify-center text-charcoal">
                                <Layers size={20} />
                              </div>
                            )}
                            <div>
                              <div className={`text-2xl font-black tracking-tighter ${result.analysis.sentiment === 'BULLISH' ? 'text-emerald-600' : result.analysis.sentiment === 'BEARISH' ? 'text-red-600' : 'text-charcoal'}`}>
                                {result.analysis.sentiment}
                              </div>
                              <div className="text-[10px] font-mono text-[#555]">Confidence: {(result.analysis.confidence * 100).toFixed(2)}%</div>
                            </div>
                          </div>
                        </div>

                        <div className="border-2 border-charcoal p-5 bg-cream flex flex-col justify-between shadow-neo-sm">
                          <div className="text-xs font-bold uppercase tracking-wider text-[#666] mb-2">Decided Action</div>
                          <div>
                            <div className={`text-3xl font-black uppercase ${result.analysis.sentiment === 'BULLISH' ? 'text-emerald-600' : result.analysis.sentiment === 'BEARISH' ? 'text-red-600' : 'text-charcoal'}`}>
                              {result.analysis.sentiment === 'BULLISH' ? 'BUY MONAD' : result.analysis.sentiment === 'BEARISH' ? 'SELL MONAD' : 'DO NOTHING'}
                            </div>
                            <span className="text-[9px] font-bold text-[#555] block mt-1">
                              {result.analysis.sentiment === 'BULLISH' ? 'Swapping USDC to MON' : result.analysis.sentiment === 'BEARISH' ? 'Swapping MON to USDC' : 'Resting on-chain'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="border-2 border-charcoal p-5 bg-[#FAF8F5]">
                        <div className="text-xs font-bold uppercase tracking-wider text-[#666] mb-2">Quant Rationale</div>
                        <p className="text-sm font-medium leading-relaxed italic text-charcoal">
                          {result.analysis.justification}
                        </p>
                      </div>

                      {/* TX RESULT */}
                      <div className="border-2 border-charcoal p-6 bg-cream shadow-neo-sm">
                        <div className="flex justify-between items-center mb-4">
                          <div className="text-xs font-bold uppercase tracking-wider text-[#666]">On-Chain Swap Status</div>
                          {result.tradeExecuted ? (
                            <span className="px-2 py-0.5 bg-emerald-500 text-cream text-[10px] font-bold border border-charcoal uppercase">Executed</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-500 text-charcoal text-[10px] font-bold border border-charcoal uppercase">Skipped</span>
                          )}
                        </div>

                        {result.tradeExecuted && result.tradeResult ? (
                          <div className="flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-[#FAF8F5] p-3 border border-dashed border-charcoal">
                              <div>
                                <span className="block text-[#666]">Swapped In</span>
                                <span className="font-bold text-red-600">{result.tradeResult.amountIn}</span>
                              </div>
                              <div>
                                <span className="block text-[#666]">Received Out</span>
                                <span className="font-bold text-emerald-600">{result.tradeResult.amountOut}</span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1 text-[11px] font-mono mt-1">
                              <div className="flex justify-between">
                                <span className="text-[#666]">Signature Type</span>
                                <span className="font-bold">Proxy Burner Wallet (Delegated)</span>
                              </div>
                              <div className="flex justify-between items-center gap-6 mt-1">
                                <span className="text-[#666]">Swap Tx Hash</span>
                                <span className="font-bold truncate max-w-[200px]">{result.tradeResult.txHash}</span>
                              </div>
                            </div>

                            {/* AUTONOMOUS NFT MINT RESULT */}
                            {result.nftMinted && result.nftResult && (
                              <div className="mt-3 pt-3 border-t border-charcoal/20 flex flex-col gap-1 text-[11px] font-mono">
                                <div className="flex justify-between text-monad-orange font-bold">
                                  <span>Autonomous NFT Mint</span>
                                  <span>SUCCESS (1 MHB)</span>
                                </div>
                                <div className="flex justify-between items-center gap-6">
                                  <span className="text-[#666]">Mint Tx Hash</span>
                                  <span className="font-bold truncate max-w-[200px] text-monad-orange">{result.nftResult.txHash}</span>
                                </div>
                              </div>
                            )}

                            {result.tradeResult.simulated && (
                              <div className="mt-2 border border-amber-500 bg-amber-50 p-3 text-[10px] text-amber-800 leading-relaxed font-medium">
                                <strong>Notice:</strong> Wallet signed transaction locally, but bypassed actual network broadcast due to RPC/funding status. Safe for test networks.
                              </div>
                            )}

                            <div className="mt-2 pt-3 border-t border-charcoal flex justify-between items-center">
                              <span className="text-[10px] text-[#666] font-bold">MONAD BLOCK EXPLORER</span>
                              <a 
                                href={`https://testnet.monadexplorer.com/tx/${result.tradeResult.txHash}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-xs font-bold text-monad-purple hover:underline flex items-center gap-1"
                              >
                                Verify TX <ExternalLink size={12} />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-[#666] leading-relaxed">
                            No trade transaction was issued on Monad Testnet because the model sentiment confidence score ({(result.analysis.confidence * 100).toFixed(2)}%) fell below the delegated execution threshold limit (75%).
                          </p>
                        )}
                      </div>
                    </section>
                  )}
                </div>

                {/* RIGHT SIDEBAR: SESSION HISTORY INSPECTOR */}
                <div className="lg:col-span-5 flex flex-col gap-8">
                  
                  <section className="border-3 border-charcoal bg-cream p-6 shadow-neo">
                    <div className="flex items-center justify-between mb-6 border-b border-charcoal pb-3">
                      <h3 className="text-lg font-black uppercase tracking-tight">Narrative History Ledger</h3>
                      <span className="px-2 py-0.5 bg-[#1A1A1A] text-cream text-[9px] font-bold font-mono">
                        {localHistory.length} VIDEOS SCANNED
                      </span>
                    </div>

                    {localHistory.length === 0 ? (
                      <p className="text-xs text-[#666] leading-relaxed py-8 border-2 border-dashed border-charcoal text-center bg-[#FAF8F5]">
                        No videos scanned in the current session.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-2">
                        {localHistory.map((item) => {
                          const isExpanded = expandedHistoryId === item.id;
                          return (
                            <div key={item.id} className="border-2 border-charcoal p-4 bg-cream shadow-neo-sm text-xs flex flex-col gap-2 transition-all">
                              <div className="flex justify-between items-center">
                                <span className="font-mono text-[9px] text-[#666]">{item.timestamp}</span>
                                <span className={`px-1.5 py-0.5 text-[9px] font-bold border border-charcoal uppercase
                                  ${item.sentiment === 'BULLISH' ? 'bg-emerald-100 text-emerald-800' : item.sentiment === 'BEARISH' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                  {item.sentiment} ({(item.confidence * 100).toFixed(2)}%)
                                </span>
                              </div>

                              <div className="font-mono text-[#333] break-all leading-tight font-bold">
                                URL: <a href={item.url} target="_blank" rel="noreferrer" className="underline hover:text-monad-purple">{item.url}</a>
                              </div>

                              <p className="text-[11px] text-[#555] leading-relaxed">
                                <strong>AI Decision:</strong> {item.analysis.justification}
                              </p>

                              {item.nftMinted && (
                                <div className="flex items-center gap-1.5 text-monad-orange font-bold text-[10px] mt-1">
                                  <Award size={12} />
                                  <span>Autonomously Minted Commemorative NFT Badge</span>
                                </div>
                              )}

                              <div className="flex justify-between text-[10px] font-mono border-t border-charcoal/10 pt-2 mt-1">
                                <span className="text-[#666]">Tx: {item.txHash.slice(0, 14)}...</span>
                                <button
                                  onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                                  className="text-monad-purple font-bold hover:underline flex items-center gap-1 uppercase text-[9px]"
                                >
                                  <FileText size={12} />
                                  {isExpanded ? 'Hide Transcript' : 'View Transcript'}
                                  {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                </button>
                              </div>

                              {/* EXPANDABLE TRANSCRIPT BOX */}
                              {isExpanded && (
                                <div className="mt-3 pt-3 border-t-2 border-charcoal bg-[#FAF8F5] p-3 border border-charcoal flex flex-col gap-2">
                                  <div className="flex justify-between items-center text-[10px] font-bold uppercase text-[#666]">
                                    <span>Full YouTube Transcript</span>
                                    <button
                                      onClick={() => copyToClipboard(item.transcript)}
                                      className="text-monad-purple hover:underline flex items-center gap-1 font-mono text-[9px]"
                                    >
                                      <Copy size={10} />
                                      Copy Text
                                    </button>
                                  </div>
                                  <div className="max-h-40 overflow-y-auto pr-1 text-[10px] font-mono text-[#444] leading-relaxed whitespace-pre-wrap border border-charcoal/10 p-2 bg-white">
                                    {item.transcript}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* PERSISTENT LEDGER NOTICE */}
                  <section className="border-2 border-charcoal bg-cream p-4 text-xs">
                    <div className="font-bold text-charcoal uppercase mb-1">Execution Loop Logger</div>
                    <p className="text-[#666] leading-relaxed">
                      Every operation executed by this agent is logged directly to the server console log for security, performance, and audit compliance on Monad Testnet.
                    </p>
                  </section>

                </div>

              </div>

            </div>
          ) : activeTab === 'social' ? (
            /* SOCIAL SCANNER TAB VIEW */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN: SCANNER PARAMETERS */}
              <div className="lg:col-span-7 flex flex-col gap-8">
                
                <section className="border-3 border-charcoal bg-cream p-8 shadow-neo">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-8 bg-[#1A1A1A] flex items-center justify-center text-cream">
                      <Tv size={16} />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Social Whale Scanner</h2>
                  </div>
                  
                  <form onSubmit={runSocialPipeline} className="flex flex-col gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase mb-3 tracking-wider text-[#333]">
                        Targeted Crypto Whale X (Twitter) Accounts
                      </label>
                      <div className="flex flex-wrap gap-4">
                        {['keoneHD', 'monad_xyz', 'cryptowhale'].map((h) => (
                          <label key={h} className="flex items-center gap-2 font-mono text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={(handles as any)[h]}
                              onChange={(e) => setHandles(prev => ({ ...prev, [h]: e.target.checked }))}
                              className="accent-monad-purple h-4 w-4 border-2 border-charcoal outline-none"
                            />
                            @{h}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase mb-2 tracking-wider text-[#333]">
                        Targeted Subreddit Feed
                      </label>
                      <div className="flex gap-2">
                        <span className="bg-[#FAF8F5] border-2 border-r-0 border-charcoal px-3 py-2.5 font-mono text-xs flex items-center justify-center text-[#666]">r/</span>
                        <input
                          type="text"
                          placeholder="monad"
                          value={redditSub}
                          onChange={(e) => setRedditSub(e.target.value)}
                          className="flex-1 bg-[#FAF8F5] text-charcoal border-2 border-charcoal px-4 py-2.5 font-mono text-xs shadow-inner outline-none focus:bg-white focus:ring-1 focus:ring-charcoal transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSocialLoading || !agentWallet.isDeployed}
                      className={`w-full font-black text-sm tracking-widest uppercase border-2 border-charcoal py-4 transition-all flex items-center justify-center gap-2
                        ${isSocialLoading || !agentWallet.isDeployed
                          ? 'bg-amber-100 cursor-not-allowed opacity-60' 
                          : 'bg-[#FFC700] text-charcoal hover:-translate-x-1 hover:-translate-y-1 hover:shadow-neo active:translate-x-0 active:translate-y-0 active:shadow-none'
                        }`}
                    >
                      {isSocialLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          SCANNING FEEDS...
                        </>
                      ) : (
                        <>
                          SCAN FEEDS & EXECUTE NARRATIVE SWAP
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>
                </section>

                {/* LOADER TIMELINE */}
                {isSocialLoading && (
                  <section className="border-2 border-charcoal bg-cream p-6 shadow-neo font-mono text-xs">
                    <div className="flex items-center justify-between mb-4 border-b border-charcoal pb-2">
                      <span className="font-bold uppercase tracking-wider flex items-center gap-2">
                        <Terminal size={14} className="animate-pulse text-monad-purple" />
                        Agent Social Scan Logs
                      </span>
                      <span className="text-[10px] text-cream bg-charcoal px-1.5 py-0.5">ACTIVE</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {[
                        'Establishing connection to Web3 social scrapers...',
                        'Aggregating whale tweets & Reddit selftext data...',
                        'Synthesizing combined social text stream...',
                        'Running Groq Llama narrative sentiment indexer...',
                        'Determining on-chain trading signals...',
                        'Executing automated swap on Monad Testnet...',
                        'Mints commemorative social narrative Badge NFT...',
                        'Ledger confirmation complete!'
                      ].map((stepText, idx) => {
                        const isDone = socialLoadingStep > idx;
                        const isActive = socialLoadingStep === idx;
                        
                        return (
                          <div key={idx} className={`flex items-center gap-3 transition-opacity duration-300 ${isDone ? 'text-emerald-700 opacity-100' : isActive ? 'text-charcoal font-bold opacity-100' : 'text-gray-400 opacity-60'}`}>
                            <div className={`h-4 w-4 rounded-full border border-charcoal flex items-center justify-center text-[8px] font-black
                              ${isDone ? 'bg-emerald-500 text-cream' : isActive ? 'bg-amber-400 text-charcoal animate-bounce' : 'bg-transparent'}`}>
                              {isDone ? '✓' : idx + 1}
                            </div>
                            <span>{stepText}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* OUTPUT RESULTS */}
                {socialResult && (
                  <section className="border-3 border-charcoal bg-cream p-8 shadow-neo flex flex-col gap-6">
                    <div className="border-b border-charcoal pb-4 flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-[#777]">Social Pipeline Outcome</span>
                        <h3 className="text-xl font-black uppercase">Sentiment Metrics</h3>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#555]">{new Date(socialResult.timestamp).toLocaleTimeString()}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="border-2 border-charcoal p-5 bg-cream flex flex-col justify-between shadow-neo-sm">
                        <div className="text-xs font-bold uppercase tracking-wider text-[#666] mb-2">Social Sentiment</div>
                        <div className="flex items-center gap-3">
                          {socialResult.analysis.sentiment === 'BULLISH' ? (
                            <div className="h-10 w-10 rounded-full bg-emerald-500 border-2 border-charcoal flex items-center justify-center text-cream">
                              <TrendingUp size={20} />
                            </div>
                          ) : socialResult.analysis.sentiment === 'BEARISH' ? (
                            <div className="h-10 w-10 rounded-full bg-red-500 border-2 border-charcoal flex items-center justify-center text-cream">
                              <TrendingDown size={20} />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 border-2 border-charcoal flex items-center justify-center text-charcoal">
                              <Layers size={20} />
                            </div>
                          )}
                          <div>
                            <div className={`text-2xl font-black tracking-tighter ${socialResult.analysis.sentiment === 'BULLISH' ? 'text-emerald-600' : socialResult.analysis.sentiment === 'BEARISH' ? 'text-red-600' : 'text-charcoal'}`}>
                              {socialResult.analysis.sentiment}
                            </div>
                            <div className="text-[10px] font-mono text-[#555]">Confidence: {(socialResult.analysis.confidence * 100).toFixed(2)}%</div>
                          </div>
                        </div>
                      </div>

                      <div className="border-2 border-charcoal p-5 bg-cream flex flex-col justify-between shadow-neo-sm">
                        <div className="text-xs font-bold uppercase tracking-wider text-[#666] mb-2">Decided Action</div>
                        <div>
                          <div className={`text-3xl font-black uppercase ${socialResult.analysis.sentiment === 'BULLISH' ? 'text-emerald-600' : socialResult.analysis.sentiment === 'BEARISH' ? 'text-red-600' : 'text-charcoal'}`}>
                            {socialResult.analysis.sentiment === 'BULLISH' ? 'BUY MONAD' : socialResult.analysis.sentiment === 'BEARISH' ? 'SELL MONAD' : 'DO NOTHING'}
                          </div>
                          <span className="text-[9px] font-bold text-[#555] block mt-1">
                            {socialResult.analysis.sentiment === 'BULLISH' ? 'Swapping USDC to MON' : socialResult.analysis.sentiment === 'BEARISH' ? 'Swapping MON to USDC' : 'Resting on-chain'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-2 border-charcoal p-5 bg-[#FAF8F5]">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#666] mb-2">Quant Rationale</div>
                      <p className="text-sm font-medium leading-relaxed italic text-charcoal">
                        {socialResult.analysis.justification}
                      </p>
                    </div>

                    {/* TX RESULT */}
                    <div className="border-2 border-charcoal p-6 bg-cream shadow-neo-sm">
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-[#666]">On-Chain Swap Status</div>
                        {socialResult.tradeExecuted ? (
                          <span className="px-2 py-0.5 bg-emerald-500 text-cream text-[10px] font-bold border border-charcoal uppercase">Executed</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-500 text-charcoal text-[10px] font-bold border border-charcoal uppercase">Skipped</span>
                        )}
                      </div>

                      {socialResult.tradeExecuted && socialResult.tradeResult ? (
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-[#FAF8F5] p-3 border border-dashed border-charcoal">
                            <div>
                              <span className="block text-[#666]">Swapped In</span>
                              <span className="font-bold text-red-600">{socialResult.tradeResult.amountIn}</span>
                            </div>
                            <div>
                              <span className="block text-[#666]">Received Out</span>
                              <span className="font-bold text-emerald-600">{socialResult.tradeResult.amountOut}</span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 text-[11px] font-mono mt-1">
                            <div className="flex justify-between">
                              <span className="text-[#666]">Signature Type</span>
                              <span className="font-bold">Proxy Burner Wallet (Delegated)</span>
                            </div>
                            <div className="flex justify-between items-center gap-6 mt-1">
                              <span className="text-[#666]">Swap Tx Hash</span>
                              <span className="font-bold truncate max-w-[200px]">{socialResult.tradeResult.txHash}</span>
                            </div>
                          </div>

                          {socialResult.nftMinted && socialResult.nftResult && (
                            <div className="mt-3 pt-3 border-t border-charcoal/20 flex flex-col gap-1 text-[11px] font-mono">
                              <div className="flex justify-between text-monad-orange font-bold">
                                <span>Autonomous NFT Mint</span>
                                <span>SUCCESS (1 MHB)</span>
                              </div>
                              <div className="flex justify-between items-center gap-6">
                                <span className="text-[#666]">Mint Tx Hash</span>
                                <span className="font-bold truncate max-w-[200px] text-monad-orange">{socialResult.nftResult.txHash}</span>
                              </div>
                            </div>
                          )}

                          <div className="mt-2 pt-3 border-t border-charcoal flex justify-between items-center">
                            <span className="text-[10px] text-[#666] font-bold">MONAD BLOCK EXPLORER</span>
                            <a 
                              href={`https://testnet.monadexplorer.com/tx/${socialResult.tradeResult.txHash}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-xs font-bold text-monad-purple hover:underline flex items-center gap-1"
                            >
                              Verify TX <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#666] leading-relaxed">
                          No trade transaction was issued because the sentiment confidence score ({(socialResult.analysis.confidence * 100).toFixed(2)}%) did not cross the delegated swap execution threshold limit (75%).
                        </p>
                      )}
                    </div>
                  </section>
                )}
              </div>

              {/* RIGHT COLUMN: SCANNED POSTS FEED */}
              <div className="lg:col-span-5 border-3 border-charcoal bg-cream p-6 shadow-neo">
                <div className="flex justify-between items-center mb-6 border-b border-charcoal pb-3">
                  <h3 className="text-base font-black uppercase tracking-tight">Aggregated Social Feed</h3>
                  {socialResult && (
                    <span className="px-2 py-0.5 bg-[#1A1A1A] text-cream text-[9px] font-bold font-mono">
                      {socialResult.postsCount} POSTS PARSED
                    </span>
                  )}
                </div>

                {!socialResult ? (
                  <div className="border-2 border-dashed border-charcoal p-12 text-center text-xs text-[#666] bg-[#FAF8F5]">
                    Trigger a scan to aggregate and preview the crypto whale feeds.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-2">
                    {socialResult.posts.map((post: any, idx: number) => (
                      <div key={idx} className="border-2 border-charcoal p-4 bg-cream shadow-neo-sm text-xs flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#666]">{new Date(post.timestamp).toLocaleTimeString()}</span>
                          <span className={`px-1.5 py-0.5 text-[8px] font-bold border border-charcoal uppercase
                            ${post.source === 'TWITTER' ? 'bg-[#1DA1F2]/10 text-[#1DA1F2]' : 'bg-[#FF4500]/10 text-[#FF4500]'}`}>
                            {post.source}
                          </span>
                        </div>
                        <div className="font-bold text-charcoal">{post.author}</div>
                        <p className="text-[11px] text-[#444] leading-relaxed whitespace-pre-wrap bg-[#FAF8F5] p-2 border border-charcoal/10">
                          {post.content}
                        </p>
                        <a href={post.url} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-monad-purple hover:underline self-end">
                          View Original Post →
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* NFT MINTING HUB TAB VIEW */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* LEFT COLUMN: ERC721 MINTER CARD */}
              <div className="lg:col-span-7 border-3 border-charcoal bg-cream p-8 shadow-neo flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-[#1A1A1A] flex items-center justify-center text-cream">
                    <Award size={18} />
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Monad Badge ERC721 Minter</h2>
                </div>

                <p className="text-xs text-[#555] leading-relaxed">
                  Mint a custom **Monad Hackathon Badge** NFT directly to your connected browser wallet. This ERC721 contract executes natively on the Monad Testnet.
                </p>

                <div className="border-2 border-charcoal p-4 bg-[#FAF8F5] text-xs font-mono flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-[#666]">NFT Smart Contract Target</span>
                  <span className="font-bold text-monad-orange block truncate">{contractAddresses.nft}</span>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#333]">
                    NFT Token Metadata URI (JSON)
                  </label>
                  <input
                    type="text"
                    value={nftUri}
                    onChange={(e) => setNftUri(e.target.value)}
                    disabled={isMintingNft}
                    className="w-full bg-[#FAF8F5] text-charcoal border-2 border-charcoal px-3 py-2.5 font-mono text-xs shadow-inner outline-none focus:bg-white focus:ring-1 focus:ring-charcoal transition-all"
                  />
                  <span className="text-[9px] text-[#666] leading-relaxed block">
                    Points to custom JSON metadata containing the NFT name, description, and media asset URL. Prefilled with hackathon badge metadata.
                  </span>
                </div>

                <button
                  onClick={handleUserMintNFT}
                  disabled={isMintingNft}
                  className="w-full bg-monad-orange text-cream font-black text-sm tracking-widest uppercase border-2 border-charcoal py-4 shadow-neo hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#1A1A1A] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  {isMintingNft ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      CONFIRMING NFT TRANSACTION...
                    </>
                  ) : (
                    <>
                      <Fingerprint size={16} />
                      MINT BADGE TO METAMASK
                    </>
                  )}
                </button>
              </div>

              {/* RIGHT COLUMN: NFT COLLECTION VIEWER */}
              <div className="lg:col-span-5 border-3 border-charcoal bg-cream p-6 shadow-neo flex flex-col gap-6">
                <div className="flex justify-between items-center border-b border-charcoal pb-3">
                  <h3 className="text-base font-black uppercase tracking-tight">Collection Ledger</h3>
                  <span className="px-2 py-0.5 bg-[#1A1A1A] text-cream text-[9px] font-bold font-mono">
                    {mintedNfts.length} NFT BADGES MINTED
                  </span>
                </div>

                {mintedNfts.length === 0 ? (
                  <div className="border-2 border-dashed border-charcoal p-12 text-center text-xs text-[#666] bg-[#FAF8F5]">
                    No badges minted in this session. Trigger your first mint to populate the local collection gallery!
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-2">
                    {mintedNfts.map((nft) => (
                      <div key={nft.tokenId} className="border-2 border-charcoal p-4 bg-cream shadow-neo-sm text-xs flex flex-col gap-3 relative">
                        <div className="absolute top-2 right-2 text-[8px] bg-charcoal text-cream font-mono px-1.5 py-0.5">
                          ID: #{nft.tokenId}
                        </div>

                        {/* BADGE EMBLEM */}
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 border-2 border-charcoal flex items-center justify-center rounded-full
                            ${nft.minter === 'AI_AGENT' ? 'bg-monad-purple text-cream' : 'bg-monad-orange text-cream'}`}>
                            <Award size={20} />
                          </div>
                          <div>
                            <div className="font-black text-sm uppercase tracking-tight">Monad Hackathon Badge</div>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1 border border-charcoal
                              ${nft.minter === 'AI_AGENT' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'}`}>
                              {nft.minter === 'AI_AGENT' ? 'AI Agent Mint' : 'User MetaMask Mint'}
                            </span>
                          </div>
                        </div>

                        {/* DATA SUMMARY */}
                        <div className="border-t border-charcoal/10 pt-2 font-mono text-[10px] flex flex-col gap-1 text-[#444]">
                          <div>
                            <span className="font-bold text-[#666] block">Owner:</span>
                            <span className="truncate block font-semibold">{nft.owner}</span>
                          </div>
                          <div>
                            <span className="font-bold text-[#666] block">Metadata:</span>
                            <span className="truncate block text-monad-purple underline">{nft.uri}</span>
                          </div>
                        </div>

                        <div className="border-t border-charcoal/10 pt-2 mt-1 flex justify-between items-center text-[9px] font-mono">
                          <span className="text-[#666]">{nft.timestamp}</span>
                          <a 
                            href={`https://testnet.monadexplorer.com/address/${contractAddresses.nft}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-monad-purple font-bold hover:underline flex items-center gap-0.5"
                          >
                            Verify Contract <ExternalLink size={10} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </main>
      )}

      {/* FOOTER */}
      <footer className="mt-auto pt-16 pb-6 text-center text-xs font-semibold text-[#888] border-t border-charcoal/20">
        <p>MONAD TESTNET SENTIMENT QUANT TRADING AGENT • BUILT FOR MONAD BLITZ v2 HACKATHON</p>
      </footer>

    </div>
  );
}
