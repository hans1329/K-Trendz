import { Helmet } from "react-helmet-async";
import { ChevronDown, ChevronUp, Target, Lightbulb, Cog, PieChart, DollarSign, Coins, Rocket, TrendingUp, Shield, Crown, Zap, Sparkles, Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import ceoImage from "@/assets/team/ceo-han-kim.jpg";
import cfoImage from "@/assets/team/cfo-chris-lee.jpg";
import cooImage from "@/assets/team/coo-william-yang.jpg";
const PitchDeck2 = () => {
  const isMobile = useIsMobile();
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 12;
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
  // Slide 1: Cover
  {
    content: <div className="flex flex-col items-center justify-center h-full text-center px-4 md:px-8">
          <div className="mb-4 md:mb-8">
            <span className="text-xs md:text-sm tracking-[0.3em] md:tracking-[0.5em] text-white/40 uppercase">Fan-Fi Platform Pitch Deck</span>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-9xl font-black tracking-tight mb-4 md:mb-8 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            K-TRENDZ
          </h1>
          <p className="text-lg sm:text-xl md:text-3xl font-light text-white/90 mb-4 md:mb-6 max-w-4xl leading-relaxed px-2">
            Turn K-POP fandom into <span className="font-bold text-primary">digital assets</span><br />
            fans can own and trade.
          </p>
          <div className="mt-4 md:mt-8 px-6 md:px-10 py-3 md:py-4 bg-gradient-to-r from-primary/90 to-orange-500/90 rounded-full">
            <p className="text-sm md:text-xl font-bold text-white">
              The Fan-Fi Platform
            </p>
          </div>
          <p className="text-sm md:text-lg text-white/50 mt-6 md:mt-10 max-w-2xl px-2">
            팬덤(Fandom)의 열정과 참여가 자산의 가치와 시장 가격(Finance)으로 연결되는 플랫폼
          </p>
          <div className="absolute bottom-16 md:bottom-12 animate-bounce">
            <ChevronDown className="w-6 h-6 md:w-8 md:h-8 text-white/30" />
          </div>
        </div>
  },
  // Slide 2: The Problem
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">02 — The Problem</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-6 md:mb-12 leading-tight">
            팬덤이 <span className="text-primary">수십억</span>을 만들어도,<br />
            팬에게 돌아오는 건 <span className="text-white/40">없다</span>.
          </h2>
          
          <div className="space-y-4 md:space-y-8 max-w-4xl">
            <div className="border-l-2 border-white/20 pl-4 md:pl-8">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <span className="text-xl md:text-2xl">💸</span>
                <h3 className="text-base md:text-xl font-bold text-white/80">일방적 소비 구조</h3>
              </div>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                팬들은 앨범, 굿즈, 투표권을 구매하지만, 그 가치는 구매 즉시 <span className="text-white font-semibold">'0'</span>이 되거나 중고로 헐값에 팔립니다.
              </p>
            </div>
            
            <div className="border-l-2 border-primary pl-4 md:pl-8">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <span className="text-xl md:text-2xl">😢</span>
                <h3 className="text-base md:text-xl font-bold text-white/80">기여 대비 보상 부재</h3>
              </div>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                팬들이 스트리밍과 투표로 아이돌을 1위로 만들어도, 팬들에게 돌아오는 <span className="text-primary font-semibold">금전적 보상은 전무</span>합니다.
              </p>
            </div>
            
            <div className="border-l-2 border-white/20 pl-4 md:pl-8">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <span className="text-xl md:text-2xl">🔥</span>
                <h3 className="text-base md:text-xl font-bold text-white/80">참여 지속성 결여</h3>
              </div>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                보상이 없으니 팬덤 활동은 <span className="text-white font-semibold">'열정'</span>에만 의존해야 하며, 이는 시간이 지날수록 식어버립니다.
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 mt-4 md:mt-8">
              <p className="text-base md:text-xl text-white/80 font-medium">
                결과: 팬덤 문화의 진정한 창작자들을 위한 <span className="text-white">지속 가능한 경제</span>가 없습니다.
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 3: The Solution
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">03 — The Solution</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            팬덤(Fandom)과<br />
            금융(Finance)의 결합<br />
            <span className="text-primary">Fan-Fi</span>의 탄생.
          </h2>
          
          <p className="text-sm md:text-xl text-white/60 mb-6 md:mb-12 max-w-3xl">
            소비가 아닌 <span className="text-white font-semibold">가치 창출</span> 관점의 팬덤 참여 (ERC-1155 기반 자산, Base Network)
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 max-w-5xl">
            <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-primary to-orange-400 rounded-xl flex items-center justify-center shadow-lg mb-3 md:mb-4">
                <span className="text-xl md:text-2xl">🎤</span>
              </div>
              <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">투자형 팬덤</h3>
              <p className="text-xs md:text-base text-white/60">
                디지털 응원봉(Light Stick) 구매는 단순 소비가 아닌 <span className="text-primary font-semibold">'지분 획득'</span>입니다.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-green-500 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg mb-3 md:mb-4">
                <span className="text-xl md:text-2xl">📈</span>
              </div>
              <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">실시간 가격 반영</h3>
              <p className="text-xs md:text-base text-white/60">
                팬들이 많이 구매할수록 <span className="text-green-400 font-semibold">본딩 커브</span>에 의해 가격이 자동 상승합니다.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-violet-500 to-purple-400 rounded-xl flex items-center justify-center shadow-lg mb-3 md:mb-4">
                <span className="text-xl md:text-2xl">💰</span>
              </div>
              <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">수익 실현 가능</h3>
              <p className="text-xs md:text-base text-white/60">
                내가 발굴한 신인의 가격이 오르면, 매도하여 <span className="text-violet-400 font-semibold">시세 차익</span>을 얻습니다.
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 4: The Mechanism
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">04 — Key Mechanism</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-2 md:mb-4 leading-tight">
            실시간 가치 평가 시스템
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">팬덤 참여도와 수요가 실시간으로 가격에 반영</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 max-w-5xl">
            <div>
              <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-6">
                <Cog className="w-5 h-5 md:w-8 md:h-8 text-primary" />
                <h3 className="text-base md:text-xl font-bold">Bonding Curve Algorithm</h3>
              </div>
              <ul className="space-y-3 md:space-y-4 text-white/70">
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">01</span>
                  <span>팬 참여 증가에 따라 가격이 <span className="text-white font-semibold">자동 조정</span>되는 알고리즘</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">02</span>
                  <span><span className="text-green-400 font-semibold">초기 진입자</span>: 저렴한 가격($2.00)에 매수 - High Risk, High Return</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">03</span>
                  <span><span className="text-blue-400 font-semibold">후기 진입자</span>: 검증된 가치에 매수 - Low Risk, Low Return</span>
                </li>
              </ul>
            </div>
            
            <div>
              <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-6">
                <Crown className="w-5 h-5 md:w-8 md:h-8 text-yellow-400" />
                <h3 className="text-base md:text-xl font-bold">Operator System</h3>
              </div>
              <ul className="space-y-3 md:space-y-4 text-white/70">
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-yellow-400 font-mono">✓</span>
                  <span>독립된 팬페이지 운영을 위한 <span className="text-white font-semibold">'팬덤 마스터'</span> 선출</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-yellow-400 font-mono">✓</span>
                  <span>팬페이지 콘텐츠 관리 권한</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-yellow-400 font-mono">✓</span>
                  <span>서포트 자금 집행 및 커뮤니티 운영</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 md:mt-12 bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary p-4 md:p-6 max-w-4xl">
            <p className="text-xs md:text-base text-white/70">
              자동화된 시장 조성(AMM)으로 <span className="text-primary font-bold">언제든 즉시 현금화</span> 가능
            </p>
          </div>
        </div>
  },
  // Slide 5: Portfolio Strategy
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">05 — Portfolio Strategy</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            안정적인 대장주부터<br />
            <span className="text-primary">100배 대박</span>을 노리는 루키까지
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">K-POP 그룹을 5단계 금융 자산 등급으로 분류</p>
          
          <div className="space-y-3 md:space-y-4 max-w-4xl">
            <div className="flex items-center gap-4">
              <div className="w-20 md:w-28 text-right">
                <span className="text-2xl md:text-3xl font-black text-yellow-400">$30~</span>
              </div>
              <div className="flex-1 bg-yellow-400/20 border border-yellow-400/30 rounded-xl md:rounded-full h-auto md:h-12 flex items-center px-4 md:px-6 py-3 md:py-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg md:text-xl">👑</span>
                  <div>
                    <span className="text-sm md:text-base font-bold text-yellow-400">Tier 1: The Kings</span>
                    <p className="text-xs md:text-sm text-white/60 md:hidden">BTS, 세븐틴 - 안전한 '기축통화'</p>
                  </div>
                  <span className="text-xs md:text-sm text-white/60 hidden md:inline">— BTS, 세븐틴 등 - 변동성은 낮지만 안전한 '기축통화'</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-20 md:w-28 text-right">
                <span className="text-2xl md:text-3xl font-black text-blue-400">$15~</span>
              </div>
              <div className="flex-1 bg-blue-400/20 border border-blue-400/30 rounded-xl md:rounded-full h-auto md:h-12 flex items-center px-4 md:px-6 py-3 md:py-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg md:text-xl">💎</span>
                  <div>
                    <span className="text-sm md:text-base font-bold text-blue-400">Tier 2: Blue Chips</span>
                    <p className="text-xs md:text-sm text-white/60 md:hidden">CORTIS, 뉴진스 - 강력한 성장세</p>
                  </div>
                  <span className="text-xs md:text-sm text-white/60 hidden md:inline">— CORTIS, 뉴진스 등 - 강력한 성장세의 우량주</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-20 md:w-28 text-right">
                <span className="text-2xl md:text-3xl font-black text-green-400">$2~</span>
              </div>
              <div className="flex-1 bg-green-400/20 border border-green-400/30 rounded-xl md:rounded-full h-auto md:h-12 flex items-center px-4 md:px-6 py-3 md:py-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg md:text-xl">🌱</span>
                  <div>
                    <span className="text-sm md:text-base font-bold text-green-400">Tier 3-4: Growth & Emerging</span>
                    <p className="text-xs md:text-sm text-white/60 md:hidden">저평가 루키 - '제2의 BTS'</p>
                  </div>
                  <span className="text-xs md:text-sm text-white/60 hidden md:inline">— 저평가된 루키 - '제2의 BTS'를 노리는 투기적 수요</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 mt-6 md:mt-8 max-w-4xl">
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <span className="text-lg md:text-xl">📊</span>
              <h4 className="font-bold text-sm md:text-base">Case Study</h4>
            </div>
            <p className="text-xs md:text-base text-white/60">
              신인 그룹 <span className="text-primary font-bold">CORTIS</span>의 경우, 데뷔 4개월 만에 가파른 상승세로 '트레져'를 위협하며 <span className="text-primary font-bold">Tier 2 진입</span>
            </p>
          </div>
        </div>
  },
  // Slide 6: Business Model
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">06 — Business Model</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            거래가 일어날 때마다<br />
            <span className="text-primary">플랫폼은 성장합니다</span>.
          </h2>
          
          <div className="max-w-4xl">
            <h3 className="text-sm md:text-lg font-bold text-white/80 mb-4 md:mb-6 flex items-center gap-2">
              <span className="text-green-400">📈</span> 구매 시 수수료 구조
            </h3>
            
            <div className="space-y-3 md:space-y-4 mb-6 md:mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 md:w-24 text-right">
                  <span className="text-2xl md:text-3xl font-black text-yellow-400">10%</span>
                </div>
                <div className="flex-1 bg-yellow-400/20 border border-yellow-400/30 rounded-full h-8 md:h-10 flex items-center px-4 md:px-6">
                  <span className="text-xs md:text-sm font-medium">Artist Fund — 아티스트를 위한 적립 펀드</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-16 md:w-24 text-right">
                  <span className="text-2xl md:text-3xl font-black text-pink-400">6%</span>
                </div>
                <div className="flex-1 bg-pink-400/20 border border-pink-400/30 rounded-full h-8 md:h-10 flex items-center px-4 md:px-6">
                  <span className="text-xs md:text-sm font-medium">Fandom Master Fee — 페이지 운영자 수수료</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-16 md:w-24 text-right">
                  <span className="text-2xl md:text-3xl font-black text-primary">4%</span>
                </div>
                <div className="flex-1 bg-primary/20 border border-primary/30 rounded-full h-8 md:h-10 flex items-center px-4 md:px-6">
                  <span className="text-xs md:text-sm font-medium">Platform Fee — K-Trendz 수익</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-16 md:w-24 text-right">
                  <span className="text-2xl md:text-3xl font-black text-green-400">80%</span>
                </div>
                <div className="flex-1 bg-green-400/20 border border-green-400/30 rounded-full h-8 md:h-10 flex items-center px-4 md:px-6">
                  <span className="text-xs md:text-sm font-medium">컨트랙트로 전송 / 매도시 지급</span>
                </div>
              </div>
            </div>
            
            <h3 className="text-sm md:text-lg font-bold text-white/80 mb-4 flex items-center gap-2">
              <span className="text-red-400">📉</span> 판매 시 수수료
            </h3>
            
            <div className="flex items-center gap-4 mb-6 md:mb-8">
              <div className="w-16 md:w-24 text-right">
                <span className="text-2xl md:text-3xl font-black text-violet-400">3%</span>
              </div>
              <div className="flex-1 bg-violet-400/20 border border-violet-400/30 rounded-full h-8 md:h-10 flex items-center px-4 md:px-6">
                <span className="text-xs md:text-sm font-medium">Platform Fee — 판매 시 플랫폼 수수료</span>
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
              <h4 className="font-bold text-white mb-2">지속 가능성:</h4>
              <p className="text-sm md:text-base text-white/60">
                폰지 구조와 달리, 우리 모델은 <span className="text-white font-semibold">콘텐츠 소비</span>와 <span className="text-white font-semibold">실물 서포트</span> 수요에 기반합니다.
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 7: $KTNZ Token
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">07 — $KTNZ Token</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            Vote-to-Earn<br />
            <span className="text-primary">유틸리티 토큰</span>
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">팬 투표, 거버넌스, 보상 메커니즘에 사용</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-5xl">
            <div className="bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-violet-500/20 rounded-xl flex items-center justify-center">
                  <Coins className="w-5 h-5 md:w-6 md:h-6 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-base md:text-xl font-bold">$KTNZ Token</h3>
                  <span className="text-xs md:text-sm text-white/50">ERC-20 on Base Network</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 md:gap-4 mb-4 md:mb-6">
                <div className="bg-white/10 rounded-xl p-2 md:p-3 text-center">
                  <p className="text-base md:text-xl font-bold text-white">5B</p>
                  <p className="text-violet-300 text-[10px] md:text-xs">Max Supply</p>
                </div>
                <div className="bg-white/10 rounded-xl p-2 md:p-3 text-center">
                  <p className="text-base md:text-xl font-bold text-white">70%</p>
                  <p className="text-violet-300 text-[10px] md:text-xs">Community Mining</p>
                </div>
              </div>
              
              <div className="border-t border-white/10 pt-4">
                <p className="text-sm text-white/50 mb-2">Earning:</p>
                <p className="text-sm text-white/70">
                  매일 <span className="text-violet-400 font-semibold">13회 투표 완료</span> 시 레벨별 토큰 자동 지급
                </p>
                <p className="text-sm text-white/50 mb-2 mt-4">Burning:</p>
                <p className="text-sm text-white/70">
                  활동 포인트인 <span className="text-violet-400 font-semibold">'Stars'</span> 로 전환 시 소각
                </p>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-base md:text-xl font-bold">Fanz Asset</h3>
                  <span className="text-xs md:text-sm text-white/50">ERC-1155 Digital Light Stick</span>
                </div>
              </div>
              
              <p className="text-white/60 mb-4 text-sm md:text-base">Role: 페이지의 지분/주식</p>
              <p className="text-white/60 mb-4 text-sm md:text-base">Pricing: <span className="text-white font-semibold">Bonding Curve</span></p>
              
              <div className="border-t border-white/10 pt-4">
                <p className="text-sm text-white/50 mb-2">Utility:</p>
                <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-white/70">
                  <li>• <span className="text-white">팬덤 증명:</span> HQ 콘텐츠 해금</li>
                  <li>• <span className="text-white">투표 파워:</span> 가중치 투표권</li>
                  <li>• <span className="text-white">소각:</span> 판매 시 토큰 소각 (디플레이션)</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="mt-6 md:mt-8 bg-gradient-to-r from-green-500/20 to-transparent border-l-4 border-green-500 p-4 md:p-6 max-w-4xl">
            <p className="text-xs md:text-sm text-white/70">
              <span className="font-bold text-green-400">팬덤 활동 = 토큰 보상</span> | 사용량 증가 → <span className="text-primary font-semibold">공급량 감소</span> → 가치 상승
            </p>
            <p className="text-[10px] md:text-xs text-white/50 mt-2">
              KTNZ는 플랫폼 참여를 위한 유틸리티 토큰이며, 투자 상품이 아닙니다.
            </p>
          </div>
        </div>
  },
  // Slide 8: One More Thing
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-amber-400 uppercase mb-2 md:mb-4">08 — 그리고...</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            One More Thing!
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">또 하나의 강력한 성장 동력</p>
          
          <div className="bg-gradient-to-r from-amber-500/20 to-transparent border-l-4 border-amber-500 p-4 md:p-6 max-w-4xl">
            <p className="text-sm md:text-lg text-white/80">
              토큰 이코노미를 넘어, K-TRENDZ는 팬들의 지식을 가치 있는 인사이트로 전환하는 <span className="text-amber-400 font-bold">게이미파이드 예측 마켓</span>을 도입합니다.
            </p>
          </div>
        </div>
  },
  // Slide 9: Fan Challenges
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-amber-400 uppercase mb-2 md:mb-4">09 — 팬 챌린지</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            K-Culture<br />
            <span className="text-amber-400">예측 마켓</span>
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">팬의 지식을 예측 인사이트로 전환하고 보상 획득</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-5xl">
            <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Trophy className="w-5 h-5 md:w-6 md:h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base md:text-xl font-bold">팬 챌린지</h3>
                  <span className="text-xs md:text-sm text-white/50">게이미파이드 예측</span>
                </div>
              </div>
              
              <ul className="space-y-2 md:space-y-4 text-xs md:text-sm text-white/70">
                <li className="flex items-start gap-2 md:gap-3">
                  <span className="text-amber-400 font-mono">01</span>
                  <span>컴백 일정, 차트 순위, 시상식 수상자 예측</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3">
                  <span className="text-amber-400 font-mono">02</span>
                  <span>노래 가사, 앨범 컨셉, 뮤직비디오 스토리라인 맞추기</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3">
                  <span className="text-amber-400 font-mono">03</span>
                  <span><span className="text-amber-400 font-semibold">온체인 랜덤</span>으로 당첨자 선정</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Crown className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-base md:text-xl font-bold">팬 거버넌스</h3>
                  <span className="text-xs md:text-sm text-white/50">응원봉 홀더 혜택</span>
                </div>
              </div>
              
              <ul className="space-y-2 md:space-y-4 text-xs md:text-sm text-white/70">
                <li className="flex items-start gap-2 md:gap-3">
                  <span className="text-primary font-mono">✓</span>
                  <span>응원봉 소유 여부에 따른 <span className="text-white font-semibold">상금 차등 지급</span></span>
                </li>
                <li className="flex items-start gap-2 md:gap-3">
                  <span className="text-primary font-mono">✓</span>
                  <span>예측 참여로 <span className="text-white font-semibold">추가 수익 창출</span> 기회</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3">
                  <span className="text-primary font-mono">✓</span>
                  <span>투명한 온체인 당첨자 선정</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 md:mt-8 bg-gradient-to-r from-amber-500/20 to-transparent border-l-4 border-amber-500 p-4 md:p-6 max-w-4xl">
            <p className="text-xs md:text-sm text-white/70">
              <span className="font-bold text-amber-400">게이미파이드 참여</span> | 팬들이 경쟁하고, 예측하고, <span className="text-amber-400 font-semibold">USDC 상금</span>을 획득
            </p>
          </div>
        </div>
  },
  // Slide 10: Legal & Tech
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">10 — 법률 & 기술</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-6 md:mb-12 leading-tight">
            안전하고, 확장 가능하며,<br />
            <span className="text-primary">대중 채택 준비 완료</span>.
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-5xl">
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <h3 className="text-base md:text-lg font-bold">저작권 방어</h3>
              </div>
              <p className="text-primary font-semibold mb-2 text-sm md:text-base">"기부" 모델</p>
              <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-white/70">
                <li>• 이미지 직접 판매 아님.</li>
                <li>• 팬들이 응원봉으로 "후원"; 콘텐츠 접근은 "혜택".</li>
                <li>• 직접적 침해 리스크 제거.</li>
              </ul>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Cog className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <h3 className="text-base md:text-lg font-bold">콘텐츠 보호</h3>
              </div>
              <p className="text-sm md:text-base text-white/70 leading-relaxed">
                모든 업로드 이미지에 <span className="text-white font-semibold">보이지 않는 디지털 워터마크</span> 적용.
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Rocket className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <h3 className="text-base md:text-lg font-bold">온보딩</h3>
              </div>
              <p className="text-sm md:text-base text-white/70 leading-relaxed">
                Base 체인에서 <span className="text-white font-semibold">소셜 로그인</span> + <span className="text-white font-semibold">법정화폐 온램프</span> (Stripe).
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 11: Team
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">11 — 팀</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            K-Pop 인사이더와<br />
            <span className="text-primary">Web3 빌더</span>의 만남.
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 max-w-5xl">
            {/* Han Kim */}
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden mb-3 md:mb-4 mx-auto border-2 border-primary/30">
                <img src={ceoImage} alt="Han Kim" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-center mb-1">Han Kim</h3>
              <p className="text-primary font-semibold text-center text-sm md:text-base mb-2 md:mb-3">CEO</p>
              <p className="text-xs md:text-sm text-white/70 text-center leading-relaxed">
                플랫폼 업계 베테랑<br />
                스마트 컨트랙트 전문가이자<br />
                풀스택 개발자
              </p>
            </div>
            
            {/* Chris Lee */}
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden mb-3 md:mb-4 mx-auto border-2 border-primary/30">
                <img src={cfoImage} alt="Chris Lee" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-center mb-1">Chris Lee</h3>
              <p className="text-primary font-semibold text-center text-sm md:text-base mb-2 md:mb-3">CFO</p>
              <p className="text-xs md:text-sm text-white/70 text-center leading-relaxed">
                기획 리드<br />
                플랫폼 설계 및<br />
                재무요소 설계 전문가
              </p>
            </div>
            
            {/* William Yang */}
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden mb-3 md:mb-4 mx-auto border-2 border-primary/30">
                <img src={cooImage} alt="William Yang" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-center mb-1">William Yang</h3>
              <p className="text-primary font-semibold text-center text-sm md:text-base mb-2 md:mb-3">COO</p>
              <p className="text-xs md:text-sm text-white/70 text-center leading-relaxed">
                커뮤니티<br />
                팬덤 네트워크 전문가<br />
                K-Culture 스페셜리스트
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 12: Vision
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">12 — Vision</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            팬덤 자본 시장의<br />
            <span className="text-primary">나스닥(NASDAQ)</span>
          </h2>
          
          <p className="text-sm md:text-xl text-white/60 mb-6 md:mb-12 max-w-3xl leading-relaxed">
            전 세계 <span className="text-primary font-bold">1억 명</span>의 K-POP 팬들이 아침마다 눈을 뜨면 가장 먼저 확인하는 플랫폼
          </p>
          
          <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8 max-w-4xl mb-6 md:mb-8">
            <p className="text-sm md:text-lg text-white/80 leading-relaxed mb-4">
              K-TRENDZ는 K-POP 팬덤의 참여를 시장 기반 자산 구조로 확장하고<br />
              팬, 크리에이터, 플랫폼이 함께 성장하는 <span className="text-primary font-semibold">지속 가능한 팬덤 자본 생태계</span>를 구축합니다.
            </p>
            <p className="text-sm md:text-base text-primary font-semibold">
              팬덤은 더 이상 소비자가 아니라, 시장을 만들어가는 참여자가 됩니다.
            </p>
          </div>
          
          <div className="bg-gradient-to-r from-white/10 to-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8 max-w-4xl mb-6 md:mb-8">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <span className="text-xl md:text-2xl">💼</span>
              <h4 className="text-base md:text-xl font-bold text-white">투자자용 한 줄 요약</h4>
            </div>
            <p className="text-sm md:text-lg text-white/80 italic leading-relaxed">
              "K-Trendz는 엔터테인먼트의 <span className="text-primary font-bold">'감성'</span>을 핀테크의 <span className="text-primary font-bold">'숫자'</span>로 치환한 최초의 플랫폼입니다.<br />
              BTS의 성공을 지켜보기만 했던 팬들에게, 이제 BTS의 성공을 <span className="text-primary font-bold">'나눠 가질'</span> 기회를 팝니다."
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <a href="mailto:manager@k-trendz.com" className="inline-flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-full transition-colors text-sm md:text-base">
              <span>📧</span> Contact Us
            </a>
            <a href="https://k-trendz.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full border border-white/20 transition-colors text-sm md:text-base">
              <span>🌐</span> k-trendz.com
            </a>
          </div>
        </div>
  }];
  // 모바일: 세로 스크롤 / 데스크톱: 페이지 네비게이션
  if (isMobile) {
    return (
      <div className="min-h-screen bg-black text-white overflow-y-auto">
        <Helmet>
          <title>K-TRENDZ Fan-Fi Pitch Deck - Investor Presentation</title>
          <meta name="description" content="K-TRENDZ Fan-Fi pitch deck - We turn K-POP fandom into digital assets fans can own and trade" />
        </Helmet>

        {/* 모바일: 세로 스크롤 레이아웃 */}
        <div className="flex flex-col">
          {slides.map((slide, index) => (
            <div key={index} className="min-h-screen w-full flex justify-center border-b-4 border-white/10 last:border-b-0">
              <div className="w-full max-w-7xl">{slide.content}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <div className="fixed inset-0 bg-black text-white overflow-hidden">
      <Helmet>
        <title>K-TRENDZ Fan-Fi Pitch Deck - Investor Presentation</title>
        <meta name="description" content="K-TRENDZ Fan-Fi pitch deck - We turn K-POP fandom into digital assets fans can own and trade" />
      </Helmet>

      {/* Navigation Controls - 데스크톱 전용 */}
      <div className="fixed right-8 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-4">
        {/* Slide dots */}
        <div className="flex flex-col gap-2 mb-4">
          {slides.map((_, index) => <button key={index} onClick={() => goToSlide(index)} className={`w-2.5 h-2.5 rounded-full transition-all ${index === currentSlide ? "bg-primary scale-125" : "bg-white/20 hover:bg-white/40"}`} />)}
        </div>
        
        {/* Navigation arrows */}
        <button onClick={prevSlide} disabled={currentSlide === 0} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
          <ChevronUp className="w-5 h-5" />
        </button>
        <span className="text-sm text-white/50 font-mono">
          {currentSlide + 1}/{totalSlides}
        </span>
        <button onClick={nextSlide} disabled={currentSlide === totalSlides - 1} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Slides Container - 데스크톱 전용 */}
      <div className="transition-transform duration-700 ease-out" style={{
      transform: `translateY(-${currentSlide * 100}vh)`
    }}>
        {slides.map((slide, index) => <div key={index} className="h-screen w-full flex justify-center">
            <div className="w-full max-w-7xl">{slide.content}</div>
          </div>)}
      </div>
    </div>;
};
export default PitchDeck2;