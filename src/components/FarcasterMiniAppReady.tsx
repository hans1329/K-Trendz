import { useEffect } from "react";

/**
 * Farcaster Mini App SDK 초기화 컴포넌트
 * - splash 화면을 제거하기 위해 sdk.actions.ready() 호출
 * - Farcaster가 /miniapp 외 다른 경로로 열리는 경우가 있어(캐시/설정/리다이렉트),
 *   라우트로 제한하지 않고 "Farcaster로부터 열린 흔적"이 있으면 항상 ready를 시도한다.
 */
export default function FarcasterMiniAppReady() {
  useEffect(() => {
    let cancelled = false;

    // Farcaster/warpcast에서 열렸을 가능성이 높을 때만 SDK 로드를 시도
    // - /miniapp, /farcaster-app/*
    // - referrer가 farcaster/warpcast
    // - UA에 farcaster/warpcast 힌트
    const path = window.location.pathname;
    const ref = document.referrer || "";
    const ua = navigator.userAgent || "";

    // farcaster.xyz miniapps 디렉토리에서 열리면 pathname이 아래 형태가 된다:
    // /miniapps/<appId>/<slug>/miniapp/shop
    const miniappsPrefixMatch = path.match(/^\/miniapps\/[^/]+\/[^/]+/);
    const normalizedPath = miniappsPrefixMatch ? (path.slice(miniappsPrefixMatch[0].length) || "/") : path;

    const likelyMiniApp =
      normalizedPath === "/miniapp" ||
      normalizedPath.startsWith("/miniapp/") ||
      normalizedPath.startsWith("/farcaster-app/") ||
      miniappsPrefixMatch !== null ||
      /farcaster|warpcast/i.test(ref) ||
      /farcaster|warpcast/i.test(ua);

    if (!likelyMiniApp) return;

    const callReady = async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");

        // sdk.actions.ready()를 여러 번 시도 (SDK 초기화 지연 대비)
        for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
          try {
            await sdk.actions.ready();
            console.log("[FarcasterMiniAppReady] SDK ready success");
            break;
          } catch (err) {
            console.warn(`[FarcasterMiniAppReady] ready attempt ${attempt + 1} failed`, err);
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        }
      } catch (err) {
        // Mini App SDK를 로드할 수 없는 환경 (일반 브라우저)
        console.log("[FarcasterMiniAppReady] SDK not available");
      }
    };

    // requestAnimationFrame로 늦추지 말고 즉시 시도 (스플래시 지속 방지)
    void callReady();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

