import { Helmet } from "react-helmet-async";
import { ChevronDown, ChevronUp, Users, TrendingUp, Shield, Rocket, Target, Coins, Lock, Unlock, Zap, Heart, Crown, Star } from "lucide-react";
import { useState, useEffect } from "react";
const PitchDeckAllianceKr = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 10;
  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };
  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };
  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        nextSlide();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        prevSlide();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlide]);
  const slides = [
  // Slide 1: 표지
  {
    content: <div className="flex flex-col items-center justify-center h-full text-center px-4 md:px-8">
          <div className="mb-4 md:mb-8">
            <span className="text-xs md:text-sm tracking-[0.3em] md:tracking-[0.5em] text-white/40 uppercase">Alliance DAO 피치 덱</span>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-9xl font-black tracking-tight mb-4 md:mb-8 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            K-TRENDZ
          </h1>
          <p className="text-lg sm:text-xl md:text-3xl font-light text-white/90 mb-4 md:mb-6 max-w-4xl leading-relaxed px-2">
            Base 기반 <span className="font-bold text-primary">"Fan-Fi"</span> 플랫폼.<br />
            팬덤의 열정을 투자 가능한 자산으로 전환합니다.
          </p>
          <p className="text-sm md:text-lg text-white/50 mt-4 md:mt-8 max-w-2xl px-2">
            페이지 마스터(슈퍼팬 크리에이터)와 실제 K-Pop 팬덤이 함께 만들어갑니다.
          </p>
          <div className="absolute bottom-16 md:bottom-12 animate-bounce">
            <ChevronDown className="w-6 h-6 md:w-8 md:h-8 text-white/30" />
          </div>
        </div>
  },
  // Slide 2: 문제점
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">02 — 문제점</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-6 md:mb-12 leading-tight">
            팬덤은 <span className="text-primary">수십억</span>을 창출하지만,<br />
            수익은 <span className="text-white/40">제로</span>.
          </h2>
          
          <div className="space-y-4 md:space-y-10 max-w-4xl">
            <div className="border-l-2 border-white/20 pl-4 md:pl-8">
              <h3 className="text-base md:text-xl font-bold text-white/80 mb-2 md:mb-3">갭(Gap)</h3>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                글로벌 K-Pop 팬들은 가장 조직화된 디지털 군대(스트리밍, 투표)이지만,
                여전히 <span className="text-white font-semibold">수동적인 소비자</span>로 남아있습니다.
              </p>
            </div>
            
            <div className="border-l-2 border-primary pl-4 md:pl-8">
              <h3 className="text-base md:text-xl font-bold text-white/80 mb-2 md:mb-3">공급 측 고충</h3>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                "페이지 마스터"(아티스트를 팔로우하고 콘텐츠를 만드는 슈퍼팬)들이 문화를 이끌지만,
                실물 굿즈 판매 시 <span className="text-primary font-semibold">높은 비용과 법적 리스크</span>에 시달립니다.
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 mt-4 md:mt-8">
              <p className="text-base md:text-xl text-white/80 font-medium">
                결과: 팬덤 문화의 진정한 창작자들을 위한 <span className="text-white">지속 가능한 경제가 없습니다</span>.
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 3: 솔루션
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">03 — 솔루션</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            팬이 만들고,<br />
            <span className="text-primary">팬이 소유한다</span>.
          </h2>
          
          <p className="text-sm md:text-xl text-white/60 mb-6 md:mb-12 max-w-3xl">
            K-Trendz는 팬들이 아티스트 정보를 기록하고, 순위를 정하고, 그 영향력으로 수익을 창출하는 "Fan-Fi" 플랫폼입니다.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 max-w-5xl">
            <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8">
              <Heart className="w-6 h-6 md:w-10 md:h-10 text-pink-400 mb-2 md:mb-4" />
              <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">팬</h3>
              <p className="text-xs md:text-base text-white/60">
                활동하면 <span className="text-primary font-mono">$KTNZ</span> 토큰을 받고, 좋아하는 아티스트의 "Fanz 자산"에 투자할 수 있어요.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <Crown className="w-6 h-6 md:w-10 md:h-10 text-primary mb-2 md:mb-4" />
              <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">페이지 마스터</h3>
              <p className="text-xs md:text-base text-white/60">
                거래가 일어날 때마다 <span className="text-primary font-bold">6%</span> 수익을 평생 받을 수 있어요.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8">
              <Star className="w-6 h-6 md:w-10 md:h-10 text-yellow-400 mb-2 md:mb-4" />
              <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">아티스트</h3>
              <p className="text-xs md:text-base text-white/60">
                거래량의 <span className="font-bold">10%</span>가 팬들이 직접 운영하는 아티스트 지원 펀드로 적립돼요.
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 4: 메커니즘 I - 언락 워
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">04 — 핵심 메커니즘 I</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-2 md:mb-4 leading-tight">
            "잠금 해제 전쟁"
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">먼저 커뮤니티를 모으고, 그 다음에 거래를 시작합니다.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 max-w-5xl">
            <div>
              <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-6">
                <Lock className="w-5 h-5 md:w-8 md:h-8 text-white/40" />
                <h3 className="text-base md:text-xl font-bold">잠금 시스템</h3>
              </div>
              <ul className="space-y-3 md:space-y-4 text-white/70">
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">01</span>
                  <span>아티스트는 인지도에 따라 <span className="text-white font-semibold">3개 등급</span>으로 나뉩니다 (레전드 / 챌린저 / 루키)</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">02</span>
                  <span>모든 페이지는 처음에 <span className="text-white font-semibold">"잠금"</span> 상태이며, 토큰 거래가 불가능합니다.</span>
                </li>
              </ul>
            </div>
            
            <div>
              <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-6">
                <Unlock className="w-5 h-5 md:w-8 md:h-8 text-primary" />
                <h3 className="text-base md:text-xl font-bold">잠금 해제 경쟁</h3>
              </div>
              <ul className="space-y-3 md:space-y-4 text-white/70">
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">01</span>
                  <span>팬들이 자신의 아티스트 페이지를 열기 위해 <span className="text-primary font-semibold">투표</span>합니다.</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">02</span>
                  <span>투표 1등 기여자가 <span className="text-white font-semibold">"페이지 마스터"</span>로 선정됩니다.</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 md:mt-12 bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary p-4 md:p-6 max-w-4xl">
            <h4 className="text-sm md:text-lg font-bold text-primary mb-1 md:mb-2">이 방식이 효과적인 이유:</h4>
            <p className="text-xs md:text-base text-white/70">
              토큰이 발행되기 전부터 <span className="text-white font-semibold">폭발적인 관심과 트래픽</span>이 생깁니다. 
              마켓이 열리는 순간, 이미 활성화된 팬층이 준비되어 있습니다.
            </p>
          </div>
        </div>
  },
  // Slide 5: 메커니즘 II - 듀얼 토큰 이코노미
  {
    content: <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">05 — 메커니즘 II</span>
          <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            듀얼 토큰 이코노미
          </h2>
          <p className="text-2xl text-white/60 mb-12">지속 가능한 순환: 자산 & 보상.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl">
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Fanz 자산</h3>
                  <span className="text-sm text-white/50">ERC-1155 디지털 응원봉</span>
                </div>
              </div>
              <p className="text-white/60 mb-4">역할: 페이지의 지분/주식.</p>
              <p className="text-white/60 mb-4">가격: <span className="text-white font-semibold">본딩 커브</span> (지지가 커질수록 가격 상승).</p>
              <div className="border-t border-white/10 pt-4 mt-4">
                <p className="text-sm text-white/50 mb-2">유틸리티:</p>
                <ul className="space-y-2 text-sm text-white/70">
                  <li>• <span className="text-white">팬덤 증명:</span> HQ 콘텐츠 언락</li>
                  <li>• <span className="text-white">파워:</span> 가중 투표권</li>
                  <li>• <span className="text-white">소각:</span> 판매 시 토큰 소각 (디플레이션)</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Coins className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">$KTNZ</h3>
                  <span className="text-sm text-white/50">Base 활동 토큰</span>
                </div>
              </div>
              <p className="text-white/60 mb-4">역할: 일일 활동 보상 (투표, 로그인).</p>
              <p className="text-white/60 mb-4">유틸리티: Fanz 자산 구매 시 할인을 위해 <span className="text-white font-semibold">소각</span>됨.</p>
              <div className="border-t border-white/10 pt-4 mt-4">
                <p className="text-sm text-white/50 mb-2">UX:</p>
                <p className="text-sm text-white/70">
                  <span className="text-white">임베디드 월렛</span>으로 배포 (보이지 않는 Web3).
                </p>
              </div>
            </div>
          </div>
        </div>
  },
  // Slide 6: 비즈니스 모델
  {
    content: <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">06 — 비즈니스 모델</span>
          <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            수익 & 분배
          </h2>
          <p className="text-2xl text-white/60 mb-12">모든 이해관계자를 위한 정렬된 인센티브.</p>
          
          <div className="max-w-4xl">
            <h3 className="text-lg font-bold text-white/80 mb-6">거래 수수료 구조 (자산 매매 시)</h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-24 text-right">
                  <span className="text-3xl font-black text-yellow-400">10%</span>
                </div>
                <div className="flex-1 bg-yellow-400/20 rounded-full h-8 flex items-center px-4">
                  <span className="text-sm font-medium">아티스트를 위한 펀드 — 실물 이벤트 (광고, 자선). 팬 투표로 사용처 결정.</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-24 text-right">
                  <span className="text-3xl font-black text-primary">6%</span>
                </div>
                <div className="flex-1 bg-primary/20 rounded-full h-8 flex items-center px-4">
                  <span className="text-sm font-medium">페이지 마스터 — 직접 수익. 5만+ 팔로워 유입 인센티브.</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-24 text-right">
                  <span className="text-3xl font-black text-blue-400">4%</span>
                </div>
                <div className="flex-1 bg-blue-400/20 rounded-full h-8 flex items-center px-4">
                  <span className="text-sm font-medium">플랫폼 — K-Trendz 수익</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-24 text-right">
                  <span className="text-3xl font-black text-green-400">80%</span>
                </div>
                <div className="flex-1 bg-green-400/20 rounded-full h-8 flex items-center px-4">
                  <span className="text-sm font-medium">컨트랙트로 전송 / 매도시 지급</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h4 className="font-bold text-white mb-2">지속 가능성:</h4>
              <p className="text-white/60">
                폰지 스킴과 달리, 우리 모델은 <span className="text-white font-semibold">콘텐츠 소비</span>와 <span className="text-white font-semibold">실물 지원</span> 니즈에 기반합니다.
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 7: 법률 & 기술 전략
  {
    content: <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">07 — 법률 & 기술</span>
          <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            안전하고, 확장 가능하며,<br />
            <span className="text-primary">대중 채택 준비 완료</span>.
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mt-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <Shield className="w-8 h-8 text-green-400 mb-4" />
              <h3 className="text-lg font-bold mb-3">저작권 방어</h3>
              <p className="text-sm text-white/50 mb-2">"기부" 모델</p>
              <ul className="space-y-2 text-sm text-white/60">
                <li>• 이미지 직접 판매 아님.</li>
                <li>• 팬들이 응원봉으로 "후원"; 콘텐츠 접근은 "혜택".</li>
                <li>• <span className="text-green-400">직접적 침해 리스크 제거.</span></li>
              </ul>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <Lock className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-bold mb-3">콘텐츠 보호</h3>
              <p className="text-sm text-white/60 mt-4">
                모든 업로드 이미지에 <span className="text-white font-semibold">보이지 않는 디지털 워터마크</span> 적용.
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <Users className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-3">온보딩</h3>
              <p className="text-sm text-white/60 mt-4">
                Base 체인에서 <span className="text-white font-semibold">소셜 로그인</span> + <span className="text-white font-semibold">법정화폐 온램프 (Stripe)</span>.
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 8: 성장 전략 (GTM)
  {
    content: <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">08 — 성장 전략</span>
          <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            "페이지 마스터"<br />
            <span className="text-primary">트로이 목마</span>.
          </h2>
          
          <div className="max-w-4xl mt-8">
            <div className="bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary p-6 mb-8">
              <h3 className="text-xl font-bold mb-2">전략:</h3>
              <p className="text-lg text-white/70">
                유저를 한 명씩 확보하지 않습니다. <span className="text-white font-semibold">마스터를 확보합니다.</span>
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <Target className="w-8 h-8 text-primary mb-4" />
                <h4 className="text-lg font-bold mb-3">제안</h4>
                <p className="text-white/60">
                  "당신의 최애 페이지의 <span className="text-white font-semibold">창립자</span>가 되세요. 무제한 초대 코드를 받으세요."
                </p>
              </div>
              
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <TrendingUp className="w-8 h-8 text-green-400 mb-4" />
                <h4 className="text-lg font-bold mb-3">승수 효과</h4>
                <p className="text-white/60">
                  <span className="text-3xl font-black text-white">1</span> 마스터 = <span className="text-3xl font-black text-primary">1만 ~ 10만</span> 팔로워 즉시 온보딩.
                </p>
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h4 className="text-lg font-bold mb-4">현재 상태 (베타):</h4>
              <ul className="space-y-3 text-white/70">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span><span className="text-white font-semibold">초대 전용 베타 라이브.</span></span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>"라이징 스타" 그룹 (티어 2) 타겟팅으로 초기 경쟁 점화.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
  },
  // Slide 9: 팀
  {
    content: <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">09 — 팀</span>
          <h2 className="text-4xl md:text-6xl font-black mb-12 leading-tight">
            K-Pop 인사이더와<br />
            <span className="text-primary">Web3 빌더</span>의 만남.
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/50 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-black">F</span>
              </div>
              <h3 className="text-lg font-bold mb-2">파운더</h3>
              <p className="text-sm text-white/60">
                K-Pop 업계 베테랑<br />
                풀스택 개발자
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-500/50 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-black">T</span>
              </div>
              <h3 className="text-lg font-bold mb-2">테크 리드</h3>
              <p className="text-sm text-white/60">
                스마트 컨트랙트 전문가<br />
                Base 생태계 빌더
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-500/50 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-black">C</span>
              </div>
              <h3 className="text-lg font-bold mb-2">커뮤니티</h3>
              <p className="text-sm text-white/60">
                팬덤 네트워크 전문가<br />
                K-Culture 스페셜리스트
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 10: 요청
  {
    content: <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-8">10 — 요청</span>
          <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight">
            <span className="text-primary">Base</span>에서<br />
            혁명에 동참하세요.
          </h2>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-2xl mb-12">
            <Rocket className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-4">목표:</h3>
            <p className="text-lg text-white/70">
              엔지니어링 & 글로벌 마케팅 가속화를 위한 <span className="text-white font-semibold">시드 라운드</span> 모금.
            </p>
          </div>
          
          <div className="max-w-3xl">
            <p className="text-2xl md:text-3xl font-light text-white/80 leading-relaxed italic">
              "K-Trendz는 단순한 앱이 아닙니다; 세계에서 가장 열정적인 커뮤니티를 위한 <span className="text-primary font-semibold">금융 레이어</span>입니다."
            </p>
          </div>
          
          <div className="mt-16 flex flex-col md:flex-row items-center gap-4 mb-12">
            <a href="https://k-trendz.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-4 px-8 rounded-full transition-all min-w-[180px]">
              K-Trendz 방문
            </a>
            <a href="mailto:manager@k-trendz.com" className="inline-flex items-center justify-center gap-2 border border-white/60 hover:border-white hover:bg-white/10 text-white font-bold py-4 px-8 rounded-full transition-all min-w-[180px]">
              연락하기
            </a>
          </div>
        </div>
  }];
  return <>
      <Helmet>
        <title>K-Trendz: Alliance DAO 피치 덱</title>
        <meta name="description" content="Base 기반 Fan-Fi 플랫폼. 팬덤의 열정을 투자 가능한 자산으로 전환합니다." />
      </Helmet>

      <div className="fixed inset-0 bg-black text-white overflow-hidden">
        {/* Navigation Dots */}
        <div className="fixed right-3 md:right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5 md:gap-2">
          {slides.map((_, index) => <button key={index} onClick={() => goToSlide(index)} className={`w-1.5 md:w-2 h-1.5 md:h-2 rounded-full transition-all ${currentSlide === index ? "bg-primary w-1.5 md:w-2 h-4 md:h-6" : "bg-white/30 hover:bg-white/50"}`} />)}
        </div>

        {/* Navigation Arrows */}
        <div className="fixed right-3 md:right-6 bottom-4 md:bottom-6 z-50 flex flex-col gap-1.5 md:gap-2">
          <button onClick={prevSlide} disabled={currentSlide === 0} className="p-1.5 md:p-2 bg-white/10 hover:bg-white/20 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <ChevronUp className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button onClick={nextSlide} disabled={currentSlide === totalSlides - 1} className="p-1.5 md:p-2 bg-white/10 hover:bg-white/20 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        {/* Slide Counter */}
        <div className="fixed left-3 md:left-6 bottom-4 md:bottom-6 z-50 text-xs md:text-sm text-white/40 font-mono">
          {String(currentSlide + 1).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}
        </div>


        {/* Slides Container */}
        <div className="transition-transform duration-700 ease-out" style={{
        transform: `translateY(-${currentSlide * 100}vh)`
      }}>
          {slides.map((slide, index) => <div key={index} className="h-screen w-full flex items-center justify-center">
              {slide.content}
            </div>)}
        </div>
      </div>
    </>;
};
export default PitchDeckAllianceKr;