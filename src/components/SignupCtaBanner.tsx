import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SignupCtaBannerProps {
  buttonText: string;
  redirectPath: string;
  title?: string;
  subtitle?: string;
}

// Google One Tap이 표시되지 않거나 dismissed된 경우에만 CTA 배너 표시
const SignupCtaBanner = ({ buttonText, redirectPath, title, subtitle }: SignupCtaBannerProps) => {
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const layoutViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (user) {
      setShowBanner(false);
      return;
    }

    // 커스텀 이벤트 리스너 - One Tap이 숨겨질 때 배너 표시
    const handleShowCta = () => {
      setShowBanner(true);
    };

    window.addEventListener('showSignupCta', handleShowCta);

    // 2초 후 sessionStorage 체크 (One Tap 표시 시도 후)
    const timer = setTimeout(() => {
      const dismissed = sessionStorage.getItem("googleOneTapDismissed");
      const notDisplayed = sessionStorage.getItem("googleOneTapNotDisplayed");
      
      if (dismissed || notDisplayed) {
        setShowBanner(true);
      }
    }, 2000);

    return () => {
      window.removeEventListener('showSignupCta', handleShowCta);
      clearTimeout(timer);
    };
  }, [user]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 모바일 브라우저에서 주소창/툴바 변화로 fixed 바가 떠보이거나 스크롤되는 현상 보정
  useEffect(() => {
    if (!isClient || user || !showBanner) return;

    const viewport = window.visualViewport;
    if (!viewport || !bannerRef.current || !layoutViewportRef.current) return;

    const update = () => {
      const layoutRect = layoutViewportRef.current!.getBoundingClientRect();
      const offsetLeft = viewport.offsetLeft;
      const offsetTop = viewport.height - layoutRect.height + viewport.offsetTop;

      bannerRef.current!.style.transformOrigin = "left bottom";
      bannerRef.current!.style.transform = `translate3d(${offsetLeft}px, ${offsetTop}px, 0) scale(${1 / viewport.scale})`;
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);

    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [isClient, showBanner, user]);

  if (!isClient || user || !showBanner) return null;

  const handleClick = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${redirectPath}`
      }
    });
  };

  return (
    <>
      <div
        ref={layoutViewportRef}
        className="fixed inset-0 pointer-events-none invisible"
        aria-hidden="true"
      />

      <div
        ref={bannerRef}
        className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom"
        style={{ transform: "translate3d(0,0,0)" }}
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-center sm:justify-between gap-4 bg-gradient-to-r from-primary via-orange-600 to-primary border-t border-primary/20 shadow-2xl">
          {/* 데스크탑에서만 표시 */}
          {title && subtitle && (
            <div className="hidden sm:flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">{title}</p>
                <p className="text-white/80 text-xs truncate">{subtitle}</p>
              </div>
            </div>
          )}
          <Button 
            variant="secondary" 
            className="rounded-full px-8 bg-white text-primary hover:bg-white/90 font-bold shadow-lg flex-shrink-0"
            onClick={handleClick}
          >
            {buttonText}
          </Button>
        </div>
      </div>
    </>
  );
};

export default SignupCtaBanner;
