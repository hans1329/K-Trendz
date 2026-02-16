import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// KTrendzVoteV2 ABI
const VOTE_V2_ABI = [
  "function setOperator(address _operator) external",
  "function operator() view returns (address)",
  "function owner() view returns (address)"
];

// SimpleAccountFactory address (Coinbase)
const SIMPLE_ACCOUNT_FACTORY = "0x9406Cc6185a346906296840746125a0E44976454";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VOTE_CONTRACT_ADDRESS = Deno.env.get('VOTE_CONTRACT_ADDRESS');
    const BACKEND_WALLET_PRIVATE_KEY = Deno.env.get('BACKEND_WALLET_PRIVATE_KEY');
    const BASE_OPERATOR_PRIVATE_KEY = Deno.env.get('BASE_OPERATOR_PRIVATE_KEY');
    const BASE_RPC_URL = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';

    if (!VOTE_CONTRACT_ADDRESS) {
      throw new Error('Missing VOTE_CONTRACT_ADDRESS');
    }
    if (!BACKEND_WALLET_PRIVATE_KEY) {
      throw new Error('Missing BACKEND_WALLET_PRIVATE_KEY (owner key)');
    }
    if (!BASE_OPERATOR_PRIVATE_KEY) {
      throw new Error('Missing BASE_OPERATOR_PRIVATE_KEY');
    }

    console.log('Setting operator for VoteV2 contract:', VOTE_CONTRACT_ADDRESS);

    // Provider 설정
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Owner wallet (컨트랙트 owner - setOperator 호출용)
    const ownerWallet = new ethers.Wallet(BACKEND_WALLET_PRIVATE_KEY, provider);
    console.log('Owner wallet address:', ownerWallet.address);
    
    // Operator wallet (record-onchain-vote에서 사용하는 키)
    const operatorWallet = new ethers.Wallet(BASE_OPERATOR_PRIVATE_KEY, provider);
    console.log('Operator EOA address:', operatorWallet.address);

    // Smart Account 주소 계산 (record-onchain-vote와 동일한 로직)
    const factoryInterface = new ethers.Interface([
      "function createAccount(address owner, uint256 salt) returns (address)",
    ]);
    
    const creationCode = await provider.call({
      to: SIMPLE_ACCOUNT_FACTORY,
      data: factoryInterface.encodeFunctionData("createAccount", [operatorWallet.address, 0n]),
    });
    const backendSmartAccount = ethers.getAddress("0x" + creationCode.slice(-40));
    
    console.log('Calculated Backend Smart Account:', backendSmartAccount);

    // Contract 인스턴스
    const voteContract = new ethers.Contract(VOTE_CONTRACT_ADDRESS, VOTE_V2_ABI, ownerWallet);

    // 현재 owner와 operator 확인
    const currentOwner = await voteContract.owner();
    const currentOperator = await voteContract.operator();
    
    console.log('Current owner:', currentOwner);
    console.log('Current operator:', currentOperator);

    // owner 확인
    if (currentOwner.toLowerCase() !== ownerWallet.address.toLowerCase()) {
      throw new Error(`Wallet is not the owner. Owner: ${currentOwner}, Wallet: ${ownerWallet.address}`);
    }

    // 이미 설정되어 있는지 확인
    if (currentOperator.toLowerCase() === backendSmartAccount.toLowerCase()) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Operator already set to Backend Smart Account',
        operator: currentOperator,
        smartAccount: backendSmartAccount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // setOperator 트랜잭션 전송
    console.log('Sending setOperator transaction...');
    console.log('Setting operator to:', backendSmartAccount);
    
    const tx = await voteContract.setOperator(backendSmartAccount);
    console.log('Transaction hash:', tx.hash);

    // 트랜잭션 완료 대기
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);

    // 새 operator 확인
    const newOperator = await voteContract.operator();
    console.log('New operator:', newOperator);

    return new Response(JSON.stringify({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      previousOperator: currentOperator,
      newOperator: newOperator,
      smartAccount: backendSmartAccount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error setting operator:', errorMessage);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
