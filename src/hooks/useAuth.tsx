import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UserProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  current_level: number;
  total_points: number;
  available_points: number;
}

// 모듈 레벨 전역 플래그 - 모든 useAuth 인스턴스에서 공유됨
let dailyBonusAwarded = false;

// 초기 세션을 동기적으로 가져오기 (Supabase 저장 형식에 맞게 파싱)
const getInitialSession = (): Session | null => {
  try {
    const data = localStorage.getItem('sb-jguylowswwgjvotdcsfj-auth-token');
    if (!data) return null;

    const parsed = JSON.parse(data);
    // Supabase v2는 { currentSession, expiresAt } 형태로 저장
    return parsed.currentSession ?? null;
  } catch (error) {
    console.warn('Failed to parse initial session from localStorage:', error);
    return null;
  }
};

export const useAuth = () => {
  const initialSession = getInitialSession();
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [loading, setLoading] = useState(true); // 초기 세션 체크 완료까지 로딩 상태
  const queryClient = useQueryClient();

  // Use React Query for profile data
  const { data: profile = null } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, current_level, total_points, available_points')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data as UserProfile;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5분간 fresh 상태 유지
    gcTime: 1000 * 60 * 30, // 30분간 캐시 유지
    refetchOnMount: true, // 컴포넌트 마운트 시 데이터가 stale이면 새로고침
    refetchOnWindowFocus: false,
    refetchOnReconnect: true, // 네트워크 재연결 시 새로고침
    retry: 1, // 1회 재시도
  });

  // Realtime subscription for profile updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        () => {
          // 프로필 데이터가 변경되면 즉시 refetch
          queryClient.refetchQueries({ queryKey: ['profile', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Use React Query for admin status
  const { data: isAdmin = false } = useQuery({
    queryKey: ['isAdmin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      return !!data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
  });

  // Use React Query for moderator status
  const { data: isModerator = false } = useQuery({
    queryKey: ['isModerator', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'moderator')
        .maybeSingle();

      return !!data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
  });

  // 일일 로그인 보너스 지급 (모듈 레벨 전역 플래그 사용)
  const awardDailyLoginBonus = async (userId: string) => {
    // 이미 이번 세션에서 호출된 경우 스킵
    if (dailyBonusAwarded) {
      return false;
    }
    
    // 호출 플래그 설정 (먼저 설정해서 race condition 방지)
    dailyBonusAwarded = true;
    
    try {
      // 먼저 보너스 금액 조회
      const { data: ruleData } = await supabase
        .from('point_rules')
        .select('points')
        .eq('action_type', 'daily_login')
        .eq('is_active', true)
        .single();
      
      const bonusPoints = ruleData?.points || 5;
      
      const { data, error } = await supabase.rpc('award_daily_login_bonus', {
        user_id_param: userId
      });
      
      if (error) {
        console.error('Daily login bonus error:', error);
        return false;
      }
      
      if (data === true) {
        console.log('Daily login bonus awarded');
        // 토스트 알림 표시
        toast.success(`Daily Login Bonus! +${bonusPoints} Stars`, {
          description: 'Come back tomorrow for more rewards!'
        });
        // 프로필 데이터 갱신
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      }
      
      return data;
    } catch (error) {
      console.error('Failed to award daily login bonus:', error);
      // 에러 발생 시 플래그 리셋 (다음에 재시도 가능하도록)
      dailyBonusAwarded = false;
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    let previousUserId: string | null = null;

    // 세션 만료로 로그인 페이지로 리다이렉트
    const redirectToAuthWithExpiredSession = () => {
      // 현재 페이지가 이미 /auth이면 리다이렉트하지 않음
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
        // 세션 만료 플래그 설정
        try {
          sessionStorage.setItem('session_expired', 'true');
        } catch (e) {
          // sessionStorage 접근 실패 무시
        }
        window.location.href = '/auth';
      }
    };

    // 초기 세션 비동기 확인
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;

        // 세션 에러 발생 시 (refresh_token_not_found 등) graceful하게 처리
        if (error) {
          console.warn('Session error, clearing invalid session:', error.message);
          // 잘못된 세션 토큰 정리
          try {
            localStorage.removeItem('sb-jguylowswwgjvotdcsfj-auth-token');
          } catch (e) {
            // localStorage 접근 실패 무시
          }
          
          // 이전에 로그인된 사용자가 있었다면 세션 만료로 처리
          if (previousUserId || initialSession?.user?.id) {
            redirectToAuthWithExpiredSession();
          }
          
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        previousUserId = session?.user?.id ?? null;
        // 보너스는 onAuthStateChange에서만 처리 (중복 방지)
      } catch (error) {
        console.error('Failed to get initial session:', error);
        // 에러 발생 시 세션 초기화하고 정상적으로 페이지 렌더링
        try {
          localStorage.removeItem('sb-jguylowswwgjvotdcsfj-auth-token');
        } catch (e) {
          // localStorage 접근 실패 무시
        }
        
        // 이전에 로그인된 사용자가 있었다면 세션 만료로 처리
        if (previousUserId || initialSession?.user?.id) {
          redirectToAuthWithExpiredSession();
        }
        
        if (mounted) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    };

    initSession();

    // Auth 상태 변경 구독 (한 번만 등록)
    // CRITICAL: 콜백 내에서 Supabase 호출 금지 - 데드락 유발
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        const newUser = session?.user ?? null;
        const newUserId = newUser?.id ?? null;

        // TOKEN_REFRESHED 실패 또는 세션 만료 감지
        if (event === 'TOKEN_REFRESHED' && !session) {
          // 토큰 리프레시 실패 - 세션 만료
          if (previousUserId) {
            redirectToAuthWithExpiredSession();
          }
        }

        // 동기 상태 업데이트만 수행
        setSession(session ?? null);
        setUser(newUser);

        // 사용자 변경 시에만 프로필 관련 쿼리 업데이트
        if (!newUserId && previousUserId) {
          // 로그아웃 된 경우 이전 사용자 캐시 정리
          queryClient.setQueryData(['profile', previousUserId], null);
          queryClient.setQueryData(['isAdmin', previousUserId], false);
          queryClient.setQueryData(['isModerator', previousUserId], false);
          // 로그아웃 시 보너스 플래그 리셋 (다음 로그인 시 다시 지급 가능)
          dailyBonusAwarded = false;
        } else if (newUserId && newUserId !== previousUserId) {
          // 다른 사용자로 변경된 경우 - invalidate만 하고, 실제 fetch는 React Query가 처리
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['profile', newUserId] });
            queryClient.invalidateQueries({ queryKey: ['isAdmin', newUserId] });
            queryClient.invalidateQueries({ queryKey: ['isModerator', newUserId] });
          }, 0);

          // 새 사용자 - pending fingerprint 검증 및 저장 (OAuth 가입 후)
          setTimeout(async () => {
            try {
              const pendingFingerprint = localStorage.getItem('pending_fingerprint');
              const needsCheck = localStorage.getItem('pending_fingerprint_check');
              
              if (pendingFingerprint && session?.access_token) {
                localStorage.removeItem('pending_fingerprint');
                localStorage.removeItem('pending_fingerprint_check');
                
                // 신규 가입 여부 확인 (created_at이 최근 1분 이내면 신규)
                const createdAt = new Date(newUser?.created_at || 0);
                const now = new Date();
                const isNewUser = (now.getTime() - createdAt.getTime()) < 60000; // 1분 이내
                
                if (isNewUser && needsCheck) {
                  // 신규 가입자의 경우 fingerprint 검증
                  const checkResponse = await fetch(
                    `https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/check-fingerprint`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndXlsb3dzd3dnanZvdGRjc2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTY5MzQsImV4cCI6MjA3NzQ3MjkzNH0.WYZndHJtDXwFITy9FYKv7bhqDcmhqNwZNrj_gEobJiM',
                      },
                      body: JSON.stringify({
                        fingerprint: pendingFingerprint,
                        action: 'check'
                      })
                    }
                  );
                  
                  const checkResult = await checkResponse.json();
                  
                  if (!checkResult.allowed) {
                    // 중복 가입 감지 - 계정 차단 처리
                    console.warn('[Auth] Duplicate signup detected, banning user:', newUserId);
                    
                    // user_bans 테이블에 추가 (서버에서 처리)
                    await fetch(
                      `https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/check-fingerprint`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${session.access_token}`,
                          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndXlsb3dzd3dnanZvdGRjc2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTY5MzQsImV4cCI6MjA3NzQ3MjkzNH0.WYZndHJtDXwFITy9FYKv7bhqDcmhqNwZNrj_gEobJiM',
                        },
                        body: JSON.stringify({
                          fingerprint: pendingFingerprint,
                          action: 'ban_duplicate'
                        })
                      }
                    );
                    
                    // 로그아웃 및 알림
                    toast.error('Account creation blocked', {
                      description: 'Multiple account creation is not allowed.'
                    });
                    
                    // 세션 정리 후 리다이렉트
                    await supabase.auth.signOut();
                    window.location.href = '/auth';
                    return;
                  }
                }
                
                // fingerprint 저장
                const response = await fetch(
                  `https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/check-fingerprint`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`,
                      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndXlsb3dzd3dnanZvdGRjc2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTY5MzQsImV4cCI6MjA3NzQ3MjkzNH0.WYZndHJtDXwFITy9FYKv7bhqDcmhqNwZNrj_gEobJiM',
                    },
                    body: JSON.stringify({
                      fingerprint: pendingFingerprint,
                      action: 'save'
                    })
                  }
                );
                console.log('[Auth] Fingerprint saved for user');
              }
            } catch (e) {
              console.error('[Auth] Failed to process fingerprint:', e);
            }
          }, 500);
        }
        
        // 세션이 있으면 먼저 밴 유저인지 체크
        if (newUserId && session?.access_token) {
          setTimeout(async () => {
            try {
              // 밴 유저 체크
              const { data: userBan } = await supabase
                .from('user_bans')
                .select('id, reason')
                .eq('user_id', newUserId)
                .maybeSingle();
              
              if (userBan) {
                console.warn('[Auth] Banned user attempted to login:', newUserId);
                toast.error('Your account has been suspended', {
                  description: userBan.reason || 'Contact support for more information.'
                });
                
                // 세션 정리 후 리다이렉트
                await supabase.auth.signOut();
                window.location.href = '/auth';
                return;
              }
              
              // 밴이 아니면 일일 로그인 보너스 지급
              awardDailyLoginBonus(newUserId);
              
              // 로그인 IP 기록 (Admin에서 조회용)
              fetch('https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/record-login-ip', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndXlsb3dzd3dnanZvdGRjc2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTY5MzQsImV4cCI6MjA3NzQ3MjkzNH0.WYZndHJtDXwFITy9FYKv7bhqDcmhqNwZNrj_gEobJiM',
                  'Content-Type': 'application/json',
                },
              }).catch(e => console.warn('[Auth] Failed to record login IP:', e));
            } catch (e) {
              console.error('[Auth] Ban check failed:', e);
              // 체크 실패 시에도 보너스는 지급 (fail-open)
              awardDailyLoginBonus(newUserId);
            }
          }, 100);
        }

        previousUserId = newUserId;
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const signOut = async () => {
    const currentUserId = user?.id;
    
    // 1. 먼저 로컬 상태 초기화 (이후 요청 방지)
    setUser(null);
    setSession(null);
    
    // 2. 진행 중인 모든 쿼리 취소 및 캐시 정리
    queryClient.cancelQueries();
    
    if (currentUserId) {
      queryClient.setQueryData(['profile', currentUserId], null);
      queryClient.setQueryData(['isAdmin', currentUserId], false);
      queryClient.setQueryData(['isModerator', currentUserId], false);
    }
    queryClient.clear();
    
    // 3. 로컬 스토리지 정리
    try {
      localStorage.removeItem('sb-jguylowswwgjvotdcsfj-auth-token');
    } catch (storageError) {
      console.warn('Failed to clear auth token from localStorage:', storageError);
    }
    
    // 4. Supabase 로그아웃 (마지막에 수행)
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // 5. 홈으로 리다이렉트
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return { user, session, profile, loading, isAdmin, isModerator, signOut };
};

// Re-export useOwnerStatus for convenience
export { useOwnerStatus } from './useOwnerStatus';
