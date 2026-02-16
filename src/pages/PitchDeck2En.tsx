import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Home, Target, Lightbulb, Cog, PieChart, DollarSign, Rocket, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Image imports
import coverHero from "@/assets/pitch/cover-hero.jpg";
import problemImg from "@/assets/pitch/problem.jpg";
import solutionImg from "@/assets/pitch/solution.jpg";
import marketImg from "@/assets/pitch/market.jpg";
import roadmapImg from "@/assets/pitch/roadmap.jpg";

// Slide data - Fan-Fi concept (English)
const slides = [
  {
    id: "cover",
    title: "K-TRENDZ",
    subtitle: "Turn K-POP fandom into digital assets fans can own and trade.",
    bgImage: coverHero,
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 md:space-y-8 px-2">
        <div className="space-y-2 md:space-y-4">
          <h1 className="text-4xl md:text-7xl font-bold text-white drop-shadow-2xl">
            K-TRENDZ
          </h1>
          <p className="text-lg md:text-2xl text-white/90 font-medium drop-shadow-lg max-w-3xl">
            Turn K-POP fandom into digital assets fans can own and trade.
          </p>
        </div>
        <div className="mt-4 md:mt-8 px-4 md:px-8 py-3 md:py-4 bg-gradient-to-r from-primary/90 to-orange-500/90 rounded-full shadow-2xl">
          <p className="text-sm md:text-xl font-bold text-white">
            The Fan-Fi Platform
          </p>
        </div>
        <p className="text-sm md:text-lg text-white/80 max-w-2xl mt-4">
          A platform where fandom passion and engagement translate into asset value and market price
        </p>
      </div>
    ),
  },
  {
    id: "problem",
    title: "The Problem",
    subtitle: "Despite high engagement and spending, current K-POP fandom activities leave fans with almost no lasting asset value.",
    icon: Target,
    bgImage: problemImg,
    content: (
      <div className="space-y-4 md:space-y-8">
        <div className="grid gap-3 md:gap-6">
          <Card className="bg-background/95 backdrop-blur-sm border-destructive/30 shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-3xl">💸</span>
                <h4 className="font-semibold text-sm md:text-xl">One-Way Consumption</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                Fans buy albums, merchandise, and voting tickets, but their value drops to zero immediately or gets resold at bargain prices.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-background/95 backdrop-blur-sm border-destructive/30 shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-3xl">😢</span>
                <h4 className="font-semibold text-sm md:text-xl">No Rewards for Contribution</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                Even when fans push their idols to #1 through streaming and voting, there is zero financial return for the fans themselves.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-background/95 backdrop-blur-sm border-destructive/30 shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-3xl">🔥</span>
                <h4 className="font-semibold text-sm md:text-xl">Lack of Engagement Sustainability</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                Without rewards, fandom activities rely solely on passion, which inevitably fades over time.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    ),
  },
  {
    id: "solution",
    title: "The Solution",
    subtitle: "The Birth of Fan-Fi: Combining Fandom and Finance",
    icon: Lightbulb,
    bgImage: solutionImg,
    content: (
      <div className="space-y-4 md:space-y-8">
        <div className="text-center mb-4 md:mb-8">
          <Card className="bg-background/80 backdrop-blur-sm inline-block shadow-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-sm md:text-xl text-foreground">
                Fandom participation from an <span className="text-primary font-bold">investment</span> perspective, not consumption
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-3 md:gap-6">
          <Card className="bg-background/80 backdrop-blur-sm border-primary/30 shadow-xl hover:scale-[1.02] transition-transform">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary to-orange-400 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl md:text-3xl">🎤</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-xl">Fandom Participation as Investment</h4>
                  <p className="text-xs md:text-base text-muted-foreground">Buying a digital Light Stick is not mere consumption - it is <span className="text-primary font-semibold">acquiring equity</span>.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background/80 backdrop-blur-sm border-green-500/30 shadow-xl hover:scale-[1.02] transition-transform">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-green-500 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl md:text-3xl">📈</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-xl">Real-Time Price Reflection of Fan Activity</h4>
                  <p className="text-xs md:text-base text-muted-foreground">As more fans purchase (increased demand), the <span className="text-green-500 font-semibold">Bonding Curve</span> algorithm drives the Light Stick price upward.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background/80 backdrop-blur-sm border-violet-500/30 shadow-xl hover:scale-[1.02] transition-transform">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-violet-500 to-purple-400 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl md:text-3xl">💰</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-xl">Liquidity-Based Profit Realization</h4>
                  <p className="text-xs md:text-base text-muted-foreground">When the rookie you discovered rises in price, you can sell for <span className="text-violet-500 font-semibold">capital gains</span>.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    ),
  },
  {
    id: "mechanism",
    title: "Key Mechanism",
    subtitle: "Real-time Valuation System (A structure where fandom engagement and demand are reflected in real-time pricing)",
    icon: Cog,
    content: (
      <div className="space-y-4 md:space-y-8">
        {/* Bonding Curve */}
        <Card className="bg-gradient-to-r from-gray-900/90 via-gray-800/90 to-gray-900/90 border-primary/30 shadow-xl">
          <CardContent className="p-4 md:p-6">
            <h4 className="text-lg md:text-2xl font-bold text-white mb-3 md:mb-4 text-center">Bonding Curve Pricing Algorithm</h4>
            
            {/* Anti-Speculation */}
            <div className="bg-violet-500/20 border border-violet-500/30 rounded-xl p-3 md:p-4 mb-3 md:mb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-lg md:text-xl">🛡️</span>
                <h5 className="font-bold text-violet-300 text-xs md:text-base">Anti-Speculation Design</h5>
              </div>
              <p className="text-violet-200/80 text-[10px] md:text-xs text-center">
                Algorithm-based pricing mechanism that automatically adjusts prices as fan engagement increases
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-3 md:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg md:text-2xl">🚀</span>
                  <h5 className="font-bold text-green-400 text-xs md:text-sm">Early Adopters</h5>
                </div>
                <p className="text-white/80 text-[10px] md:text-sm">Buy at low price <span className="text-green-400 font-bold">($2.00)</span></p>
                <p className="text-green-400 font-semibold text-[10px] md:text-xs mt-1">High Risk, High Return</p>
              </div>
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-3 md:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg md:text-2xl">🛡️</span>
                  <h5 className="font-bold text-blue-400 text-xs md:text-sm">Late Adopters</h5>
                </div>
                <p className="text-white/80 text-[10px] md:text-sm">Buy at validated price</p>
                <p className="text-blue-400 font-semibold text-[10px] md:text-xs mt-1">Low Risk, Low Return</p>
              </div>
            </div>
            <div className="mt-3 md:mt-4 text-center">
              <p className="text-white/70 text-xs md:text-sm">
                Automated Market Making (AMM) enables <span className="text-primary font-bold">instant liquidation anytime</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Surcharge & Governance */}
        <div className="grid md:grid-cols-2 gap-3 md:gap-6">
          <Card className="shadow-xl hover:shadow-2xl transition-shadow">
            <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-pink-500 to-rose-400 rounded-xl flex items-center justify-center">
                  <span className="text-xl md:text-2xl">💖</span>
                </div>
                <h4 className="font-bold text-base md:text-xl">Surcharge & Governance Fee</h4>
              </div>
              <div className="bg-pink-500/10 rounded-lg p-3 md:p-4">
                <p className="text-2xl md:text-3xl font-bold text-pink-500 mb-2">10%</p>
                <p className="text-muted-foreground text-xs md:text-sm">Structured fee system for platform operations and community governance</p>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                90% of purchase value flows back to the bonding curve as liquidity.
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-xl hover:shadow-2xl transition-shadow">
            <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center">
                  <span className="text-xl md:text-2xl">👑</span>
                </div>
                <h4 className="font-bold text-base md:text-xl">Captain System</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                Beyond simple holding, elect <span className="text-orange-500 font-semibold">"Captains" (community leaders)</span> to strengthen community bonds.
              </p>
              <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">✓</span>
                  <span>Fan page content management</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">✓</span>
                  <span>Support fund execution</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">✓</span>
                  <span>Community governance decisions</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    ),
  },
  {
    id: "portfolio",
    title: "Portfolio Strategy",
    subtitle: "From stable blue-chips to 100x rookie moonshots",
    icon: PieChart,
    bgImage: marketImg,
    content: (
      <div className="space-y-4 md:space-y-8">
        <div className="text-center mb-4 md:mb-6">
          <Card className="bg-background/85 backdrop-blur-sm inline-block shadow-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-xs md:text-lg text-foreground">
                100 K-POP groups classified into <span className="text-primary font-bold">5 financial asset tiers</span>
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 md:gap-4">
          {/* Tier 1 */}
          <Card className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30 shadow-xl">
            <CardContent className="p-3 md:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-xl md:text-2xl">👑</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm md:text-lg text-yellow-500">Tier 1: The Kings</h4>
                    <p className="text-xs md:text-sm text-muted-foreground">BTS, SEVENTEEN, etc. - Low volatility, safe "reserve currency"</p>
                  </div>
                </div>
                <span className="text-lg md:text-2xl font-bold text-yellow-500">$30~</span>
              </div>
            </CardContent>
          </Card>

          {/* Tier 2 */}
          <Card className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30 shadow-xl">
            <CardContent className="p-3 md:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-xl md:text-2xl">💎</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm md:text-lg text-blue-500">Tier 2: Blue Chips</h4>
                    <p className="text-xs md:text-sm text-muted-foreground">KATSEYE, NewJeans, etc. - Strong growth momentum</p>
                  </div>
                </div>
                <span className="text-lg md:text-2xl font-bold text-blue-500">$15~</span>
              </div>
            </CardContent>
          </Card>

          {/* Tier 3-4 */}
          <Card className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 shadow-xl">
            <CardContent className="p-3 md:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-xl md:text-2xl">🌱</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm md:text-lg text-green-500">Tier 3-4: Growth & Emerging</h4>
                    <p className="text-xs md:text-sm text-muted-foreground">Undervalued rookies - Speculative demand seeking "the next BTS"</p>
                  </div>
                </div>
                <span className="text-lg md:text-2xl font-bold text-green-500">$2~</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Case Study */}
        <Card className="bg-background/85 backdrop-blur-sm shadow-xl border-primary/30">
          <CardContent className="p-3 md:p-5">
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <span className="text-xl md:text-2xl">📊</span>
              <h4 className="font-bold text-sm md:text-lg">Case Study</h4>
            </div>
            <p className="text-xs md:text-base text-muted-foreground">
              Rookie group <span className="text-primary font-bold">KATSEYE</span> showed steep upward trajectory within 4 months of debut, threatening TREASURE and <span className="text-primary font-bold">entering Tier 2</span>
            </p>
          </CardContent>
        </Card>
      </div>
    ),
  },
  {
    id: "business-model",
    title: "Business Model",
    subtitle: "The platform grows with every transaction.",
    icon: DollarSign,
    content: (
      <div className="space-y-4 md:space-y-8">
        <div className="grid md:grid-cols-3 gap-3 md:gap-6">
          <Card className="bg-gradient-to-br from-primary/10 to-orange-500/10 border-primary/30 shadow-xl hover:scale-105 transition-transform">
            <CardContent className="p-4 md:p-6 text-center space-y-3 md:space-y-4">
              <div className="w-14 h-14 md:w-20 md:h-20 mx-auto bg-gradient-to-br from-primary to-orange-400 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl md:text-4xl">💳</span>
              </div>
              <h4 className="font-bold text-sm md:text-xl">Transaction Fee</h4>
              <p className="text-2xl md:text-4xl font-bold text-primary">4%</p>
              <p className="text-xs md:text-sm text-muted-foreground">Trading fees on asset buy/sell transactions</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/30 shadow-xl hover:scale-105 transition-transform">
            <CardContent className="p-4 md:p-6 text-center space-y-3 md:space-y-4">
              <div className="w-14 h-14 md:w-20 md:h-20 mx-auto bg-gradient-to-br from-violet-500 to-purple-400 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl md:text-4xl">🏦</span>
              </div>
              <h4 className="font-bold text-sm md:text-xl">Withdrawal Fee</h4>
              <p className="text-2xl md:text-4xl font-bold text-violet-500">$1</p>
              <p className="text-xs md:text-sm text-muted-foreground">Fees incurred during asset liquidation (cashing out)</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border-pink-500/30 shadow-xl hover:scale-105 transition-transform">
            <CardContent className="p-4 md:p-6 text-center space-y-3 md:space-y-4">
              <div className="w-14 h-14 md:w-20 md:h-20 mx-auto bg-gradient-to-br from-pink-500 to-rose-400 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl md:text-4xl">👑</span>
              </div>
              <h4 className="font-bold text-sm md:text-xl">Governance Fee</h4>
              <p className="text-2xl md:text-4xl font-bold text-pink-500">6%</p>
              <p className="text-xs md:text-sm text-muted-foreground">Fees related to fan voting and platform decision-making participation</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 shadow-xl">
          <CardContent className="p-3 md:p-6 text-center flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
            <span className="text-2xl md:text-4xl">🔒</span>
            <p className="text-sm md:text-xl">
              <span className="font-bold text-green-500">90%</span> of purchase value flows back to the bonding curve as liquidity
            </p>
          </CardContent>
        </Card>
      </div>
    ),
  },
  {
    id: "ktnz-token",
    title: "$KTNZ Token",
    subtitle: "Vote-to-Earn: Utility token for platform participation (used in fan voting, governance, and reward mechanisms)",
    icon: Coins,
    content: (
      <div className="space-y-4 md:space-y-6">
        {/* Token Overview */}
        <Card className="bg-gradient-to-r from-violet-900/90 via-purple-800/90 to-violet-900/90 border-violet-500/30 shadow-xl">
          <CardContent className="p-4 md:p-6">
            <div className="text-center mb-3 md:mb-4">
              <h4 className="text-lg md:text-2xl font-bold text-white mb-1">$KTNZ Token</h4>
              <p className="text-violet-300 text-xs md:text-sm">ERC-20 on Base Network • Vote-to-Earn Economy</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              <div className="bg-white/10 rounded-xl p-2 md:p-3 text-center">
                <p className="text-base md:text-xl font-bold text-white">5B</p>
                <p className="text-violet-300 text-[10px] md:text-xs">Max Supply</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2 md:p-3 text-center">
                <p className="text-base md:text-xl font-bold text-white">1.5B</p>
                <p className="text-violet-300 text-[10px] md:text-xs">FDV Basis</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2 md:p-3 text-center">
                <p className="text-base md:text-xl font-bold text-white">70%</p>
                <p className="text-violet-300 text-[10px] md:text-xs">Community Mining</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2 md:p-3 text-center">
                <p className="text-base md:text-xl font-bold text-white">🔥</p>
                <p className="text-violet-300 text-[10px] md:text-xs">Usage-based Burn</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Earning Mechanism */}
        <div className="grid md:grid-cols-2 gap-3 md:gap-4">
          <Card className="shadow-xl">
            <CardContent className="p-3 md:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-violet-500 to-purple-400 rounded-lg flex items-center justify-center">
                  <span className="text-base md:text-xl">⛏️</span>
                </div>
                <h4 className="font-bold text-sm md:text-base">Vote-to-Earn</h4>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                Reward structure for participation and decision-making activities on the platform. Complete <span className="text-violet-500 font-semibold">13 daily votes</span> to automatically receive $KTNZ tokens based on your level.
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-xl">
            <CardContent className="p-3 md:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary to-orange-400 rounded-lg flex items-center justify-center">
                  <span className="text-base md:text-xl">🏦</span>
                </div>
                <h4 className="font-bold text-sm md:text-base">Initial Allocation (30%)</h4>
              </div>
              <div className="space-y-1 text-[10px] md:text-xs text-muted-foreground">
                <p>• <span className="font-semibold">Private/Seed 10%</span>: 6mo Cliff → 18mo Vesting</p>
                <p>• <span className="font-semibold">Team 10%</span>: 12mo Cliff → 24-36mo Vesting</p>
                <p>• <span className="font-semibold">Marketing 5%</span>: TGE 10-20% + Activity Rewards</p>
                <p>• <span className="font-semibold">Liquidity 5%</span>: 100% TGE for DEX</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FDV & Burn Mechanism */}
        <div className="grid md:grid-cols-2 gap-3 md:gap-4">
          <Card className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30 shadow-xl">
            <CardContent className="p-3 md:p-4 text-center">
              <p className="text-xs md:text-sm text-muted-foreground mb-1">FDV (Fully Diluted Valuation)</p>
              <p className="text-lg md:text-2xl font-bold text-blue-400">Based on Initial 1.5B</p>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Measured on initial circulation, not max 5B</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/30 shadow-xl">
            <CardContent className="p-3 md:p-4 text-center">
              <p className="text-xs md:text-sm text-muted-foreground mb-1">Deflationary Burn 🔥</p>
              <p className="text-lg md:text-2xl font-bold text-orange-400">Burned on Use</p>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Permanently burned when exchanged for points or used on platform</p>
            </CardContent>
          </Card>
        </div>

        {/* Value Proposition */}
        <Card className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 shadow-xl">
          <CardContent className="p-3 md:p-5 text-center space-y-2">
            <p className="text-xs md:text-base">
              <span className="font-bold text-green-500">Fandom Activity = Token Rewards</span>
              <span className="text-muted-foreground mx-2">|</span>
              Increased usage → <span className="text-orange-500 font-semibold">Decreased supply</span> → Value appreciation
            </p>
            <div className="text-[10px] md:text-xs text-muted-foreground space-y-1 pt-2 border-t border-green-500/20">
              <p>KTNZ is a utility token for platform participation, not an investment product.</p>
              <p>Token value is formed by platform usage and community activity.</p>
              <p>KTNZ does not represent equity, ownership, or profit claims.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    ),
  },
  {
    id: "vision",
    title: "Vision",
    subtitle: "The NASDAQ of K-POP Fandom Economy",
    icon: Rocket,
    bgImage: roadmapImg,
    content: (
      <div className="space-y-4 md:space-y-8">
        <Card className="bg-background/85 backdrop-blur-sm shadow-2xl border-primary/30">
          <CardContent className="p-6 md:p-10 text-center space-y-4 md:space-y-6">
            <div className="w-20 h-20 md:w-28 md:h-28 mx-auto bg-gradient-to-br from-primary to-orange-400 rounded-full flex items-center justify-center shadow-2xl">
              <span className="text-4xl md:text-6xl">🚀</span>
            </div>
            <h3 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
              The NASDAQ of Fandom Capital Markets
            </h3>
            <p className="text-sm md:text-xl text-muted-foreground max-w-2xl mx-auto">
              The platform that <span className="text-primary font-bold">100 million</span> K-POP fans worldwide check first every morning
            </p>
          </CardContent>
        </Card>

        <Card className="bg-background/85 backdrop-blur-sm shadow-xl">
          <CardContent className="p-4 md:p-6 space-y-4">
            <p className="text-sm md:text-lg text-center text-muted-foreground leading-relaxed">
              K-TRENDZ expands K-POP fandom engagement into a market-based asset structure<br />
              and builds a <span className="text-primary font-semibold">sustainable fandom capital ecosystem</span> where fans, creators, and the platform grow together.
            </p>
            <p className="text-xs md:text-base text-center text-primary font-semibold">
              Fandom is no longer just consumers—they become participants who shape the market.
            </p>
          </CardContent>
        </Card>

        {/* Investor Summary */}
        <Card className="bg-gradient-to-r from-gray-900/95 via-gray-800/95 to-gray-900/95 border-primary/30 shadow-2xl">
          <CardContent className="p-4 md:p-8 space-y-4 md:space-y-6">
            <div className="flex items-center justify-center gap-2 md:gap-3">
              <span className="text-xl md:text-3xl">💼</span>
              <h4 className="text-lg md:text-2xl font-bold text-white">One-Line Summary for Investors</h4>
            </div>
            <p className="text-sm md:text-lg text-white/90 text-center leading-relaxed italic">
              &quot;K-Trendz is the first platform to convert entertainment <span className="text-primary font-bold">&apos;emotions&apos;</span> into fintech <span className="text-primary font-bold">&apos;numbers&apos;</span>.<br />
              For fans who could only watch BTS succeed, we now sell the opportunity to <span className="text-primary font-bold">&apos;share in&apos;</span> that success.&quot;
            </p>
          </CardContent>
        </Card>

        <Card className="bg-background/75 backdrop-blur-sm shadow-xl border-primary/30">
          <CardContent className="p-4 md:p-8 text-center space-y-3 md:space-y-4">
            <h4 className="text-base md:text-2xl font-bold">Let&apos;s Build the Future of Fan-Fi Together</h4>
            <p className="text-muted-foreground text-xs md:text-base">Contact us to learn more about this investment opportunity</p>
            <div className="flex flex-col md:flex-row justify-center gap-2 md:gap-4 mt-4 md:mt-6">
              <Button size="sm" className="rounded-full px-4 md:px-8 md:h-11" asChild>
                <a href="mailto:manager@k-trendz.com">
                  <span className="mr-2">📧</span> Contact Us
                </a>
              </Button>
              <Button size="sm" variant="outline" className="rounded-full px-4 md:px-8 md:h-11" asChild>
                <a href="https://k-trendz.com" target="_blank" rel="noopener noreferrer">
                  <span className="mr-2">🌐</span> k-trendz.com
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    ),
  },
];

const PitchDeck2En = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const goToSlide = (index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlide(index);
    }
  };

  const nextSlide = () => goToSlide(currentSlide + 1);
  const prevSlide = () => goToSlide(currentSlide - 1);

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>K-TRENDZ Fan-Fi Pitch Deck - Investor Presentation</title>
        <meta name="description" content="K-TRENDZ Fan-Fi pitch deck - We financialize K-POP fandom activities into tradeable assets" />
      </Helmet>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
          <span className="text-sm text-muted-foreground font-medium">
            {currentSlide + 1} / {slides.length}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={prevSlide} disabled={currentSlide === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={nextSlide} disabled={currentSlide === slides.length - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Slide Content */}
      <main className="flex-1 pt-14 pb-20 relative overflow-hidden">
        {/* Background Image or Gradient */}
        {slide.bgImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${slide.bgImage})` }}
          >
            <div className="absolute inset-0 backdrop-blur-sm bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
          </div>
        ) : slide.id === "mechanism" || slide.id === "business-model" ? (
          <div className="absolute inset-0 bg-gradient-to-br from-pink-600 via-orange-500 to-amber-600" />
        ) : null}

        <div className="container mx-auto px-2 md:px-4 py-4 md:py-8 relative z-10">
          {/* Slide Header */}
          {slide.id !== "cover" && (
            <div className="mb-4 md:mb-8 text-center">
              {Icon && (
                <Icon
                  className={`w-8 h-8 md:w-12 md:h-12 mx-auto mb-2 md:mb-4 ${
                    slide.bgImage || slide.id === "mechanism" || slide.id === "business-model"
                      ? "text-white"
                      : "text-primary"
                  }`}
                />
              )}
              <h2
                className={`text-2xl md:text-5xl font-bold mb-1 md:mb-2 ${
                  slide.bgImage || slide.id === "mechanism" || slide.id === "business-model"
                    ? "text-white drop-shadow-lg"
                    : ""
                }`}
              >
                {slide.title}
              </h2>
              <p
                className={`text-sm md:text-xl ${
                  slide.bgImage || slide.id === "mechanism" || slide.id === "business-model"
                    ? "text-white/90 drop-shadow-md"
                    : "text-muted-foreground"
                }`}
              >
                {slide.subtitle}
              </p>
            </div>
          )}

          {/* Slide Body */}
          <div
            className={`max-w-5xl mx-auto ${
              slide.id === "cover" ? "flex items-center justify-center min-h-[calc(100vh-14rem)]" : ""
            }`}
          >
            {slide.content}
          </div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t py-2 md:py-4">
        <div className="container mx-auto px-4">
          <div className="flex justify-center gap-1.5 md:gap-2 flex-wrap">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition-all ${
                  index === currentSlide
                    ? "bg-primary w-6 md:w-8"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PitchDeck2En;
