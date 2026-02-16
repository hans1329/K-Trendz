import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCoinbaseWallet } from '@/hooks/useCoinbaseWallet';
import { toast } from 'sonner';

interface UseWalletAuthOptions {
  /** 로그인 성공 후 이동할 경로 (기본값: 현재 페이지 reload) */
  redirectTo?: string;
}

/**
 * 지갑 연결 → 서명 → 계정 생성/로그인을 처리하는 통합 훅
 * - /auth 페이지와 /challenges 페이지 모두에서 동일하게 사용
 */
export const useWalletAuth = (options?: UseWalletAuthOptions) => {
  const {
    connectWallet,
    connectedAddress,
    isConnecting,
    disconnectWallet,
    signMessageForLogin,
  } = useCoinbaseWallet();

  const [isSigningIn, setIsSigningIn] = useState(false);

  /**
   * 지갑 연결 후 서명 → Edge Function → 세션 생성까지 한 번에 처리
   */
  const signInWithWallet = useCallback(async (): Promise<boolean> => {
    // 1. 지갑이 연결되어 있지 않으면 먼저 연결
    let address = connectedAddress;
    if (!address) {
      try {
        address = await connectWallet();
        if (!address) {
          toast.error('Failed to connect wallet');
          return false;
        }
      } catch (e: any) {
        console.error('Wallet connect failed:', e);
        toast.error('Failed to connect wallet');
        return false;
      }
    }

    setIsSigningIn(true);
    try {
      // 2. 서명 요청
      const { signature, nonce } = await signMessageForLogin(address);

      // 3. Edge Function 호출
      const { data, error } = await supabase.functions.invoke('link-external-wallet', {
        body: {
          walletAddress: address,
          signature,
          nonce,
        },
      });

      // Edge Function 에러 처리 (400 에러 포함)
      if (error) {
        // FunctionsHttpError의 경우 context에서 상세 메시지 추출
        const errorBody = error.context?.body;
        if (errorBody) {
          try {
            const parsed = JSON.parse(errorBody);
            if (parsed?.error) {
              throw new Error(parsed.error);
            }
          } catch (parseErr) {
            // JSON 파싱 실패 시 원래 에러 사용
          }
        }
        throw error;
      }
      if (!data?.success) throw new Error(data?.error || 'Failed to sign in');

      console.log('[useWalletAuth] Edge function response:', {
        success: data.success,
        hasTokenHash: !!data.tokenHash,
        hasMagicLink: !!data.magicLink,
        isExisting: data.isExisting,
      });

      // 4. tokenHash로 세션 직접 생성 (가장 안정적)
      if (data.tokenHash) {
        toast.success('Signing you in...');

        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: 'magiclink',
          token_hash: data.tokenHash,
        });

        if (verifyError) {
          console.error('[useWalletAuth] verifyOtp failed:', verifyError);
          throw verifyError;
        }

        console.log('[useWalletAuth] verifyOtp succeeded');
        
        // 세션이 localStorage에 저장될 시간을 주고 리다이렉트
        setTimeout(() => {
          if (options?.redirectTo) {
            window.location.assign(options.redirectTo);
          } else {
            window.location.reload();
          }
        }, 100);
        return true;
      }

      // 5. Fallback: magicLink로 리다이렉트
      if (data.magicLink) {
        console.warn('[useWalletAuth] tokenHash not available, using magicLink');
        toast.success('Signing you in...');
        
        try {
          if (window.top && window.top !== window) {
            window.top.location.href = data.magicLink;
          } else {
            window.location.href = data.magicLink;
          }
        } catch (_e) {
          window.location.href = data.magicLink;
        }
        return true;
      }

      // 6. 둘 다 없으면 실패
      console.error('[useWalletAuth] Neither tokenHash nor magicLink returned');
      toast.error('Login failed. Please try again.');
      return false;
    } catch (error: any) {
      console.error('[useWalletAuth] Sign-in failed:', error);
      
      if (error.message?.includes('User rejected')) {
        toast.error('Signature was rejected');
      } else {
        toast.error(error.message || 'Failed to sign in with wallet');
      }
      return false;
    } finally {
      setIsSigningIn(false);
    }
  }, [connectedAddress, connectWallet, signMessageForLogin, options?.redirectTo]);

  /**
   * 이미 연결된 지갑으로 로그인만 수행 (연결은 별도로 했을 경우)
   */
  const signInWithConnectedWallet = useCallback(async (): Promise<boolean> => {
    if (!connectedAddress) {
      toast.error('Please connect your wallet first');
      return false;
    }
    return signInWithWallet();
  }, [connectedAddress, signInWithWallet]);

  return {
    // 지갑 연결 상태
    connectedAddress,
    isConnecting,
    isSigningIn,
    isProcessing: isConnecting || isSigningIn,

    // 액션
    connectWallet,
    disconnectWallet,
    signInWithWallet,
    signInWithConnectedWallet,
  };
};
