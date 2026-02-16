import { Helmet } from "react-helmet-async";
import { ChevronDown, ChevronUp, Users, TrendingUp, Shield, Rocket, Target, Coins, Lock, Unlock, Zap, Heart, Crown, Star, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

const PitchDeckVariant = () => {
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
    // Slide 1: Title (The Vision)
    {
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-4 md:px-8">
          <div className="mb-4 md:mb-8">
            <span className="text-xs md:text-sm tracking-[0.3em] md:tracking-[0.5em] text-white/40 uppercase">The Pitch Deck for Variant Fund</span>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-9xl font-black tracking-tight mb-4 md:mb-8 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            K-TRENDZ
          </h1>
          <p className="text-lg sm:text-xl md:text-3xl font-light text-white/90 mb-4 md:mb-6 max-w-4xl leading-relaxed px-2">
            The <span className="font-bold text-primary">Ownership Economy</span> for K-Pop Fandom.
          </p>
          <p className="text-sm md:text-lg text-white/60 mt-2 md:mt-4 max-w-2xl px-2">
            Building a user-owned entertainment network where fans and curators capture the value they create.
          </p>
          <div className="flex items-center gap-2 md:gap-4 mt-6 md:mt-8 text-sm md:text-base text-white/50">
            <span>Passive Consumption</span>
            <ArrowRight className="w-4 h-4 md:w-6 md:h-6 text-primary" />
            <span className="text-white font-semibold">Active Ownership</span>
          </div>
          <div className="absolute bottom-16 md:bottom-12 animate-bounce">
            <ChevronDown className="w-6 h-6 md:w-8 md:h-8 text-white/30" />
          </div>
        </div>
      ),
    },
    // Slide 2: The Problem (Misalignment)
    {
      content: (
        <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">02 — The Problem</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-6 md:mb-12 leading-tight">
            The Fandom Economy is <span className="text-primary">Broken</span>.
          </h2>
          
          <div className="space-y-4 md:space-y-10 max-w-4xl">
            <div className="border-l-2 border-white/20 pl-4 md:pl-8">
              <h3 className="text-base md:text-xl font-bold text-white/80 mb-2 md:mb-3">The Insight</h3>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                K-Pop fandom is not just an audience; it is a <span className="text-white font-semibold">highly organized workforce</span>.
                They market artists, organize events, and create high-quality content.
              </p>
            </div>
            
            <div className="border-l-2 border-red-500 pl-4 md:pl-8">
              <h3 className="text-base md:text-xl font-bold text-white/80 mb-2 md:mb-3">The Misalignment</h3>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                Currently, centralized agencies and platforms capture <span className="text-red-400 font-semibold">100% of the financial upside</span>.
              </p>
            </div>
            
            <div className="border-l-2 border-yellow-500 pl-4 md:pl-8">
              <h3 className="text-base md:text-xl font-bold text-white/80 mb-2 md:mb-3">The Victim</h3>
              <p className="text-sm md:text-lg text-white/60 leading-relaxed">
                "Hommas" (Super-fan Curators) drive the industry's engagement but operate in precarious grey markets
                (selling physical photobooks) with <span className="text-yellow-400 font-semibold">no long-term security</span>.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 3: The Thesis (Why Now?)
    {
      content: (
        <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">03 — The Thesis</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            Empowering the<br />
            <span className="text-primary">"Middle Class"</span> of Creators.
          </h2>
          
          <div className="max-w-4xl">
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-8 mb-4 md:mb-8">
              <h3 className="text-base md:text-xl font-bold text-primary mb-2 md:mb-4">The Shift</h3>
              <p className="text-sm md:text-lg text-white/60 mb-2 md:mb-4">
                Web2 Platforms (Instagram, Twitter) optimize for <span className="text-white">superstars</span>.
              </p>
              <p className="text-base md:text-xl text-white/80">
                <span className="text-primary font-bold">K-Trendz Thesis:</span> We are building tools for the 
                <span className="text-white font-semibold"> "Niche Curators"</span> (Page Masters) who serve specific communities.
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary p-4 md:p-6">
              <p className="text-base md:text-xl text-white/80">
                By formalizing their role and giving them <span className="text-primary font-bold">Ownership</span>,
                we unlock a massive, untapped layer of the creator economy.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 4: The Solution (Product)
    {
      content: (
        <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">04 — The Solution</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight">
            A Decentralized<br />
            <span className="text-primary">Archive Network</span>.
          </h2>
          
          <p className="text-sm md:text-xl text-white/60 mb-6 md:mb-12 italic">How it Works:</p>
          
          <div className="space-y-4 md:space-y-8 max-w-4xl">
            <div className="flex gap-3 md:gap-6 items-start">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-base md:text-xl">1</span>
              </div>
              <div>
                <h3 className="text-base md:text-xl font-bold mb-1 md:mb-2">Community-Elected Curators</h3>
                <p className="text-xs md:text-base text-white/60">
                  Instead of a central admin, <span className="text-white font-semibold">Page Masters</span> (elected via community vote) operate individual Artist Archives.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 md:gap-6 items-start">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-base md:text-xl">2</span>
              </div>
              <div>
                <h3 className="text-base md:text-xl font-bold mb-1 md:mb-2">Curator-Fan Alignment</h3>
                <p className="text-xs md:text-base text-white/60">
                  Fans don't just "follow" a page; they <span className="text-primary font-semibold">"invest"</span> in it via Fanz Assets (Digital Light Sticks).
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 md:gap-6 items-start">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-base md:text-xl">3</span>
              </div>
              <div>
                <h3 className="text-base md:text-xl font-bold mb-1 md:mb-2">Community-Driven Value</h3>
                <p className="text-xs md:text-base text-white/60">
                  High-quality content is archived permanently, and <span className="text-white font-semibold">the community—not the platform</span>—decides what is valuable.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 5: The Economic Model (Sustainability)
    {
      content: (
        <div className="flex flex-col justify-center h-full px-4 md:px-20 py-8 md:py-0 overflow-y-auto">
          <span className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] text-primary uppercase mb-2 md:mb-4">05 — The Economic Model</span>
          <h2 className="text-2xl sm:text-3xl md:text-6xl font-black mb-2 md:mb-4 leading-tight">
            Patronage Meets Investment.
          </h2>
          <p className="text-base md:text-2xl text-white/60 mb-6 md:mb-12">Sustainability through aligned incentives.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 max-w-5xl">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="text-xl md:text-3xl font-black text-blue-400 mb-2 md:mb-4">Bonding Curve</div>
              <p className="text-xs md:text-base text-white/60">
                Aligns incentives between early believers and curators. As the community grows, <span className="text-white font-semibold">the asset value grows for everyone</span>.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="text-xl md:text-3xl font-black text-green-400 mb-2 md:mb-4">6% Royalty</div>
              <p className="text-xs md:text-base text-white/60">
                The "Pension" for Creators: Page Masters earn <span className="text-green-400 font-semibold">perpetual royalty</span> on trading volume.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 rounded-xl md:rounded-2xl p-4 md:p-8">
              <div className="text-xl md:text-3xl font-black text-purple-400 mb-2 md:mb-4">10% Fund</div>
              <p className="text-xs md:text-base text-white/60">
                Ecosystem Fund accumulated per transaction. Token holders <span className="text-purple-400 font-semibold">vote on how to deploy</span> this capital.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 6: Tokenomics (Dual-Token Structure)
    {
      content: (
        <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">06 — Tokenomics</span>
          <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            Dual-Token Structure
          </h2>
          <p className="text-2xl text-white/60 mb-12">Separating Governance from Activity.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl">
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Fanz Asset</h3>
                  <span className="text-sm text-white/50">ERC-1155 — The Equity</span>
                </div>
              </div>
              <p className="text-white/60 mb-4">Represents <span className="text-white font-semibold">Ownership & Governance</span>.</p>
              <div className="border-t border-white/10 pt-4 mt-4">
                <ul className="space-y-2 text-sm text-white/70">
                  <li>• Weighted voting on key decisions (Master selection, Fund usage)</li>
                  <li>• Access to tiered, high-quality content (Curated by Masters)</li>
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
                  <span className="text-sm text-white/50">Base Chain — The Fuel</span>
                </div>
              </div>
              <p className="text-white/60 mb-4">Rewards daily labor (Voting, Curation).</p>
              <div className="border-t border-white/10 pt-4 mt-4">
                <ul className="space-y-2 text-sm text-white/70">
                  <li>• Reduces friction by offering <span className="text-white">discounts</span> on asset purchases</li>
                  <li>• <span className="text-primary">Deflationary Sink:</span> Burned upon usage</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 7: Legal & Rights Strategy
    {
      content: (
        <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">07 — Legal & Rights</span>
          <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            Legitimizing the<br />
            <span className="text-primary">Grey Market</span>.
          </h2>
          
          <div className="space-y-6 max-w-4xl mt-8">
            <div className="bg-gradient-to-r from-yellow-500/20 to-transparent border-l-4 border-yellow-500 rounded-r-xl p-6">
              <h3 className="text-xl font-bold text-yellow-400 mb-3">The Challenge</h3>
              <p className="text-white/60">
                Hommas currently face legal risks selling direct merchandise.
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-green-500/20 to-transparent border-l-4 border-green-500 rounded-r-xl p-6">
              <h3 className="text-xl font-bold text-green-400 mb-3">The Shift</h3>
              <p className="text-white/60">
                K-Trendz reframes the transaction. Fans <span className="text-white font-semibold">"Donate"</span> via Fanz Assets to support the page; Access to content is a <span className="text-green-400 font-semibold">non-monetary perk</span> of membership.
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-blue-500/20 to-transparent border-l-4 border-blue-500 rounded-r-xl p-6">
              <h3 className="text-xl font-bold text-blue-400 mb-3">Protection</h3>
              <p className="text-white/60">
                <span className="text-white font-semibold">Invisible digital watermarking</span> ensures content security, protecting both the Master's IP and the Artist's portrait rights from unauthorized commercial use outside the platform.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 8: Growth Strategy (Community-Led)
    {
      content: (
        <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">08 — Growth Strategy</span>
          <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            Bottom-Up<br />
            <span className="text-primary">Network Effects</span>.
          </h2>
          
          <div className="max-w-4xl mt-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8">
              <h3 className="text-xl font-bold text-primary mb-4">Go-to-Market</h3>
              <p className="text-xl text-white/80 mb-4">
                We do not buy users. We <span className="text-white font-bold">empower Community Leaders</span>.
              </p>
              <p className="text-white/60">
                <span className="text-primary font-semibold">The "Master" Incentive:</span> By giving Masters unlimited invite codes and ownership rights, they migrate their existing Web2 followers (<span className="text-white font-semibold">50k~500k</span>) to K-Trendz.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-6 text-center">
                <Heart className="w-10 h-10 text-pink-400 mx-auto mb-4" />
                <div className="text-2xl font-bold text-white mb-2">Social Capital</div>
                <p className="text-white/50 text-sm">Rankings & Community Status</p>
              </div>
              
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-6 text-center">
                <Star className="w-10 h-10 text-yellow-400 mx-auto mb-4" />
                <div className="text-2xl font-bold text-white mb-2">Emotional Connection</div>
                <p className="text-white/50 text-sm">Content & Fandom Experience</p>
              </div>
            </div>
            
            <p className="text-center text-white/60 mt-8">
              Unlike speculative crypto apps, our users <span className="text-white font-semibold">stay</span> for these reasons.
            </p>
          </div>
        </div>
      ),
    },
    // Slide 9: The Team
    {
      content: (
        <div className="flex flex-col justify-center h-full px-8 md:px-20">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">09 — The Team</span>
          <h2 className="text-4xl md:text-6xl font-black mb-12 leading-tight">
            Builders with<br />
            <span className="text-primary">Skin in the Game</span>.
          </h2>
          
          <div className="max-w-4xl">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8">
              <p className="text-xl text-white/80 leading-relaxed">
                A team that understands the nuances of <span className="text-primary font-semibold">Fan Psychology</span> (The "Han" and "Jeong") and the technical scalability of <span className="text-blue-400 font-semibold">Base</span>.
              </p>
            </div>
            
            <div className="text-center mt-12">
              <p className="text-2xl text-white/60">We are building the rails for the</p>
              <p className="text-4xl text-white font-black mt-4">
                next generation of entertainment.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 10: The Ask
    {
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <span className="text-sm tracking-[0.3em] text-primary uppercase mb-4">10 — The Ask</span>
          <h2 className="text-4xl md:text-6xl font-black mb-12 leading-tight">
            Invest in the<br />
            <span className="text-primary">Future of Fandom</span>.
          </h2>
          
          <div className="max-w-3xl">
            <p className="text-xl text-white/70 leading-relaxed mb-12">
              K-Pop is just the beginning. We are building the <span className="text-white font-semibold">standard protocol</span> for high-engagement communities.
            </p>
            
            <div className="border-t border-b border-white/20 py-8 my-8">
              <p className="text-2xl md:text-3xl text-white font-light italic">
                "Join us in restoring ownership<br />
                to the people who build the culture."
              </p>
            </div>
            
            <div className="mt-12 flex flex-col md:flex-row items-center justify-center gap-4 mb-12">
              <a 
                href="https://k-trendz.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-full font-bold text-lg transition-all min-w-[200px]"
              >
                Visit K-TRENDZ
                <ArrowRight className="w-5 h-5" />
              </a>
              <a 
                href="mailto:manager@k-trendz.com"
                className="inline-flex items-center justify-center gap-2 border border-white/60 hover:border-white hover:bg-white/10 text-white px-8 py-4 rounded-full font-bold text-lg transition-all min-w-[200px]"
              >
                Contact
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
        <title>K-Trendz Pitch Deck for Variant Fund</title>
        <meta name="description" content="K-Trendz: The Ownership Economy for K-Pop Fandom. Building a user-owned entertainment network." />
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
              aria-label={`Go to slide ${index + 1}`}
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
          aria-label="Previous slide"
        >
          <ChevronUp className="w-5 h-5 md:w-6 md:h-6" />
        </button>

        {currentSlide < totalSlides - 1 && (
          <button
            onClick={nextSlide}
            className="fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-50 p-1.5 md:p-2 rounded-full border border-white/20 transition-all opacity-60 hover:opacity-100 hover:bg-white/10"
            aria-label="Next slide"
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

export default PitchDeckVariant;
