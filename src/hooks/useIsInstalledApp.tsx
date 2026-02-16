import { useState, useEffect } from "react";

/**
 * PWA(홈 화면에 추가)로 설치된 앱인지 판별하는 훅
 * - display-mode: standalone (Android PWA, iOS Safari PWA)
 * - navigator.standalone (iOS Safari 전용)
 * - TWA (Trusted Web Activity) 등도 포함
 */
export function useIsInstalledApp() {
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return checkInstalled();
  });

  useEffect(() => {
    setIsInstalled(checkInstalled());

    // display-mode 변경 감지 (브라우저 → PWA 전환 등)
    const mql = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setIsInstalled(checkInstalled());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isInstalled;
}

function checkInstalled(): boolean {
  // iOS Safari standalone 모드
  if ((navigator as any).standalone === true) return true;

  // Android Chrome PWA / 데스크탑 PWA
  if (window.matchMedia("(display-mode: standalone)").matches) return true;

  // TWA (Trusted Web Activity)
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;

  // document.referrer가 android-app:// 인 경우 (TWA 일부)
  if (document.referrer.startsWith("android-app://")) return true;

  return false;
}
