import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Home, Music, Users, TrendingUp, DollarSign, Target, Rocket, Coins, Calendar, HandshakeIcon, Brain, Sparkles, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

// 이미지 imports
import coverHero from "@/assets/pitch/cover-hero.jpg";
import problemImg from "@/assets/pitch/problem.jpg";
import solutionImg from "@/assets/pitch/solution.jpg";
import marketImg from "@/assets/pitch/market.jpg";
import roadmapImg from "@/assets/pitch/roadmap.jpg";

// 슬라이드 데이터
const slides = [{
  id: "cover",
  title: "K-TRENDZ",
  subtitle: "Transparent Artist Support Platform",
  bgImage: coverHero,
  content: <div className="flex flex-col items-center justify-center h-full text-center space-y-4 md:space-y-8 px-2">
        <div className="space-y-2 md:space-y-4">
          <h1 className="text-4xl md:text-7xl font-bold text-white drop-shadow-2xl">
            K-TRENDZ
          </h1>
          <p className="text-lg md:text-3xl text-white/90 font-medium drop-shadow-lg">
            Transparent Artist Support Platform
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 text-sm md:text-xl text-white/90 drop-shadow-md">
          <span>K-Pop</span>
          <span className="text-primary">•</span>
          <span>K-Drama</span>
          <span className="text-primary">•</span>
          <span>K-Beauty</span>
          <span className="text-primary">•</span>
          <span>K-Food</span>
          <span className="text-primary">•</span>
          <span>K-Culture</span>
        </div>
        <div className="mt-4 md:mt-8 px-4 md:px-6 py-2 md:py-3 bg-primary/90 rounded-full shadow-2xl">
          <p className="text-sm md:text-lg font-medium text-white">
            Every Transaction On-Chain • 100% Transparent
          </p>
        </div>
      </div>
}, {
  id: "problem",
  title: "The Problem",
  subtitle: "Opaque Artist Support Platforms",
  icon: Target,
  bgImage: problemImg,
  content: <div className="space-y-4 md:space-y-8">
        <div className="grid md:grid-cols-2 gap-3 md:gap-6">
          <Card className="bg-background/95 backdrop-blur-sm border-destructive/30 shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-2xl">🔒</span>
                <h4 className="font-semibold text-sm md:text-lg">Hidden Fee Structures</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                Traditional platforms hide their fee structures — fans never know how much actually reaches artists
              </p>
            </CardContent>
          </Card>
          <Card className="bg-background/95 backdrop-blur-sm border-destructive/30 shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-2xl">❓</span>
                <h4 className="font-semibold text-sm md:text-lg">Unverifiable Fund Usage</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                No way to verify if fan donations are actually used for artist support activities
              </p>
            </CardContent>
          </Card>
          <Card className="bg-background/95 backdrop-blur-sm border-destructive/30 shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-2xl">💔</span>
                <h4 className="font-semibold text-sm md:text-lg">Trust Deficit</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                Fans have lost trust after numerous scandals involving misused crowdfunding and support funds
              </p>
            </CardContent>
          </Card>
          <Card className="bg-background/95 backdrop-blur-sm border-destructive/30 shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-2xl">📊</span>
                <h4 className="font-semibold text-sm md:text-lg">No Real-Time Tracking</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                Centralized systems prevent fans from tracking their contributions in real-time
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
}, {
  id: "solution",
  title: "Our Solution",
  subtitle: "On-Chain Transparent Artist Support",
  icon: Rocket,
  bgImage: solutionImg,
  content: <div className="space-y-4 md:space-y-8">
        <div className="text-center mb-4 md:mb-8">
          <Card className="bg-background/80 backdrop-blur-sm inline-block shadow-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-sm md:text-xl text-foreground">
                K-TRENDZ brings <span className="text-primary font-semibold">100% transparency</span> to artist support with blockchain
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <Card className="bg-background/80 backdrop-blur-sm border-primary/30 shadow-xl hover:scale-105 transition-transform">
            <CardContent className="p-3 md:p-6 text-center space-y-2 md:space-y-4">
              <div className="w-12 h-12 md:w-20 md:h-20 mx-auto bg-gradient-to-br from-primary to-orange-400 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl md:text-4xl">⛓️</span>
              </div>
              <h4 className="font-bold text-sm md:text-xl">On-Chain Records</h4>
              <p className="text-xs md:text-sm text-muted-foreground hidden md:block">
                Every transaction permanently recorded on Base Network — fully auditable by anyone
              </p>
            </CardContent>
          </Card>
          <Card className="bg-background/80 backdrop-blur-sm border-orange-500/30 shadow-xl hover:scale-105 transition-transform">
            <CardContent className="p-3 md:p-6 text-center space-y-2 md:space-y-4">
              <div className="w-12 h-12 md:w-20 md:h-20 mx-auto bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl md:text-4xl">🎤</span>
              </div>
              <h4 className="font-bold text-sm md:text-xl">Lightstick Tokens</h4>
              <p className="text-xs md:text-sm text-muted-foreground hidden md:block">
                Digital support tokens — 20% goes directly to Artist Fund for real-world activities
              </p>
            </CardContent>
          </Card>
          <Card className="bg-background/80 backdrop-blur-sm border-green-500/30 shadow-xl hover:scale-105 transition-transform">
            <CardContent className="p-3 md:p-6 text-center space-y-2 md:space-y-4">
              <div className="w-12 h-12 md:w-20 md:h-20 mx-auto bg-gradient-to-br from-green-500 to-emerald-400 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl md:text-4xl">🔍</span>
              </div>
              <h4 className="font-bold text-sm md:text-xl">Verifiable Funds</h4>
              <p className="text-xs md:text-sm text-muted-foreground hidden md:block">
                Artist Fund wallet balance publicly visible — verify exactly how much has been collected
              </p>
            </CardContent>
          </Card>
          <Card className="bg-background/80 backdrop-blur-sm border-violet-500/30 shadow-xl hover:scale-105 transition-transform">
            <CardContent className="p-3 md:p-6 text-center space-y-2 md:space-y-4">
              <div className="w-12 h-12 md:w-20 md:h-20 mx-auto bg-gradient-to-br from-violet-500 to-purple-400 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl md:text-4xl">🤖</span>
              </div>
              <h4 className="font-bold text-sm md:text-xl">Smart Contract</h4>
              <p className="text-xs md:text-sm text-muted-foreground hidden md:block">
                Automatic fund distribution — no human intervention, no manipulation possible
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
}, {
  id: "how-it-works",
  title: "How It Works",
  subtitle: "Transparent Artist Support Flow",
  icon: Music,
  content: <div className="space-y-4 md:space-y-8">
        <Card className="bg-gradient-to-r from-gray-900/90 via-gray-800/90 to-gray-900/90 border-primary/30 shadow-xl">
          <CardContent className="p-4 md:p-8">
            <div className="text-center space-y-4 md:space-y-6">
              <h4 className="text-lg md:text-2xl font-bold text-white">On-Chain Support Flow</h4>
              {/* Desktop: flex row */}
              <div className="hidden sm:flex items-center justify-center gap-4 text-base">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border-2 border-primary shadow-lg">
                    <span className="text-2xl">💳</span>
                  </div>
                  <span className="font-medium text-white">Fan Purchases</span>
                </div>
                <ChevronRight className="w-8 h-8 text-primary" />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border-2 border-orange-500 shadow-lg">
                    <span className="text-2xl">🤖</span>
                  </div>
                  <span className="font-medium text-white">Smart Contract</span>
                </div>
                <ChevronRight className="w-8 h-8 text-primary" />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border-2 border-pink-500 shadow-lg">
                    <span className="text-2xl">💰</span>
                  </div>
                  <span className="font-medium text-white">20% Artist Fund</span>
                </div>
                <ChevronRight className="w-8 h-8 text-primary" />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <span className="font-medium text-primary">Real Support!</span>
                </div>
              </div>
              {/* Mobile: 2x2 grid */}
              <div className="grid grid-cols-2 gap-4 sm:hidden">
                <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border-2 border-primary shadow-lg">
                    <span className="text-xl">💳</span>
                  </div>
                  <span className="font-medium text-white text-xs text-center">Fan Purchases</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border-2 border-orange-500 shadow-lg">
                    <span className="text-xl">🤖</span>
                  </div>
                  <span className="font-medium text-white text-xs text-center">Smart Contract</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border-2 border-pink-500 shadow-lg">
                    <span className="text-xl">💰</span>
                  </div>
                  <span className="font-medium text-white text-xs text-center">20% Artist Fund</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-xl">🎯</span>
                  </div>
                  <span className="font-medium text-primary text-xs text-center">Real Support!</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="grid md:grid-cols-2 gap-3 md:gap-6">
          <Card className="shadow-xl hover:shadow-2xl transition-shadow">
            <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-pink-500 to-rose-400 rounded-xl flex items-center justify-center">
                  <span className="text-xl md:text-2xl">💜</span>
                </div>
                <h4 className="font-bold text-lg md:text-xl">For Fans</h4>
              </div>
              <ul className="space-y-2 md:space-y-3 text-muted-foreground text-sm md:text-base">
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs md:text-sm">✓</span>
                  <span>20% of every purchase supports your artist</span>
                </li>
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs md:text-sm">✓</span>
                  <span>Track your contributions on-chain anytime</span>
                </li>
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs md:text-sm">✓</span>
                  <span>Verify Artist Fund balance in real-time</span>
                </li>
              </ul>
            </CardContent>
          </Card>
          <Card className="shadow-xl hover:shadow-2xl transition-shadow">
            <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center">
                  <span className="text-xl md:text-2xl">🎤</span>
                </div>
                <h4 className="font-bold text-lg md:text-xl">For Artists</h4>
              </div>
              <ul className="space-y-2 md:space-y-3 text-muted-foreground text-sm md:text-base">
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs md:text-sm">✓</span>
                  <span>Receive real support: coffee trucks, supplies, events</span>
                </li>
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs md:text-sm">✓</span>
                  <span>All support activities publicly documented</span>
                </li>
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs md:text-sm">✓</span>
                  <span>Build trust with transparent fan support</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
}, {
  id: "market",
  title: "Market Opportunity",
  subtitle: "K-Culture is a Global Phenomenon",
  icon: TrendingUp,
  bgImage: marketImg,
  content: <div className="space-y-4 md:space-y-8">
        <div className="grid grid-cols-3 gap-2 md:gap-6">
          <Card className="text-center bg-background/85 backdrop-blur-sm shadow-xl hover:scale-105 transition-transform">
            <CardContent className="p-3 md:p-8 space-y-1 md:space-y-2">
              <p className="text-xl md:text-6xl font-bold bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">$12.4B</p>
              <p className="text-muted-foreground font-medium text-[10px] md:text-base">K-Pop Market Size (2024)</p>
            </CardContent>
          </Card>
          <Card className="text-center bg-background/85 backdrop-blur-sm shadow-xl hover:scale-105 transition-transform">
            <CardContent className="p-3 md:p-8 space-y-1 md:space-y-2">
              <p className="text-xl md:text-6xl font-bold bg-gradient-to-r from-pink-500 to-rose-400 bg-clip-text text-transparent">180M+</p>
              <p className="text-muted-foreground font-medium text-[10px] md:text-base">Global K-Pop Fans</p>
            </CardContent>
          </Card>
          <Card className="text-center bg-background/85 backdrop-blur-sm shadow-xl hover:scale-105 transition-transform">
            <CardContent className="p-3 md:p-8 space-y-1 md:space-y-2">
              <p className="text-xl md:text-6xl font-bold bg-gradient-to-r from-violet-500 to-purple-400 bg-clip-text text-transparent">$2.1B</p>
              <p className="text-muted-foreground font-medium text-[10px] md:text-base">Fan Merchandise Spend</p>
            </CardContent>
          </Card>
        </div>
        
        <Card className="bg-background/85 backdrop-blur-sm shadow-xl">
          <CardContent className="p-3 md:p-6">
            <h4 className="font-bold text-base md:text-xl mb-3 md:mb-4 flex items-center gap-2">
              <span className="text-xl md:text-2xl">🌍</span> Why K-Culture?
            </h4>
            <div className="grid grid-cols-2 gap-2 md:gap-4 text-muted-foreground text-xs md:text-base">
              <div className="flex items-center gap-2 md:gap-3 bg-primary/10 p-2 md:p-3 rounded-lg">
                <span className="text-lg md:text-2xl">🔥</span>
                <span>Most engaged fan communities globally</span>
              </div>
              <div className="flex items-center gap-2 md:gap-3 bg-primary/10 p-2 md:p-3 rounded-lg">
                <span className="text-lg md:text-2xl">💰</span>
                <span>High willingness to spend on idols</span>
              </div>
              <div className="flex items-center gap-2 md:gap-3 bg-primary/10 p-2 md:p-3 rounded-lg">
                <span className="text-lg md:text-2xl">📱</span>
                <span>Tech-savvy, digital-native audience</span>
              </div>
              <div className="flex items-center gap-2 md:gap-3 bg-primary/10 p-2 md:p-3 rounded-lg">
                <span className="text-lg md:text-2xl">⛓️</span>
                <span>Growing Web3 adoption in Asia</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
}, {
  id: "business-model",
  title: "Business Model",
  subtitle: "Transparent Fee Distribution",
  icon: DollarSign,
  content: <div className="space-y-4 md:space-y-8">
        <div className="grid md:grid-cols-2 gap-3 md:gap-6">
          <Card className="bg-gradient-to-br from-primary/10 to-orange-500/10 border-primary/30 shadow-xl">
            <CardContent className="p-4 md:p-8 space-y-3 md:space-y-6">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-primary to-orange-400 rounded-xl flex items-center justify-center">
                  <span className="text-xl md:text-3xl">🎤</span>
                </div>
                <h4 className="font-bold text-base md:text-xl">Lightstick Fee Distribution</h4>
              </div>
              <div className="space-y-2 md:space-y-4">
                <div className="flex justify-between items-center p-2 md:p-3 bg-background/50 rounded-lg">
                  <span className="text-muted-foreground text-sm md:text-base">Artist Fund</span>
                  <span className="font-bold text-xl md:text-2xl text-pink-500">20%</span>
                </div>
                <div className="text-xs md:text-sm text-muted-foreground pl-2 md:pl-4">
                  <p className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-pink-500 rounded-full"></span>
                    Real-world artist support activities
                  </p>
                </div>
                <div className="flex justify-between items-center p-2 md:p-3 bg-background/50 rounded-lg">
                  <span className="text-muted-foreground text-sm md:text-base">Platform Fee</span>
                  <span className="font-bold text-xl md:text-2xl text-primary">10%</span>
                </div>
                <div className="flex justify-between items-center p-2 md:p-3 bg-background/50 rounded-lg">
                  <span className="text-muted-foreground text-sm md:text-base">Liquidity Reserve</span>
                  <span className="font-bold text-xl md:text-2xl text-green-500">70%</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-xl">
            <CardContent className="p-4 md:p-8 space-y-3 md:space-y-6">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-violet-500 to-purple-400 rounded-xl flex items-center justify-center">
                  <span className="text-xl md:text-3xl">⛓️</span>
                </div>
                <h4 className="font-bold text-base md:text-xl">On-Chain Transparency</h4>
              </div>
              <div className="space-y-2 md:space-y-4 text-muted-foreground text-sm md:text-base">
                <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-muted/50 rounded-lg">
                  <span className="text-lg md:text-2xl">🔍</span>
                  <span>All transactions viewable on BaseScan</span>
                </div>
                <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-muted/50 rounded-lg">
                  <span className="text-lg md:text-2xl">💼</span>
                  <span>Artist Fund wallet publicly auditable</span>
                </div>
                <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-muted/50 rounded-lg">
                  <span className="text-lg md:text-2xl">🤖</span>
                  <span>Smart contract auto-distribution</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Card className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 shadow-xl">
          <CardContent className="p-3 md:p-6 text-center flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
            <span className="text-2xl md:text-4xl">✅</span>
            <p className="text-sm md:text-xl">
              <span className="font-bold text-green-500">100% Verifiable</span> — Every dollar tracked from fan to artist on Base Network
            </p>
          </CardContent>
        </Card>
      </div>
}, {
  id: "ai-data",
  title: "AI Data Economy",
  subtitle: "Semantic Data for AI Training",
  icon: Brain,
  bgGradient: "bg-gradient-to-br from-violet-900/80 via-purple-800/70 to-indigo-900/80",
  content: <div className="space-y-4 md:space-y-8">
        <div className="text-center mb-4 md:mb-8">
          <Card className="bg-background/80 backdrop-blur-sm inline-block shadow-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-sm md:text-xl text-foreground">
                Transform fan-generated content into <span className="text-primary font-semibold">valuable AI training data</span>
              </p>
            </CardContent>
          </Card>
        </div>
        
        <Card className="bg-gradient-to-r from-gray-900/90 via-gray-800/90 to-gray-900/90 border-violet-500/30 shadow-xl">
          <CardContent className="p-4 md:p-8">
            <div className="text-center space-y-4 md:space-y-6">
              <h4 className="text-lg md:text-2xl font-bold text-white">Semantic Data Flow</h4>
              {/* Desktop: flex row */}
              <div className="hidden sm:flex items-center justify-center gap-4 text-base">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border-2 border-violet-500 shadow-lg">
                    <span className="text-2xl">📝</span>
                  </div>
                  <span className="font-medium text-white">Users Create Content</span>
                </div>
                <ChevronRight className="w-8 h-8 text-violet-500" />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border-2 border-purple-500 shadow-lg">
                    <span className="text-2xl">🏗️</span>
                  </div>
                  <span className="font-medium text-white">Structured Schema</span>
                </div>
                <ChevronRight className="w-8 h-8 text-violet-500" />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border-2 border-pink-500 shadow-lg">
                    <span className="text-2xl">🤖</span>
                  </div>
                  <span className="font-medium text-white">AI Training Data</span>
                </div>
                <ChevronRight className="w-8 h-8 text-violet-500" />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-violet-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-2xl">🪙</span>
                  </div>
                  <span className="font-medium text-violet-400">Token Rewards!</span>
                </div>
              </div>
              {/* Mobile: 2x2 grid */}
              <div className="grid grid-cols-2 gap-4 sm:hidden">
                <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border-2 border-violet-500 shadow-lg">
                    <span className="text-xl">📝</span>
                  </div>
                  <span className="font-medium text-white text-xs text-center">Users Create Content</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border-2 border-purple-500 shadow-lg">
                    <span className="text-xl">🏗️</span>
                  </div>
                  <span className="font-medium text-white text-xs text-center">Structured Schema</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border-2 border-pink-500 shadow-lg">
                    <span className="text-xl">🤖</span>
                  </div>
                  <span className="font-medium text-white text-xs text-center">AI Training Data</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-violet-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-xl">🪙</span>
                  </div>
                  <span className="font-medium text-violet-400 text-xs text-center">Token Rewards!</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-3 md:gap-6">
          <Card className="shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-violet-500 to-purple-400 rounded-xl flex items-center justify-center">
                  <span className="text-xl md:text-2xl">📊</span>
                </div>
                <h4 className="font-bold text-base md:text-xl">Semantic Data Structure</h4>
              </div>
              <ul className="space-y-2 md:space-y-3 text-muted-foreground text-sm md:text-base">
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-500 text-xs md:text-sm">✓</span>
                  <span>K-Pop groups, members, discography</span>
                </li>
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-500 text-xs md:text-sm">✓</span>
                  <span>K-Drama cast, synopsis, ratings</span>
                </li>
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-500 text-xs md:text-sm">✓</span>
                  <span>K-Culture events, trends, facts</span>
                </li>
              </ul>
            </CardContent>
          </Card>
          <Card className="shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary to-orange-400 rounded-xl flex items-center justify-center">
                  <span className="text-xl md:text-2xl">💰</span>
                </div>
                <h4 className="font-bold text-base md:text-xl">Reward Mechanism</h4>
              </div>
              <ul className="space-y-2 md:space-y-3 text-muted-foreground text-sm md:text-base">
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs md:text-sm">✓</span>
                  <span>KTNZ tokens for quality content</span>
                </li>
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs md:text-sm">✓</span>
                  <span>Bonus for verified/popular data</span>
                </li>
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs md:text-sm">✓</span>
                  <span>Long-term royalties from AI usage</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
        
        <Card className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-500/30 shadow-xl">
          <CardContent className="p-3 md:p-6 text-center flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
            <span className="text-2xl md:text-4xl">🧠</span>
            <p className="text-sm md:text-xl">
              <span className="font-bold text-violet-500">First K-Culture AI Dataset</span> — Fans contribute, AI learns, everyone benefits
            </p>
          </CardContent>
        </Card>
      </div>
}, {
  id: "one-more-thing",
  title: "One More Thing!",
  subtitle: "Another Powerful Engine",
  icon: Sparkles,
  bgGradient: "bg-gradient-to-br from-gray-900 via-black to-gray-900",
  content: <div className="flex flex-col items-center justify-center h-full text-center space-y-6 md:space-y-12 px-4">
        <div className="space-y-4 md:space-y-6">
          <p className="text-lg md:text-2xl text-white/60 font-medium tracking-widest uppercase">
            And...
          </p>
          <h1 className="text-4xl md:text-8xl font-bold text-white drop-shadow-2xl">
            One More Thing!
          </h1>
          <p className="text-lg md:text-3xl text-white/80 font-medium drop-shadow-lg">
            Another Powerful Engine
          </p>
        </div>
      </div>
}, {
  id: "fan-challenges",
  title: "Fan Challenges",
  subtitle: "Prediction Market for K-Culture",
  icon: Trophy,
  bgGradient: "bg-gradient-to-br from-amber-900/80 via-orange-800/70 to-yellow-900/80",
  content: <div className="space-y-4 md:space-y-8">
        <div className="text-center mb-4 md:mb-8">
          <Card className="bg-background/80 backdrop-blur-sm inline-block shadow-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-sm md:text-xl text-foreground">
                Turn fan knowledge into <span className="text-primary font-semibold">predictive insights</span> and earn rewards
              </p>
            </CardContent>
          </Card>
        </div>
        
        <Card className="bg-gradient-to-r from-gray-900/90 via-gray-800/90 to-gray-900/90 border-amber-500/30 shadow-xl">
          <CardContent className="p-4 md:p-8">
            <div className="text-center space-y-4 md:space-y-6">
              <h4 className="text-lg md:text-2xl font-bold text-white">How Fan Challenges Work</h4>
              {/* Desktop: flex row */}
              <div className="hidden sm:flex items-center justify-center gap-4 text-base">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border-2 border-amber-500 shadow-lg">
                    <span className="text-2xl">❓</span>
                  </div>
                  <span className="font-medium text-white">Question Posted</span>
                </div>
                <ChevronRight className="w-8 h-8 text-amber-500" />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border-2 border-orange-500 shadow-lg">
                    <span className="text-2xl">🎟️</span>
                  </div>
                  <span className="font-medium text-white">Fans Submit</span>
                </div>
                <ChevronRight className="w-8 h-8 text-amber-500" />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border-2 border-yellow-500 shadow-lg">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <span className="font-medium text-white">Answer Revealed</span>
                </div>
                <ChevronRight className="w-8 h-8 text-amber-500" />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-2xl">🏆</span>
                  </div>
                  <span className="font-medium text-amber-400">Winners Rewarded!</span>
                </div>
              </div>
              {/* Mobile: 2x2 grid */}
              <div className="grid grid-cols-2 gap-4 sm:hidden">
                <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border-2 border-amber-500 shadow-lg">
                    <span className="text-xl">❓</span>
                  </div>
                  <span className="font-medium text-white text-xs text-center">Question Posted</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border-2 border-orange-500 shadow-lg">
                    <span className="text-xl">🎟️</span>
                  </div>
                  <span className="font-medium text-white text-xs text-center">Fans Submit</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border-2 border-yellow-500 shadow-lg">
                    <span className="text-xl">🎯</span>
                  </div>
                  <span className="font-medium text-white text-xs text-center">Answer Revealed</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-xl">🏆</span>
                  </div>
                  <span className="font-medium text-amber-400 text-xs text-center">Winners Rewarded!</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-3 md:gap-6">
          <Card className="shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-amber-500 to-orange-400 rounded-xl flex items-center justify-center">
                  <span className="text-xl md:text-2xl">🔮</span>
                </div>
                <h4 className="font-bold text-base md:text-xl">Prediction Market</h4>
              </div>
              <ul className="space-y-2 md:space-y-3 text-muted-foreground text-sm md:text-base">
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-xs md:text-sm">✓</span>
                  <span>Predict comeback dates, chart rankings</span>
                </li>
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-xs md:text-sm">✓</span>
                  <span>Forecast award show winners</span>
                </li>
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-xs md:text-sm">✓</span>
                  <span>Guess song lyrics, album concepts</span>
                </li>
              </ul>
            </CardContent>
          </Card>
          <Card className="shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary to-orange-400 rounded-xl flex items-center justify-center">
                  <span className="text-xl md:text-2xl">🗳️</span>
                </div>
                <h4 className="font-bold text-base md:text-xl">Fan Governance</h4>
              </div>
              <ul className="space-y-2 md:space-y-3 text-muted-foreground text-sm md:text-base">
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs md:text-sm">✓</span>
                  <span>Lightstick holders get bonus entries</span>
                </li>
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs md:text-sm">✓</span>
                  <span>Community fund contributions</span>
                </li>
                <li className="flex items-center gap-2 md:gap-3">
                  <span className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs md:text-sm">✓</span>
                  <span>Transparent on-chain winner selection</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
        
        <Card className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/30 shadow-xl">
          <CardContent className="p-3 md:p-6 text-center flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
            <span className="text-2xl md:text-4xl">🎯</span>
            <p className="text-sm md:text-xl">
              <span className="font-bold text-amber-500">Gamified Engagement</span> — Fans compete, predict, and earn USDC prizes
            </p>
          </CardContent>
        </Card>
      </div>
}, {
  id: "tokenomics",
  title: "Token Economics",
  subtitle: "KTNZ Utility Token",
  icon: Coins,
  content: <div className="space-y-8">
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-r from-gray-900/90 via-gray-800/90 to-gray-900/90 border-primary/30 shadow-xl">
            <CardContent className="p-6 text-center">
              <p className="text-lg text-white/70 mb-2">Total Supply</p>
              <p className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
                5,000,000,000 KTNZ
              </p>
              <p className="text-sm text-white/60 mt-2">Hard Cap - Limited Supply</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-gray-900/90 via-gray-800/90 to-gray-900/90 border-green-500/30 shadow-xl">
            <CardContent className="p-6 text-center">
              <p className="text-lg text-white/70 mb-2">Initial Issuance (FDV)</p>
              <p className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                1,500,000,000 KTNZ
              </p>
              <p className="text-sm text-white/60 mt-2">30% of Total Supply</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="shadow-xl">
            <CardContent className="p-6 space-y-4">
              <h4 className="font-bold text-xl flex items-center gap-2">
                <span className="text-2xl">📊</span> Distribution
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                    Community Mining
                  </span>
                  <span className="font-bold text-xl text-primary">70%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    Team & Advisors
                  </span>
                  <span className="font-bold text-lg">10%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
                    Early Investors
                  </span>
                  <span className="font-bold text-lg">8%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Liquidity
                  </span>
                  <span className="font-bold text-lg">7%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-violet-500 rounded-full"></div>
                    Treasury Reserve
                  </span>
                  <span className="font-bold text-lg">5%</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-xl">
            <CardContent className="p-6 space-y-4">
              <h4 className="font-bold text-xl flex items-center gap-2">
                <span className="text-2xl">🛠️</span> Token Utility
              </h4>
              <div className="space-y-4 text-muted-foreground">
                <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg">
                  <span className="text-2xl">🗳️</span>
                  <div>
                    <p className="font-medium text-foreground">Daily Voting Rewards</p>
                    <p className="text-sm">13 votes = KTNZ tokens</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <span className="text-2xl">🔄</span>
                  <div>
                    <p className="font-medium text-foreground">Exchange for Stars</p>
                    <p className="text-sm">Convert to in-app currency</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <span className="text-2xl">🏛️</span>
                  <div>
                    <p className="font-medium text-foreground">Governance (Future)</p>
                    <p className="text-sm">Vote on platform decisions</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <span className="text-2xl">👑</span>
                  <div>
                    <p className="font-medium text-foreground">Premium Access (Future)</p>
                    <p className="text-sm">Exclusive features for holders</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
}, {
  id: "traction",
  title: "Traction",
  subtitle: "Early Momentum",
  icon: Users,
  content: <div className="space-y-4 md:space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <Card className="text-center shadow-xl hover:scale-105 transition-transform bg-gradient-to-br from-primary/10 to-transparent">
            <CardContent className="p-3 md:p-6">
              <div className="w-10 h-10 md:w-16 md:h-16 mx-auto mb-2 md:mb-4 bg-gradient-to-br from-primary to-orange-400 rounded-xl md:rounded-2xl flex items-center justify-center">
                <span className="text-xl md:text-3xl">📄</span>
              </div>
              <p className="text-2xl md:text-5xl font-bold text-primary">5,000+</p>
              <p className="text-[10px] md:text-sm text-muted-foreground font-medium">Fan Pages Created</p>
            </CardContent>
          </Card>
          <Card className="text-center shadow-xl hover:scale-105 transition-transform bg-gradient-to-br from-pink-500/10 to-transparent">
            <CardContent className="p-3 md:p-6">
              <div className="w-10 h-10 md:w-16 md:h-16 mx-auto mb-2 md:mb-4 bg-gradient-to-br from-pink-500 to-rose-400 rounded-xl md:rounded-2xl flex items-center justify-center">
                <span className="text-xl md:text-3xl">👥</span>
              </div>
              <p className="text-2xl md:text-5xl font-bold text-pink-500">10,000+</p>
              <p className="text-[10px] md:text-sm text-muted-foreground font-medium">Registered Users</p>
            </CardContent>
          </Card>
          <Card className="text-center shadow-xl hover:scale-105 transition-transform bg-gradient-to-br from-orange-500/10 to-transparent">
            <CardContent className="p-3 md:p-6">
              <div className="w-10 h-10 md:w-16 md:h-16 mx-auto mb-2 md:mb-4 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl md:rounded-2xl flex items-center justify-center">
                <span className="text-xl md:text-3xl">🎤</span>
              </div>
              <p className="text-2xl md:text-5xl font-bold text-orange-500">50+</p>
              <p className="text-[10px] md:text-sm text-muted-foreground font-medium">Lightsticks Issued</p>
            </CardContent>
          </Card>
          <Card className="text-center shadow-xl hover:scale-105 transition-transform bg-gradient-to-br from-green-500/10 to-transparent">
            <CardContent className="p-3 md:p-6">
              <div className="w-10 h-10 md:w-16 md:h-16 mx-auto mb-2 md:mb-4 bg-gradient-to-br from-green-500 to-emerald-400 rounded-xl md:rounded-2xl flex items-center justify-center">
                <span className="text-xl md:text-3xl">🌐</span>
              </div>
              <p className="text-2xl md:text-5xl font-bold text-green-500">Live</p>
              <p className="text-[10px] md:text-sm text-muted-foreground font-medium">On Base Mainnet</p>
            </CardContent>
          </Card>
        </div>
        
        <Card className="shadow-xl">
          <CardContent className="p-6">
            <h4 className="font-bold text-xl mb-6 flex items-center gap-2">
              <span className="text-2xl">🏆</span> Key Achievements
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/10 to-transparent rounded-xl">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">⛓️</span>
                </div>
                <div>
                  <p className="font-semibold">Smart Contract Deployed</p>
                  <p className="text-sm text-muted-foreground">ERC-1155 on Base Network</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-pink-500/10 to-transparent rounded-xl">
                <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">💳</span>
                </div>
                <div>
                  <p className="font-semibold">Fiat Payment Integration</p>
                  <p className="text-sm text-muted-foreground">Stripe checkout enabled</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-orange-500/10 to-transparent rounded-xl">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🇰🇷</span>
                </div>
                <div>
                  <p className="font-semibold">K-Culture Categories</p>
                  <p className="text-sm text-muted-foreground">K-Pop, K-Drama, K-Food, K-Beauty</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-green-500/10 to-transparent rounded-xl">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🪙</span>
                </div>
                <div>
                  <p className="font-semibold">KTNZ Token Launched</p>
                  <p className="text-sm text-muted-foreground">1.5B initial supply minted</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
}, {
  id: "roadmap",
  title: "Roadmap",
  subtitle: "Building the Future of Fandom",
  icon: Calendar,
  bgImage: roadmapImg,
  content: <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-background/85 backdrop-blur-sm shadow-xl border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                  <span className="text-green-500 font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg">Q4 2025</h4>
                  <p className="text-sm text-green-500 font-medium">Completed</p>
                </div>
              </div>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Platform MVP Launch
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Lightstick Token System
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Stripe Integration
                </li>
              </ul>
            </CardContent>
          </Card>
          
          <Card className="bg-background/85 backdrop-blur-sm shadow-xl border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                  <span className="text-primary font-bold">→</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg">Q1 2026</h4>
                  <p className="text-sm text-primary font-medium">In Progress</p>
                </div>
              </div>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-primary">•</span>
                  Community Growth Campaign
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">•</span>
                  Mobile App Development
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">•</span>
                  Creator Partnership Program
                </li>
              </ul>
            </CardContent>
          </Card>
          
          <Card className="bg-background/85 backdrop-blur-sm shadow-xl border-l-4 border-l-orange-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <span className="text-orange-500 font-bold">Q2</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg">Q2 2026</h4>
                  <p className="text-sm text-orange-500 font-medium">Planned</p>
                </div>
              </div>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-orange-500">○</span>
                  KTNZ Token Exchange Listing
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-500">○</span>
                  Advanced Analytics Dashboard
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-500">○</span>
                  Multi-language Support
                </li>
              </ul>
            </CardContent>
          </Card>
          
          <Card className="bg-background/85 backdrop-blur-sm shadow-xl border-l-4 border-l-violet-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-violet-500/20 rounded-full flex items-center justify-center">
                  <span className="text-violet-500 font-bold">Q3+</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg">Q3-Q4 2026</h4>
                  <p className="text-sm text-violet-500 font-medium">Vision</p>
                </div>
              </div>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-violet-500">○</span>
                  DAO Governance Launch
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-violet-500">○</span>
                  Artist Official Partnerships
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-violet-500">○</span>
                  Global Market Expansion
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
}, {
  id: "ask",
  title: "The Ask",
  subtitle: "Join Our Journey",
  icon: HandshakeIcon,
  bgGradient: "bg-gradient-to-r from-gray-900/90 via-gray-800/90 to-gray-900/90",
  content: <div className="space-y-4 md:space-y-8">
        <Card className="bg-background/75 backdrop-blur-sm border-primary/30 shadow-2xl">
          <CardContent className="p-4 md:p-12 text-center space-y-2 md:space-y-4">
            <h3 className="text-xl md:text-4xl font-bold">Seed Round</h3>
            <p className="text-3xl md:text-6xl font-bold bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
              $300,000
            </p>
            <p className="text-sm md:text-xl text-muted-foreground">
              SAFE with 20% discount at Series A
            </p>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-3 gap-2 md:gap-6">
          <Card className="bg-background/75 backdrop-blur-sm shadow-xl hover:scale-105 transition-transform">
            <CardContent className="p-3 md:p-6 text-center space-y-2 md:space-y-4">
              <div className="w-10 h-10 md:w-16 md:h-16 mx-auto bg-gradient-to-br from-primary to-orange-400 rounded-xl md:rounded-2xl flex items-center justify-center">
                <span className="text-xl md:text-3xl">💻</span>
              </div>
              <h4 className="font-bold text-xs md:text-lg">Product Development</h4>
              <p className="text-xl md:text-3xl font-bold text-primary">30%</p>
              <p className="text-[10px] md:text-sm text-muted-foreground hidden md:block">Mobile app, features, infrastructure</p>
            </CardContent>
          </Card>
          <Card className="bg-background/75 backdrop-blur-sm shadow-xl hover:scale-105 transition-transform">
            <CardContent className="p-3 md:p-6 text-center space-y-2 md:space-y-4">
              <div className="w-10 h-10 md:w-16 md:h-16 mx-auto bg-gradient-to-br from-pink-500 to-rose-400 rounded-xl md:rounded-2xl flex items-center justify-center">
                <span className="text-xl md:text-3xl">📢</span>
              </div>
              <h4 className="font-bold text-xs md:text-lg">Marketing & Growth</h4>
              <p className="text-xl md:text-3xl font-bold text-pink-500">45%</p>
              <p className="text-[10px] md:text-sm text-muted-foreground hidden md:block">User acquisition, partnerships</p>
            </CardContent>
          </Card>
          <Card className="bg-background/75 backdrop-blur-sm shadow-xl hover:scale-105 transition-transform">
            <CardContent className="p-3 md:p-6 text-center space-y-2 md:space-y-4">
              <div className="w-10 h-10 md:w-16 md:h-16 mx-auto bg-gradient-to-br from-violet-500 to-purple-400 rounded-xl md:rounded-2xl flex items-center justify-center">
                <span className="text-xl md:text-3xl">⚙️</span>
              </div>
              <h4 className="font-bold text-xs md:text-lg">Operations</h4>
              <p className="text-xl md:text-3xl font-bold text-violet-500">25%</p>
              <p className="text-[10px] md:text-sm text-muted-foreground hidden md:block">Team, legal, compliance</p>
            </CardContent>
          </Card>
        </div>
        
        <Card className="bg-background/75 backdrop-blur-sm shadow-xl border-primary/30">
          <CardContent className="p-4 md:p-8 text-center space-y-3 md:space-y-4">
            <h4 className="text-base md:text-2xl font-bold">Let's Build the Future of K-Culture Fandom Together</h4>
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
}];
const PitchDeck = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const goToSlide = (index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlide(index);
    }
  };
  const nextSlide = () => goToSlide(currentSlide + 1);
  const prevSlide = () => goToSlide(currentSlide - 1);
  const slide = slides[currentSlide];
  const Icon = slide.icon;

  // 모바일: 세로 스크롤 레이아웃
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <Helmet>
          <title>K-TRENDZ Pitch Deck - Transparent Artist Support Platform</title>
          <meta name="description" content="K-TRENDZ investor pitch deck - On-chain transparent artist support platform for K-Culture" />
        </Helmet>

        <div className="flex flex-col">
          {slides.map((slideItem, index) => {
            const SlideIcon = slideItem.icon;
            return (
              <div key={index} className="min-h-screen relative border-b-4 border-primary/20 last:border-b-0">
                {/* Background Image or Gradient */}
                {slideItem.bgImage ? (
                  <div className="absolute inset-0 bg-cover bg-center" style={{
                    backgroundImage: `url(${slideItem.bgImage})`
                  }}>
                    <div className={`absolute inset-0 backdrop-blur-sm ${slideItem.id === 'cover' || slideItem.id === 'problem' || slideItem.id === 'solution' || slideItem.id === 'market' || slideItem.id === 'roadmap' ? 'bg-gradient-to-b from-black/60 via-black/50 to-black/70' : 'bg-background/70'}`} />
                  </div>
                ) : (slideItem.id === 'how-it-works' || slideItem.id === 'business-model' || slideItem.id === 'tokenomics' || slideItem.id === 'ask') ? (
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-600 via-orange-500 to-amber-600" />
                ) : slideItem.id === 'traction' ? (
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-500 via-cyan-500 to-violet-600" />
                ) : slideItem.id === 'ai-data' && (
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900" />
                )}

                <div className="container mx-auto px-4 py-8 relative z-10">
                  {/* Slide Header */}
                  {slideItem.id !== 'cover' && (
                    <div className="mb-6 text-center">
                      {SlideIcon && <SlideIcon className={`w-10 h-10 mx-auto mb-3 ${slideItem.id === 'how-it-works' || slideItem.id === 'business-model' || slideItem.id === 'tokenomics' || slideItem.id === 'traction' || slideItem.id === 'roadmap' || slideItem.id === 'ask' || slideItem.id === 'ai-data' ? 'text-white' : 'text-primary'}`} />}
                      <h2 className={`text-2xl font-bold mb-1 ${slideItem.bgImage || slideItem.id === 'how-it-works' || slideItem.id === 'business-model' || slideItem.id === 'tokenomics' || slideItem.id === 'traction' || slideItem.id === 'ask' || slideItem.id === 'ai-data' ? 'text-white drop-shadow-lg' : ''}`}>
                        {slideItem.title}
                      </h2>
                      <p className={`text-sm ${slideItem.bgImage || slideItem.id === 'how-it-works' || slideItem.id === 'business-model' || slideItem.id === 'tokenomics' || slideItem.id === 'traction' || slideItem.id === 'ask' || slideItem.id === 'ai-data' ? 'text-white/90 drop-shadow-md' : 'text-muted-foreground'}`}>
                        {slideItem.subtitle}
                      </p>
                    </div>
                  )}

                  {/* Slide Body */}
                  <div className={`max-w-5xl mx-auto ${slideItem.id === 'cover' ? 'flex items-center justify-center min-h-[80vh]' : ''}`}>
                    {slideItem.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 데스크톱: 기존 네비게이션 레이아웃
  return <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>K-TRENDZ Pitch Deck - Investor Presentation</title>
        <meta name="description" content="K-TRENDZ investor pitch deck - The Fan Page Economy Platform for K-Culture" />
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
        {slide.bgImage ? <div className="absolute inset-0 bg-cover bg-center" style={{
        backgroundImage: `url(${slide.bgImage})`
      }}>
            <div className={`absolute inset-0 backdrop-blur-sm ${slide.id === 'cover' || slide.id === 'problem' || slide.id === 'solution' || slide.id === 'market' || slide.id === 'roadmap' ? 'bg-gradient-to-b from-black/60 via-black/50 to-black/70' : 'bg-background/70'}`} />
          </div> : (slide.id === 'how-it-works' || slide.id === 'business-model' || slide.id === 'tokenomics' || slide.id === 'ask') ? <div className="absolute inset-0 bg-gradient-to-br from-pink-600 via-orange-500 to-amber-600" /> : slide.id === 'traction' ? <div className="absolute inset-0 bg-gradient-to-br from-teal-500 via-cyan-500 to-violet-600" /> : slide.id === 'ai-data' && <div className="absolute inset-0 bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900" />}
        
        <div className="container mx-auto px-4 py-8 relative z-10">
          {/* Slide Header */}
          {slide.id !== 'cover' && (
            <div className="mb-8 text-center">
              {Icon && <Icon className={`w-12 h-12 mx-auto mb-4 ${slide.id === 'how-it-works' || slide.id === 'business-model' || slide.id === 'tokenomics' || slide.id === 'traction' || slide.id === 'roadmap' || slide.id === 'ask' || slide.id === 'ai-data' ? 'text-white' : 'text-primary'}`} />}
              <h2 className={`text-5xl font-bold mb-2 ${slide.bgImage || slide.id === 'how-it-works' || slide.id === 'business-model' || slide.id === 'tokenomics' || slide.id === 'traction' || slide.id === 'ask' || slide.id === 'ai-data' ? 'text-white drop-shadow-lg' : ''}`}>
                {slide.title}
              </h2>
              <p className={`text-xl ${slide.bgImage || slide.id === 'how-it-works' || slide.id === 'business-model' || slide.id === 'tokenomics' || slide.id === 'traction' || slide.id === 'ask' || slide.id === 'ai-data' ? 'text-white/90 drop-shadow-md' : 'text-muted-foreground'}`}>
                {slide.subtitle}
              </p>
            </div>
          )}

          {/* Slide Body */}
          <div className={`max-w-5xl mx-auto ${slide.id === 'cover' ? 'flex items-center justify-center min-h-[calc(100vh-14rem)]' : ''}`}>
            {slide.content}
          </div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t py-4">
        <div className="container mx-auto px-4">
          <div className="flex justify-center gap-2 flex-wrap">
            {slides.map((_, index) => <button key={index} onClick={() => goToSlide(index)} className={`w-3 h-3 rounded-full transition-all ${index === currentSlide ? "bg-primary w-8" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"}`} />)}
          </div>
        </div>
      </footer>
    </div>;
};
export default PitchDeck;