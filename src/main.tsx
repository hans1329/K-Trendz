// setImmediate 폴리필: @solana/web3.js 등이 postMessage 기반 폴리필을 로드하면
// 콘솔에 "setImmediate$..." 메시지가 대량 출력되는 문제 방지
if (typeof globalThis.setImmediate === "undefined") {
  (globalThis as any).setImmediate = (fn: (...args: any[]) => void, ...args: any[]) =>
    setTimeout(fn, 0, ...args);
  (globalThis as any).clearImmediate = (id: number) => clearTimeout(id);
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Farcaster Mini App 스플래시 해제는 가능한 한 빠르게 호출해야 한다.
// React mount 이전에 시도해서, 라우팅/렌더링 문제로 effect가 늦어져도 스플래시가 멈추지 않게 한다.
(async () => {
  try {
    const path = window.location.pathname;
    const ref = document.referrer || "";
    const ua = navigator.userAgent || "";

    // farcaster.xyz miniapps 디렉토리에서 열리면 pathname이 아래 형태가 된다:
    // /miniapps/<appId>/<slug>/miniapp/shop
    // 이때는 prefix를 제거한 normalizedPath 기준으로 미니앱 경로를 판별한다.
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

    const { sdk } = await import("@farcaster/miniapp-sdk");
    // ready는 여러 번 호출해도 안전해야 하므로 방어적으로 한번 더 시도
    await sdk.actions.ready();
    console.log("[main] Farcaster SDK ready called");
  } catch {
    // 일반 브라우저에서는 무시
  }
})();

createRoot(document.getElementById("root")!).render(<App />);

