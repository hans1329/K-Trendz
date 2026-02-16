import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { ethers } from "https://esm.sh/ethers@6.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FANZTOKEN_CONTRACT_ADDRESS = Deno.env.get("FANZTOKEN_CONTRACT_ADDRESS") ?? "";
const BASE_RPC_URL = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";

// FanzTokenUSDC ABI (발행에 필요한 최소 ABI만 유지)
const fanzTokenAbi = [
  "function createToken(uint256 tokenId, address creator, uint256 basePrice, uint256 kValue) external",
  "function tokens(uint256 tokenId) external view returns (uint256 totalSupply, uint256 basePrice, uint256 kValue, address creator)"
];

// UUID를 uint256으로 변환 (앞 16자리 사용)
function uuidToTokenId(uuid: string): bigint {
  const hex = uuid.replace(/-/g, '').substring(0, 16);
  return BigInt('0x' + hex);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authenticate user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { wikiEntryId, postId } = await req.json();

    if (!wikiEntryId && !postId) {
      throw new Error("Either wikiEntryId or postId is required");
    }

    // Check if user is admin
    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    const isAdmin = !!adminRole;

    // Verify user is the creator, owner, or admin
    if (wikiEntryId) {
      const { data: entry, error: entryError } = await supabaseAdmin
        .from('wiki_entries')
        .select('creator_id, owner_id, page_status, votes')
        .eq('id', wikiEntryId)
        .single();

      if (entryError || !entry) {
        throw new Error("Wiki entry not found");
      }

      // 발행 잠금 해제 조건: claimed/verified 또는 투표 1000+ 달성
      const entryVotes = Number(entry.votes ?? 0);
      const isUnlocked = entry.page_status === 'claimed' || entry.page_status === 'verified' || entryVotes >= 1000;
      if (!isUnlocked) {
        throw new Error("Lightstick issuance is locked until 1,000 votes or Master verification.");
      }

      // Admin, creator_id, and owner_id are authorized to issue tokens
      if (!isAdmin && entry.creator_id !== user.id && entry.owner_id !== user.id) {
        throw new Error("Only the creator, owner, or admin can issue lightstick tokens");
      }
    } else if (postId) {
      // Post에서 토큰 발행하는 경우
      const { data: post, error: postError } = await supabaseAdmin
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();

      if (postError || !post) {
        throw new Error("Post not found");
      }

      // Admin or post owner can issue tokens
      if (!isAdmin && post.user_id !== user.id) {
        throw new Error("Only the creator or admin can issue lightstick tokens");
      }
    }

    // Check if token already exists
    const { data: existingToken } = await supabaseAdmin
      .from('fanz_tokens')
      .select('id')
      .eq(wikiEntryId ? 'wiki_entry_id' : 'post_id', wikiEntryId || postId)
      .maybeSingle();

    if (existingToken) {
      throw new Error("Lightstick token already issued for this entry");
    }

    // Get creator's profile and check Stars balance
    const { data: creatorProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, available_points')
      .eq('id', user.id)
      .single();

    if (!creatorProfile) {
      throw new Error("Creator profile not found");
    }

    // Get point cost for issuing lightstick
    const { data: pointRule } = await supabaseAdmin
      .from('point_rules')
      .select('points')
      .eq('action_type', 'issue_lightstick')
      .eq('is_active', true)
      .single();

    const pointCost = pointRule?.points || -100; // Default -100 if rule not found

    // Check if user has enough points
    if (creatorProfile.available_points + pointCost < 0) {
      throw new Error(`Insufficient Stars. You need ${Math.abs(pointCost)} Stars to issue a lightstick.`);
    }

    // Deduct points
    const { error: deductError } = await supabaseAdmin
      .from('profiles')
      .update({ available_points: creatorProfile.available_points + pointCost })
      .eq('id', user.id);

    if (deductError) throw deductError;

    // Record point transaction
    const { error: transactionError } = await supabaseAdmin
      .from('point_transactions')
      .insert({
        user_id: user.id,
        action_type: 'issue_lightstick',
        points: pointCost,
        reference_id: wikiEntryId || postId
      });

    if (transactionError) throw transactionError;

    // Smart wallet 타입으로 필터링하여 조회
    let { data: creatorWallet } = await supabaseAdmin
      .from('wallet_addresses')
      .select('wallet_address')
      .eq('user_id', user.id)
      .eq('network', 'base')
      .eq('wallet_type', 'smart_wallet')
      .maybeSingle();

    // smart_wallet이 없으면 일반 wallet도 확인
    if (!creatorWallet) {
      const { data: anyWallet } = await supabaseAdmin
        .from('wallet_addresses')
        .select('wallet_address')
        .eq('user_id', user.id)
        .eq('network', 'base')
        .maybeSingle();
      
      creatorWallet = anyWallet;
    }

    if (!creatorWallet) {
      throw new Error("Creator wallet not found. Please create a wallet first.");
    }

    console.log("Creator wallet:", creatorWallet.wallet_address);

    // Generate uint256 tokenId from UUID
    const entryUuid = wikiEntryId || postId;
    const tokenId = uuidToTokenId(entryUuid);
    console.log("Generated tokenId:", tokenId.toString());

    // Initialize ethers provider and wallet
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const backendPrivateKey = Deno.env.get("BACKEND_WALLET_PRIVATE_KEY");
    if (!backendPrivateKey) {
      throw new Error("Backend wallet private key not configured");
    }

    if (!FANZTOKEN_CONTRACT_ADDRESS) {
      throw new Error("FANZTOKEN_CONTRACT_ADDRESS not configured");
    }

    const backendWallet = new ethers.Wallet(backendPrivateKey, provider);
    console.log("Backend wallet address:", backendWallet.address);

    // Check backend wallet ETH balance before proceeding
    const ethBalance = await provider.getBalance(backendWallet.address);
    const minRequiredEth = ethers.parseEther("0.0005"); // ~$1.25 at $2500/ETH, covers ~2-3 createToken txs
    
    console.log("Backend wallet ETH balance:", ethers.formatEther(ethBalance), "ETH");
    
    if (ethBalance < minRequiredEth) {
      console.error("Insufficient ETH balance for gas fees");
      throw new Error("Platform wallet needs ETH refill. Please contact support.");
    }

    // Connect to FanzToken contract
    const fanzTokenContract = new ethers.Contract(
      FANZTOKEN_CONTRACT_ADDRESS,
      fanzTokenAbi,
      backendWallet
    );

    // Check if token already exists on-chain
    let tokenExists = false;

    try {
      const tokenInfo = await fanzTokenContract.tokens(tokenId);
      // creator가 zero address가 아니면 토큰이 존재함
      const creator = String(tokenInfo[3]);
      tokenExists = creator.toLowerCase() !== ethers.ZeroAddress.toLowerCase();

      if (tokenExists) {
        console.log("Token already exists on-chain, skipping createToken");
        console.log("Existing creator:", creator);
        console.log("Existing totalSupply:", tokenInfo[0].toString());
      }
    } catch (error) {
      // 여기서 에러가 나면 '토큰 없음'으로 간주하면 위험함(이미 존재하는데 디코딩 실패일 수 있음)
      console.error("Failed to read on-chain token info (tokens()):", error);
      throw new Error("Failed to verify on-chain token existence");
    }

    // USDC 단위 (6 decimals)
    // basePrice: 1.65 USDC → 1,650,000
    // kValue: 본딩커브 계수(스케일 1e12). 0.3 * 1e12 = 300,000,000,000
    const basePrice = BigInt(1650000); // 1.65 USDC (6 decimals)
    const kValue = BigInt(300000000000); // 0.3 scaled by 1e12
    try {
      // 토큰이 존재하지 않으면 생성 (supply=0 상태로 시작, 첫 팬이 구매)
      if (!tokenExists) {
        console.log("Creating token on-chain...");
        console.log("tokenId:", tokenId.toString());
        console.log("creator:", creatorWallet.wallet_address);
        console.log("basePrice (USDC, 6 decimals):", basePrice.toString());
        console.log("kValue (scaled, 1e12):", kValue.toString());

        const tx = await fanzTokenContract.createToken(
          tokenId,
          creatorWallet.wallet_address,
          basePrice,
          kValue
        );

        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt.hash);
      }
    } catch (chainError) {
      console.error("On-chain token creation failed:", chainError);
      throw chainError;
    }

    // Create token record in database with total_supply = 0 (first fan will purchase)
    // DB에는 온체인과 동일한 USDC 값 저장
    const { data: token, error: tokenError } = await supabaseAdmin
      .from('fanz_tokens')
      .insert({
        wiki_entry_id: wikiEntryId || null,
        post_id: postId || null,
        creator_id: user.id,
        token_id: tokenId.toString(),
        contract_address: FANZTOKEN_CONTRACT_ADDRESS,
        base_price: 1.65,  // $1.65 USDC (온체인: 1650000)
        k_value: 300000000000,   // V5 kValue (on-chain raw)
        total_supply: 0,
        is_active: true
      })
      .select()
      .single();

    if (tokenError) throw tokenError;

    console.log("Lightstick token issued:", token);

    // 토큰 발행 성공 시, 커뮤니티 이름 짓기 제안 자동 생성 (wikiEntryId가 있는 경우만)
    if (wikiEntryId) {
      try {
        // 이미 community_naming 제안이 있는지 확인
        const { data: existingNamingProposal } = await supabaseAdmin
          .from('support_proposals')
          .select('id')
          .eq('wiki_entry_id', wikiEntryId)
          .eq('proposal_category', 'community_naming')
          .maybeSingle();

        if (!existingNamingProposal) {
          // 시스템 계정 찾기 (KTRENDZ Official 또는 admin 계정)
          const { data: systemAccount } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .or('username.eq.ktrendz,username.eq.admin')
            .limit(1)
            .maybeSingle();

          const proposerId = systemAccount?.id || user.id;

          // 한 달 후 투표 종료
          const votingEndAt = new Date();
          votingEndAt.setMonth(votingEndAt.getMonth() + 1);

          // 커뮤니티 이름 짓기 Discussion 제안 생성
          const { error: proposalError } = await supabaseAdmin
            .from('support_proposals')
            .insert({
              wiki_entry_id: wikiEntryId,
              proposer_id: proposerId,
              title: '🎉 Name Our Fandom!',
              description: 'What should our fandom be called? Share your creative ideas for our community name! The most loved suggestion will become our official fandom name.',
              proposal_type: 'community',
              proposal_format: 'discussion',
              proposal_category: 'community_naming',
              voting_end_at: votingEndAt.toISOString(),
              status: 'voting',
              quorum_threshold: 3,
              pass_threshold: 50,
              min_lightstick_required: 0
            });

          if (proposalError) {
            console.error("Failed to create community naming proposal:", proposalError);
          } else {
            console.log("Community naming proposal created successfully");
          }
        } else {
          console.log("Community naming proposal already exists, skipping");
        }
      } catch (proposalErr) {
        console.error("Error creating community naming proposal:", proposalErr);
        // 제안 생성 실패해도 토큰 발행은 성공으로 처리
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        token,
        message: "Lightstick token issued successfully" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error issuing token:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
