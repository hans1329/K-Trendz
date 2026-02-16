import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Ban, ExternalLink, RefreshCw, User, Wallet } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface VerifiedAgent {
  id: string;
  wallet_address: string;
  social_provider: string;
  social_id: string;
  social_username: string | null;
  social_avatar_url: string | null;
  status: "pending" | "verified" | "rejected" | "suspended";
  paymaster_approved: boolean;
  daily_limit_usd: number;
  daily_tx_limit: number;
  verified_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export default function AgentVerificationManager() {
  const [agents, setAgents] = useState<VerifiedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<VerifiedAgent | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | "suspend">("approve");
  const [actionLoading, setActionLoading] = useState(false);
  
  // 승인 시 설정할 한도
  const [dailyLimitUsd, setDailyLimitUsd] = useState(100);
  const [dailyTxLimit, setDailyTxLimit] = useState(50);
  const [paymasterApproved, setPaymasterApproved] = useState(true);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("verified_agents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAgents((data as VerifiedAgent[]) || []);
    } catch (error) {
      console.error("Error fetching agents:", error);
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleAction = async () => {
    if (!selectedAgent) return;
    
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await supabase.functions.invoke("admin-approve-agent", {
        body: {
          agent_id: selectedAgent.id,
          action: actionType,
          daily_limit_usd: dailyLimitUsd,
          daily_tx_limit: dailyTxLimit,
          paymaster_approved: paymasterApproved
        }
      });

      if (response.error) throw response.error;

      const result = response.data;
      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(`Agent ${actionType}d successfully`);
      setActionDialogOpen(false);
      fetchAgents();
    } catch (error) {
      console.error("Action error:", error);
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const openActionDialog = (agent: VerifiedAgent, action: "approve" | "reject" | "suspend") => {
    setSelectedAgent(agent);
    setActionType(action);
    setDailyLimitUsd(agent.daily_limit_usd);
    setDailyTxLimit(agent.daily_tx_limit);
    setPaymasterApproved(action === "approve");
    setActionDialogOpen(true);
  };

  const getStatusBadge = (status: VerifiedAgent["status"], paymasterApproved: boolean) => {
    switch (status) {
      case "verified":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Verified {paymasterApproved && "(PM)"}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
            <Ban className="w-3 h-3 mr-1" />
            Suspended
          </Badge>
        );
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "twitter":
        return "𝕏";
      case "discord":
        return "🎮";
      case "farcaster":
        return "🟣";
      case "github":
        return "🐙";
      default:
        return "🔗";
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const pendingCount = agents.filter(a => a.status === "pending").length;
  const verifiedCount = agents.filter(a => a.status === "verified").length;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <User className="h-5 w-5" />
              Agent Verification Manager
            </CardTitle>
            <CardDescription>
              Manage verified agents for Paymaster V2 integration
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAgents} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        
        {/* 통계 */}
        <div className="flex gap-4 mt-4">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2">
            <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2">
            <div className="text-2xl font-bold text-green-400">{verifiedCount}</div>
            <div className="text-xs text-muted-foreground">Verified</div>
          </div>
          <div className="bg-muted/30 rounded-lg px-4 py-2">
            <div className="text-2xl font-bold text-foreground">{agents.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No agents registered yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Limits</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={agent.social_avatar_url || undefined} />
                          <AvatarFallback>
                            {getProviderIcon(agent.social_provider)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-foreground">
                            {agent.social_username || agent.social_id}
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {agent.social_provider}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Wallet className="h-3 w-3 text-muted-foreground" />
                        <code className="text-xs">
                          {shortenAddress(agent.wallet_address)}
                        </code>
                        <a
                          href={`https://basescan.org/address/${agent.wallet_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(agent.status, agent.paymaster_approved)}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div>${agent.daily_limit_usd}/day</div>
                        <div className="text-muted-foreground">{agent.daily_tx_limit} TX/day</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(agent.created_at), { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {agent.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-400 border-green-400/30 hover:bg-green-400/10"
                              onClick={() => openActionDialog(agent, "approve")}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                              onClick={() => openActionDialog(agent, "reject")}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {agent.status === "verified" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
                            onClick={() => openActionDialog(agent, "suspend")}
                          >
                            Suspend
                          </Button>
                        )}
                        {(agent.status === "rejected" || agent.status === "suspended") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-400 border-green-400/30 hover:bg-green-400/10"
                            onClick={() => openActionDialog(agent, "approve")}
                          >
                            Re-approve
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">{actionType} Agent</DialogTitle>
            <DialogDescription>
              {actionType === "approve" && "Set limits and approve this agent for Paymaster V2."}
              {actionType === "reject" && "Reject this agent registration."}
              {actionType === "suspend" && "Suspend this agent's access."}
            </DialogDescription>
          </DialogHeader>

          {selectedAgent && (
            <div className="space-y-4">
              {/* Agent Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Avatar>
                  <AvatarImage src={selectedAgent.social_avatar_url || undefined} />
                  <AvatarFallback>
                    {getProviderIcon(selectedAgent.social_provider)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">
                    {selectedAgent.social_username || selectedAgent.social_id}
                  </div>
                  <code className="text-xs text-muted-foreground">
                    {shortenAddress(selectedAgent.wallet_address)}
                  </code>
                </div>
              </div>

              {/* Limits (only for approve) */}
              {actionType === "approve" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="dailyLimit">Daily Limit (USD)</Label>
                    <Input
                      id="dailyLimit"
                      type="number"
                      value={dailyLimitUsd}
                      onChange={(e) => setDailyLimitUsd(Number(e.target.value))}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="txLimit">Daily TX Limit</Label>
                    <Input
                      id="txLimit"
                      type="number"
                      value={dailyTxLimit}
                      onChange={(e) => setDailyTxLimit(Number(e.target.value))}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="paymasterApproved"
                      checked={paymasterApproved}
                      onChange={(e) => setPaymasterApproved(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="paymasterApproved">
                      Enable Paymaster sponsoring (gas-free transactions)
                    </Label>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setActionDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={actionLoading}
              className={
                actionType === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : actionType === "reject"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-orange-600 hover:bg-orange-700"
              }
            >
              {actionLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              {actionType === "approve" && "Approve Agent"}
              {actionType === "reject" && "Reject Agent"}
              {actionType === "suspend" && "Suspend Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
