import { Helmet } from "react-helmet-async";
import { ChevronDown, ChevronUp, Users, TrendingUp, Shield, Rocket, Target, Coins, Lock, Unlock, Zap, Heart, Crown, Star } from "lucide-react";
import { useState, useEffect } from "react";
const PitchDeckAlliance = () => {
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
  // Slide 1: The Hook (표지)
  {
    content: <div className="flex flex-col items-center justify-center h-full text-center px-4 md:px-8">
          <div className="mb-4 md:mb-8">
            <span className="text-xs md:text-sm tracking-[0.3em] md:tracking-[0.5em] text-white/40 uppercase">The Pitch Deck for Alliance DAO</span>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-9xl font-black tracking-tight mb-4 md:mb-8 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            K-TRENDZ
          </h1>
          <p className="text-lg sm:text-xl md:text-3xl font-light text-white/90 mb-4 md:mb-6 max-w-4xl leading-relaxed px-2">
            The <span className="font-bold text-primary">"Fan-Fi"</span> Platform on Base.<br />
            We turn Fandom Passion into Investable Assets.
          </p>
          <p className="text-sm md:text-lg text-white/50 mt-4 md:mt-8 max-w-2xl px-2">
            Powered by Page Masters (Super-fan Creators) & Real-world K-Pop Fandoms.
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
            Fandoms Create <span className="text-primary">Billions</span>,<br />
            But Earn <span className="text-white/40">Zero</span>.
          </h2>
          
          <div className="space-y-4 md:space-y-10 max-w-4xl">
            <div className="border-l-2 border-white/20 pl-4 md:pl-8">
              <h3 className="text-base md:text-xl font-bold text-white/80 mb-2 md:mb-3">The Gap</h3>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                Global K-Pop fans are the most organized digital army (Streaming, Voting),
                but they remain <span className="text-white font-semibold">passive consumers</span>.
              </p>
            </div>
            
            <div className="border-l-2 border-primary pl-4 md:pl-8">
              <h3 className="text-base md:text-xl font-bold text-white/80 mb-2 md:mb-3">The Pain Point (Supply Side)</h3>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                "Page Masters" (Super-fans who follow artists and create content) drive the culture
                but suffer from <span className="text-primary font-semibold">high costs and legal risks</span> when selling physical merch.
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 mt-4 md:mt-8">
              <p className="text-base md:text-xl text-white/80 font-medium">
                Result: <span className="text-white">No sustainable economy</span> for the true creators of fandom culture.
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
            A Gamified Archive Economy<br />
            <span className="text-primary">Owned by Fans</span>.
          </h2>
          
          <p className="text-sm md:text-xl text-white/60 mb-6 md:mb-12 max-w-3xl">
            K-Trendz is a "FanFi" platform where fans archive data, rank artists, and trade influence.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 max-w-5xl">
            <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8">
              <Heart className="w-6 h-6 md:w-10 md:h-10 text-pink-400 mb-2 md:mb-4" />
              <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">For Fans</h3>
              <p className="text-xs md:text-base text-white/60">
                Earn rewards (<span className="text-primary font-mono">$KTNZ</span>) for activity and invest in "Fanz Assets".
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <Crown className="w-6 h-6 md:w-10 md:h-10 text-primary mb-2 md:mb-4" />
              <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">For Masters</h3>
              <p className="text-xs md:text-base text-white/60">
                Earn perpetual royalties (<span className="text-primary font-bold">6%</span>) via a legitimate digital platform.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8">
              <Star className="w-6 h-6 md:w-10 md:h-10 text-yellow-400 mb-2 md:mb-4" />
              <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">For Artists</h3>
              <p className="text-xs md:text-base text-white/60">
                Receive real-world support funds (<span className="font-bold">10%</span> of volume) raised by fans.
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 4: The Mechanism I - The Unlock War
  {
    content: <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">04 — The Mechanism I</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-2 md:mb-4 leading-tight">
            "The Unlock War"
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">Community First, Asset Later.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 max-w-5xl">
            <div>
              <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-6">
                <Lock className="w-5 h-5 md:w-8 md:h-8 text-white/40" />
                <h3 className="text-base md:text-xl font-bold">The "Lock" System</h3>
              </div>
              <ul className="space-y-3 md:space-y-4 text-white/70">
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">01</span>
                  <span>Artists are categorized into <span className="text-white font-semibold">3 Tiers</span> (Legends / Challengers / Rookies)</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">02</span>
                  <span>All entries start <span className="text-white font-semibold">"LOCKED"</span>. No trading allowed.</span>
                </li>
              </ul>
            </div>
            
            <div>
              <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-6">
                <Unlock className="w-5 h-5 md:w-8 md:h-8 text-primary" />
                <h3 className="text-base md:text-xl font-bold">The Game</h3>
              </div>
              <ul className="space-y-3 md:space-y-4 text-white/70">
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">01</span>
                  <span>Fans must <span className="text-primary font-semibold">Vote</span> to unlock their artist's market.</span>
                </li>
                <li className="flex items-start gap-2 md:gap-3 text-sm md:text-base">
                  <span className="text-primary font-mono">02</span>
                  <span>This voting process selects the <span className="text-white font-semibold">"Page Master"</span>.</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 md:mt-12 bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary p-4 md:p-6 max-w-4xl">
            <h4 className="text-sm md:text-lg font-bold text-primary mb-1 md:mb-2">Why it works:</h4>
            <p className="text-xs md:text-base text-white/70">
              It creates <span className="text-white font-semibold">massive pre-launch hype and traffic</span> before any token is issued. 
              It ensures liquidity is ready when the market opens.
            </p>
          </div>
        </div>
  },
  // Slide 5: The Mechanics II - Dual-Token Economy
  {
    content: <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">05 — The Mechanics II</span>
          <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            Dual-Token Economy
          </h2>
          <p className="text-2xl text-white/60 mb-12">Sustainable Loop: Assets & Rewards.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl">
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Fanz Asset</h3>
                  <span className="text-sm text-white/50">ERC-1155 Digital Light Stick</span>
                </div>
              </div>
              <p className="text-white/60 mb-4">Role: The Share/Stock of the page.</p>
              <p className="text-white/60 mb-4">Pricing: <span className="text-white font-semibold">Bonding Curve</span> (Price rises as support grows).</p>
              <div className="border-t border-white/10 pt-4 mt-4">
                <p className="text-sm text-white/50 mb-2">Utility:</p>
                <ul className="space-y-2 text-sm text-white/70">
                  <li>• <span className="text-white">Proof of Fandom:</span> Unlocks HQ content</li>
                  <li>• <span className="text-white">Power:</span> Weighted voting rights</li>
                  <li>• <span className="text-white">Burn:</span> Selling burns the token (Deflationary)</li>
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
                  <span className="text-sm text-white/50">Activity Token on Base</span>
                </div>
              </div>
              <p className="text-white/60 mb-4">Role: Reward for daily engagement (Voting, Login).</p>
              <p className="text-white/60 mb-4">Utility: <span className="text-white font-semibold">Burned</span> to get Discounts on Fanz Asset purchases.</p>
              <div className="border-t border-white/10 pt-4 mt-4">
                <p className="text-sm text-white/50 mb-2">UX:</p>
                <p className="text-sm text-white/70">
                  Distributed via <span className="text-white">embedded wallets</span> (Invisible Web3).
                </p>
              </div>
            </div>
          </div>
        </div>
  },
  // Slide 6: The Business Model
  {
    content: <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">06 — Business Model</span>
          <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            Revenue & Split
          </h2>
          <p className="text-2xl text-white/60 mb-12">Aligned Incentives for All Stakeholders.</p>
          
          <div className="max-w-4xl">
            <h3 className="text-lg font-bold text-white/80 mb-6">Transaction Fee Structure (On Asset Buy/Sell)</h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-24 text-right">
                  <span className="text-3xl font-black text-yellow-400">10%</span>
                </div>
                <div className="flex-1 bg-yellow-400/20 rounded-full h-8 flex items-center px-4">
                  <span className="text-sm font-medium">Ecosystem Fund — For Real-world Events (Ads, Charity). Fans vote on usage.</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-24 text-right">
                  <span className="text-3xl font-black text-primary">6%</span>
                </div>
                <div className="flex-1 bg-primary/20 rounded-full h-8 flex items-center px-4">
                  <span className="text-sm font-medium">Page Master — Direct Revenue. Incentivizes bringing 50k+ followers.</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-24 text-right">
                  <span className="text-3xl font-black text-blue-400">4%</span>
                </div>
                <div className="flex-1 bg-blue-400/20 rounded-full h-8 flex items-center px-4">
                  <span className="text-sm font-medium">Platform — K-Trendz Revenue</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-24 text-right">
                  <span className="text-3xl font-black text-green-400">80%</span>
                </div>
                <div className="flex-1 bg-green-400/20 rounded-full h-8 flex items-center px-4">
                  <span className="text-sm font-medium">Liquidity Reserve / Sellers</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h4 className="font-bold text-white mb-2">Sustainability:</h4>
              <p className="text-white/60">
                Unlike Ponzi schemes, our model is backed by <span className="text-white font-semibold">Content consumption</span> and <span className="text-white font-semibold">Real-world Support</span> needs.
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 7: Legal & Tech Strategy
  {
    content: <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">07 — Legal & Tech</span>
          <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            Safe, Scalable, and<br />
            <span className="text-primary">Mass-Adoption Ready</span>.
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mt-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <Shield className="w-8 h-8 text-green-400 mb-4" />
              <h3 className="text-lg font-bold mb-3">Copyright Defense</h3>
              <p className="text-sm text-white/50 mb-2">The "Donation" Model</p>
              <ul className="space-y-2 text-sm text-white/60">
                <li>• We do NOT sell images directly.</li>
                <li>• Fans "Donate" via Light Sticks; Content access is a "Perk".</li>
                <li>• <span className="text-green-400">Removes direct infringement risks.</span></li>
              </ul>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <Lock className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-bold mb-3">Content Protection</h3>
              <p className="text-sm text-white/60 mt-4">
                <span className="text-white font-semibold">Invisible Digital Watermarking</span> on all uploaded images.
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <Users className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-3">Onboarding</h3>
              <p className="text-sm text-white/60 mt-4">
                <span className="text-white font-semibold">Social Login</span> + <span className="text-white font-semibold">Fiat On-ramp (Stripe)</span> on Base Chain.
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 8: Growth Strategy (GTM)
  {
    content: <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">08 — Growth Strategy</span>
          <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            The "Page Master"<br />
            <span className="text-primary">Trojan Horse</span>.
          </h2>
          
          <div className="max-w-4xl mt-8">
            <div className="bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary p-6 mb-8">
              <h3 className="text-xl font-bold mb-2">Strategy:</h3>
              <p className="text-lg text-white/70">
                We don't acquire users one by one. <span className="text-white font-semibold">We acquire Masters.</span>
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <Target className="w-8 h-8 text-primary mb-4" />
                <h4 className="text-lg font-bold mb-3">The Offer</h4>
                <p className="text-white/60">
                  "Be a <span className="text-white font-semibold">Founder</span> of your bias's page. Get unlimited invite codes."
                </p>
              </div>
              
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <TrendingUp className="w-8 h-8 text-green-400 mb-4" />
                <h4 className="text-lg font-bold mb-3">The Multiplier</h4>
                <p className="text-white/60">
                  <span className="text-3xl font-black text-white">1</span> Master = <span className="text-3xl font-black text-primary">10k ~ 100k</span> Followers onboarded instantly.
                </p>
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h4 className="text-lg font-bold mb-4">Current Status (Beta):</h4>
              <ul className="space-y-3 text-white/70">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span><span className="text-white font-semibold">Invite-only Beta LIVE.</span></span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Targeting "Rising Star" groups (Tier 2) to ignite early competition.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
  },
  // Slide 9: The Team
  {
    content: <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">09 — The Team</span>
          <h2 className="text-4xl md:text-6xl font-black mb-12 leading-tight">
            K-Pop Insiders meets<br />
            <span className="text-primary">Web3 Builders</span>.
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/50 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-black">F</span>
              </div>
              <h3 className="text-lg font-bold mb-2">Founder</h3>
              <p className="text-sm text-white/60">
                K-Pop Industry Veteran<br />
                Full-stack Developer
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-500/50 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-black">T</span>
              </div>
              <h3 className="text-lg font-bold mb-2">Tech Lead</h3>
              <p className="text-sm text-white/60">
                Smart Contract Expert<br />
                Base Ecosystem Builder
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-500/50 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-black">C</span>
              </div>
              <h3 className="text-lg font-bold mb-2">Community</h3>
              <p className="text-sm text-white/60">
                Fandom Network Expert<br />
                K-Culture Specialist
              </p>
            </div>
          </div>
        </div>
  },
  // Slide 10: The Ask
  {
    content: <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-8">10 — The Ask</span>
          <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight">
            Join the Revolution<br />
            on <span className="text-primary">Base</span>.
          </h2>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-2xl mb-12">
            <Rocket className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-4">Goal:</h3>
            <p className="text-lg text-white/70">
              Raising <span className="text-white font-semibold">Seed Round</span> to accelerate Engineering & Global Marketing.
            </p>
          </div>
          
          <div className="max-w-3xl">
            <p className="text-2xl md:text-3xl font-light text-white/80 leading-relaxed italic">
              "K-Trendz is not just an app; it's the <span className="text-primary font-semibold">financial layer</span> for the world's most passionate community."
            </p>
          </div>
          
          <div className="mt-16 flex flex-col md:flex-row items-center gap-4 mb-12">
            <a href="https://k-trendz.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-4 px-8 rounded-full transition-all min-w-[180px]">
              Visit K-Trendz
            </a>
            <a href="mailto:manager@k-trendz.com" className="inline-flex items-center justify-center gap-2 border border-white/60 hover:border-white hover:bg-white/10 text-white font-bold py-4 px-8 rounded-full transition-all min-w-[180px]">
              Contact
            </a>
          </div>
        </div>
  }];
  return <>
      <Helmet>
        <title>K-Trendz: Pitch Deck for Alliance DAO</title>
        <meta name="description" content="The FanFi Platform on Base. We turn Fandom Passion into Investable Assets." />
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
export default PitchDeckAlliance;