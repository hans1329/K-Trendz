import { Helmet } from "react-helmet-async";
import { ChevronDown, ChevronUp, Target, Lightbulb, Cog, PieChart, DollarSign, Coins, Rocket, TrendingUp, Shield, Crown, Zap, Sparkles, Trophy, Linkedin } from "lucide-react";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import ceoImage from "@/assets/team/ceo-han-kim.jpg";
import cfoImage from "@/assets/team/cfo-chris-lee.jpg";
import cooImage from "@/assets/team/coo-william-yang.jpg";
const PitchDeckMain = () => {
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
            <span className="text-xs md:text-sm tracking-[0.3em] md:tracking-[0.5em] text-white/40 uppercase">Transparent Artist Support Platform</span>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-9xl font-black tracking-tight mb-4 md:mb-8 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            K-TRENDZ
          </h1>
          <p className="text-lg sm:text-xl md:text-3xl font-light text-white/90 mb-4 md:mb-6 max-w-4xl leading-relaxed px-2">
            Support your favorite artists with<br />
            <span className="font-bold text-primary">100% on-chain transparency</span>.
          </p>
          <div className="mt-4 md:mt-8 px-6 md:px-10 py-3 md:py-4 bg-gradient-to-r from-primary/90 to-orange-500/90 rounded-full">
            <p className="text-sm md:text-xl font-bold text-white">
              Every Transaction On-Chain • Fully Verifiable
            </p>
          </div>
          <p className="text-sm md:text-lg text-white/50 mt-6 md:mt-10 max-w-2xl px-2">
            Tracked and verified on Base Network
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
            Fans want to support artists,<br />
            but <span className="text-white/40">can't trust</span> the platforms.
          </h2>
          
          <div className="space-y-4 md:space-y-8 max-w-4xl">
            <div className="border-l-2 border-white/20 pl-4 md:pl-8">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <span className="text-xl md:text-2xl">🔒</span>
                <h3 className="text-base md:text-xl font-bold text-white/80">Hidden Fee Structures</h3>
              </div>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                Traditional platforms hide their fee structures — fans never know <span className="text-white font-semibold">how much actually reaches artists</span>.
              </p>
            </div>
            
            <div className="border-l-2 border-primary pl-4 md:pl-8">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <span className="text-xl md:text-2xl">❓</span>
                <h3 className="text-base md:text-xl font-bold text-white/80">Unverifiable Fund Usage</h3>
              </div>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                No way to verify if fan donations are actually used for <span className="text-primary font-semibold">real artist support activities</span>.
              </p>
            </div>
            
            <div className="border-l-2 border-white/20 pl-4 md:pl-8">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <span className="text-xl md:text-2xl">💔</span>
                <h3 className="text-base md:text-xl font-bold text-white/80">Trust Deficit</h3>
              </div>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                Numerous scandals involving <span className="text-white font-semibold">misused crowdfunding</span> have eroded fan trust completely.
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 mt-4 md:mt-8">
              <p className="text-base md:text-xl text-white/80 font-medium">
                The result: Fans hesitate to support because they <span className="text-white">can't verify</span> where their money goes.
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
            Every dollar tracked.<br />
            <span className="text-primary">On-chain transparency</span>.
          </h2>
          
          <p className="text-sm md:text-xl text-white/60 mb-6 md:mb-12 max-w-3xl">
            Smart contracts automatically distribute funds — <span className="text-white font-semibold">no human intervention, no manipulation possible</span>
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 max-w-5xl">
            <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-primary to-orange-400 rounded-xl flex items-center justify-center shadow-lg mb-3 md:mb-4">
                <span className="text-xl md:text-2xl">⛓️</span>
              </div>
              <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">On-Chain Records</h3>
              <p className="text-xs md:text-base text-white/60">
                Every transaction permanently recorded on <span className="text-primary font-semibold">Base Network</span> — fully auditable by anyone.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-pink-500/20 to-pink-500/5 border border-pink-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-pink-500 to-rose-400 rounded-xl flex items-center justify-center shadow-lg mb-3 md:mb-4">
                <span className="text-xl md:text-2xl">💰</span>
              </div>
              <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">20% Artist Fund</h3>
              <p className="text-xs md:text-base text-white/60">
                <span className="text-pink-400 font-semibold">20% of every purchase</span> goes directly to Artist Fund for real-world support activities.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-green-500 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg mb-3 md:mb-4">
                <span className="text-xl md:text-2xl">🔍</span>
              </div>
              <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">Verifiable Funds</h3>
              <p className="text-xs md:text-base text-white/60">
                Artist Fund wallet <span className="text-green-400 font-semibold">publicly visible</span> — verify exactly how much has been collected anytime.
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 4: The Mechanism
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">04 — How It Works</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-2 md:mb-4 leading-tight">
            Smart Contract<br />
            <span className="text-primary">Auto-Distribution</span>
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">No middleman, no manipulation — code executes automatically</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 max-w-5xl">
            <div>
              <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-6">
                <Cog className="w-5 h-5 md:w-8 md:h-8 text-primary" />
                <h3 className="text-base md:text-xl font-bold">Transparent Fund Flow</h3>
              </div>
              <ul className="space-y-3 md:space-y-4 text-white/70">
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">01</span>
                  <span>Fan purchases Lightstick token via <span className="text-white font-semibold">credit card or crypto</span></span>
                </li>
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">02</span>
                  <span>Smart contract <span className="text-pink-400 font-semibold">automatically splits</span> the payment: 20% Artist Fund, 10% Platform, 70% Reserve</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">03</span>
                  <span>Every transaction <span className="text-green-400 font-semibold">recorded on BaseScan</span> — publicly verifiable</span>
                </li>
              </ul>
            </div>
            
            <div>
              <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-6">
                <Shield className="w-5 h-5 md:w-8 md:h-8 text-green-400" />
                <h3 className="text-base md:text-xl font-bold">Trust Guarantees</h3>
              </div>
              <ul className="space-y-3 md:space-y-4 text-white/70">
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-green-400 font-mono">✓</span>
                  <span><span className="text-white font-semibold">Immutable code</span> — fee distribution cannot be changed</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-green-400 font-mono">✓</span>
                  <span><span className="text-white font-semibold">Real-time tracking</span> — check Artist Fund balance anytime</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-green-400 font-mono">✓</span>
                  <span><span className="text-white font-semibold">Public wallet</span> — Artist Fund address visible to all</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 md:mt-12 bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary p-4 md:p-6 max-w-4xl">
            <p className="text-xs md:text-base text-white/70">
              <span className="font-bold text-primary">Zero Trust Required</span> — Don't trust us, verify on-chain yourself at any time
            </p>
          </div>
        </div>
  },
  // Slide 5: Artist Support Activities
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">05 — Artist Support</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            Real-World Support<br />
            <span className="text-primary">Powered by Fans</span>
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">20% Artist Fund enables meaningful support activities</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-5xl mb-6 md:mb-8">
            <div className="bg-gradient-to-br from-pink-500/20 to-pink-500/5 border border-pink-500/30 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="text-3xl md:text-4xl mb-3 md:mb-4">🏙️</div>
              <h3 className="text-lg md:text-xl font-bold text-pink-400 mb-2">Times Square Ads</h3>
              <p className="text-xs md:text-sm text-white/60">
                Birthday & debut anniversary ads on the world's biggest screens. Fan-funded, transparently tracked.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/30 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="text-3xl md:text-4xl mb-3 md:mb-4">☕</div>
              <h3 className="text-lg md:text-xl font-bold text-amber-400 mb-2">Coffee Truck Support</h3>
              <p className="text-xs md:text-sm text-white/60">
                Send coffee trucks to filming locations, concert venues, and fan meetings. Direct artist appreciation.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/30 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="text-3xl md:text-4xl mb-3 md:mb-4">🎁</div>
              <h3 className="text-lg md:text-xl font-bold text-violet-400 mb-2">Limited Edition Merch</h3>
              <p className="text-xs md:text-sm text-white/60">
                Exclusive fan-designed merchandise. Revenue flows back to Artist Fund for more support activities.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-5xl">
            <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="text-3xl md:text-4xl mb-3 md:mb-4">🎂</div>
              <h3 className="text-lg md:text-xl font-bold text-green-400 mb-2">Birthday & Anniversary Events</h3>
              <p className="text-xs md:text-sm text-white/60">
                Subway station ads, LED truck campaigns, charity donations in artist's name.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="text-3xl md:text-4xl mb-3 md:mb-4">🌍</div>
              <h3 className="text-lg md:text-xl font-bold text-blue-400 mb-2">Global Fan Projects</h3>
              <p className="text-xs md:text-sm text-white/60">
                Coordinated worldwide support: streaming parties, voting campaigns, forest donations.
              </p>
            </div>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 mt-6 md:mt-8 max-w-5xl">
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <span className="text-lg md:text-xl">🗳️</span>
              <h4 className="font-bold text-sm md:text-base">Fan Governance</h4>
            </div>
            <p className="text-xs md:text-base text-white/60">
              Support activities are <span className="text-primary font-bold">decided by Lightstick holders</span> through on-chain governance voting. Your token = Your voice.
            </p>
          </div>
        </div>
  },
  // Slide 6: Bonding Curve Economics
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">06 — Bonding Curve Economics</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            Price Grows with Community<br />
            <span className="text-primary">Earn as Artist Value Rises</span>
          </h2>
          
          <div className="max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-6 md:mb-8">
              {/* Bonding Curve Explanation */}
              <div className="bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/30 rounded-xl md:rounded-2xl p-4 md:p-6">
                <h3 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4 flex items-center gap-2">
                  <span className="text-2xl">📈</span> Price Goes Up with Demand
                </h3>
                <p className="text-sm md:text-base text-white/70 mb-4">
                  Bonding curve ensures <span className="text-white font-semibold">price increases</span> as more fans join. Early supporters benefit from artist's growing popularity.
                </p>
                <div className="bg-white/10 rounded-xl p-3 md:p-4">
                  <p className="text-xs md:text-sm text-white/50 mb-2">Example Price Growth:</p>
                  <div className="flex items-center gap-2 text-sm md:text-base">
                    <span className="text-white/60">1st Token:</span>
                    <span className="text-white font-bold">$1.15</span>
                    <span className="text-white/40">→</span>
                    <span className="text-white/60">100th:</span>
                    <span className="text-green-400 font-bold">$21.82</span>
                  </div>
                </div>
              </div>
              
              {/* Anti-Speculation */}
              <div className="bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/30 rounded-xl md:rounded-2xl p-4 md:p-6">
                <h3 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4 flex items-center gap-2">
                  <span className="text-2xl">🛡️</span> Anti-Speculation Design
                </h3>
                <p className="text-sm md:text-base text-white/70 mb-4">
                  <span className="text-white font-semibold">30% total fees</span> on every transaction discourages short-term flipping and protects genuine fan communities.
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Artist Fund:</span>
                    <span className="text-pink-400 font-bold">20%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Platform Fee:</span>
                    <span className="text-primary font-bold">10%</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex justify-between text-sm">
                    <span className="text-white/60">Quick Flip Loss:</span>
                    <span className="text-red-400 font-bold">~30%</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Value Proposition */}
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/10 border border-green-500/30 rounded-xl md:rounded-2xl p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">💎</span> Long-Term Fan Benefits
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-black text-green-400 mb-1">📈</p>
                  <p className="text-sm md:text-base text-white font-semibold">Price Appreciation</p>
                  <p className="text-xs md:text-sm text-white/50">Value grows with artist popularity</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-black text-green-400 mb-1">🎫</p>
                  <p className="text-sm md:text-base text-white font-semibold">Exclusive Access</p>
                  <p className="text-xs md:text-sm text-white/50">Priority for events & content</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-black text-green-400 mb-1">💰</p>
                  <p className="text-sm md:text-base text-white font-semibold">Exit Anytime</p>
                  <p className="text-xs md:text-sm text-white/50">70% liquidity reserve guarantees</p>
                </div>
              </div>
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
            <span className="text-primary">Utility Token</span>
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">Used for fan voting, governance, and reward mechanisms</p>
          
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
                  Tokens auto-distributed by level upon completing <span className="text-violet-400 font-semibold">13 daily votes</span>
                </p>
                <p className="text-sm text-white/50 mb-2 mt-4">Burning:</p>
                <p className="text-sm text-white/70">
                  Burned when converted to activity points <span className="text-violet-400 font-semibold">'Stars'</span>
                </p>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-base md:text-xl font-bold">Digital Lightstick</h3>
                  <span className="text-xs md:text-sm text-white/50">ERC-1155 Artist Support Token</span>
                </div>
              </div>
              
              <p className="text-white/60 mb-4 text-sm md:text-base">
                Your <span className="text-white font-semibold">Lightstick</span> represents your support for an artist and powers the Artist Fund.
              </p>
              
              <div className="border-t border-white/10 pt-4">
                <p className="text-sm text-white/50 mb-2">Support & Governance:</p>
                <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-white/70">
                  <li>• <span className="text-white">20% to Artist Fund:</span> Every purchase supports your artist</li>
                  <li>• <span className="text-white">Governance Vote:</span> Decide how funds are used (ads, coffee trucks, merch)</li>
                  <li>• <span className="text-white">On-Chain Verified:</span> All support activities transparently tracked</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="mt-6 md:mt-8 bg-gradient-to-r from-green-500/20 to-transparent border-l-4 border-green-500 p-4 md:p-6 max-w-4xl">
            <p className="text-xs md:text-sm text-white/70">
              <span className="font-bold text-green-400">Fandom Activity = Token Rewards</span> | Usage increases → <span className="text-primary font-semibold">Supply decreases</span> → Value rises
            </p>
            <p className="text-[10px] md:text-xs text-white/50 mt-2">
              KTNZ is a utility token for platform participation, not an investment product.
            </p>
          </div>
        </div>
  },
  // Slide 8: One More Thing
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-amber-400 uppercase mb-2 md:mb-4">08 — And...</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            One More Thing!
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">Another Powerful Engine</p>
          
          <div className="bg-gradient-to-r from-amber-500/20 to-transparent border-l-4 border-amber-500 p-4 md:p-6 max-w-4xl">
            <p className="text-sm md:text-lg text-white/80">
              Beyond token economy, K-TRENDZ introduces a <span className="text-amber-400 font-bold">gamified prediction market</span> that transforms fan knowledge into valuable insights.
            </p>
          </div>
        </div>
  },
  // Slide 9: Fan Challenges
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-amber-400 uppercase mb-2 md:mb-4">09 — Fan Challenges</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            Prediction Market<br />
            for <span className="text-amber-400">K-Culture</span>
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">Turn fan knowledge into predictive insights and earn rewards</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-5xl">
            <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Trophy className="w-5 h-5 md:w-6 md:h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base md:text-xl font-bold">Fan Challenges</h3>
                  <span className="text-xs md:text-sm text-white/50">Gamified Prediction</span>
                </div>
              </div>
              
              <ul className="space-y-2 md:space-y-4 text-xs md:text-sm text-white/70">
                <li className="flex items-start gap-2 md:gap-3">
                  <span className="text-amber-400 font-mono">01</span>
                  <span>Predict comeback dates, chart rankings, award show winners</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3">
                  <span className="text-amber-400 font-mono">02</span>
                  <span>Guess song lyrics, album concepts, MV storylines</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3">
                  <span className="text-amber-400 font-mono">03</span>
                  <span>Winners selected via <span className="text-amber-400 font-semibold">on-chain randomness</span></span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Crown className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-base md:text-xl font-bold">Fan Governance</h3>
                  <span className="text-xs md:text-sm text-white/50">Lightstick Holder Benefits</span>
                </div>
              </div>
              
              <ul className="space-y-2 md:space-y-4 text-xs md:text-sm text-white/70">
                <li className="flex items-start gap-2 md:gap-3">
                  <span className="text-primary font-mono">✓</span>
                  <span><span className="text-white font-semibold">Tiered prizes</span> based on lightstick ownership</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3">
                  <span className="text-primary font-mono">✓</span>
                  <span><span className="text-white font-semibold">Additional earning</span> opportunities through predictions</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3">
                  <span className="text-primary font-mono">✓</span>
                  <span>Transparent on-chain winner selection</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 md:mt-8 bg-gradient-to-r from-amber-500/20 to-transparent border-l-4 border-amber-500 p-4 md:p-6 max-w-4xl">
            <p className="text-xs md:text-sm text-white/70">
              <span className="font-bold text-amber-400">Gamified Engagement</span> | Fans compete, predict, and earn <span className="text-amber-400 font-semibold">USDC prizes</span>
            </p>
          </div>
        </div>
  },
  // Slide 10: Legal & Tech
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">10 — Legal & Tech</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-6 md:mb-12 leading-tight">
            Secure, Scalable, and<br />
            <span className="text-primary">Ready for Mass Adoption</span>.
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-5xl">
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <h3 className="text-base md:text-lg font-bold">Copyright Defense</h3>
              </div>
              <p className="text-primary font-semibold mb-2 text-sm md:text-base">"Donation" Model</p>
              <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-white/70">
                <li>• No direct image sales.</li>
                <li>• Fans "support" with lightsticks; content access is a "perk."</li>
                <li>• Eliminates direct infringement risk.</li>
              </ul>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Cog className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <h3 className="text-base md:text-lg font-bold">Content Protection</h3>
              </div>
              <p className="text-sm md:text-base text-white/70 leading-relaxed">
                <span className="text-white font-semibold">Invisible digital watermarks</span> applied to all uploaded images.
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Rocket className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <h3 className="text-base md:text-lg font-bold">Onboarding</h3>
              </div>
              <p className="text-sm md:text-base text-white/70 leading-relaxed">
                <span className="text-white font-semibold">Social login</span> + <span className="text-white font-semibold">fiat on-ramp</span> (Stripe) on Base chain.
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 11: Team
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">11 — Team</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            Where K-Pop Insiders<br />
            Meet <span className="text-primary">Web3 Builders</span>.
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
                Platform Industry Veteran<br />
                Smart Contract Specialist &<br />
                Full-Stack Developer
              </p>
              <a href="https://www.linkedin.com/in/han-seok-kim-0057121aa/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 mt-3 text-xs md:text-sm text-blue-400 hover:text-blue-300 transition-colors">
                <Linkedin className="w-4 h-4" />
                <span>LinkedIn</span>
              </a>
            </div>
            
            {/* Chris Lee */}
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden mb-3 md:mb-4 mx-auto border-2 border-primary/30">
                <img src={cfoImage} alt="Chris Lee" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-center mb-1">Chris Lee</h3>
              <p className="text-primary font-semibold text-center text-sm md:text-base mb-2 md:mb-3">CFO</p>
              <p className="text-xs md:text-sm text-white/70 text-center leading-relaxed">
                Strategy Lead<br />
                Platform Architecture &<br />
                Financial Design Expert
              </p>
              <a href="https://www.linkedin.com/in/chris-lee-73a4a74/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 mt-3 text-xs md:text-sm text-blue-400 hover:text-blue-300 transition-colors">
                <Linkedin className="w-4 h-4" />
                <span>LinkedIn</span>
              </a>
            </div>
            
            {/* William Yang */}
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden mb-3 md:mb-4 mx-auto border-2 border-primary/30">
                <img src={cooImage} alt="William Yang" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-center mb-1">William Yang</h3>
              <p className="text-primary font-semibold text-center text-sm md:text-base mb-2 md:mb-3">COO</p>
              <p className="text-xs md:text-sm text-white/70 text-center leading-relaxed">
                Community<br />
                Fandom Network Specialist<br />
                K-Culture Expert
              </p>
              <a href="https://www.linkedin.com/in/william-yang-vim/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 mt-3 text-xs md:text-sm text-blue-400 hover:text-blue-300 transition-colors">
                <Linkedin className="w-4 h-4" />
                <span>LinkedIn</span>
              </a>
            </div>
          </div>
        </div>
  },
  // Slide 12: Vision
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">12 — Vision</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            The <span className="text-primary">NASDAQ</span><br />
            of the Fandom Economy
          </h2>
          
          <p className="text-sm md:text-xl text-white/60 mb-6 md:mb-12 max-w-3xl leading-relaxed">
            The platform <span className="text-primary font-bold">100 million</span> K-POP fans worldwide check first thing every morning
          </p>
          
          <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8 max-w-4xl mb-6 md:mb-8">
            <p className="text-sm md:text-lg text-white/80 leading-relaxed mb-4">
              K-TRENDZ extends K-POP fandom participation into a market-based participation layer,<br />
              creating a <span className="text-primary font-semibold">sustainable fandom ecosystem</span> where fans, creators, and the platform grow together.
            </p>
            <p className="text-sm md:text-base text-primary font-semibold">
              Fans are no longer passive supporters—they become active participants who help shape fandom momentum.
            </p>
          </div>
          
          <div className="bg-gradient-to-r from-white/10 to-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8 max-w-4xl mb-6 md:mb-8">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <span className="text-xl md:text-2xl">💼</span>
              <h4 className="text-base md:text-xl font-bold text-white">One-Liner for Investors</h4>
            </div>
            <p className="text-sm md:text-lg text-white/80 italic leading-relaxed">
              "K-TRENDZ turns fandom participation into measurable, on-chain signals that power a new fandom economy,<br />
              giving fans a meaningful way to engage beyond watching from the sidelines."
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

  // 모바일: 페이지 네비게이션 없이 세로 스크롤
  if (isMobile) {
    return <div className="min-h-screen bg-black text-white overflow-y-auto">
        <Helmet>
          <title>K-TRENDZ Pitch Deck - Transparent Artist Support Platform</title>
          <meta name="description" content="K-TRENDZ pitch deck - On-chain transparent artist support platform with 100% verifiable fund distribution" />
        </Helmet>

        <div className="flex flex-col">
          {slides.map((slide, index) => <div key={index} className="min-h-screen w-full flex justify-center border-b-4 border-white/10 last:border-b-0">
              <div className="w-full max-w-7xl">{slide.content}</div>
            </div>)}
        </div>
      </div>;
  }
  return <div className="fixed inset-0 bg-black text-white overflow-hidden">
      <Helmet>
        <title>K-TRENDZ Pitch Deck - Transparent Artist Support Platform</title>
        <meta name="description" content="K-TRENDZ pitch deck - On-chain transparent artist support platform with 100% verifiable fund distribution" />
      </Helmet>

      {/* Navigation Controls */}
      <div className="fixed right-4 md:right-8 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-2 md:gap-4">
        {/* Slide dots */}
        <div className="flex flex-col gap-1.5 md:gap-2 mb-2 md:mb-4">
          {slides.map((_, index) => <button key={index} onClick={() => goToSlide(index)} className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-all ${index === currentSlide ? "bg-primary scale-125" : "bg-white/20 hover:bg-white/40"}`} />)}
        </div>

        {/* Navigation arrows */}
        <button onClick={prevSlide} disabled={currentSlide === 0} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
          <ChevronUp className="w-4 h-4 md:w-5 md:h-5" />
        </button>
        <span className="text-xs md:text-sm text-white/50 font-mono">
          {currentSlide + 1}/{totalSlides}
        </span>
        <button onClick={nextSlide} disabled={currentSlide === totalSlides - 1} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
          <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>

      {/* Slides Container */}
      <div className="transition-transform duration-700 ease-out" style={{
      transform: `translateY(-${currentSlide * 100}vh)`
    }}>
        {slides.map((slide, index) => <div key={index} className="h-screen w-full flex justify-center">
            <div className="w-full max-w-7xl">{slide.content}</div>
          </div>)}
      </div>
    </div>;
};
export default PitchDeckMain;