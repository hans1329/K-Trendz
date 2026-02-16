import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { ethers } from 'https://esm.sh/ethers@6.14.1';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenMetadata {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract token ID from URL path
    // 지원 형식:
    // 1) 10진수 ID:   /api/token/1234.json (테스트용)
    // 2) 16진수 ID:   /api/token/ffff...64hex....json (ERC-1155 표준)
    // 3) 확장자 없음: /api/token/{id}
    // 4) 0x prefix:   /api/token/0x{hex}.json
    const url = new URL(req.url);
    const pathname = url.pathname;
    // BaseScan/Etherscan류 크롤러가 실제로 이 엔드포인트를 호출하는지 확인하기 위한 요청 로그
    console.log('🔎 get-token-metadata request:', {
      method: req.method,
      pathname,
      ua: req.headers.get('user-agent'),
      accept: req.headers.get('accept'),
    });

    const marker = '/api/token/';
    const idx = pathname.toLowerCase().lastIndexOf(marker);
    if (idx === -1) {
      console.error('Invalid URL path (missing /api/token/):', pathname);
      return new Response(
        JSON.stringify({ error: 'Invalid token ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const tail = pathname.slice(idx + marker.length);
    const withoutTrailingSlash = tail.replace(/\/+$/, '');
    const withoutJson = withoutTrailingSlash.replace(/\.json$/i, '');
    const normalized = withoutJson.replace(/^0x/i, '');

    if (!normalized || !/^[0-9a-fA-F]+$/.test(normalized)) {
      console.error('Invalid URL path (bad token id):', pathname, 'parsed:', normalized);
      return new Response(
        JSON.stringify({ error: 'Invalid token ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const rawId = normalized;
    // ERC-1155 표준 `{id}` 치환은 64자 hex(leading zeros 포함)라서, 숫자만으로 구성돼도 hex로 취급해야 함
    const looksLikeErc1155HexId = rawId.length === 64;
    const isDecimalId = /^[0-9]+$/.test(rawId) && !looksLikeErc1155HexId;
    console.log('🎫 Fetching metadata for token ID (raw):', rawId, 'isDecimal:', isDecimalId, 'isErc1155Hex:', looksLikeErc1155HexId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let tokenData: any = null;
    let tokenError: any = null;

    // 우선 단순 디버그용: decimal ID가 DB token_id랑 바로 매칭되면 그대로 사용
    if (isDecimalId) {
      const directId = rawId;
      console.log('🎫 Treating ID as decimal tokenId (direct try):', directId);

      const { data: directToken, error: directError } = await supabase
        .from('fanz_tokens')
        .select(`
          token_id,
          total_supply,
          base_price,
          k_value,
          creator_id,
          wiki_entry_id,
          post_id,
          wiki_entries (
            title,
            slug,
            image_url
          ),
          posts (
            title,
            image_url
          ),
          profiles!fanz_tokens_creator_id_fkey (
            username,
            display_name
          )
        `)
        .eq('token_id', directId)
        .eq('is_active', true)
        .maybeSingle();

      if (directToken) {
        tokenData = directToken;
      } else if (directError) {
        console.error('Error on direct token lookup:', directError);
        tokenError = directError;
      }
    }

    // ERC-1155 표준 hex ID(64자리)이면, 먼저 hex -> decimal 변환 후 DB token_id와 직접 매칭을 시도
    // (기존 토큰들이 DB에 decimal string으로 저장된 경우를 지원)
    if (!tokenData && !isDecimalId) {
      try {
        // 64자리 hex에서 leading zeros 제거 후 변환 (BigInt 정밀도 문제 방지)
        const trimmedHex = rawId.toLowerCase().replace(/^0+/, '') || '0';
        const decimalFromHex = BigInt(`0x${trimmedHex}`).toString(10);
        console.log('🎫 Treating ID as ERC-1155 hex -> decimal (direct try):', decimalFromHex, 'from trimmed hex:', trimmedHex);

        const { data: directHexToken, error: directHexError } = await supabase
          .from('fanz_tokens')
          .select(`
            token_id,
            total_supply,
            base_price,
            k_value,
            creator_id,
            wiki_entry_id,
            post_id,
            wiki_entries (
              title,
              slug,
              image_url
            ),
            posts (
              title,
              image_url
            ),
            profiles!fanz_tokens_creator_id_fkey (
              username,
              display_name
            )
          `)
          .eq('token_id', decimalFromHex)
          .eq('is_active', true)
          .maybeSingle();

        if (directHexToken) {
          tokenData = directHexToken;
          console.log('✅ Matched via hex->decimal conversion:', decimalFromHex);
        } else if (directHexError) {
          console.error('Error on hex->decimal direct token lookup:', directHexError);
          tokenError = directHexError;
        }
      } catch (e) {
        console.log('⚠️ Failed to parse hex token id as bigint; fallback to hashed mapping:', e);
      }
    }

    // 직접 매칭이 안 되면, keccak256(token_id) 기반으로 매핑 (decimal/hex 모두 지원)

    if (!tokenData) {
      const { data: allTokens, error: allTokensError } = await supabase
        .from('fanz_tokens')
        .select(`
          token_id,
          total_supply,
          base_price,
          k_value,
          creator_id,
          wiki_entry_id,
          post_id,
          wiki_entries (
            title,
            slug,
            image_url
          ),
          posts (
            title,
            image_url
          ),
          profiles!fanz_tokens_creator_id_fkey (
            username,
            display_name
          )
        `)
        .eq('is_active', true);

      if (allTokensError) {
        console.error('Error loading tokens for hashed ID mapping:', allTokensError);
        tokenError = allTokensError;
      } else if (allTokens && Array.isArray(allTokens)) {
        const targetIsDecimal = isDecimalId;
        const targetDecimal = targetIsDecimal ? rawId : null;
        const targetHex = targetIsDecimal
          ? null
          : rawId.toLowerCase().padStart(64, '0');

        console.log('🎫 Trying hashed ID mapping. isDecimal:', targetIsDecimal, 'raw:', rawId);

        for (const t of allTokens) {
          if (!t.token_id) continue;

          const hashHexWithPrefix = ethers.keccak256(
            new TextEncoder().encode(String(t.token_id))
          ); // e.g. 0xabc...
          const normalizedHex = hashHexWithPrefix.replace(/^0x/, '').padStart(64, '0');
          const hashDecimal = BigInt(hashHexWithPrefix).toString(10);

          if (targetIsDecimal) {
            if (hashDecimal === targetDecimal) {
              tokenData = t;
              console.log('✅ Matched via decimal hashed ID:', targetDecimal, '-> token_id:', t.token_id);
              break;
            }
          } else {
            if (normalizedHex === targetHex) {
              tokenData = t;
              console.log('✅ Matched via hex hashed ID:', targetHex, '-> token_id:', t.token_id);
              break;
            }
          }
        }
      }
    }

    if (tokenError || !tokenData) {
      console.error('Token not found in database:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Token not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine if this is a wiki entry or post token
    const isWikiToken = !!tokenData.wiki_entry_id;
    const entryData = isWikiToken 
      ? (Array.isArray(tokenData.wiki_entries) ? tokenData.wiki_entries[0] : tokenData.wiki_entries)
      : (Array.isArray(tokenData.posts) ? tokenData.posts[0] : tokenData.posts);
    const creator = Array.isArray(tokenData.profiles) ? tokenData.profiles[0] : tokenData.profiles;

    if (!entryData) {
      console.error('Associated entry not found');
      return new Response(
        JSON.stringify({ error: 'Associated entry not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build entry URL
    const entryUrl = isWikiToken && 'slug' in entryData
      ? `https://k-trendz.com/k/${entryData.slug}`
      : `https://k-trendz.com/p/${tokenData.post_id}`;

    // Construct metadata according to ERC-1155 standard
    const metadata: TokenMetadata = {
      name: `LightStick for ${entryData.title}`,
      description: `Fan token (lightstick) for ${entryData.title}. Issued by ${creator?.display_name || creator?.username || 'K-TRENDZ'} on K-TRENDZ platform.`,
      image: entryData.image_url || 'https://k-trendz.com/images/ktrendz_lightstick.webp',
      external_url: entryUrl,
      attributes: [
        {
          trait_type: 'Total Supply',
          value: tokenData.total_supply || 0,
        },
        {
          trait_type: 'Creator',
          value: creator?.display_name || creator?.username || 'Unknown',
        },
        {
          trait_type: 'Type',
          value: isWikiToken ? 'Wiki Entry Token' : 'Post Token',
        },
      ],
    };

    console.log('✅ Metadata generated successfully:', metadata.name);

    return new Response(
      JSON.stringify(metadata),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json; charset=utf-8',
          // Explorer(BaseScan) 캐시로 인한 갱신 지연을 줄이기 위해 즉시 재검증하도록 설정
          'Cache-Control': 'no-store, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('❌ Error generating token metadata:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
