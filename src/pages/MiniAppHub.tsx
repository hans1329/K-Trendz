import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sdk } from "@farcaster/miniapp-sdk";
import { Button } from "@/components/ui/button";
import { Trophy, ShoppingBag, X, ExternalLink, ChevronRight, Sparkles, Wand2 } from "lucide-react";

export default function MiniAppHub() {
  const navigate = useNavigate();

  // SDK ready 호출
  useEffect(() => {
    let cancelled = false;

    const initSDK = async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        try {
          await sdk.actions.ready();
          console.log("[MiniAppHub] SDK ready successful");
          break;
        } catch (err) {
          console.warn(`[MiniAppHub] SDK ready attempt ${attempt + 1} failed`);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    };

    void initSDK();
    return () => { cancelled = true; };
  }, []);

  const handleClose = async () => {
    try {
      await sdk.actions.close();
    } catch {
      // 일반 브라우저에서는 닫기 불가
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-yellow-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">K-Trendz</h1>
              <p className="text-xs text-white/70">K-Pop Fan Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open('https://k-trendz.com', '_blank')}
              className="text-white hover:text-white bg-white/20 hover:bg-white/30 rounded-full px-3 h-9 text-xs font-medium"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Web
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-white hover:text-white bg-white/20 hover:bg-white/30 rounded-full w-9 h-9"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 메인 허브 카드 영역 */}
      <div className="px-4 py-8 space-y-5">
        {/* Quiz Show 카드 */}
        <button
          onClick={() => navigate('/miniapp/challenges')}
          className="w-full text-left rounded-3xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-white/15 backdrop-blur-xl border border-white/30 shadow-xl"
        >
          <div className="relative bg-gradient-to-br from-yellow-400/30 via-orange-400/20 to-pink-500/20 p-6">
            {/* 배경 아이콘 */}
            <div className="absolute top-4 right-4 opacity-20">
              <Trophy className="h-24 w-24 text-yellow-300" />
            </div>
            
            <div className="relative z-[1]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <div className="bg-yellow-400/30 rounded-full px-3 py-1">
                  <span className="text-xs font-bold text-yellow-200 uppercase tracking-wide">Win USDC</span>
                </div>
              </div>

              <h2 className="text-2xl font-black text-white mb-2">
                K-Pop Quiz Show
              </h2>
              <p className="text-sm text-white/70 mb-5 leading-relaxed">
                Test your K-Pop knowledge and win real USDC prizes. Lightstick holders get 7:3 priority!
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-300 font-medium">Live Challenges</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2.5">
                  <span className="text-sm font-bold text-white">Play Now</span>
                  <ChevronRight className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        </button>

        {/* Lightstick Shop 카드 */}
        <button
          onClick={() => navigate('/miniapp/shop')}
          className="w-full text-left rounded-3xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-white/15 backdrop-blur-xl border border-white/30 shadow-xl"
        >
          <div className="relative bg-gradient-to-br from-pink-400/30 via-purple-400/20 to-indigo-500/20 p-6">
            {/* 배경 아이콘 */}
            <div className="absolute top-4 right-4 opacity-20">
              <Wand2 className="h-24 w-24 text-pink-300" />
            </div>
            
            <div className="relative z-[1]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Wand2 className="h-6 w-6 text-white" />
                </div>
                <div className="bg-pink-400/30 rounded-full px-3 py-1">
                  <span className="text-xs font-bold text-pink-200 uppercase tracking-wide">Support Artists</span>
                </div>
              </div>

              <h2 className="text-2xl font-black text-white mb-2">
                Lightstick Shop
              </h2>
              <p className="text-sm text-white/70 mb-5 leading-relaxed">
                Own digital lightsticks to support your favorite artists. 20% goes to Artist Fund, 70% in reserve.
              </p>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <span className="bg-white/10 rounded-full px-3 py-1 text-xs text-white/80">🎵 7 Artists</span>
                  <span className="bg-white/10 rounded-full px-3 py-1 text-xs text-white/80">💎 On-chain</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2.5">
                  <span className="text-sm font-bold text-white">Browse</span>
                  <ChevronRight className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* 하단 안내 */}
      <div className="px-4 pb-8 text-center">
        <p className="text-white/40 text-xs">
          Powered by K-Trendz · Built on Base
        </p>
      </div>
    </div>
  );
}
