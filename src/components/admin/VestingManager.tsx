import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Clock, Wallet, Coins, Calendar, Loader2, Download, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum?: any;
  }
}

// KTNZVesting 컨트랙트 ABI (클레임에 필요한 함수만)
const VESTING_ABI = [
  "function claim(uint256 _scheduleId) external",
  "function revokeVesting(uint256 _scheduleId) external",
  "function getClaimableAmount(uint256 _scheduleId) public view returns (uint256)",
  "function getBeneficiarySchedules(address _beneficiary) external view returns (uint256[] memory)",
  "function getVestingScheduleInfo(uint256 _scheduleId) external view returns (address beneficiary, uint256 totalAmount, uint256 claimedAmount, uint256 claimableAmount, uint256 startTime, uint256 cliffEndTime, uint256 vestingEndTime, bool revoked)"
];

// 베스팅 컨트랙트 주소 (Base Mainnet)
const VESTING_CONTRACT_ADDRESS = "0x4b1A2b2031Ef2aDC622eD4AB41d8Db9400E72c50";

interface VestingSchedule {
  id: string;
  beneficiary_address: string;
  beneficiary_user_id: string | null;
  total_amount: number;
  cliff_duration_days: number;
  vesting_duration_days: number;
  start_time: string;
  created_at: string;
  tx_hash: string | null;
  status: string;
  claimed_amount: number;
  notes: string | null;
  onchain_schedule_id: number | null;
  revoked_at: string | null;
  revoke_tx_hash: string | null;
}

export function VestingManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    beneficiary_address: "",
    total_amount: "",
    cliff_duration_days: "365",
    vesting_duration_days: "730",
    notes: "",
  });

  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [claimingScheduleId, setClaimingScheduleId] = useState<string | null>(null);
  const [revokingScheduleId, setRevokingScheduleId] = useState<string | null>(null);

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
        setConnectedWallet(accounts[0].toLowerCase());
        toast.success("Wallet connected");
      }
    } catch (error) {
      console.error("Wallet connection error:", error);
      toast.error("Failed to connect wallet");
    }
  };

  // 토큰 클레임
  const handleClaim = async (schedule: VestingSchedule) => {
    if (!connectedWallet) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (connectedWallet.toLowerCase() !== schedule.beneficiary_address.toLowerCase()) {
      toast.error("Connected wallet doesn't match beneficiary address");
      return;
    }

    if (!schedule.tx_hash) {
      toast.error("Vesting schedule not yet created on-chain");
      return;
    }

    try {
      setClaimingScheduleId(schedule.id);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(VESTING_CONTRACT_ADDRESS, VESTING_ABI, signer);

      // 온체인 스케줄 ID 가져오기 (tx_hash에서 이벤트로 파싱하거나 DB에 저장된 값 사용)
      // 현재는 DB의 순서로 추정 (나중에 개선 필요)
      const scheduleIndex = schedules?.findIndex(s => s.id === schedule.id) ?? 0;
      
      const tx = await contract.claim(scheduleIndex);
      toast.info("Claiming tokens... Please wait for confirmation");
      
      await tx.wait();
      toast.success("Tokens claimed successfully!");
      
      // DB 업데이트
      queryClient.invalidateQueries({ queryKey: ["vesting-schedules"] });
    } catch (error: any) {
      console.error("Claim error:", error);
      toast.error(error.reason || error.message || "Failed to claim tokens");
    } finally {
      setClaimingScheduleId(null);
    }
  };

  // 베스팅 취소 (admin 전용)
  const handleRevoke = async (schedule: VestingSchedule) => {
    if (!schedule.tx_hash) {
      toast.error("Schedule not yet deployed on-chain");
      return;
    }

    if (schedule.status === "revoked") {
      toast.error("Schedule already revoked");
      return;
    }

    if (schedule.onchain_schedule_id === null || schedule.onchain_schedule_id === undefined) {
      toast.error("Missing onchain schedule ID. Please contact admin.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to revoke the vesting schedule for ${schedule.beneficiary_address.slice(0, 6)}...${schedule.beneficiary_address.slice(-4)}?\n\n` +
      `This will:\n` +
      `• Return unvested tokens to the contract owner\n` +
      `• Transfer any already vested (but unclaimed) tokens to the beneficiary\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setRevokingScheduleId(schedule.id);
      
      const { data, error } = await supabase.functions.invoke("revoke-vesting", {
        body: {
          schedule_id: schedule.id,
          onchain_schedule_id: schedule.onchain_schedule_id,
        },
      });

      if (error) throw error;

      toast.success(`Vesting revoked! Returned: ${data.returnedAmount} KTNZ`);
      queryClient.invalidateQueries({ queryKey: ["vesting-schedules"] });
    } catch (error: any) {
      console.error("Revoke error:", error);
      toast.error(error.message || "Failed to revoke vesting");
    } finally {
      setRevokingScheduleId(null);
    }
  };

  // 베스팅 스케줄 목록 조회
  const { data: schedules, isLoading } = useQuery({
    queryKey: ["vesting-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vesting_schedules")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as VestingSchedule[];
    },
  });

  // 베스팅 생성 mutation
  const createVestingMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const startTimeIso = new Date(Date.now() + 60 * 1000).toISOString();

      // 1. DB에 베스팅 스케줄 저장
      const { data: schedule, error } = await supabase
        .from("vesting_schedules")
        .insert({
          beneficiary_address: data.beneficiary_address,
          total_amount: parseFloat(data.total_amount),
          cliff_duration_days: parseInt(data.cliff_duration_days),
          vesting_duration_days: parseInt(data.vesting_duration_days),
          start_time: startTimeIso,
          notes: data.notes || null,
          created_by: userData.user.id,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Edge Function 호출하여 컨트랙트에 베스팅 생성
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "create-vesting",
        {
          body: {
            schedule_id: schedule.id,
            beneficiary: data.beneficiary_address,
            amount: data.total_amount,
            cliffDays: parseInt(data.cliff_duration_days),
            vestingDays: parseInt(data.vesting_duration_days),
            startTime: schedule.start_time ?? startTimeIso,
          },
        }
      );

      if (fnError) throw fnError;

      // 3. tx_hash 업데이트
      if (result?.txHash) {
        await supabase
          .from("vesting_schedules")
          .update({ tx_hash: result.txHash, status: "active" })
          .eq("id", schedule.id);
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Vesting schedule created successfully");
      setIsDialogOpen(false);
      setFormData({
        beneficiary_address: "",
        total_amount: "",
        cliff_duration_days: "365",
        vesting_duration_days: "730",
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["vesting-schedules"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create vesting: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.beneficiary_address || !formData.total_amount) {
      toast.error("Please fill in all required fields");
      return;
    }
    createVestingMutation.mutate(formData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "completed":
        return "bg-blue-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-yellow-500";
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-US").format(amount);
  };

  const calculateVestedAmount = (schedule: VestingSchedule) => {
    const now = new Date();
    const startTime = new Date(schedule.start_time);
    const cliffEnd = new Date(
      startTime.getTime() + schedule.cliff_duration_days * 24 * 60 * 60 * 1000
    );
    const vestingEnd = new Date(
      startTime.getTime() + schedule.vesting_duration_days * 24 * 60 * 60 * 1000
    );

    if (now < cliffEnd) return 0;
    if (now >= vestingEnd) return schedule.total_amount;

    const elapsed = now.getTime() - cliffEnd.getTime();
    const vestingPeriod = vestingEnd.getTime() - cliffEnd.getTime();
    return (schedule.total_amount * elapsed) / vestingPeriod;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold">KTNZ Vesting Management</h2>
        <div className="flex items-center gap-2">
          {/* 지갑 연결 버튼 */}
          {connectedWallet ? (
            <Badge variant="outline" className="font-mono text-xs px-3 py-1">
              <Wallet className="w-3 h-3 mr-1" />
              {connectedWallet.slice(0, 6)}...{connectedWallet.slice(-4)}
            </Badge>
          ) : (
            <Button variant="outline" size="sm" onClick={connectWallet}>
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Create Vesting
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md mx-4">
              <DialogHeader>
                <DialogTitle>Create New Vesting Schedule</DialogTitle>
              </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="beneficiary">Beneficiary Wallet Address *</Label>
                <Input
                  id="beneficiary"
                  placeholder="0x..."
                  value={formData.beneficiary_address}
                  onChange={(e) =>
                    setFormData({ ...formData, beneficiary_address: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Total KTNZ Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="1000000"
                  value={formData.total_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, total_amount: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cliff">Cliff Period (days)</Label>
                  <Input
                    id="cliff"
                    type="number"
                    value={formData.cliff_duration_days}
                    onChange={(e) =>
                      setFormData({ ...formData, cliff_duration_days: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vesting">Vesting Period (days)</Label>
                  <Input
                    id="vesting"
                    type="number"
                    value={formData.vesting_duration_days}
                    onChange={(e) =>
                      setFormData({ ...formData, vesting_duration_days: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="e.g., Team member name, role..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>

              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-2">Vesting Summary</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Cliff ends: {formData.cliff_duration_days} days after start</li>
                  <li>• Full vesting: {formData.vesting_duration_days} days after start</li>
                  <li>• Linear unlock after cliff period</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90"
                  disabled={createVestingMutation.isPending}
                >
                  {createVestingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Vesting"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Total Vesting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatAmount(
                schedules?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0
              )}{" "}
              KTNZ
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Active Schedules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {schedules?.filter((s) => s.status === "active").length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {schedules?.filter((s) => s.status === "pending").length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vesting Schedules Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Vesting Schedules
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : schedules && schedules.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beneficiary</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Cliff</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Vested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Claim</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule, scheduleIndex) => {
                    const claimableAmount = calculateVestedAmount(schedule) - schedule.claimed_amount;
                    const isMySchedule = connectedWallet?.toLowerCase() === schedule.beneficiary_address.toLowerCase();
                    const canClaim = isMySchedule && claimableAmount > 0 && schedule.status === "active";
                    
                    return (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-mono text-xs">
                          {schedule.beneficiary_address.slice(0, 6)}...
                          {schedule.beneficiary_address.slice(-4)}
                          {isMySchedule && (
                            <Badge variant="outline" className="ml-2 text-[10px] px-1">You</Badge>
                          )}
                          {schedule.tx_hash && (
                            <a
                              href={`https://basescan.org/tx/${schedule.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-primary hover:underline"
                            >
                              Tx
                            </a>
                          )}
                        </TableCell>
                        <TableCell>{formatAmount(schedule.total_amount)} KTNZ</TableCell>
                        <TableCell>{schedule.cliff_duration_days}d</TableCell>
                        <TableCell>{schedule.vesting_duration_days}d</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>
                              {formatAmount(Math.floor(calculateVestedAmount(schedule)))} KTNZ
                              <span className="text-muted-foreground text-xs ml-1">
                                ({Math.floor((calculateVestedAmount(schedule) / schedule.total_amount) * 100)}%)
                              </span>
                            </span>
                            {claimableAmount > 0 && (
                              <span className="text-xs text-green-600">
                                Claimable: {formatAmount(Math.floor(claimableAmount))}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(schedule.status)}>
                            {schedule.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {schedule.notes || "-"}
                        </TableCell>
                        <TableCell>
                          {canClaim ? (
                            <Button
                              size="sm"
                              onClick={() => handleClaim(schedule)}
                              disabled={claimingScheduleId === schedule.id}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              {claimingScheduleId === schedule.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Download className="w-3 h-3 mr-1" />
                                  Claim
                                </>
                              )}
                            </Button>
                          ) : isMySchedule && claimableAmount <= 0 ? (
                            <span className="text-xs text-muted-foreground">No claimable</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {schedule.status === "active" && schedule.tx_hash && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRevoke(schedule)}
                              disabled={revokingScheduleId === schedule.id}
                            >
                              {revokingScheduleId === schedule.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Revoke
                                </>
                              )}
                            </Button>
                          )}
                          {(schedule.status === "revoked" || schedule.status === "cancelled") && (
                            <span className="text-xs text-red-500">Revoked</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No vesting schedules yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
