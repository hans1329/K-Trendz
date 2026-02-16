import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Sparkles, TrendingUp, Coins, Vote, Star, ExternalLink, Zap, Users, Rocket, Heart, Shield, CheckCircle, ArrowRight, Coffee, Gift, Building2, Globe, Calendar } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-16 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/10"></div>
        <div className="absolute top-10 md:top-20 right-10 md:right-20 w-48 md:w-72 h-48 md:h-72 bg-primary/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 md:bottom-20 left-10 md:left-20 w-64 md:w-96 h-64 md:h-96 bg-primary/30 rounded-full blur-3xl"></div>
        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <div className="text-center space-y-4 md:space-y-6">
            <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium text-white">
              <Shield className="w-3 h-3 md:w-4 md:h-4 text-green-400" />
              100% On-Chain Transparency
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white leading-tight px-2">
              Transparent<br /><span className="text-primary">Artist Support</span> Platform
            </h1>
            <p className="text-sm md:text-lg text-gray-300 max-w-2xl mx-auto px-4 leading-relaxed">
              Every transaction verified on-chain. 20% of every purchase goes directly to Artist Fund. Your support, transparently tracked.
            </p>
            <div className="flex flex-wrap gap-6 md:gap-10 justify-center pt-4 md:pt-6">
              <div className="text-center">
                <div className="text-2xl md:text-4xl font-bold text-primary">20%</div>
                <div className="text-xs md:text-sm text-gray-400">Artist Fund</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-4xl font-bold text-green-400">100%</div>
                <div className="text-xs md:text-sm text-gray-400">On-Chain Verified</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-4xl font-bold text-white">Base</div>
                <div className="text-xs md:text-sm text-gray-400">Network</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-12 md:py-20 container mx-auto px-4 max-w-6xl">
        <div className="text-center space-y-3 md:space-y-4 mb-10 md:mb-16">
          <span className="text-xs md:text-sm tracking-widest text-primary uppercase">The Problem</span>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground">Why Traditional Fan Platforms Fail</h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Fans invest time and money, but have no visibility into how funds are actually used
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 md:p-8">
            <div className="text-3xl md:text-4xl mb-4">🔒</div>
            <h3 className="text-lg md:text-xl font-bold text-foreground mb-3">Hidden Fees</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Traditional platforms take unclear cuts. Fans never know what percentage actually reaches the artist.
            </p>
          </div>
          
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 md:p-8">
            <div className="text-3xl md:text-4xl mb-4">❓</div>
            <h3 className="text-lg md:text-xl font-bold text-foreground mb-3">Unverifiable Funds</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Where does the money go? Closed systems make it impossible to verify fund usage.
            </p>
          </div>
          
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 md:p-8">
            <div className="text-3xl md:text-4xl mb-4">💔</div>
            <h3 className="text-lg md:text-xl font-bold text-foreground mb-3">Trust Deficit</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Fans must blindly trust platforms with no accountability or transparency mechanisms.
            </p>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-green-500/5 via-background to-primary/5">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center space-y-3 md:space-y-4 mb-10 md:mb-16">
            <span className="text-xs md:text-sm tracking-widest text-primary uppercase">Our Solution</span>
            <h2 className="text-2xl md:text-4xl font-bold text-foreground">On-Chain Transparency</h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
              Every transaction recorded on Base Network. Verify everything yourself.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-lg md:text-xl font-bold">Smart Contract Automation</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Fee distribution is handled automatically by immutable smart contracts. No human intervention, no manipulation.
              </p>
              <a 
                href="https://basescan.org/address/0xD8810587C6708b44F89520d612F0aaD832deA7aB" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View Contract on BaseScan <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Heart className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg md:text-xl font-bold">20% Artist Fund</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Every purchase automatically sends 20% to the Artist Fund wallet. Check the balance anytime, verify every transaction.
              </p>
              <a 
                href="https://basescan.org/address/0xd5C1296990b9072302a627752E46061a40112342" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View Artist Fund Wallet <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="mt-8 md:mt-12 bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary p-4 md:p-6 max-w-4xl mx-auto rounded-r-xl">
            <p className="text-sm md:text-base text-foreground">
              <span className="font-bold text-primary">Zero Trust Required</span> — Don't trust us, verify on-chain yourself at any time
            </p>
          </div>
        </div>
      </section>

      {/* Fee Structure Section */}
      <section className="py-12 md:py-20 container mx-auto px-4 max-w-6xl">
        <div className="text-center space-y-3 md:space-y-4 mb-10 md:mb-16">
          <span className="text-xs md:text-sm tracking-widest text-primary uppercase">Fee Distribution</span>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground">Transparent Fee Structure</h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Every fee is executed by smart contract and recorded on Base Network
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 md:w-28 text-right">
              <span className="text-2xl md:text-4xl font-black text-pink-400">20%</span>
            </div>
            <div className="flex-1 bg-pink-400/20 border border-pink-400/30 rounded-full h-12 md:h-14 flex items-center px-4 md:px-6">
              <span className="text-sm md:text-base font-medium">Artist Fund — Real-world artist support activities</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-20 md:w-28 text-right">
              <span className="text-2xl md:text-4xl font-black text-primary">10%</span>
            </div>
            <div className="flex-1 bg-primary/20 border border-primary/30 rounded-full h-12 md:h-14 flex items-center px-4 md:px-6">
              <span className="text-sm md:text-base font-medium">Platform Fee — Platform development and operations</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-20 md:w-28 text-right">
              <span className="text-2xl md:text-4xl font-black text-green-400">70%</span>
            </div>
            <div className="flex-1 bg-green-400/20 border border-green-400/30 rounded-full h-12 md:h-14 flex items-center px-4 md:px-6">
              <span className="text-sm md:text-base font-medium">Liquidity Reserve — Ensures instant sell-back anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Artist Support Activities */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-muted/30 to-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center space-y-3 md:space-y-4 mb-10 md:mb-16">
            <span className="text-xs md:text-sm tracking-widest text-primary uppercase">Artist Support</span>
            <h2 className="text-2xl md:text-4xl font-bold text-foreground">Real-World Support Powered by Fans</h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
              20% Artist Fund enables meaningful support activities decided by Lightstick holders
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-pink-500/10 to-pink-500/5 border border-pink-500/20 rounded-2xl p-6">
              <Building2 className="w-10 h-10 text-pink-400 mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-2">Times Square Ads</h3>
              <p className="text-sm text-muted-foreground">
                Birthday & debut anniversary ads on the world's biggest screens. Fan-funded, transparently tracked.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-2xl p-6">
              <Coffee className="w-10 h-10 text-amber-400 mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-2">Coffee Truck Support</h3>
              <p className="text-sm text-muted-foreground">
                Send coffee trucks to filming locations, concert venues, and fan meetings. Direct artist appreciation.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20 rounded-2xl p-6">
              <Gift className="w-10 h-10 text-violet-400 mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-2">Limited Edition Merch</h3>
              <p className="text-sm text-muted-foreground">
                Exclusive fan-designed merchandise. Revenue flows back to Artist Fund for more support activities.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-2xl p-6">
              <Calendar className="w-10 h-10 text-green-400 mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-2">Birthday & Anniversary Events</h3>
              <p className="text-sm text-muted-foreground">
                Subway station ads, LED truck campaigns, charity donations in artist's name.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-2xl p-6">
              <Globe className="w-10 h-10 text-blue-400 mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-2">Global Fan Projects</h3>
              <p className="text-sm text-muted-foreground">
                Coordinated worldwide support: streaming parties, voting campaigns, forest donations.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <Vote className="w-6 h-6 text-primary" />
              <h4 className="font-bold text-lg">Fan Governance</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Support activities are <span className="text-primary font-semibold">decided by Lightstick holders</span> through on-chain governance voting. Your token = Your voice.
            </p>
          </div>
        </div>
      </section>

      {/* Bonding Curve Economics */}
      <section className="py-12 md:py-20 container mx-auto px-4 max-w-6xl">
        <div className="text-center space-y-3 md:space-y-4 mb-10 md:mb-16">
          <span className="text-xs md:text-sm tracking-widest text-primary uppercase">Bonding Curve Economics</span>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground">Price Grows with Community</h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Earn as artist value rises. High fees prevent short-term speculation.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto mb-8">
          <div className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20 rounded-2xl p-6 md:p-8">
            <div className="text-3xl mb-4">📈</div>
            <h3 className="text-lg md:text-xl font-bold text-foreground mb-3">Price Goes Up with Demand</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Bonding curve ensures <span className="text-foreground font-semibold">price increases</span> as more fans join. Early supporters benefit from artist's growing popularity.
            </p>
            <div className="bg-muted/50 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-2">Example Price Growth:</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">1st Token:</span>
                <span className="text-foreground font-bold">$1.15</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">100th:</span>
                <span className="text-green-500 font-bold">$21.82</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 rounded-2xl p-6 md:p-8">
            <div className="text-3xl mb-4">🛡️</div>
            <h3 className="text-lg md:text-xl font-bold text-foreground mb-3">Anti-Speculation Design</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="text-foreground font-semibold">30% total fees</span> on every transaction discourages short-term flipping and protects genuine fan communities.
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Artist Fund:</span>
                <span className="text-pink-400 font-bold">20%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee:</span>
                <span className="text-primary font-bold">10%</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Quick Flip Loss:</span>
                <span className="text-red-400 font-bold">~30%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl p-6 md:p-8 max-w-4xl mx-auto">
          <h3 className="text-lg md:text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            <span className="text-2xl">💎</span> Long-Term Fan Benefits
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-foreground">Price Appreciation</p>
              <p className="text-xs text-muted-foreground">Value grows with artist popularity</p>
            </div>
            <div className="text-center">
              <Star className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-foreground">Exclusive Access</p>
              <p className="text-xs text-muted-foreground">Priority for events & content</p>
            </div>
            <div className="text-center">
              <Coins className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-foreground">Exit Anytime</p>
              <p className="text-xs text-muted-foreground">70% liquidity reserve guarantees</p>
            </div>
          </div>
        </div>
      </section>

      {/* Token System */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-muted/30 to-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center space-y-3 md:space-y-4 mb-10 md:mb-16">
            <span className="text-xs md:text-sm tracking-widest text-primary uppercase">Token System</span>
            <h2 className="text-2xl md:text-4xl font-bold text-foreground">$KTNZ & Digital Lightstick</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20 rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center">
                  <Coins className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold">$KTNZ Token</h3>
                  <span className="text-xs text-muted-foreground">ERC-20 on Base Network</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-foreground">5B</p>
                  <p className="text-xs text-violet-400">Max Supply</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-foreground">70%</p>
                  <p className="text-xs text-violet-400">Community Mining</p>
                </div>
              </div>
              
              <div className="border-t border-border pt-4 space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Earning:</p>
                  <p className="text-sm text-foreground">
                    Tokens auto-distributed upon completing <span className="text-violet-400 font-semibold">13 daily votes</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Burning:</p>
                  <p className="text-sm text-foreground">
                    Burned when converted to activity points <span className="text-violet-400 font-semibold">'Stars'</span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold">Digital Lightstick</h3>
                  <span className="text-xs text-muted-foreground">ERC-1155 Artist Support Token</span>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                Your <span className="text-foreground font-semibold">Lightstick</span> represents your support for an artist and powers the Artist Fund.
              </p>
              
              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted-foreground mb-2">Support & Governance:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                    <span><span className="text-foreground font-semibold">20% to Artist Fund:</span> Every purchase supports your artist</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                    <span><span className="text-foreground font-semibold">Governance Vote:</span> Decide how funds are used</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                    <span><span className="text-foreground font-semibold">On-Chain Verified:</span> All activities transparently tracked</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why K-Trendz Section */}
      <section className="py-12 md:py-20 container mx-auto px-4 max-w-6xl">
        <div className="text-center space-y-3 md:space-y-4 mb-10 md:mb-16">
          <h2 className="text-2xl md:text-4xl font-bold text-foreground">Why Choose KTRENDZ?</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            The first platform combining fan engagement with on-chain transparency
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="font-bold text-lg">100% Transparent</h3>
            <p className="text-sm text-muted-foreground">
              Every transaction recorded on Base Network. Verify Artist Fund balance anytime on BaseScan.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-bold text-lg">Real Artist Support</h3>
            <p className="text-sm text-muted-foreground">
              20% of every purchase goes directly to Artist Fund for real-world support activities.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-violet-500/10 rounded-full flex items-center justify-center mx-auto">
              <Users className="w-8 h-8 text-violet-500" />
            </div>
            <h3 className="font-bold text-lg">Fan Governance</h3>
            <p className="text-sm text-muted-foreground">
              Lightstick holders vote on how Artist Fund is used. Your token, your voice.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-20 container mx-auto px-4 max-w-4xl">
        <div className="bg-gradient-to-br from-primary/10 via-muted/20 to-background border border-border rounded-2xl md:rounded-3xl p-6 md:p-12 text-center space-y-4 md:space-y-6">
          <h2 className="text-2xl md:text-4xl font-bold text-foreground">
            Support Your Artist Transparently
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Join the first platform where every fan contribution is verified on-chain
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center pt-4">
            <a 
              href="/"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors"
            >
              <Rocket className="w-4 h-4" />
              Get Started
            </a>
            <a 
              href="https://basescan.org/address/0xD8810587C6708b44F89520d612F0aaD832deA7aB"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-6 py-3 rounded-full font-semibold hover:bg-secondary/80 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Verify on BaseScan
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
