import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Home, Target, Lightbulb, Coins, PieChart, Rocket, Zap, Shield, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

// 이미지 imports
import coverHero from "@/assets/pitch/cover-hero.jpg";
import problemImg from "@/assets/pitch/problem.jpg";
import solutionImg from "@/assets/pitch/solution.jpg";
import marketImg from "@/assets/pitch/market.jpg";
import roadmapImg from "@/assets/pitch/roadmap.jpg";

// KTNZ 컨트랙트 주소
const KTNZ_CONTRACT_ADDRESS = "0x..."; // 실제 배포 후 업데이트

// 슬라이드 데이터 - $KTNZ 토큰 중심
const slides = [
  {
    id: "cover",
    title: "$KTNZ",
    subtitle: "Vote-to-Earn: Transform your fandom activities into real rewards",
    bgImage: coverHero,
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 md:space-y-8 px-2">
        <div className="space-y-2 md:space-y-4">
          <h1 className="text-4xl md:text-7xl font-bold text-white drop-shadow-2xl">
            $KTNZ
          </h1>
          <p className="text-lg md:text-2xl text-white/90 font-medium drop-shadow-lg max-w-3xl">
            The Reward Token for K-POP Fandom Activities
          </p>
        </div>
        <div className="mt-4 md:mt-8 px-4 md:px-8 py-3 md:py-4 bg-gradient-to-r from-violet-600/90 to-purple-500/90 rounded-full shadow-2xl">
          <p className="text-sm md:text-xl font-bold text-white">
            Vote-to-Earn Economy
          </p>
        </div>
        <p className="text-sm md:text-lg text-white/80 max-w-2xl mt-4">
          투표 활동으로 토큰을 채굴하고, 진정한 팬덤 가치를 증명하세요
        </p>
      </div>
    ),
  },
  {
    id: "problem",
    title: "The Problem",
    subtitle: "팬덤 활동의 가치는 어디로 사라지는가?",
    icon: Target,
    bgImage: problemImg,
    content: (
      <div className="space-y-4 md:space-y-8">
        <div className="grid gap-3 md:gap-6">
          <Card className="bg-background/95 backdrop-blur-sm border-destructive/30 shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-3xl">⏰</span>
                <h4 className="font-semibold text-sm md:text-xl">시간의 낭비</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                매일 수십 분씩 투표하고 스트리밍하지만, 그 시간에 대한 보상은 오직 '자기만족'뿐입니다.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-background/95 backdrop-blur-sm border-destructive/30 shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-3xl">💸</span>
                <h4 className="font-semibold text-sm md:text-xl">가치의 증발</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                팬들의 열정적인 활동이 아이돌의 가치를 높이지만, 그 경제적 이익은 팬들에게 돌아오지 않습니다.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-background/95 backdrop-blur-sm border-destructive/30 shadow-xl">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-3xl">📉</span>
                <h4 className="font-semibold text-sm md:text-xl">지속 불가능한 열정</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                보상 없는 활동은 언젠가 지치게 됩니다. 팬덤의 열정을 지속 가능하게 만들 메커니즘이 필요합니다.
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
    subtitle: "$KTNZ: Vote-to-Earn 토큰 이코노미",
    icon: Lightbulb,
    bgImage: solutionImg,
    content: (
      <div className="space-y-4 md:space-y-8">
        <div className="text-center mb-4 md:mb-8">
          <Card className="bg-background/80 backdrop-blur-sm inline-block shadow-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-sm md:text-xl text-foreground">
                매일 투표하면 <span className="text-violet-500 font-bold">$KTNZ 토큰</span>을 채굴합니다
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-3 md:gap-6">
          <Card className="bg-background/80 backdrop-blur-sm border-violet-500/30 shadow-xl hover:scale-[1.02] transition-transform">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-violet-500 to-purple-400 rounded-xl flex items-center justify-center shadow-lg">
                  <Zap className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-xl">일일 13회 투표 = 토큰 보상</h4>
                  <p className="text-xs md:text-base text-muted-foreground">매일 13회의 투표를 완료하면 <span className="text-violet-500 font-semibold">레벨별 KTNZ 토큰</span>이 자동 지급됩니다.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background/80 backdrop-blur-sm border-green-500/30 shadow-xl hover:scale-[1.02] transition-transform">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-green-500 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg">
                  <Users className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-xl">레벨이 올라갈수록 더 많은 보상</h4>
                  <p className="text-xs md:text-base text-muted-foreground">활발한 활동으로 레벨업하면 <span className="text-green-500 font-semibold">일일 토큰 보상량이 증가</span>합니다.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background/80 backdrop-blur-sm border-primary/30 shadow-xl hover:scale-[1.02] transition-transform">
            <CardContent className="p-4 md:p-6 space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary to-orange-400 rounded-xl flex items-center justify-center shadow-lg">
                  <Shield className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-xl">Base Network 기반 온체인 토큰</h4>
                  <p className="text-xs md:text-base text-muted-foreground">채굴된 토큰은 <span className="text-primary font-semibold">내 지갑에 직접 전송</span>되어 완전한 소유권을 가집니다.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    ),
  },
  {
    id: "tokenomics",
    title: "Tokenomics",
    subtitle: "$KTNZ 토큰 분배 및 경제 구조",
    icon: Coins,
    content: (
      <div className="space-y-4 md:space-y-6">
        {/* Token Info */}
        <Card className="bg-gradient-to-r from-violet-900/90 via-purple-800/90 to-violet-900/90 border-violet-500/30 shadow-xl">
          <CardContent className="p-4 md:p-6">
            <div className="text-center mb-3 md:mb-4">
              <h4 className="text-lg md:text-2xl font-bold text-white mb-1">$KTNZ Token</h4>
              <p className="text-violet-300 text-xs md:text-sm">ERC-20 Token on Base Network</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              <div className="bg-white/10 rounded-xl p-2 md:p-3 text-center">
                <p className="text-base md:text-xl font-bold text-white">5B</p>
                <p className="text-violet-300 text-[10px] md:text-xs">Max Supply</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2 md:p-3 text-center">
                <p className="text-base md:text-xl font-bold text-white">1.5B</p>
                <p className="text-violet-300 text-[10px] md:text-xs">Initial (30%)</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2 md:p-3 text-center">
                <p className="text-base md:text-xl font-bold text-white">3.5B</p>
                <p className="text-violet-300 text-[10px] md:text-xs">Mining (70%)</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2 md:p-3 text-center">
                <p className="text-base md:text-xl font-bold text-white">10:1</p>
                <p className="text-violet-300 text-[10px] md:text-xs">Points Ratio</p>
              </div>
            </div>
            {/* Contract Addresses */}
            <div className="mt-4 space-y-2">
              <div className="bg-white/5 rounded-lg p-2 md:p-3">
                <p className="text-violet-300 text-[10px] md:text-xs mb-1">KTNZ Token (ERC-20)</p>
                <p className="text-white text-[9px] md:text-xs font-mono break-all">0x45dB0DA161Ede30990f827b09881938CDFfE1df6</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2 md:p-3">
                <p className="text-violet-300 text-[10px] md:text-xs mb-1">응원봉 Lightstick (ERC-1155)</p>
                <p className="text-white text-[9px] md:text-xs font-mono break-all">0xD8810587C6708b44F89520d612F0aaD832deA7aB</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Initial Allocation Table (30% = 1.5B) */}
        <Card className="shadow-xl">
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center gap-2 mb-3 md:mb-4">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary to-orange-400 rounded-lg flex items-center justify-center">
                <span className="text-base md:text-xl">🏦</span>
              </div>
              <div>
                <h4 className="font-bold text-sm md:text-lg">Initial Allocation (30% = 1.5B)</h4>
                <p className="text-[10px] md:text-xs text-muted-foreground">Portfolio Structure for TGE</p>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {/* Private/Seed */}
              <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-blue-400">1. Private/Seed</span>
                  <span className="text-xs font-bold">10% (500M)</span>
                </div>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <p><span className="text-blue-400">TGE:</span> 0~5%</p>
                  <p><span className="text-blue-400">Vesting:</span> 6mo Cliff → 18mo Linear</p>
                  <p className="text-blue-300 font-medium">[신뢰 증명] VC/초기 파트너</p>
                </div>
              </div>

              {/* Team */}
              <div className="bg-violet-500/10 rounded-lg p-3 border border-violet-500/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-violet-400">2. Team & Advisor</span>
                  <span className="text-xs font-bold">10% (500M)</span>
                </div>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <p><span className="text-violet-400">TGE:</span> 0%</p>
                  <p><span className="text-violet-400">Vesting:</span> 12mo Cliff → 24-36mo Linear</p>
                  <p className="text-violet-300 font-medium">[먹튀 방지] 1년+ 락업 필수</p>
                </div>
              </div>

              {/* Marketing */}
              <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-green-400">3. Marketing & Airdrop</span>
                  <span className="text-xs font-bold">5% (250M)</span>
                </div>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <p><span className="text-green-400">TGE:</span> 10~20%</p>
                  <p><span className="text-green-400">Vesting:</span> 활동 보상으로 분할 지급</p>
                  <p className="text-green-300 font-medium">[현재 유저용] 포인트 채굴 유저 전환</p>
                </div>
              </div>

              {/* Liquidity */}
              <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-primary">4. MM & Liquidity</span>
                  <span className="text-xs font-bold">5% (250M)</span>
                </div>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <p><span className="text-primary">TGE:</span> 100%</p>
                  <p><span className="text-primary">Vesting:</span> 즉시 유통 (MM팀 관리)</p>
                  <p className="text-primary font-medium">[가격 방어] DEX 오더북 관리용</p>
                </div>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-1 text-muted-foreground font-medium">Category</th>
                    <th className="text-center py-2 px-1 text-muted-foreground font-medium">Ratio</th>
                    <th className="text-center py-2 px-1 text-muted-foreground font-medium">Amount</th>
                    <th className="text-center py-2 px-1 text-muted-foreground font-medium">TGE Unlock</th>
                    <th className="text-left py-2 px-1 text-muted-foreground font-medium">Vesting</th>
                    <th className="text-left py-2 px-1 text-muted-foreground font-medium">Purpose</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-border/50 bg-blue-500/5">
                    <td className="py-3 px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔐</span>
                        <span className="font-semibold text-blue-400">Private/Seed</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-1 font-bold">10%</td>
                    <td className="text-center py-3 px-1 text-blue-400 font-semibold">500M</td>
                    <td className="text-center py-3 px-1">0~5%</td>
                    <td className="py-3 px-1 text-muted-foreground">6mo Cliff → 18mo Linear</td>
                    <td className="py-3 px-1">
                      <span className="text-blue-300 text-xs">[신뢰 증명] VC/초기 파트너</span>
                    </td>
                  </tr>
                  <tr className="border-b border-border/50 bg-violet-500/5">
                    <td className="py-3 px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👥</span>
                        <span className="font-semibold text-violet-400">Team & Advisor</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-1 font-bold">10%</td>
                    <td className="text-center py-3 px-1 text-violet-400 font-semibold">500M</td>
                    <td className="text-center py-3 px-1">0%</td>
                    <td className="py-3 px-1 text-muted-foreground">12mo Cliff → 24-36mo Linear</td>
                    <td className="py-3 px-1">
                      <span className="text-violet-300 text-xs">[먹튀 방지] 1년+ 절대 락업</span>
                    </td>
                  </tr>
                  <tr className="border-b border-border/50 bg-green-500/5">
                    <td className="py-3 px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🎁</span>
                        <span className="font-semibold text-green-400">Marketing & Airdrop</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-1 font-bold">5%</td>
                    <td className="text-center py-3 px-1 text-green-400 font-semibold">250M</td>
                    <td className="text-center py-3 px-1">10~20%</td>
                    <td className="py-3 px-1 text-muted-foreground">TGE 일부 + 활동 보상 분할</td>
                    <td className="py-3 px-1">
                      <span className="text-green-300 text-xs">[현재 유저용] 포인트 채굴자 전환</span>
                    </td>
                  </tr>
                  <tr className="bg-primary/5">
                    <td className="py-3 px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">💧</span>
                        <span className="font-semibold text-primary">MM & Liquidity</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-1 font-bold">5%</td>
                    <td className="text-center py-3 px-1 text-primary font-semibold">250M</td>
                    <td className="text-center py-3 px-1">100%</td>
                    <td className="py-3 px-1 text-muted-foreground">즉시 유통 (MM팀 관리)</td>
                    <td className="py-3 px-1">
                      <span className="text-primary text-xs">[가격 방어] DEX 오더북 관리</span>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="py-3 px-1 font-bold">Total Initial</td>
                    <td className="text-center py-3 px-1 font-bold text-lg">30%</td>
                    <td className="text-center py-3 px-1 font-bold text-lg text-primary">1.5B</td>
                    <td colSpan={3} className="py-3 px-1 text-muted-foreground text-center">
                      + Community Mining 70% (3.5B) = Total 5B KTNZ
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    ),
  },
  {
    id: "earning",
    title: "How to Earn",
    subtitle: "투표 활동으로 토큰을 채굴하는 방법",
    icon: PieChart,
    bgImage: marketImg,
    content: (
      <div className="space-y-4 md:space-y-8">
        <div className="text-center mb-4 md:mb-6">
          <Card className="bg-background/85 backdrop-blur-sm inline-block shadow-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-xs md:text-lg text-foreground">
                레벨이 높을수록 <span className="text-violet-500 font-bold">일일 보상량 증가</span>
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 md:gap-4">
          {/* Level 1 */}
          <Card className="bg-gradient-to-r from-gray-500/20 to-slate-500/20 border-gray-500/30 shadow-xl">
            <CardContent className="p-3 md:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-gray-400 to-slate-500 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-xl md:text-2xl">🌱</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm md:text-lg text-gray-400">Level 1-3: Rookie</h4>
                    <p className="text-xs md:text-sm text-muted-foreground">신규 팬 - 기본 보상으로 시작</p>
                  </div>
                </div>
                <span className="text-lg md:text-2xl font-bold text-gray-400">5-15 KTNZ/day</span>
              </div>
            </CardContent>
          </Card>

          {/* Level 4-6 */}
          <Card className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 shadow-xl">
            <CardContent className="p-3 md:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-xl md:text-2xl">⭐</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm md:text-lg text-green-500">Level 4-6: Active Fan</h4>
                    <p className="text-xs md:text-sm text-muted-foreground">활동적인 팬 - 보상 증가</p>
                  </div>
                </div>
                <span className="text-lg md:text-2xl font-bold text-green-500">20-40 KTNZ/day</span>
              </div>
            </CardContent>
          </Card>

          {/* Level 7-9 */}
          <Card className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-500/30 shadow-xl">
            <CardContent className="p-3 md:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-xl md:text-2xl">💎</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm md:text-lg text-violet-500">Level 7-9: Super Fan</h4>
                    <p className="text-xs md:text-sm text-muted-foreground">열성 팬 - 높은 보상</p>
                  </div>
                </div>
                <span className="text-lg md:text-2xl font-bold text-violet-500">50-80 KTNZ/day</span>
              </div>
            </CardContent>
          </Card>

          {/* Level 10+ */}
          <Card className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30 shadow-xl">
            <CardContent className="p-3 md:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-xl md:text-2xl">👑</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm md:text-lg text-yellow-500">Level 10+: Legend</h4>
                    <p className="text-xs md:text-sm text-muted-foreground">전설의 팬 - 최고 보상</p>
                  </div>
                </div>
                <span className="text-lg md:text-2xl font-bold text-yellow-500">100+ KTNZ/day</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Process */}
        <Card className="bg-background/85 backdrop-blur-sm shadow-xl border-violet-500/30">
          <CardContent className="p-3 md:p-5">
            <div className="flex items-center gap-2 md:gap-3 mb-3">
              <span className="text-xl md:text-2xl">⚡</span>
              <h4 className="font-bold text-sm md:text-lg">Daily Mining Process</h4>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 text-xs md:text-sm">
              <span className="bg-violet-500/20 text-violet-500 px-3 py-1.5 rounded-full">1. 로그인</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="bg-violet-500/20 text-violet-500 px-3 py-1.5 rounded-full">2. 13회 투표</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="bg-green-500/20 text-green-500 px-3 py-1.5 rounded-full font-bold">3. KTNZ 자동 지급!</span>
            </div>
          </CardContent>
        </Card>
      </div>
    ),
  },
  {
    id: "utility",
    title: "Token Utility",
    subtitle: "$KTNZ로 무엇을 할 수 있나요?",
    icon: Zap,
    content: (
      <div className="space-y-4 md:space-y-8">
        <div className="grid md:grid-cols-2 gap-3 md:gap-6">
          <Card className="shadow-xl hover:shadow-2xl transition-shadow border-primary/20">
            <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-primary to-orange-400 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl md:text-3xl">⭐</span>
                </div>
                <h4 className="font-bold text-base md:text-xl">Stars 교환</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                KTNZ를 플랫폼 내 Stars로 교환하여 <span className="text-primary font-semibold">프리미엄 기능</span>을 이용할 수 있습니다.
              </p>
              <div className="bg-primary/10 rounded-lg p-3">
                <p className="text-xs md:text-sm text-muted-foreground">10 KTNZ = 1 Star</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl hover:shadow-2xl transition-shadow border-violet-500/20">
            <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-violet-500 to-purple-400 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl md:text-3xl">🎤</span>
                </div>
                <h4 className="font-bold text-base md:text-xl">응원봉 구매</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                좋아하는 아티스트의 <span className="text-violet-500 font-semibold">디지털 응원봉(Fanz Token)</span>을 구매할 수 있습니다.
              </p>
              <div className="bg-violet-500/10 rounded-lg p-3">
                <p className="text-xs md:text-sm text-muted-foreground">KTNZ로 응원봉 거래 지원 예정</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl hover:shadow-2xl transition-shadow border-green-500/20">
            <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-green-500 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl md:text-3xl">💱</span>
                </div>
                <h4 className="font-bold text-base md:text-xl">DEX 거래</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                탈중앙화 거래소에서 <span className="text-green-500 font-semibold">KTNZ를 다른 토큰과 교환</span>할 수 있습니다.
              </p>
              <div className="bg-green-500/10 rounded-lg p-3">
                <p className="text-xs md:text-sm text-muted-foreground">Uniswap, Aerodrome 상장 예정</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl hover:shadow-2xl transition-shadow border-pink-500/20">
            <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-pink-500 to-rose-400 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl md:text-3xl">🗳️</span>
                </div>
                <h4 className="font-bold text-base md:text-xl">거버넌스 참여</h4>
              </div>
              <p className="text-muted-foreground text-xs md:text-base">
                KTNZ 홀더는 플랫폼의 <span className="text-pink-500 font-semibold">주요 의사결정에 투표</span>할 수 있습니다.
              </p>
              <div className="bg-pink-500/10 rounded-lg p-3">
                <p className="text-xs md:text-sm text-muted-foreground">DAO 거버넌스 도입 예정</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Burn Mechanism */}
        <Card className="bg-gradient-to-r from-red-900/30 to-orange-900/30 border-red-500/30 shadow-xl">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3 mb-3">
              <span className="text-xl md:text-2xl">🔥</span>
              <h4 className="font-bold text-red-400 text-sm md:text-lg">Deflationary Mechanism</h4>
            </div>
            <p className="text-white/80 text-xs md:text-base">
              KTNZ는 <span className="text-red-400 font-bold">ERC20Burnable</span>을 구현하여, 사용된 토큰의 일부가 영구 소각됩니다. 이를 통해 토큰의 희소성을 유지합니다.
            </p>
          </CardContent>
        </Card>
      </div>
    ),
  },
  {
    id: "vision",
    title: "Vision",
    subtitle: "팬덤 활동에 진정한 가치를 부여하다",
    icon: Rocket,
    bgImage: roadmapImg,
    content: (
      <div className="space-y-4 md:space-y-8">
        <div className="text-center mb-4 md:mb-8">
          <Card className="bg-background/80 backdrop-blur-sm inline-block shadow-xl">
            <CardContent className="p-4 md:p-6">
              <h3 className="text-lg md:text-3xl font-bold text-foreground mb-2">
                "The Reward Layer for K-Pop Fandom"
              </h3>
              <p className="text-muted-foreground text-sm md:text-lg">
                팬덤 활동의 가치가 온체인에 기록되는 새로운 시대
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Roadmap */}
        <div className="grid gap-3 md:gap-4">
          <Card className="bg-green-500/20 border-green-500/30 shadow-xl">
            <CardContent className="p-3 md:p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm md:text-base">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-lg text-green-500">Phase 1: Launch (현재)</h4>
                  <p className="text-xs md:text-sm text-muted-foreground">Vote-to-Earn 시스템 운영 중, 일일 토큰 채굴 활성화</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-violet-500/20 border-violet-500/30 shadow-xl">
            <CardContent className="p-3 md:p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-violet-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm md:text-base">2</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-lg text-violet-500">Phase 2: DEX Listing</h4>
                  <p className="text-xs md:text-sm text-muted-foreground">Uniswap/Aerodrome 유동성 풀 개설, 토큰 거래 활성화</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/20 border-primary/30 shadow-xl">
            <CardContent className="p-3 md:p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm md:text-base">3</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-lg text-primary">Phase 3: Ecosystem Expansion</h4>
                  <p className="text-xs md:text-sm text-muted-foreground">KTNZ 기반 응원봉 거래, 아티스트 파트너십, DAO 거버넌스</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <Card className="bg-gradient-to-r from-violet-600/90 to-purple-500/90 shadow-2xl">
          <CardContent className="p-6 md:p-10 text-center">
            <p className="text-lg md:text-2xl font-bold text-white mb-2">
              지금 투표하고, $KTNZ를 채굴하세요!
            </p>
            <p className="text-white/80 text-sm md:text-lg">
              당신의 팬덤 활동이 실질적인 자산이 됩니다.
            </p>
          </CardContent>
        </Card>
      </div>
    ),
  },
];

const PitchDeck3 = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <>
      <Helmet>
        <title>$KTNZ Token - Vote-to-Earn | K-TRENDZ</title>
        <meta name="description" content="$KTNZ: The reward token for K-POP fandom activities. Vote-to-Earn economy on Base Network." />
      </Helmet>

      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Background Image */}
        {slide.bgImage && (
          <div 
            className="absolute inset-0 bg-cover bg-center transition-all duration-700"
            style={{ backgroundImage: `url(${slide.bgImage})` }}
          >
            <div className="absolute inset-0 bg-black/60" />
          </div>
        )}

        {/* Home Button */}
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 left-4 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => navigate('/')}
        >
          <Home className="h-4 w-4" />
        </Button>

        {/* Slide Counter */}
        <div className="fixed top-4 right-4 z-50 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
          {currentSlide + 1} / {slides.length}
        </div>

        {/* Main Content */}
        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Header */}
          {slide.id !== "cover" && (
            <div className="pt-16 md:pt-20 px-4 md:px-8 text-center">
              <div className="flex items-center justify-center gap-2 md:gap-3 mb-2 md:mb-4">
                {Icon && (
                  <div className="w-8 h-8 md:w-12 md:h-12 bg-gradient-to-br from-violet-500 to-purple-400 rounded-xl flex items-center justify-center shadow-lg">
                    <Icon className="w-4 h-4 md:w-6 md:h-6 text-white" />
                  </div>
                )}
                <h2 className={`text-xl md:text-4xl font-bold ${slide.bgImage ? 'text-white' : 'text-foreground'}`}>
                  {slide.title}
                </h2>
              </div>
              <p className={`text-sm md:text-xl ${slide.bgImage ? 'text-white/80' : 'text-muted-foreground'} max-w-2xl mx-auto`}>
                {slide.subtitle}
              </p>
            </div>
          )}

          {/* Content */}
          <div className={`flex-1 px-4 md:px-8 py-6 md:py-12 overflow-y-auto ${slide.id === "cover" ? "flex items-center justify-center" : ""}`}>
            <div className="max-w-4xl mx-auto">
              {slide.content}
            </div>
          </div>

          {/* Navigation */}
          <div className="p-4 md:p-8">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <Button
                variant="outline"
                size="lg"
                onClick={prevSlide}
                className="bg-background/80 backdrop-blur-sm"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                <span className="hidden md:inline">Previous</span>
              </Button>

              {/* Slide Dots */}
              <div className="flex gap-1.5 md:gap-2">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition-all ${
                      index === currentSlide
                        ? "bg-violet-500 w-4 md:w-6"
                        : "bg-white/50 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="lg"
                onClick={nextSlide}
                className="bg-background/80 backdrop-blur-sm"
              >
                <span className="hidden md:inline">Next</span>
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PitchDeck3;
