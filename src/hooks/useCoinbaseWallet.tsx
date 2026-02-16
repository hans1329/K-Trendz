import { useState, useCallback, useRef } from 'react';
import { CoinbaseWalletSDK } from '@coinbase/wallet-sdk';
import { ethers } from 'ethers';

const BASE_CHAIN_ID = 8453;
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
// FanzTokenUSDC V5 계약 주소
const FANZTOKEN_CONTRACT = '0x2003eF9610A34Dc5771CbB9ac1Db2B2c056C66C7';

// USDC는 6 decimals
const USDC_DECIMALS = 6;

// 서명 메시지 Prefix (Edge Function과 동일해야 함)
const SIGN_MESSAGE_PREFIX = 'Sign in to K-Trendz with wallet:\n';

const USDC_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

const FANZTOKEN_ABI = [
  'function buy(uint256 tokenId, uint256 amount, uint256 maxCost) external'
];

// KTNZ ERC-20 ABI for transferFrom
const KTNZ_ABI = [
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

// SDK와 Provider를 모듈 레벨에서 유지 (세션 간 재사용)
let globalSdk: CoinbaseWalletSDK | null = null;
let globalProvider: any = null;

const getOrCreateProvider = () => {
  if (!globalSdk) {
    globalSdk = new CoinbaseWalletSDK({
      appName: 'KTRENDZ',
      appLogoUrl: 'https://k-trendz.com/favicon.png',
    });
  }
  if (!globalProvider) {
    globalProvider = globalSdk.makeWeb3Provider();
  }
  return globalProvider;
};

export const useCoinbaseWallet = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  
  // 현재 연결된 provider 참조 유지
  const providerRef = useRef<any>(null);

  const connectWallet = useCallback(async (): Promise<string | null> => {
    setIsConnecting(true);
    try {
      console.log('[CoinbaseWallet] Starting connection...');
      
      // 기존 세션 정리 (다른 사이트에서 사용한 경우)
      if (globalProvider) {
        try {
          if (typeof globalProvider.disconnect === 'function') {
            await globalProvider.disconnect();
            console.log('[CoinbaseWallet] Previous session cleared');
          }
        } catch (e) {
          console.log('[CoinbaseWallet] No previous session to clear');
        }
        // Provider 재생성
        globalProvider = null;
      }
      
      const provider = getOrCreateProvider();
      providerRef.current = provider;
      
      console.log('[CoinbaseWallet] Provider created, requesting accounts...');
      
      // 30초 타임아웃 추가
      const accountsPromise = provider.request({ 
        method: 'eth_requestAccounts' 
      }) as Promise<string[]>;
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timed out. Please try again.')), 30000);
      });
      
      const accounts = await Promise.race([accountsPromise, timeoutPromise]);
      console.log('[CoinbaseWallet] Accounts received:', accounts?.length);
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Switch to Base network
      console.log('[CoinbaseWallet] Switching to Base network...');
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }],
        });
      } catch (switchError: any) {
        // Chain not added, add it
        if (switchError.code === 4902) {
          console.log('[CoinbaseWallet] Adding Base network...');
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${BASE_CHAIN_ID.toString(16)}`,
              chainName: 'Base',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org'],
            }],
          });
        }
      }

      console.log('[CoinbaseWallet] Connected successfully:', accounts[0]);
      setConnectedAddress(accounts[0]);
      return accounts[0];
    } catch (error: any) {
      console.error('[CoinbaseWallet] Connection failed:', error?.message || error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const buyWithUsdc = useCallback(async (
    tokenId: string,
    amountUsdc: number, // USD 금액
    onChainTokenId: bigint
  ): Promise<string> => {
    setIsProcessing(true);
    try {
      const sdk = new CoinbaseWalletSDK({
        appName: 'KTRENDZ',
        appLogoUrl: 'https://k-trendz.com/favicon.png',
      });

      const provider = sdk.makeWeb3Provider();
      const ethersProvider = new ethers.BrowserProvider(provider as any);
      const signer = await ethersProvider.getSigner();
      const userAddress = await signer.getAddress();

      // USDC 금액을 wei 단위로 변환 (6 decimals)
      const usdcAmount = BigInt(Math.ceil(amountUsdc * 10 ** USDC_DECIMALS));
      
      // Add 5% slippage buffer for maxCost
      const maxCost = (usdcAmount * 105n) / 100n;

      // Check USDC balance
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const balance = await usdcContract.balanceOf(userAddress);
      
      if (balance < usdcAmount) {
        throw new Error(`Insufficient USDC balance. You have ${Number(balance) / 10 ** USDC_DECIMALS} USDC but need ${amountUsdc} USDC`);
      }

      // Check and set allowance
      const currentAllowance = await usdcContract.allowance(userAddress, FANZTOKEN_CONTRACT);
      
      if (currentAllowance < usdcAmount) {
        console.log('Approving USDC...');
        const approveTx = await usdcContract.approve(FANZTOKEN_CONTRACT, maxCost);
        await approveTx.wait();
        console.log('USDC approved');
      }

      // Call buy function
      const fanzContract = new ethers.Contract(FANZTOKEN_CONTRACT, FANZTOKEN_ABI, signer);
      console.log('Buying token:', { onChainTokenId: onChainTokenId.toString(), amount: 1, maxCost: maxCost.toString() });
      
      const buyTx = await fanzContract.buy(onChainTokenId, 1, maxCost);
      const receipt = await buyTx.wait();
      
      console.log('Purchase successful:', receipt.hash);
      return receipt.hash;
    } catch (error) {
      console.error('Failed to buy with USDC:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // KTNZ 출금 (외부 지갑으로 transferFrom 실행)
  const claimKtnz = useCallback(async (
    fromSmartWallet: string,
    amount: number,
    ktnzContractAddress: string
  ): Promise<string> => {
    setIsProcessing(true);
    try {
      const sdk = new CoinbaseWalletSDK({
        appName: 'KTRENDZ',
        appLogoUrl: 'https://k-trendz.com/favicon.png',
      });

      const provider = sdk.makeWeb3Provider();
      const ethersProvider = new ethers.BrowserProvider(provider as any);
      const signer = await ethersProvider.getSigner();
      const externalAddress = await signer.getAddress();

      console.log('Claiming KTNZ:', { from: fromSmartWallet, to: externalAddress, amount });

      const ktnzContract = new ethers.Contract(ktnzContractAddress, KTNZ_ABI, signer);
      
      // Allowance 확인
      const allowance = await ktnzContract.allowance(fromSmartWallet, externalAddress);
      const amountWei = ethers.parseEther(amount.toString());
      
      if (allowance < amountWei) {
        throw new Error(`Insufficient allowance. Approved: ${ethers.formatEther(allowance)} KTNZ, Need: ${amount} KTNZ. Please request approval first.`);
      }

      // transferFrom 실행
      const tx = await ktnzContract.transferFrom(fromSmartWallet, externalAddress, amountWei);
      const receipt = await tx.wait();
      
      console.log('KTNZ claimed successfully:', receipt.hash);
      return receipt.hash;
    } catch (error) {
      console.error('Failed to claim KTNZ:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    try {
      if (globalProvider && typeof globalProvider.disconnect === 'function') {
        globalProvider.disconnect();
      }
    } catch (e) {
      console.warn('Wallet disconnect failed:', e);
    }
    // 글로벌 상태 초기화
    globalProvider = null;
    providerRef.current = null;
    setConnectedAddress(null);
  }, []);

  // K-Trendz 로그인을 위한 서명 요청 (기존 연결된 provider 재사용)
  const signMessageForLogin = useCallback(async (address: string): Promise<{ signature: string; nonce: string }> => {
    // connectWallet에서 연결한 provider 재사용
    const provider = providerRef.current || getOrCreateProvider();
    
    console.log('[CoinbaseWallet] Signing message with connected provider...');
    
    const ethersProvider = new ethers.BrowserProvider(provider as any);
    const signer = await ethersProvider.getSigner();
    
    const normalizedAddress = address.toLowerCase();
    const nonce = Date.now().toString();
    const message = `${SIGN_MESSAGE_PREFIX}${normalizedAddress}\n\nNonce: ${nonce}`;
    
    console.log('[CoinbaseWallet] Requesting signature...');
    const signature = await signer.signMessage(message);
    console.log('[CoinbaseWallet] Signature received');
    
    return { signature, nonce };
  }, []);

  // Provider 노출 (BotAgentSetup 등 외부 컴포넌트에서 사용)
  const getProvider = useCallback(() => {
    return providerRef.current || getOrCreateProvider();
  }, []);

  return {
    isConnecting,
    isProcessing,
    connectedAddress,
    connectWallet,
    buyWithUsdc,
    claimKtnz,
    disconnectWallet,
    signMessageForLogin,
    getProvider,
  };
};
