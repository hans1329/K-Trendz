import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Google One Tap 타입 정의
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: (callback?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
            isDismissedMoment: () => boolean;
            getNotDisplayedReason: () => string;
            getSkippedReason: () => string;
            getDismissedReason: () => string;
          }) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

// Google Client ID
const GOOGLE_CLIENT_ID = "852197720684-81trjbgj185t4fscces3ep214tgqo5kp.apps.googleusercontent.com";

// Google One Tap 네이티브 UI 표시 (크롬 프로필 영역에 표시됨)
const LoginPromptBanner = () => {
  const handleCredentialResponse = useCallback(async (response: { credential: string }) => {
    try {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
      });

      if (error) {
        console.error("Google One Tap sign in error:", error);
      }
    } catch (error) {
      console.error("Google One Tap error:", error);
    }
  }, []);

  useEffect(() => {
    // Farcaster Mini App 라우트에서는 Google One Tap 비활성화
    const isFarcasterRoute = window.location.pathname.startsWith("/farcaster-app") || 
                             window.location.pathname.startsWith("/miniapp");
    if (isFarcasterRoute) {
      return;
    }

    // 세션 스토리지에서 dismiss 상태 확인
    const dismissed = sessionStorage.getItem("googleOneTapDismissed");
    if (dismissed) {
      return;
    }

    // 로그인 상태 확인
    const checkAuthAndShowPrompt = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        return; // 이미 로그인됨
      }

      // Google Identity Services 스크립트 로드
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: false,
            use_fedcm_for_prompt: false,
          });

          // Google One Tap 네이티브 프롬프트 표시 (크롬 오른쪽 상단)
          setTimeout(() => {
            window.google?.accounts.id.prompt((notification) => {
              if (notification.isNotDisplayed()) {
                console.log("One Tap not displayed:", notification.getNotDisplayedReason());
                sessionStorage.setItem("googleOneTapNotDisplayed", "true");
                window.dispatchEvent(new CustomEvent('showSignupCta'));
              }
              if (notification.isDismissedMoment()) {
                sessionStorage.setItem("googleOneTapDismissed", "true");
                window.dispatchEvent(new CustomEvent('showSignupCta'));
              }
            });
          }, 1500);
        }
      };
      document.head.appendChild(script);
    };

    checkAuthAndShowPrompt();

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        window.google?.accounts.id.cancel();
      }
    });

    return () => {
      subscription.unsubscribe();
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [handleCredentialResponse]);

  // 네이티브 One Tap UI는 Google이 직접 렌더링하므로 여기서는 아무것도 렌더링하지 않음
  return null;
};

export default LoginPromptBanner;
