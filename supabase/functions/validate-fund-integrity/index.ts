import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// USDC Contract on Base
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;

// Artist Fund Wallet (from FanzTokenUSDC_v2 contract)
const ARTIST_FUND_WALLET = "0xd5C1296990b9072302a627752E46061a40112342";

// ERC20 ABI for balanceOf
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)"
];

// Base RPC URLs (Alchemy first for stability)
const getBaseRpcUrls = () => {
  const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
  const urls = [];
  if (alchemyKey) urls.push(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`);
  urls.push("https://mainnet.base.org", "https://base.llamarpc.com");
  return urls;
};
const BASE_RPC_URLS = getBaseRpcUrls();

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Starting fund integrity validation...');

    // 1. Get DB total from entry_community_funds
    const { data: fundData, error: fundError } = await supabase
      .from('entry_community_funds')
      .select('total_fund');

    if (fundError) {
      throw new Error(`Failed to fetch fund data: ${fundError.message}`);
    }

    const dbTotalUsd = fundData?.reduce((sum, row) => sum + (Number(row.total_fund) || 0), 0) || 0;
    console.log(`📊 DB Total Fund: $${dbTotalUsd.toFixed(6)}`);

    // 2. Get on-chain USDC balance of artistFundWallet
    let onchainBalanceUsd = 0;
    let providerUsed = '';

    for (const rpcUrl of BASE_RPC_URLS) {
      try {
        console.log(`🔗 Trying RPC: ${rpcUrl}`);
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Verify chain ID
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== 8453) {
          console.warn(`Wrong chain ID: ${network.chainId}, expected 8453`);
          continue;
        }

        const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
        const balance = await usdcContract.balanceOf(ARTIST_FUND_WALLET);
        
        onchainBalanceUsd = Number(balance) / Math.pow(10, USDC_DECIMALS);
        providerUsed = rpcUrl;
        console.log(`💰 On-chain USDC Balance: $${onchainBalanceUsd.toFixed(6)}`);
        break;
      } catch (rpcError) {
        console.error(`RPC error for ${rpcUrl}:`, rpcError);
        continue;
      }
    }

    if (!providerUsed) {
      throw new Error('Failed to connect to any Base RPC provider');
    }

    // 3. Calculate discrepancy
    const discrepancy = Math.abs(onchainBalanceUsd - dbTotalUsd);
    const discrepancyPercent = dbTotalUsd > 0 ? (discrepancy / dbTotalUsd) * 100 : 0;
    
    // Consider it "matched" if discrepancy is less than 1% or $0.01
    const isMatched = discrepancy < 0.01 || discrepancyPercent < 1;

    // 4. Get breakdown by entry
    const { data: entryBreakdown } = await supabase
      .from('entry_community_funds')
      .select(`
        id,
        total_fund,
        wiki_entry_id,
        wiki_entries (
          title,
          slug
        )
      `)
      .order('total_fund', { ascending: false })
      .limit(20);

    // 5. Get recent fund transactions
    const { data: recentTransactions } = await supabase
      .from('entry_fund_transactions')
      .select(`
        id,
        amount,
        transaction_type,
        description,
        created_at,
        wiki_entry_id,
        wiki_entries (
          title
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    const result = {
      status: isMatched ? 'matched' : 'discrepancy',
      timestamp: new Date().toISOString(),
      summary: {
        dbTotalUsd: Number(dbTotalUsd.toFixed(6)),
        onchainBalanceUsd: Number(onchainBalanceUsd.toFixed(6)),
        discrepancyUsd: Number(discrepancy.toFixed(6)),
        discrepancyPercent: Number(discrepancyPercent.toFixed(2)),
        artistFundWallet: ARTIST_FUND_WALLET,
        providerUsed,
      },
      entryBreakdown: entryBreakdown?.map(e => ({
        entryId: e.wiki_entry_id,
        title: (e.wiki_entries as any)?.title || 'Unknown',
        slug: (e.wiki_entries as any)?.slug || '',
        fundUsd: Number(e.total_fund),
      })) || [],
      recentTransactions: recentTransactions?.map(t => ({
        id: t.id,
        amount: Number(t.amount),
        type: t.transaction_type,
        description: t.description,
        createdAt: t.created_at,
        entryTitle: (t.wiki_entries as any)?.title || 'Unknown',
      })) || [],
    };

    console.log(`✅ Validation complete - Status: ${result.status}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Fund integrity validation error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
