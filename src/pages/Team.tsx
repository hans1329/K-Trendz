import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet, Coins, Clock, Loader2, Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ethers } from "ethers";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

declare global {
  interface Window {
    ethereum?: any;
  }
}

// KTNZVesting 컨트랙트 ABI
const VESTING_ABI = [
  "function claim(uint256 _scheduleId) external",
  "function getBeneficiarySchedules(address _beneficiary) external view returns (uint256[] memory)",
  "function getVestingScheduleInfo(uint256 _scheduleId) external view returns (address beneficiary, uint256 totalAmount, uint256 claimedAmount, uint256 claimableAmount, uint256 startTime, uint256 cliffEndTime, uint256 vestingEndTime, bool revoked)",
];

// 베스팅 컨트랙트 주소 (Base Mainnet)
const VESTING_CONTRACT_ADDRESS = "0x4b1A2b2031Ef2aDC622eD4AB41d8Db9400E72c50";
const BASE_CHAIN_ID = 8453n;

type VestingInfoTuple = [
  string,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
];

interface OnChainVestingSchedule {
  scheduleId: bigint;
  beneficiary: string;
  totalAmount: bigint;
  claimedAmount: bigint;
  claimableAmount: bigint;
  startTime: number; // seconds
  cliffEndTime: number; // seconds
  vestingEndTime: number; // seconds
  revoked: boolean;
}

export default function Team() {
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [claimingScheduleId, setClaimingScheduleId] = useState<string | null>(null);

  // 지갑 연결
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        toast.error("Please install MetaMask or another wallet");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);

      if (accounts.length > 0) {
        const wallet = accounts[0].toLowerCase();
        setConnectedWallet(wallet);
        toast.success("Wallet connected");

        try {
          const network = await provider.getNetwork();
          if (network.chainId !== BASE_CHAIN_ID) {
            toast.error("Please switch to Base network");
          }
        } catch {
          // 네트워크 체크 실패는 치명적이지 않음
        }
      }
    } catch (error) {
      console.error("Wallet connection error:", error);
      toast.error("Failed to connect wallet");
    }
  };

  // 온체인에서 내 베스팅 스케줄 조회 (DB/RLS 영향 없음)
  const {
    data: schedules,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["team-vesting-onchain", connectedWallet],
    queryFn: async (): Promise<OnChainVestingSchedule[]> => {
      if (!connectedWallet) return [];
      if (!window.ethereum) throw new Error("No wallet provider");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (network.chainId !== BASE_CHAIN_ID) {
        throw new Error("Please switch to Base network");
      }

      const contract = new ethers.Contract(
        VESTING_CONTRACT_ADDRESS,
        VESTING_ABI,
        provider,
      );

      const ids = (await contract.getBeneficiarySchedules(
        connectedWallet,
      )) as bigint[];

      const rows = await Promise.all(
        ids.map(async (scheduleId) => {
          const info = (await contract.getVestingScheduleInfo(
            scheduleId,
          )) as VestingInfoTuple;

          return {
            scheduleId: BigInt(scheduleId),
            beneficiary: info[0],
            totalAmount: BigInt(info[1]),
            claimedAmount: BigInt(info[2]),
            claimableAmount: BigInt(info[3]),
            startTime: Number(info[4]),
            cliffEndTime: Number(info[5]),
            vestingEndTime: Number(info[6]),
            revoked: Boolean(info[7]),
          } satisfies OnChainVestingSchedule;
        }),
      );

      // 최신 스케줄이 위로 오도록 정렬
      return rows.sort((a, b) => b.startTime - a.startTime);
    },
    enabled: !!connectedWallet,
  });

  // 토큰 클레임
  const handleClaim = async (schedule: OnChainVestingSchedule) => {
    if (!connectedWallet) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!window.ethereum) {
      toast.error("No wallet provider");
      return;
    }

    if (schedule.revoked) {
      toast.error("This vesting schedule is revoked");
      return;
    }

    if (schedule.claimableAmount <= 0n) {
      toast.error("No claimable tokens right now");
      return;
    }

    try {
      setClaimingScheduleId(schedule.scheduleId.toString());

      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (network.chainId !== BASE_CHAIN_ID) {
        toast.error("Please switch to Base network");
        return;
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(VESTING_CONTRACT_ADDRESS, VESTING_ABI, signer);

      const tx = await contract.claim(schedule.scheduleId);
      toast.info("Claiming tokens... Please wait for confirmation");

      await tx.wait();
      toast.success("Tokens claimed successfully!");
    } catch (e: any) {
      console.error("Claim error:", e);
      toast.error(e?.reason || e?.message || "Failed to claim tokens");
    } finally {
      setClaimingScheduleId(null);
    }
  };

  const formatToken = (amountWei: bigint) => {
    const asString = ethers.formatUnits(amountWei, 18);
    const asNumber = Number(asString);

    if (!Number.isFinite(asNumber)) return asString;

    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 4,
    }).format(asNumber);
  };

  const nowSec = Math.floor(Date.now() / 1000);

  const calculateProgress = (schedule: OnChainVestingSchedule) => {
    if (nowSec <= schedule.startTime) return 0;
    if (nowSec >= schedule.vestingEndTime) return 100;

    const elapsed = nowSec - schedule.startTime;
    const total = schedule.vestingEndTime - schedule.startTime;
    if (total <= 0) return 0;

    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  const calculateVestedWei = (schedule: OnChainVestingSchedule) => {
    if (nowSec < schedule.cliffEndTime) return 0n;
    if (nowSec >= schedule.vestingEndTime) return schedule.totalAmount;

    const elapsed = BigInt(nowSec - schedule.cliffEndTime);
    const duration = BigInt(schedule.vestingEndTime - schedule.cliffEndTime);
    if (duration <= 0n) return 0n;

    return (schedule.totalAmount * elapsed) / duration;
  };

  const getTimeUntilCliff = (schedule: OnChainVestingSchedule) => {
    if (nowSec >= schedule.cliffEndTime) return null;

    const diffSec = schedule.cliffEndTime - nowSec;
    const days = Math.floor(diffSec / (24 * 60 * 60));
    return `${days} days until cliff ends`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>KTRENDZ Team Vesting Claim</title>
        <meta
          name="description"
          content="Connect your wallet to view and claim vested KTNZ tokens on the KTRENDZ team portal."
        />
        <link rel="canonical" href="https://k-trendz.com/team" />
      </Helmet>

      <Navbar />

      <main className="container max-w-4xl mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Team Token Vesting</h1>
          <p className="text-muted-foreground">
            Connect your wallet to view and claim your vested KTNZ tokens
          </p>
        </header>

        {/* 지갑 연결 */}
        <section>
          <Card className="mb-6">
            <CardContent className="py-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Wallet Connection</p>
                    {connectedWallet ? (
                      <p className="text-sm text-muted-foreground font-mono">
                        {connectedWallet.slice(0, 10)}...{connectedWallet.slice(-8)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not connected</p>
                    )}
                  </div>
                </div>
                {!connectedWallet && (
                  <Button onClick={connectWallet} className="bg-primary hover:bg-primary/90">
                    Connect Wallet
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 베스팅 스케줄 목록 */}
        {connectedWallet && (
          <section>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <Coins className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Unable to load schedules</h3>
                  <p className="text-muted-foreground text-sm">
                    {error instanceof Error ? error.message : "Unknown error"}
                  </p>
                </CardContent>
              </Card>
            ) : schedules && schedules.length > 0 ? (
              <div className="space-y-4">
                {schedules.map((schedule) => {
                  const vestedWei = calculateVestedWei(schedule);
                  const progress = calculateProgress(schedule);
                  const timeUntilCliff = getTimeUntilCliff(schedule);

                  return (
                    <Card key={schedule.scheduleId.toString()}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Coins className="w-5 h-5 text-primary" />
                            KTNZ Vesting #{schedule.scheduleId.toString()}
                          </CardTitle>
                          <Badge variant={schedule.revoked ? "destructive" : "secondary"}>
                            {schedule.revoked ? "Revoked" : "Active"}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* 진행률 */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Vesting Progress</span>
                            <span className="font-medium">{progress.toFixed(1)}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>

                        {/* 상세 정보 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Total Amount</p>
                            <p className="font-semibold">{formatToken(schedule.totalAmount)} KTNZ</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Vested</p>
                            <p className="font-semibold">{formatToken(vestedWei)} KTNZ</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Claimed</p>
                            <p className="font-semibold">{formatToken(schedule.claimedAmount)} KTNZ</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Claimable</p>
                            <p className="font-semibold text-primary">
                              {formatToken(schedule.claimableAmount)} KTNZ
                            </p>
                          </div>
                        </div>

                        {/* 타임라인 */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {timeUntilCliff ? (
                            <span>{timeUntilCliff}</span>
                          ) : (
                            <span>Cliff period ended - Linear vesting active</span>
                          )}
                        </div>

                        {/* 액션 버튼 */}
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            onClick={() => handleClaim(schedule)}
                            disabled={
                              claimingScheduleId === schedule.scheduleId.toString() ||
                              schedule.claimableAmount <= 0n ||
                              schedule.revoked
                            }
                            className="flex-1 bg-primary hover:bg-primary/90"
                          >
                            {claimingScheduleId === schedule.scheduleId.toString() ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Claiming...
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-2" />
                                Claim Tokens
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Coins className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Vesting Schedules Found</h3>
                  <p className="text-muted-foreground text-sm">
                    There are no on-chain vesting schedules associated with your wallet address.
                  </p>
                </CardContent>
              </Card>
            )}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
