import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Rss, Mail, Link2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Footer = () => {
  const queryClient = useQueryClient();
  const lastInvalidateAtRef = useRef(0);

  // 투표/온체인 기록 후 즉시 카운트 갱신 (5분 캐시로 인해 "안 올라가는 것처럼" 보이는 문제 방지)
  useEffect(() => {
    const invalidateOnchainTxCount = () => {
      const now = Date.now();
      // 너무 잦은 invalidate로 Edge Function 호출이 폭증하지 않도록 간단한 쓰로틀 적용
      if (now - lastInvalidateAtRef.current < 1500) return;
      lastInvalidateAtRef.current = now;

      queryClient.invalidateQueries({
        queryKey: ["platform-total-onchain-tx-count"],
      });
    };

    window.addEventListener("dailyVotesUpdated", invalidateOnchainTxCount);
    window.addEventListener("onchainTxUpdated", invalidateOnchainTxCount);

    return () => {
      window.removeEventListener("dailyVotesUpdated", invalidateOnchainTxCount);
      window.removeEventListener("onchainTxUpdated", invalidateOnchainTxCount);
    };
  }, [queryClient]);

  // 플랫폼 전체 온체인 트랜잭션 수 조회 (Edge Function 사용 - 관리자와 동일 소스)
  const { data: onchainTxCount } = useQuery({
    queryKey: ['platform-total-onchain-tx-count'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-onchain-transactions');
        if (error) throw error;
        return data?.stats?.total || null; // 0 대신 null 반환하여 이전 값 유지
      } catch (err) {
        console.error('Failed to fetch platform total tx count:', err);
        return null; // 오류 시에도 이전 캐시된 값 유지
      }
    },
    refetchInterval: 300000, // 5분마다 갱신 (API 호출 최소화)
    staleTime: 180000,
    placeholderData: (prev) => prev, // 이전 값 유지
  });

  return (
    <footer className="border-t bg-card mt-auto pb-20 sm:pb-16">
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* 메인 푸터 콘텐츠 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-8 mb-8">
          {/* 로고 및 소개 */}
          <div className="col-span-2">
            <Link to="/" className="inline-block mb-4">
              <img src={logo} alt="KTRENDZ" className="h-10 w-auto" />
            </Link>
            <p className="text-xs text-muted-foreground mb-4 max-w-xs leading-relaxed">
              The ultimate K-culture fan page platform. Create, support, and connect with your favorite K-Pop artists and Korean entertainment.
            </p>
            {/* 소셜 아이콘 */}
            <div className="flex items-center gap-3">
              <a
                href="https://x.com/intent/follow?screen_name=KTRNZ2025"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="Follow us on X"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="mailto:manager@k-trendz.com"
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="Contact us"
              >
                <Mail className="w-4 h-4" />
              </a>
              <a
                href="https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/rss-feed"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="RSS Feed"
              >
                <Rss className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Platform 링크 - Navbar 4개 탭과 동일 */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Platform</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/challenges" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Challenges
                </Link>
              </li>
              <li>
                <Link to="/rankings" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Supporters
                </Link>
              </li>
              <li>
                <Link to="/rankings?sort=new" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  New
                </Link>
              </li>
              <li>
                <Link to="/my-watchlist" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Watchlist
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources 링크 */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Resources</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/whitepaper" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Whitepaper
                </Link>
              </li>
              <li>
                <Link to="/points-guide" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Points Guide
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal 링크 */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a 
                  href="mailto:manager@k-trendz.com" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 구분선 */}
        <Separator className="mb-6" />

        {/* 하단 Copyright */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground footer-bottom-text">
          <p>© 2025 KTRENDZ. All rights reserved.</p>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            {/* 온체인 트랜잭션 수 */}
            {onchainTxCount && onchainTxCount > 0 && (
              <a
                href="https://basescan.org/address/0x14A96Aa0B4970C1d89154C4663564718cD061F4f"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <Link2 className="w-3 h-3" />
                <span>{onchainTxCount.toLocaleString()} on-chain txns</span>
              </a>
            )}
            <div className="flex items-center gap-1">
              <span>Built on</span>
              <a 
                href="https://base.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary transition-colors font-medium"
              >
                <svg viewBox="0 0 111 111" className="w-4 h-4" fill="currentColor">
                  <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z" />
                </svg>
                Base
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;