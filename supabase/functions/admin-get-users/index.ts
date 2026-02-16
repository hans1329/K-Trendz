import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Supabase 클라이언트 생성 (service role 사용)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 요청한 사용자가 관리자인지 확인
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 관리자 권한 확인
    const { data: adminRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !adminRole) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body for action
    let body: any = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (e) {
      console.log('[admin-get-users] No body or invalid JSON:', e);
      // No body or invalid JSON - continue with default action
    }

    const action = body?.action || 'list_users';
    console.log('[admin-get-users] Action:', action);

    // === BOT DETECTION ACTION ===
    if (action === 'detect_bots') {
      console.log('[admin-get-users] Running bot detection...');
      
      // 전체 기간으로 확장 (기존 30일 → 전체)
      // const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      // Get auth users with emails
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const authUsersMap = new Map(authUsers?.users?.map(u => [u.id, u]) || []);
      
      // Get ALL profiles (not limited to 30 days)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, created_at, avatar_url')
        .order('created_at', { ascending: false })
        .limit(5000);

      // Get existing bans
      const { data: existingBans } = await supabase
        .from('user_bans')
        .select('user_id');
      const bannedIds = new Set(existingBans?.map(b => b.user_id) || []);

      // admin/moderator 계정은 봇 탐지에서 절대 제외
      const { data: protectedRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'moderator']);
      const protectedIds = new Set(protectedRoles?.map(r => r.user_id) || []);
      console.log(`[admin-get-users] Protected accounts (admin/mod): ${protectedIds.size}`);

      // 응원봉 보유 현황 조회
      const { data: fanzBalances } = await supabase
        .from('fanz_balances')
        .select('user_id, balance, fanz_token_id, fanz_tokens(wiki_entry_id, wiki_entries(title, image_url))')
        .gt('balance', 0);
      
      const userLightsticks = new Map<string, { title: string; balance: number; image_url: string | null }[]>();
      for (const fb of fanzBalances || []) {
        if (!fb.user_id) continue;
        if (!userLightsticks.has(fb.user_id)) userLightsticks.set(fb.user_id, []);
        const token = fb.fanz_tokens as any;
        const entry = token?.wiki_entries as any;
        userLightsticks.get(fb.user_id)!.push({
          title: entry?.title || 'Unknown',
          balance: fb.balance,
          image_url: entry?.image_url || null,
        });
      }

      const detectedBots: any = {
        duplicateNames: [],
        nameEmailPattern: [],
        simultaneousSignup: [],
        sameIpSubnet: []
      };

      // 1. Duplicate Names Pattern
      const nameCount = new Map<string, any[]>();
      for (const profile of profiles || []) {
        if (!profile.display_name || bannedIds.has(profile.id) || protectedIds.has(profile.id)) continue;
        const name = profile.display_name.trim();
        if (!nameCount.has(name)) nameCount.set(name, []);
        nameCount.get(name)!.push(profile);
      }

      for (const [name, accounts] of nameCount) {
        if (accounts.length >= 2) {
          for (const account of accounts) {
            const authUser = authUsersMap.get(account.id);
            detectedBots.duplicateNames.push({
              id: account.id,
              display_name: account.display_name,
              email: authUser?.email || 'N/A',
              created_at: account.created_at,
              pattern_type: 'duplicate_name',
              evidence: [`Same name: "${name}" (${accounts.length} accounts)`],
              lightsticks: userLightsticks.get(account.id) || []
            });
          }
        }
      }

      // 2. Generated Email Pattern (firstname+lastname+numbers@gmail.com)
      // Google OAuth 사용자 (avatar_url에 googleusercontent 포함)는 제외
      const emailPattern = /^([a-z]+)([a-z]+)(\d{2,4})@gmail\.com$/i;
      const processedIds = new Set(detectedBots.duplicateNames.map((a: any) => a.id));

      for (const profile of profiles || []) {
        if (bannedIds.has(profile.id) || processedIds.has(profile.id) || protectedIds.has(profile.id)) continue;
        
        // Google OAuth 사용자는 정상 사용자로 간주 (avatar_url이 googleusercontent 포함)
        const hasGoogleAvatar = profile.avatar_url?.includes('googleusercontent.com');
        if (hasGoogleAvatar) continue;
        
        const authUser = authUsersMap.get(profile.id);
        if (!authUser?.email) continue;
        
        const email = authUser.email.toLowerCase();
        const displayName = profile.display_name || '';
        
        // Check if display_name is "Firstname Lastname" format
        const nameMatch = displayName.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)$/);
        if (!nameMatch) continue;
        
        // Check if email contains the name parts
        const firstName = nameMatch[1].toLowerCase();
        const lastName = nameMatch[2].toLowerCase();
        
        const emailContainsName = 
          (email.includes(firstName) && email.includes(lastName)) ||
          email.match(emailPattern);
        
        if (emailContainsName && profile.username?.startsWith('user_')) {
          detectedBots.nameEmailPattern.push({
            id: profile.id,
            display_name: profile.display_name,
            email: authUser.email,
            created_at: profile.created_at,
            pattern_type: 'name_email_pattern',
            evidence: ['Generated email pattern', 'Firstname Lastname format', 'No Google avatar'],
            lightsticks: userLightsticks.get(profile.id) || []
          });
          processedIds.add(profile.id);
        }
      }

      // 3. Simultaneous Signup Pattern with SAME FINGERPRINT (강화된 탐지)
      // 같은 fingerprint를 가진 사용자들 그룹화
      const { data: fingerprints } = await supabase
        .from('user_fingerprints')
        .select('user_id, fingerprint');
      
      const fingerprintToUsers = new Map<string, any[]>();
      const userToFingerprint = new Map<string, string>();
      
      for (const fp of fingerprints || []) {
        if (!fp.fingerprint) continue;
        userToFingerprint.set(fp.user_id, fp.fingerprint);
        if (!fingerprintToUsers.has(fp.fingerprint)) {
          fingerprintToUsers.set(fp.fingerprint, []);
        }
      }

      // 같은 1분 + 같은 fingerprint를 가진 계정들 탐지
      const minuteBuckets = new Map<string, any[]>();
      for (const profile of profiles || []) {
        if (bannedIds.has(profile.id) || processedIds.has(profile.id) || protectedIds.has(profile.id)) continue;
        const minute = profile.created_at.substring(0, 16); // YYYY-MM-DDTHH:MM
        if (!minuteBuckets.has(minute)) minuteBuckets.set(minute, []);
        minuteBuckets.get(minute)!.push(profile);
      }

      for (const [minute, accounts] of minuteBuckets) {
        if (accounts.length >= 2) {
          // 같은 fingerprint를 공유하는 계정들 그룹화
          const fingerprintGroups = new Map<string, any[]>();
          for (const account of accounts) {
            const fp = userToFingerprint.get(account.id);
            if (!fp) continue;
            if (!fingerprintGroups.has(fp)) fingerprintGroups.set(fp, []);
            fingerprintGroups.get(fp)!.push(account);
          }
          
          // 같은 fingerprint를 가진 2명 이상의 계정 = 봇
          for (const [fingerprint, groupAccounts] of fingerprintGroups) {
            if (groupAccounts.length >= 2) {
              for (const account of groupAccounts) {
                const authUser = authUsersMap.get(account.id);
                detectedBots.simultaneousSignup.push({
                  id: account.id,
                  display_name: account.display_name,
                  email: authUser?.email || 'N/A',
                  created_at: account.created_at,
                  pattern_type: 'simultaneous_signup',
                  evidence: [
                    `${groupAccounts.length} accounts with same fingerprint`,
                    `Signed up in same minute`,
                    `Fingerprint: ${fingerprint.substring(0, 8)}...`
                  ],
                  lightsticks: userLightsticks.get(account.id) || []
                });
              }
            }
          }
        }
      }

      // 4. Same IP Subnet Pattern (/24 대역에서 3개 이상 가입)
      const { data: loginIps } = await supabase
        .from('user_login_ips')
        .select('user_id, last_ip');
      
      const subnetToUsers = new Map<string, any[]>();
      for (const record of loginIps || []) {
        if (!record.last_ip || record.last_ip === 'unknown') continue;
        if (bannedIds.has(record.user_id) || protectedIds.has(record.user_id)) continue;
        // /24 서브넷 추출 (예: 45.131.101.x → 45.131.101)
        const parts = record.last_ip.split('.');
        if (parts.length !== 4) continue;
        const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
        if (!subnetToUsers.has(subnet)) subnetToUsers.set(subnet, []);
        subnetToUsers.get(subnet)!.push(record);
      }

      const ipProcessedIds = new Set([
        ...detectedBots.duplicateNames.map((a: any) => a.id),
        ...detectedBots.nameEmailPattern.map((a: any) => a.id),
        ...detectedBots.simultaneousSignup.map((a: any) => a.id),
      ]);

      for (const [subnet, records] of subnetToUsers) {
        if (records.length < 3) continue;
        // 사설 IP, 일반적인 대역 제외
        if (subnet.startsWith('10.') || subnet.startsWith('192.168.') || subnet.startsWith('172.')) continue;
        
        for (const record of records) {
          if (ipProcessedIds.has(record.user_id) || protectedIds.has(record.user_id)) continue;
          const profile = (profiles || []).find(p => p.id === record.user_id);
          if (!profile) continue;
          const authUser = authUsersMap.get(record.user_id);
          detectedBots.sameIpSubnet.push({
            id: record.user_id,
            display_name: profile.display_name || 'Unknown',
            email: authUser?.email || 'N/A',
            created_at: profile.created_at,
            pattern_type: 'same_ip_subnet',
            evidence: [
              `${records.length} accounts from ${subnet}.x`,
              `IP: ${record.last_ip}`
            ],
            lightsticks: userLightsticks.get(record.user_id) || []
          });
        }
      }

      console.log(`[admin-get-users] Bot detection complete: ${detectedBots.duplicateNames.length} duplicate names, ${detectedBots.nameEmailPattern.length} email patterns, ${detectedBots.simultaneousSignup.length} fingerprint signups, ${detectedBots.sameIpSubnet.length} same IP subnet`);

      return new Response(JSON.stringify(detectedBots), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === BAN USERS ACTION ===
    if (action === 'ban_users') {
      const userIds = body?.userIds || [];
      const reason = body?.reason || 'Banned by admin';

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return new Response(JSON.stringify({ error: 'No user IDs provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[admin-get-users] Banning ${userIds.length} users...`);

      // admin/moderator 계정은 밴 대상에서 강제 제외 (안전장치)
      const { data: protectedRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'moderator']);
      const protectedIds = new Set(protectedRoles?.map(r => r.user_id) || []);
      
      const safeBanIds = userIds.filter((id: string) => !protectedIds.has(id));
      const skippedCount = userIds.length - safeBanIds.length;
      if (skippedCount > 0) {
        console.warn(`[admin-get-users] Skipped ${skippedCount} protected (admin/mod) accounts from ban`);
      }

      let banned = 0;
      for (const userId of safeBanIds) {
        const { error: banError } = await supabase
          .from('user_bans')
          .upsert({
            user_id: userId,
            reason: reason,
            banned_by: user.id,
            is_permanent: true
          }, { onConflict: 'user_id' });

        if (!banError) banned++;
      }

      console.log(`[admin-get-users] Successfully banned ${banned}/${userIds.length} users`);

      return new Response(JSON.stringify({ success: true, banned }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === DEFAULT: LIST USERS ===
    // 모든 사용자 정보 가져오기 (auth.users에서 이메일 포함) - 페이지네이션으로 전체 로드
    const allAuthUsers: any[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: { users: pageUsers }, error: authUsersError } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });
      if (authUsersError) {
        console.error('Error fetching auth users page', page, authUsersError);
        throw authUsersError;
      }
      allAuthUsers.push(...(pageUsers || []));
      if (!pageUsers || pageUsers.length < perPage) break;
      page++;
    }
    console.log(`[admin-get-users] Fetched ${allAuthUsers.length} auth users in ${page} page(s)`);

    // profiles 정보 가져오기
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    // user_roles 정보 가져오기
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      throw rolesError;
    }

    // wallet_addresses 정보 가져오기
    const { data: walletAddresses, error: walletsError } = await supabase
      .from('wallet_addresses')
      .select('user_id, wallet_address, network');

    if (walletsError) {
      console.error('Error fetching wallet addresses:', walletsError);
      throw walletsError;
    }

    // user_bans 정보 가져오기
    const { data: userBans, error: bansError } = await supabase
      .from('user_bans')
      .select('user_id, reason, banned_at, is_permanent');

    if (bansError) {
      console.error('Error fetching user bans:', bansError);
      // 밴 테이블 오류는 무시하고 계속 진행
    }

    // user_login_ips 테이블에서 마지막 IP 정보 가져오기
    const { data: loginIps, error: loginIpsError } = await supabase
      .from('user_login_ips')
      .select('user_id, last_ip, last_seen_at');

    if (loginIpsError) {
      console.error('Error fetching login IPs:', loginIpsError);
      // 오류는 무시하고 계속 진행
    }

    // user_fingerprints 정보 가져오기 (동일 fingerprint 감지용)
    const { data: fingerprints, error: fingerprintsError } = await supabase
      .from('user_fingerprints')
      .select('user_id, fingerprint');

    if (fingerprintsError) {
      console.error('Error fetching fingerprints:', fingerprintsError);
      // 오류는 무시하고 계속 진행
    }

    // 사용자별 응원봉 보유 정보 가져오기
    const { data: fanzBalances, error: fanzBalancesError } = await supabase
      .from('fanz_balances')
      .select(`
        user_id,
        balance,
        fanz_token_id,
        fanz_tokens:fanz_token_id (
          id,
          wiki_entry_id,
          wiki_entries:wiki_entry_id (
            title,
            slug,
            image_url
          )
        )
      `)
      .gt('balance', 0);

    if (fanzBalancesError) {
      console.error('Error fetching fanz balances:', fanzBalancesError);
      // 오류는 무시하고 계속 진행
    }

    // 사용자별 응원봉 그룹화
    const userLightsticks = new Map<string, Array<{
      tokenId: string;
      balance: number;
      title: string;
      slug: string;
      imageUrl: string | null;
    }>>();

    if (fanzBalances) {
      for (const balance of fanzBalances) {
        const userId = balance.user_id;
        const token = balance.fanz_tokens as any;
        const entry = token?.wiki_entries;
        
        if (!userLightsticks.has(userId)) {
          userLightsticks.set(userId, []);
        }
        
        userLightsticks.get(userId)!.push({
          tokenId: balance.fanz_token_id,
          balance: balance.balance,
          title: entry?.title || 'Unknown',
          slug: entry?.slug || '',
          imageUrl: entry?.image_url || null,
        });
      }
    }

    // 동일 fingerprint를 가진 사용자들 그룹화
    const fingerprintMap = new Map<string, string[]>();
    if (fingerprints) {
      for (const fp of fingerprints) {
        if (!fp.fingerprint) continue;
        if (!fingerprintMap.has(fp.fingerprint)) {
          fingerprintMap.set(fp.fingerprint, []);
        }
        fingerprintMap.get(fp.fingerprint)!.push(fp.user_id);
      }
    }

    // 2명 이상이 동일 fingerprint를 공유하는 사용자 ID 집합
    const suspiciousUserIds = new Set<string>();
    for (const [, userIds] of fingerprintMap) {
      if (userIds.length >= 2) {
        userIds.forEach(id => suspiciousUserIds.add(id));
      }
    }

    // 유사 이메일 패턴 탐지 (숫자를 제거하여 비교)
    const normalizeEmail = (email: string): string => {
      if (!email) return '';
      const [localPart, domain] = email.toLowerCase().split('@');
      if (!localPart || !domain) return email.toLowerCase();
      // 로컬 파트에서 숫자 제거
      const normalizedLocal = localPart.replace(/\d+/g, '');
      return `${normalizedLocal}@${domain}`;
    };

    const emailPatternMap = new Map<string, string[]>();
    for (const authUser of allAuthUsers) {
      if (!authUser.email) continue;
      const normalizedEmail = normalizeEmail(authUser.email);
      // 너무 짧은 정규화된 이메일은 무시 (e.g., @gmail.com)
      if (normalizedEmail.split('@')[0].length < 3) continue;
      
      if (!emailPatternMap.has(normalizedEmail)) {
        emailPatternMap.set(normalizedEmail, []);
      }
      emailPatternMap.get(normalizedEmail)!.push(authUser.id);
    }

    // 2명 이상이 유사 이메일 패턴을 공유하는 사용자 추가
    for (const [, userIds] of emailPatternMap) {
      if (userIds.length >= 2) {
        userIds.forEach(id => suspiciousUserIds.add(id));
      }
    }

    // 첫 번째 사용자의 구조 로깅 (디버깅용)
    if (allAuthUsers.length > 0) {
      const sampleUser = allAuthUsers[0];
      console.log('[admin-get-users] Sample auth user keys:', Object.keys(sampleUser));
    }

    // 빠른 조회를 위한 Map 생성
    const authUsersMap = new Map(allAuthUsers.map(u => [u.id, u]));

    // 데이터 결합
    const usersWithDetails = profiles.map(profile => {
      const authUser = authUsersMap.get(profile.id);
      const roles = userRoles.filter(r => r.user_id === profile.id).map(r => r.role);
      const wallet = walletAddresses?.find(w => w.user_id === profile.id);
      const ban = userBans?.find(b => b.user_id === profile.id);
      const isSuspicious = suspiciousUserIds.has(profile.id);
      const lightsticks = userLightsticks.get(profile.id) || [];
      
      // user_login_ips 테이블에서 마지막 IP 정보 가져오기
      const loginIpRecord = loginIps?.find(ip => ip.user_id === profile.id);
      
      return {
        ...profile,
        email: authUser?.email || null,
        roles: roles,
        wallet_address: wallet?.wallet_address || null,
        is_banned: !!ban,
        ban_reason: ban?.reason || null,
        banned_at: ban?.banned_at || null,
        is_suspicious: isSuspicious,
        lightsticks: lightsticks,
        last_ip: loginIpRecord?.last_ip || null,
        last_seen_at: loginIpRecord?.last_seen_at || null,
      };
    });

    return new Response(JSON.stringify({ users: usersWithDetails }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-get-users function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
