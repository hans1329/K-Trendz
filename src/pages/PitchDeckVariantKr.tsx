import { Helmet } from "react-helmet-async";
import { ChevronDown, ChevronUp, Users, TrendingUp, Shield, Rocket, Target, Coins, Lock, Unlock, Zap, Heart, Crown, Star, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

const PitchDeckVariantKr = () => {
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
    // Slide 1: 비전
    {
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-4 md:px-8">
          <div className="mb-4 md:mb-8">
            <span className="text-xs md:text-sm tracking-[0.3em] md:tracking-[0.5em] text-white/40 uppercase">Variant Fund 투자 제안서</span>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-9xl font-black tracking-tight mb-4 md:mb-8 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            K-TRENDZ
          </h1>
          <p className="text-lg sm:text-xl md:text-3xl font-light text-white/90 mb-4 md:mb-6 max-w-4xl leading-relaxed px-2">
            K-Pop 팬덤을 위한 <span className="font-bold text-primary">소유권 경제</span>
          </p>
          <p className="text-sm md:text-lg text-white/60 mt-2 md:mt-4 max-w-2xl px-2">
            팬과 큐레이터가 자신이 만들어낸 가치를 직접 소유하는 사용자 소유형 엔터테인먼트 네트워크를 구축합니다.
          </p>
          <div className="flex items-center gap-2 md:gap-4 mt-6 md:mt-8 text-sm md:text-base text-white/50">
            <span>수동적 소비</span>
            <ArrowRight className="w-4 h-4 md:w-6 md:h-6 text-primary" />
            <span className="text-white font-semibold">능동적 소유</span>
          </div>
          <div className="absolute bottom-16 md:bottom-12 animate-bounce">
            <ChevronDown className="w-6 h-6 md:w-8 md:h-8 text-white/30" />
          </div>
        </div>
      ),
    },
    // Slide 2: 문제점
    {
      content: (
        <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">02 — 문제점</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-6 md:mb-12 leading-tight">
            팬덤 경제는 <span className="text-primary">망가져</span> 있습니다.
          </h2>
          
          <div className="space-y-4 md:space-y-10 max-w-4xl">
            <div className="border-l-2 border-white/20 pl-4 md:pl-8">
              <h3 className="text-base md:text-xl font-bold text-white/80 mb-2 md:mb-3">핵심 인사이트</h3>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                K-Pop 팬덤은 단순한 관객이 아닙니다. 그들은 <span className="text-white font-semibold">고도로 조직화된 노동력</span>입니다.
                아티스트를 홍보하고, 이벤트를 기획하며, 고품질 콘텐츠를 직접 제작합니다.
              </p>
            </div>
            
            <div className="border-l-2 border-red-500 pl-4 md:pl-8">
              <h3 className="text-base md:text-xl font-bold text-white/80 mb-2 md:mb-3">구조적 불균형</h3>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                현재 중앙화된 기획사와 플랫폼이 <span className="text-red-400 font-semibold">수익의 100%를 독점</span>하고 있습니다.
              </p>
            </div>
            
            <div className="border-l-2 border-yellow-500 pl-4 md:pl-8">
              <h3 className="text-base md:text-xl font-bold text-white/80 mb-2 md:mb-3">희생자</h3>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                "홈마"(슈퍼팬 큐레이터)들은 팬덤 참여의 핵심 동력이지만, 포토북 판매 같은 법적 회색지대에서
                <span className="text-yellow-400 font-semibold"> 어떤 장기적 보장도 없이</span> 활동하고 있습니다.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 3: 테시스
    {
      content: (
        <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">03 — 투자 테시스</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            크리에이터 <span className="text-primary">"중산층"</span>에<br />
            힘을 실어주다
          </h2>
          
          <div className="max-w-4xl">
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8 mb-4 md:mb-8">
              <h3 className="text-base md:text-xl font-bold text-primary mb-2 md:mb-4">패러다임의 전환</h3>
              <p className="text-sm md:text-lg text-white/60 mb-2 md:mb-4">
                Web2 플랫폼(인스타그램, 트위터)은 <span className="text-white">소수의 슈퍼스타</span>에 최적화되어 있습니다.
              </p>
              <p className="text-base md:text-xl text-white/80">
                <span className="text-primary font-bold">K-Trendz의 신념:</span> 우리는 특정 커뮤니티를 섬기는
                <span className="text-white font-semibold"> "니치 큐레이터"</span>(페이지 캡틴)를 위한 도구를 만듭니다.
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary p-4 md:p-6">
              <p className="text-base md:text-xl text-white/80">
                그들에게 <span className="text-primary font-bold">소유권</span>을 부여함으로써,
                크리에이터 경제의 거대하고 미개척된 영역을 열어갑니다.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 4: 솔루션
    {
      content: (
        <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">04 — 솔루션</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            탈중앙화된<br />
            <span className="text-primary">아카이브 네트워크</span>
          </h2>
          
          <p className="text-sm md:text-xl text-white/60 mb-6 md:mb-12 italic">작동 방식:</p>
          
          <div className="space-y-4 md:space-y-8 max-w-4xl">
            <div className="flex gap-3 md:gap-6 items-start">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-base md:text-xl">1</span>
              </div>
              <div>
                <h3 className="text-base md:text-xl font-bold mb-1 md:mb-2">커뮤니티가 선출한 큐레이터</h3>
                <p className="text-xs md:text-base text-white/60">
                  중앙 관리자 대신 <span className="text-white font-semibold">페이지 캡틴</span>(커뮤니티 투표로 선출)이 개별 아티스트 아카이브를 운영합니다.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 md:gap-6 items-start">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-base md:text-xl">2</span>
              </div>
              <div>
                <h3 className="text-base md:text-xl font-bold mb-1 md:mb-2">큐레이터-팬 이해관계 일치</h3>
                <p className="text-xs md:text-base text-white/60">
                  팬들은 단순히 "팔로우"하는 것이 아니라, Fanz 자산(디지털 응원봉)을 통해 페이지에 <span className="text-primary font-semibold">"투자"</span>합니다.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 md:gap-6 items-start">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-base md:text-xl">3</span>
              </div>
              <div>
                <h3 className="text-base md:text-xl font-bold mb-1 md:mb-2">커뮤니티 주도 가치 창출</h3>
                <p className="text-xs md:text-base text-white/60">
                  고품질 콘텐츠는 영구히 아카이브되고, <span className="text-white font-semibold">플랫폼이 아닌 커뮤니티가</span> 무엇이 가치 있는지 결정합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 5: 경제 모델
    {
      content: (
        <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">05 — 경제 모델</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-2 md:mb-4 leading-tight">
            후원과 투자의 만남
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">이해관계 일치를 통한 지속가능성</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 max-w-5xl">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="text-xl md:text-3xl font-black text-blue-400 mb-2 md:mb-4">본딩 커브</div>
              <p className="text-xs md:text-base text-white/60">
                초기 지지자와 큐레이터 간 이해관계를 일치시킵니다. 커뮤니티가 성장하면 <span className="text-white font-semibold">모두의 자산 가치가 함께 상승</span>합니다.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="text-xl md:text-3xl font-black text-green-400 mb-2 md:mb-4">6% 로열티</div>
              <p className="text-xs md:text-base text-white/60">
                크리에이터를 위한 "연금": 페이지 캡틴은 거래량에 대해 <span className="text-green-400 font-semibold">영구적인 로열티</span>를 받습니다.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="text-xl md:text-3xl font-black text-purple-400 mb-2 md:mb-4">10% 펀드</div>
              <p className="text-xs md:text-base text-white/60">
                거래마다 적립되는 생태계 펀드. 토큰 보유자가 <span className="text-purple-400 font-semibold">자금 사용처를 투표로 결정</span>합니다.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 6: 토크노믹스
    {
      content: (
        <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">06 — 토크노믹스</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-2 md:mb-4 leading-tight">
            듀얼 토큰 구조
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">거버넌스와 활동의 분리</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 max-w-5xl">
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold">Fanz 자산</h3>
                  <span className="text-xs md:text-sm text-white/50">ERC-1155 — 지분</span>
                </div>
              </div>
              <p className="text-sm md:text-base text-white/60 mb-4"><span className="text-white font-semibold">소유권과 거버넌스</span>를 대표합니다.</p>
              <div className="border-t border-white/10 pt-4 mt-4">
                <ul className="space-y-2 text-xs md:text-sm text-white/70">
                  <li>• 주요 의사결정에 가중 투표권 행사 (캡틴 선출, 펀드 사용)</li>
                  <li>• 캡틴이 큐레이션한 고품질 콘텐츠 등급별 접근</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Coins className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold">$KTNZ</h3>
                  <span className="text-xs md:text-sm text-white/50">Base 체인 — 연료</span>
                </div>
              </div>
              <p className="text-sm md:text-base text-white/60 mb-4">일상적인 활동(투표, 큐레이션)에 대한 보상</p>
              <div className="border-t border-white/10 pt-4 mt-4">
                <ul className="space-y-2 text-xs md:text-sm text-white/70">
                  <li>• 자산 구매 시 <span className="text-white">할인</span>을 제공해 진입장벽 낮춤</li>
                  <li>• <span className="text-primary">디플레이션 메커니즘:</span> 사용 시 소각</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 7: 법적 전략
    {
      content: (
        <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">07 — 법적 전략</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            <span className="text-primary">회색지대</span>를<br />
            양성화하다
          </h2>
          
          <div className="space-y-4 md:space-y-6 max-w-4xl mt-4 md:mt-8">
            <div className="bg-gradient-to-r from-yellow-500/20 to-transparent border-l-4 border-yellow-500 rounded-r-xl p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-bold text-yellow-400 mb-2 md:mb-3">도전 과제</h3>
              <p className="text-sm md:text-base text-white/60">
                홈마들은 현재 직접 굿즈를 판매하며 법적 위험에 노출되어 있습니다.
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-green-500/20 to-transparent border-l-4 border-green-500 rounded-r-xl p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-bold text-green-400 mb-2 md:mb-3">패러다임 전환</h3>
              <p className="text-sm md:text-base text-white/60">
                K-Trendz는 거래의 프레임을 바꿉니다. 팬은 Fanz 자산으로 페이지를 <span className="text-white font-semibold">"후원"</span>하고, 콘텐츠 접근은 멤버십의 <span className="text-green-400 font-semibold">비금전적 혜택</span>으로 제공됩니다.
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-blue-500/20 to-transparent border-l-4 border-blue-500 rounded-r-xl p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-bold text-blue-400 mb-2 md:mb-3">보호 장치</h3>
              <p className="text-sm md:text-base text-white/60">
                <span className="text-white font-semibold">비가시적 디지털 워터마킹</span>으로 콘텐츠 보안을 확보하여, 캡틴의 IP와 아티스트의 초상권을 플랫폼 외부의 무단 상업적 사용으로부터 보호합니다.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 8: 성장 전략
    {
      content: (
        <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">08 — 성장 전략</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            바텀업<br />
            <span className="text-primary">네트워크 효과</span>
          </h2>
          
          <div className="max-w-4xl mt-4 md:mt-8">
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8 mb-4 md:mb-8">
              <h3 className="text-lg md:text-xl font-bold text-primary mb-2 md:mb-4">시장 진입 전략</h3>
              <p className="text-base md:text-xl text-white/80 mb-2 md:mb-4">
                우리는 사용자를 돈으로 사지 않습니다. <span className="text-white font-bold">커뮤니티 리더에게 권한을 부여</span>합니다.
              </p>
              <p className="text-sm md:text-base text-white/60">
                <span className="text-primary font-semibold">"캡틴" 인센티브:</span> 캡틴에게 무제한 초대 코드와 소유권을 부여함으로써, 그들은 기존 Web2 팔로워(<span className="text-white font-semibold">5만~50만명</span>)를 K-Trendz로 데려옵니다.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 text-center">
                <Heart className="w-8 h-8 md:w-10 md:h-10 text-pink-400 mx-auto mb-2 md:mb-4" />
                <div className="text-xl md:text-2xl font-bold text-white mb-1 md:mb-2">소셜 캐피탈</div>
                <p className="text-white/50 text-xs md:text-sm">랭킹 & 커뮤니티 지위</p>
              </div>
              
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 text-center">
                <Star className="w-8 h-8 md:w-10 md:h-10 text-yellow-400 mx-auto mb-2 md:mb-4" />
                <div className="text-xl md:text-2xl font-bold text-white mb-1 md:mb-2">감정적 연결</div>
                <p className="text-white/50 text-xs md:text-sm">콘텐츠 & 팬덤 경험</p>
              </div>
            </div>
            
            <p className="text-center text-sm md:text-base text-white/60 mt-4 md:mt-8">
              투기적 크립토 앱과 달리, 우리 사용자들은 이러한 이유로 <span className="text-white font-semibold">머무릅니다</span>.
            </p>
          </div>
        </div>
      ),
    },
    // Slide 9: 팀
    {
      content: (
        <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">09 — 팀</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-6 md:mb-12 leading-tight">
            <span className="text-primary">이해관계가 일치된</span><br />
            빌더들
          </h2>
          
          <div className="max-w-4xl">
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8 mb-4 md:mb-8">
              <p className="text-base md:text-xl text-white/80 leading-relaxed">
                <span className="text-primary font-semibold">팬 심리</span>("한"과 "정")의 뉘앙스와 
                <span className="text-blue-400 font-semibold"> Base</span>의 기술적 확장성을 
                모두 이해하는 팀입니다.
              </p>
            </div>
            
            <div className="text-center mt-8 md:mt-12">
              <p className="text-lg md:text-2xl text-white/60">우리는</p>
              <p className="text-2xl md:text-4xl text-white font-black mt-2 md:mt-4">
                차세대 엔터테인먼트를 위한<br />
                인프라를 구축하고 있습니다.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 10: 투자 요청
    {
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-4 md:px-8">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">10 — 투자 요청</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-6 md:mb-12 leading-tight">
            <span className="text-primary">팬덤의 미래</span>에<br />
            투자하세요.
          </h2>
          
          <div className="max-w-3xl">
            <p className="text-base md:text-xl text-white/70 leading-relaxed mb-6 md:mb-12">
              K-Pop은 시작에 불과합니다. 우리는 높은 참여도를 가진 커뮤니티를 위한 <span className="text-white font-semibold">표준 프로토콜</span>을 구축하고 있습니다.
            </p>
            
            <div className="border-t border-b border-white/20 py-6 md:py-8 my-6 md:my-8">
              <p className="text-xl md:text-3xl text-white font-light italic">
                "문화를 만들어가는 사람들에게<br />
                소유권을 돌려주는 여정에<br />
                함께해 주세요."
              </p>
            </div>
            
            <div className="mt-8 md:mt-12 flex flex-col md:flex-row items-center justify-center gap-4 mb-8 md:mb-12">
              <a 
                href="https://k-trendz.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-full font-bold text-base md:text-lg transition-all min-w-[200px]"
              >
                K-TRENDZ 방문하기
                <ArrowRight className="w-5 h-5" />
              </a>
              <a 
                href="mailto:manager@k-trendz.com"
                className="inline-flex items-center justify-center gap-2 border border-white/60 hover:border-white hover:bg-white/10 text-white px-8 py-4 rounded-full font-bold text-base md:text-lg transition-all min-w-[200px]"
              >
                문의하기
              </a>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <Helmet>
        <title>K-Trendz 피치덱 - Variant Fund</title>
        <meta name="description" content="K-Trendz: K-Pop 팬덤을 위한 소유권 경제. 사용자 소유형 엔터테인먼트 네트워크 구축." />
      </Helmet>

      <div className="min-h-screen bg-black text-white font-sans overflow-hidden">
        {/* Navigation dots */}
        <div className="fixed right-3 md:right-8 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5 md:gap-3">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-1.5 md:w-2 h-1.5 md:h-2 rounded-full transition-all duration-300 ${
                currentSlide === index 
                  ? "bg-primary scale-150" 
                  : "bg-white/30 hover:bg-white/50"
              }`}
              aria-label={`${index + 1}번 슬라이드로 이동`}
            />
          ))}
        </div>

        {/* Navigation arrows */}
        <button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className={`fixed top-4 md:top-8 left-1/2 -translate-x-1/2 z-50 p-1.5 md:p-2 rounded-full border border-white/20 transition-all ${
            currentSlide === 0 
              ? "opacity-20 cursor-not-allowed" 
              : "opacity-60 hover:opacity-100 hover:bg-white/10"
          }`}
          aria-label="이전 슬라이드"
        >
          <ChevronUp className="w-5 h-5 md:w-6 md:h-6" />
        </button>

        {currentSlide < totalSlides - 1 && (
          <button
            onClick={nextSlide}
            className="fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-50 p-1.5 md:p-2 rounded-full border border-white/20 transition-all opacity-60 hover:opacity-100 hover:bg-white/10"
            aria-label="다음 슬라이드"
          >
            <ChevronDown className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        )}

        {/* Slide counter */}
        <div className="fixed bottom-4 md:bottom-8 left-3 md:left-8 z-50 text-white/40 font-mono text-xs md:text-sm">
          <span className="text-white">{String(currentSlide + 1).padStart(2, '0')}</span>
          <span className="mx-1 md:mx-2">/</span>
          <span>{String(totalSlides).padStart(2, '0')}</span>
        </div>


        {/* Main content */}
        <div 
          className="transition-transform duration-700 ease-out"
          style={{ transform: `translateY(-${currentSlide * 100}vh)` }}
        >
          {slides.map((slide, index) => (
            <div 
              key={index}
              className="h-screen w-full flex items-center justify-center"
            >
              {slide.content}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default PitchDeckVariantKr;
