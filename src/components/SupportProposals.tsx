import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Vote, Plus, Clock, CheckCircle2, XCircle, Users, ThumbsUp, ThumbsDown, Sparkles, AlertCircle, Timer, Wand2, Check, MessageSquare, Send, Trash2, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, isPast } from "date-fns";
import MyFanStatusCard from "@/components/MyFanStatusCard";
import { usePageTranslation } from "@/hooks/usePageTranslation";


interface SupportProposalsProps {
  wikiEntryId: string;
  variant?: 'compact' | 'full';
  ownerId?: string | null;
  showOriginal?: boolean;
}

interface Proposal {
  id: string;
  title: string;
  description: string;
  proposal_type: string;
  proposal_format: 'decision' | 'discussion';
  proposal_category?: string;
  selected_result?: string | null;
  requested_amount: number;
  status: string;
  voting_start_at: string;
  voting_end_at: string;
  quorum_threshold: number;
  pass_threshold: number;
  total_votes_for: number;
  total_votes_against: number;
  total_vote_weight: number;
  tx_hash: string | null;
  created_at: string;
  min_lightstick_required: number;
  proposer: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

interface ProposalOpinion {
  id: string;
  opinion: string;
  lightstick_count: number;
  votes_for: number;
  votes_against: number;
  total_vote_weight: number;
  created_at: string;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

interface ProposalVote {
  id: string;
  vote_type: string;
  vote_weight: number;
}

interface OpinionVote {
  id: string;
  opinion_id: string;
  vote_type: 'for' | 'against';
  vote_weight: number;
}

const PROPOSAL_TYPES = [
  { value: 'general', label: 'General', emoji: '💬' },
  { value: 'event', label: 'Fan Event', emoji: '🎉' },
  { value: 'advertisement', label: 'Advertisement', emoji: '📢' },
  { value: 'merchandise', label: 'Merchandise', emoji: '🛍️' },
  { value: 'donation', label: 'Donation', emoji: '💝' },
  { value: 'community', label: 'Community Naming', emoji: '🎤' },
];

const STATUS_CONFIG = {
  voting: { label: 'Voting', color: 'bg-blue-500', icon: Vote },
  approved: { label: 'Approved', color: 'bg-green-500', icon: CheckCircle2 },
  passed: { label: 'Passed', color: 'bg-green-500', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-500', icon: XCircle },
  executed: { label: 'Executed', color: 'bg-purple-500', icon: Sparkles },
  expired: { label: 'Expired', color: 'bg-gray-500', icon: Clock },
};

const TIER_WEIGHTS = [
  { min: 100, weight: 5, name: 'Diamond', color: 'text-cyan-400' },
  { min: 50, weight: 4, name: 'Gold', color: 'text-yellow-400' },
  { min: 20, weight: 3, name: 'Silver', color: 'text-gray-400' },
  { min: 5, weight: 2, name: 'Bronze', color: 'text-orange-400' },
  { min: 1, weight: 1, name: 'Basic', color: 'text-primary' },
];

const getVoteWeight = (lightstickCount: number) => {
  for (const tier of TIER_WEIGHTS) {
    if (lightstickCount >= tier.min) return tier;
  }
  return { weight: 0, name: 'None', color: 'text-muted-foreground' };
};

const SupportProposals = ({ wikiEntryId, variant = 'compact', ownerId, showOriginal: externalShowOriginal }: SupportProposalsProps) => {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [newProposal, setNewProposal] = useState({
    title: '',
    description: '',
    proposal_type: 'general',
    proposal_format: 'decision' as 'decision' | 'discussion',
    requested_amount: 0,
    voting_days: 7,
    min_lightstick_required: 0,
  });

  // wiki entry의 community_name 조회
  const { data: wikiEntry } = useQuery({
    queryKey: ['wiki-entry-community-name', wikiEntryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wiki_entries')
        .select('title, community_name')
        .eq('id', wikiEntryId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!wikiEntryId,
    staleTime: 60000,
  });

  // 커뮤니티 이름 (팬덤명이 있으면 사용)
  const communityDisplayName = wikiEntry?.community_name || null;

  // 사용자의 응원봉 보유량 조회
  const { data: userLightstickBalance } = useQuery({
    queryKey: ['user-lightstick-balance', wikiEntryId, user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      const { data: token } = await supabase
        .from('fanz_tokens')
        .select('id')
        .eq('wiki_entry_id', wikiEntryId)
        .maybeSingle();
      
      if (!token) return 0;

      const { data: balance } = await supabase
        .from('fanz_balances')
        .select('balance')
        .eq('fanz_token_id', token.id)
        .eq('user_id', user.id)
        .maybeSingle();

      return balance?.balance ?? 0;
    },
    enabled: !!user?.id && !!wikiEntryId,
  });

  // 총 투표권 (정족수 계산용)
  const { data: totalVotingPower } = useQuery({
    queryKey: ['total-voting-power', wikiEntryId],
    queryFn: async () => {
      const { data: token } = await supabase
        .from('fanz_tokens')
        .select('id')
        .eq('wiki_entry_id', wikiEntryId)
        .maybeSingle();
      
      if (!token) return 0;

      const { data: balances } = await supabase
        .from('fanz_balances')
        .select('balance')
        .eq('fanz_token_id', token.id)
        .gt('balance', 0);

      if (!balances) return 0;

      // 각 홀더의 가중치 합산
      return balances.reduce((sum, b) => {
        const tier = getVoteWeight(b.balance);
        return sum + tier.weight;
      }, 0);
    },
    enabled: !!wikiEntryId,
  });

  // 오늘 사용자가 생성한 제안 수 조회 (하루 3개 제한)
  const { data: todayProposalCount = 0 } = useQuery({
    queryKey: ['today-proposal-count', wikiEntryId, user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error } = await supabase
        .from('support_proposals')
        .select('*', { count: 'exact', head: true })
        .eq('wiki_entry_id', wikiEntryId)
        .eq('proposer_id', user.id)
        .gte('created_at', today.toISOString());
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id && !!wikiEntryId,
  });

  const canCreateProposal = userLightstickBalance > 0 && todayProposalCount < 3;
  const remainingProposals = 3 - todayProposalCount;

  // 제안 목록 조회
  const { data: proposals, isLoading } = useQuery({
    queryKey: ['support-proposals', wikiEntryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_proposals')
        .select(`
          *,
          proposer:profiles!support_proposals_proposer_id_fkey(id, username, avatar_url)
        `)
        .eq('wiki_entry_id', wikiEntryId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Proposal[];
    },
    enabled: !!wikiEntryId,
  });

  // 사용자 투표 현황 조회
  const { data: userVotes } = useQuery({
    queryKey: ['user-proposal-votes', wikiEntryId, user?.id],
    queryFn: async () => {
      if (!user?.id) return {};
      
      const proposalIds = proposals?.map(p => p.id) || [];
      if (proposalIds.length === 0) return {};

      const { data, error } = await supabase
        .from('support_proposal_votes')
        .select('id, proposal_id, vote_type, vote_weight')
        .eq('user_id', user.id)
        .in('proposal_id', proposalIds);
      
      if (error) throw error;
      
      const voteMap: Record<string, ProposalVote> = {};
      data?.forEach(v => {
        voteMap[v.proposal_id] = v as ProposalVote;
      });
      return voteMap;
    },
    enabled: !!user?.id && !!proposals?.length,
  });

  // 제안 생성
  const createProposalMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Login required');
      if (userLightstickBalance === 0) throw new Error('You need at least 1 Lightstick to create a proposal');
      if (todayProposalCount >= 3) throw new Error('Daily limit reached. You can create up to 3 proposals per day.');

      const votingEndAt = new Date();
      votingEndAt.setDate(votingEndAt.getDate() + newProposal.voting_days);

      const { data, error } = await supabase
        .from('support_proposals')
        .insert({
          wiki_entry_id: wikiEntryId,
          proposer_id: user.id,
          title: newProposal.title,
          description: newProposal.description,
          proposal_type: newProposal.proposal_type,
          proposal_format: newProposal.proposal_format,
          requested_amount: newProposal.requested_amount,
          voting_end_at: votingEndAt.toISOString(),
          min_lightstick_required: newProposal.min_lightstick_required,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Proposal created successfully!');
      setIsCreateOpen(false);
      setNewProposal({ title: '', description: '', proposal_type: 'general', proposal_format: 'decision', requested_amount: 0, voting_days: 7, min_lightstick_required: 0 });
      queryClient.invalidateQueries({ queryKey: ['support-proposals', wikiEntryId] });
      queryClient.invalidateQueries({ queryKey: ['today-proposal-count', wikiEntryId, user?.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 투표하기
  const voteMutation = useMutation({
    mutationFn: async ({ proposalId, voteType }: { proposalId: string; voteType: 'for' | 'against' }) => {
      if (!user?.id) throw new Error('Login required');
      
      // 해당 프로포절의 min_lightstick_required 확인
      const proposal = proposals?.find(p => p.id === proposalId);
      const minRequired = proposal?.min_lightstick_required ?? 0;
      if (minRequired > 0 && userLightstickBalance < minRequired) {
        throw new Error(`You need at least ${minRequired} Lightstick(s) to vote`);
      }

      const tier = getVoteWeight(userLightstickBalance);

      const { error } = await supabase
        .from('support_proposal_votes')
        .upsert({
          proposal_id: proposalId,
          user_id: user.id,
          vote_type: voteType,
          vote_weight: tier.weight,
          lightstick_count: userLightstickBalance,
        }, {
          onConflict: 'proposal_id,user_id',
        });

      if (error) throw error;

      // 온체인 기록 (백그라운드)
      supabase.functions.invoke('record-proposal-vote-onchain', {
        body: {
          proposalId,
          userId: user.id,
          voteType,
          voteWeight: tier.weight,
        },
      }).then(({ error: onchainError }) => {
        if (onchainError) {
          console.error('On-chain vote recording failed:', onchainError);
        } else {
          console.log('Vote recorded on-chain successfully');
          // 온체인 트랜잭션 카운트 갱신 이벤트
          window.dispatchEvent(new CustomEvent('onchainTxUpdated'));
        }
      });
    },
    onSuccess: () => {
      toast.success('Vote recorded!');
      queryClient.invalidateQueries({ queryKey: ['support-proposals', wikiEntryId] });
      queryClient.invalidateQueries({ queryKey: ['user-proposal-votes', wikiEntryId, user?.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 제안 승인 (관리자 전용) - 투표 조건 충족 후 승인
  const approveProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      if (!user?.id || !isAdmin) throw new Error('Admin access required');

      const { error } = await supabase
        .from('support_proposals')
        .update({ status: 'approved' })
        .eq('id', proposalId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Proposal approved!');
      queryClient.invalidateQueries({ queryKey: ['support-proposals', wikiEntryId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 제안 실행 (관리자 전용) - 승인 후 실행
  const executeProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      if (!user?.id || !isAdmin) throw new Error('Admin access required');

      // 제안 정보 가져오기
      const { data: proposalData, error: fetchError } = await supabase
        .from('support_proposals')
        .select('proposal_category, selected_result, wiki_entry_id')
        .eq('id', proposalId)
        .single();

      if (fetchError) throw fetchError;

      // 제안 실행 상태로 업데이트
      const { error } = await supabase
        .from('support_proposals')
        .update({ 
          status: 'executed',
          executed_at: new Date().toISOString()
        })
        .eq('id', proposalId);

      if (error) throw error;

      // community_naming 제안이고 selected_result가 있으면 wiki_entries 업데이트
      if (proposalData?.proposal_category === 'community_naming' && proposalData?.selected_result) {
        const { error: updateError } = await supabase
          .from('wiki_entries')
          .update({ community_name: proposalData.selected_result })
          .eq('id', proposalData.wiki_entry_id);

        if (updateError) {
          console.error('Failed to update community name:', updateError);
        } else {
          toast.success(`Fandom name set to "${proposalData.selected_result}"!`);
        }
      }
    },
    onSuccess: () => {
      toast.success('Proposal executed successfully!');
      queryClient.invalidateQueries({ queryKey: ['support-proposals', wikiEntryId] });
      queryClient.invalidateQueries({ queryKey: ['wiki-entry-community-name', wikiEntryId] });
      queryClient.invalidateQueries({ queryKey: ['wiki-entry-title', wikiEntryId] });
      queryClient.invalidateQueries({ queryKey: ['wiki-entry', wikiEntryId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 제안 삭제 (제안자 본인 또는 관리자)
  const deleteProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      if (!user?.id) throw new Error('Login required');

      // 먼저 관련 의견들 삭제
      await supabase
        .from('support_proposal_opinions')
        .delete()
        .eq('proposal_id', proposalId);

      // 관련 투표들 삭제
      await supabase
        .from('support_proposal_votes')
        .delete()
        .eq('proposal_id', proposalId);

      // 제안 삭제 (관리자는 모든 제안 삭제 가능)
      const { data, error } = await supabase
        .from('support_proposals')
        .delete()
        .eq('id', proposalId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Failed to delete proposal. You may not have permission.');
      }
    },
    onSuccess: () => {
      toast.success('Proposal deleted!');
      queryClient.invalidateQueries({ queryKey: ['support-proposals', wikiEntryId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const userTier = getVoteWeight(userLightstickBalance || 0);
  const activeProposals = proposals?.filter(p => p.status === 'voting' && !isPast(new Date(p.voting_end_at))) || [];
  const pastProposals = proposals?.filter(p => p.status !== 'voting' || isPast(new Date(p.voting_end_at))) || [];

  // 번역 세그먼트 구성 (프로포절 제목/설명 + UI 라벨)
  const translationSegments = useMemo(() => {
    const segs: Record<string, string> = {};
    // UI 라벨
    segs['ui_community_proposals'] = communityDisplayName ? `${communityDisplayName} Proposals` : 'Community Proposals';
    segs['ui_active_voting'] = 'Active Voting';
    segs['ui_past_proposals'] = 'Past Proposals';
    // 동적 콘텐츠
    proposals?.forEach((p) => {
      if (p.title) segs[`p_title_${p.id}`] = p.title;
      if (p.description) segs[`p_desc_${p.id}`] = p.description;
    });
    return segs;
  }, [proposals, communityDisplayName]);

  const {
    t: proposalT,
  } = usePageTranslation({
    cacheKey: `proposals-${wikiEntryId}`,
    segments: translationSegments,
    enabled: (proposals?.length ?? 0) > 0,
    overrideShowOriginal: externalShowOriginal,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // 컴팩트 버전
  if (variant === 'compact') {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-blue-500/10 hover:from-blue-500/15 hover:via-blue-500/10 hover:to-blue-500/15 rounded-full border border-blue-500/20 transition-all">
            <Vote className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-500">
              {activeProposals.length}
            </span>
            <span className="text-xs text-muted-foreground">Active Votes</span>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Vote className="w-5 h-5 text-blue-500" />
              {communityDisplayName ? `${communityDisplayName} Proposals` : 'Community Proposals'}
            </DialogTitle>
            <DialogDescription>
              LightStick holders can vote on community proposals
            </DialogDescription>
          </DialogHeader>
          <ProposalsList 
            activeProposals={activeProposals}
            pastProposals={pastProposals}
            userVotes={userVotes || {}}
            userTier={userTier}
            userLightstickBalance={userLightstickBalance || 0}
            totalVotingPower={totalVotingPower || 0}
            onVote={(id, type) => voteMutation.mutate({ proposalId: id, voteType: type })}
            isVoting={voteMutation.isPending}
            onCreateOpen={() => setIsCreateOpen(true)}
            user={user}
            isAdmin={isAdmin}
            onApprove={(id) => approveProposalMutation.mutate(id)}
            isApproving={approveProposalMutation.isPending}
            onExecute={(id) => executeProposalMutation.mutate(id)}
            isExecuting={executeProposalMutation.isPending}
            onDelete={(id) => deleteProposalMutation.mutate(id)}
            isDeleting={deleteProposalMutation.isPending}
            proposalT={proposalT}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // 풀 버전
  return (
    <div className="max-w-3xl mx-auto space-y-4 px-4 sm:px-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Vote className="w-5 h-5 text-blue-500" />
          <h3 className="font-bold text-lg sm:text-xl">{proposalT('ui_community_proposals')}</h3>
          {activeProposals.length > 0 && (
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
              {activeProposals.length} Active
            </Badge>
          )}
        </div>
        {/* PC: 헤더 우측에 버튼 */}
        {user && (
          <Button 
            size="sm" 
            onClick={() => {
              if (userLightstickBalance === 0) {
                toast.error('You need at least 1 Lightstick to create a proposal');
                return;
              }
              if (todayProposalCount >= 3) {
                toast.error('Daily limit reached. You can create up to 3 proposals per day.');
                return;
              }
              setIsCreateOpen(true);
            }}
            disabled={!canCreateProposal}
            className="rounded-full hidden sm:flex"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Proposal {remainingProposals < 3 && `(${remainingProposals}/3)`}
          </Button>
        )}
      </div>

      {/* 사용자 팬 상태 카드 */}
      <MyFanStatusCard 
        wikiEntryId={wikiEntryId} 
        userId={user?.id || null} 
        userProfile={profile} 
        ownerId={ownerId} 
      />

      {/* 모바일: 사용자 박스 아래에 버튼 */}
      {user && (
        <Button 
          size="sm" 
          onClick={() => {
            if (userLightstickBalance === 0) {
              toast.error('You need at least 1 Lightstick to create a proposal');
              return;
            }
            if (todayProposalCount >= 3) {
              toast.error('Daily limit reached. You can create up to 3 proposals per day.');
              return;
            }
            setIsCreateOpen(true);
          }}
          disabled={!canCreateProposal}
          className="rounded-full w-full sm:hidden"
        >
          <Plus className="w-4 h-4 mr-1" />
          New Proposal {remainingProposals < 3 && `(${remainingProposals}/3)`}
        </Button>
      )}


      <ProposalsList 
        activeProposals={activeProposals}
        pastProposals={pastProposals}
        userVotes={userVotes || {}}
        userTier={userTier}
        userLightstickBalance={userLightstickBalance || 0}
        totalVotingPower={totalVotingPower || 0}
        onVote={(id, type) => voteMutation.mutate({ proposalId: id, voteType: type })}
        isVoting={voteMutation.isPending}
        onCreateOpen={() => setIsCreateOpen(true)}
        user={user}
        isAdmin={isAdmin}
        onApprove={(id) => approveProposalMutation.mutate(id)}
        isApproving={approveProposalMutation.isPending}
        onExecute={(id) => executeProposalMutation.mutate(id)}
        isExecuting={executeProposalMutation.isPending}
        onDelete={(id) => deleteProposalMutation.mutate(id)}
        isDeleting={deleteProposalMutation.isPending}
        proposalT={proposalT}
      />

      {/* 제안 생성 다이얼로그 */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Proposal</DialogTitle>
            <DialogDescription>
              Submit a proposal for the community to vote on
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input
                placeholder="Proposal title..."
                value={newProposal.title}
                onChange={(e) => setNewProposal(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Type</label>
              <Select
                value={newProposal.proposal_type}
                onValueChange={(value) => setNewProposal(prev => ({ ...prev, proposal_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPOSAL_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.emoji} {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Format</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={newProposal.proposal_format === 'decision' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setNewProposal(prev => ({ ...prev, proposal_format: 'decision' }))}
                >
                  <ThumbsUp className="w-4 h-4 mr-1" />
                  Vote (Yes/No)
                </Button>
                <Button
                  type="button"
                  variant={newProposal.proposal_format === 'discussion' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setNewProposal(prev => ({ ...prev, proposal_format: 'discussion' }))}
                >
                  <Users className="w-4 h-4 mr-1" />
                  Collect Ideas
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {newProposal.proposal_format === 'decision' 
                  ? 'Members vote Agree/Disagree on the proposal'
                  : 'Members submit their own suggestions (e.g., naming ideas)'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea
                placeholder="Describe your proposal..."
                value={newProposal.description}
                onChange={(e) => setNewProposal(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Requested Amount (USD)</label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={newProposal.requested_amount || ''}
                onChange={(e) => setNewProposal(prev => ({ ...prev, requested_amount: parseFloat(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave 0 if no funds are needed
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Voting Period</label>
              <Select
                value={String(newProposal.voting_days)}
                onValueChange={(value) => setNewProposal(prev => ({ ...prev, voting_days: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="5">5 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Minimum Lightsticks to Participate</label>
              <Select
                value={String(newProposal.min_lightstick_required)}
                onValueChange={(value) => setNewProposal(prev => ({ ...prev, min_lightstick_required: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 - Anyone can participate</SelectItem>
                  <SelectItem value="1">1+ Lightstick holders</SelectItem>
                  <SelectItem value="5">5+ Lightstick holders</SelectItem>
                  <SelectItem value="20">20+ Lightstick holders</SelectItem>
                  <SelectItem value="50">50+ Lightstick holders</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {newProposal.min_lightstick_required === 0 
                  ? 'All logged-in users can vote and submit opinions'
                  : `Only users with ${newProposal.min_lightstick_required}+ lightsticks can participate`}
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setIsCreateOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => createProposalMutation.mutate()}
                disabled={!newProposal.title || !newProposal.description || createProposalMutation.isPending}
                className="flex-1"
              >
                {createProposalMutation.isPending ? 'Creating...' : 'Submit Proposal'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface ProposalsListProps {
  activeProposals: Proposal[];
  pastProposals: Proposal[];
  userVotes: Record<string, ProposalVote>;
  userTier: { weight: number; name: string; color: string };
  userLightstickBalance: number;
  totalVotingPower: number;
  onVote: (proposalId: string, voteType: 'for' | 'against') => void;
  isVoting: boolean;
  onCreateOpen: () => void;
  user: any;
  isAdmin?: boolean;
  onApprove?: (proposalId: string) => void;
  isApproving?: boolean;
  onExecute?: (proposalId: string) => void;
  isExecuting?: boolean;
  onDelete?: (proposalId: string) => void;
  isDeleting?: boolean;
  proposalT?: (key: string) => string;
}

const ProposalsList = ({ 
  activeProposals, 
  pastProposals, 
  userVotes, 
  userTier, 
  userLightstickBalance,
  totalVotingPower,
  onVote, 
  isVoting,
  onCreateOpen,
  user,
  isAdmin,
  onApprove,
  isApproving,
  onExecute,
  isExecuting,
  onDelete,
  isDeleting,
  proposalT,
}: ProposalsListProps) => {
  const [isBackfilling, setIsBackfilling] = useState(false);

  // 관리자용 백필 함수
  const handleBackfillNamingProposals = async () => {
    if (!isAdmin) return;
    
    setIsBackfilling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await supabase.functions.invoke('backfill-naming-proposals', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw response.error;
      }

      const result = response.data;
      if (result.success) {
        toast.success(`Backfill complete: ${result.results.created} proposals created`);
      } else {
        toast.error(result.error || 'Backfill failed');
      }
    } catch (error: any) {
      console.error('Backfill error:', error);
      toast.error(error.message || 'Failed to backfill naming proposals');
    } finally {
      setIsBackfilling(false);
    }
  };

  if (activeProposals.length === 0 && pastProposals.length === 0) {
    return (
      <div className="space-y-4">
        {/* 관리자용 백필 버튼 */}
        {isAdmin && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-amber-600 dark:text-amber-400">
                <strong>Admin:</strong> Backfill naming proposals for existing lightsticks
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleBackfillNamingProposals}
                disabled={isBackfilling}
                className="border-amber-500/50 text-amber-600 hover:bg-amber-500/20"
              >
                <Wand2 className="w-4 h-4 mr-1" />
                {isBackfilling ? 'Processing...' : 'Backfill'}
              </Button>
            </div>
          </div>
        )}
        <div className="text-center py-8 rounded-xl bg-muted/20 border border-dashed border-border/50">
          <Vote className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mb-2">No proposals yet</p>
          {user ? (
            <Button size="sm" variant="outline" onClick={() => {
              if (userLightstickBalance === 0) {
                toast.error('You need at least 1 Lightstick to create a proposal');
                return;
              }
              onCreateOpen();
            }}>
              <Plus className="w-4 h-4 mr-1" />
              Create First Proposal
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground/70">
              Login to create and vote on proposals
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 -mx-4 px-4">
      <div className="space-y-4 pb-4">
        {/* 관리자용 백필 버튼 */}
        {isAdmin && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-amber-600 dark:text-amber-400">
                <strong>Admin:</strong> Backfill naming proposals for existing lightsticks
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleBackfillNamingProposals}
                disabled={isBackfilling}
                className="border-amber-500/50 text-amber-600 hover:bg-amber-500/20"
              >
                <Wand2 className="w-4 h-4 mr-1" />
                {isBackfilling ? 'Processing...' : 'Backfill'}
              </Button>
            </div>
          </div>
        )}
        {/* 활성 제안 - 캐주얼하고 예쁜 디자인 */}
        {activeProposals.length > 0 && (
          <div className="space-y-4">
            {/* 헤더 - 그라데이션 배경과 아이콘 */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Timer className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-base bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  {proposalT ? proposalT('ui_active_voting') : 'Active Voting'}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {activeProposals.length} proposal{activeProposals.length > 1 ? 's' : ''} waiting for your vote ✨
                </p>
              </div>
            </div>
            
            {/* 제안 카드들 */}
            <div className="space-y-3">
              {activeProposals.map((proposal, index) => (
                <div 
                  key={proposal.id} 
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <ProposalCard 
                    proposal={proposal}
                    userVote={userVotes[proposal.id]}
                    userTier={userTier}
                    userLightstickBalance={userLightstickBalance}
                    totalVotingPower={totalVotingPower}
                    onVote={onVote}
                    isVoting={isVoting}
                    isActive
                    isAdmin={isAdmin}
                    onApprove={onApprove}
                    isApproving={isApproving}
                    onExecute={onExecute}
                    isExecuting={isExecuting}
                    onDelete={onDelete}
                    isDeleting={isDeleting}
                    proposalT={proposalT}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 과거 제안 */}
        {pastProposals.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">
              {proposalT ? proposalT('ui_past_proposals') : 'Past Proposals'} ({pastProposals.length})
            </h4>
            {pastProposals.map(proposal => (
              <ProposalCard 
                key={proposal.id}
                proposal={proposal}
                userVote={userVotes[proposal.id]}
                userTier={userTier}
                userLightstickBalance={userLightstickBalance}
                totalVotingPower={totalVotingPower}
                onVote={onVote}
                isVoting={isVoting}
                isActive={false}
                isAdmin={isAdmin}
                onApprove={onApprove}
                isApproving={isApproving}
                onExecute={onExecute}
                isExecuting={isExecuting}
                onDelete={onDelete}
                isDeleting={isDeleting}
                proposalT={proposalT}
              />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

interface ProposalCardProps {
  proposal: Proposal;
  userVote?: ProposalVote;
  userTier: { weight: number; name: string; color: string };
  userLightstickBalance: number;
  totalVotingPower: number;
  onVote: (proposalId: string, voteType: 'for' | 'against') => void;
  isVoting: boolean;
  isActive: boolean;
  isAdmin?: boolean;
  onApprove?: (proposalId: string) => void;
  isApproving?: boolean;
  onExecute?: (proposalId: string) => void;
  isExecuting?: boolean;
  onDelete?: (proposalId: string) => void;
  isDeleting?: boolean;
  proposalT?: (key: string) => string;
}

const ProposalCard = ({ 
  proposal, 
  userVote, 
  userTier, 
  userLightstickBalance,
  totalVotingPower,
  onVote, 
  isVoting,
  isActive,
  isAdmin,
  onApprove,
  isApproving,
  onExecute,
  isExecuting,
  onDelete,
  isDeleting,
  proposalT,
}: ProposalCardProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [newOpinion, setNewOpinion] = useState('');

  const typeConfig = PROPOSAL_TYPES.find(t => t.value === proposal.proposal_type) || PROPOSAL_TYPES[0];
  const statusConfig = STATUS_CONFIG[proposal.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.voting;
  const isDiscussion = proposal.proposal_format === 'discussion';
  
  const totalVotes = proposal.total_votes_for + proposal.total_votes_against;
  const forPercentage = totalVotes > 0 ? (proposal.total_votes_for / totalVotes) * 100 : 50;
  
  // 정족수 계산
  const quorumReached = totalVotingPower > 0 
    ? (proposal.total_vote_weight / totalVotingPower) * 100 >= proposal.quorum_threshold
    : false;

  const isExpired = isPast(new Date(proposal.voting_end_at));
  const hasVoted = !!userVote;
  const canVote = isActive && !isExpired && !hasVoted;
  
  // 제안자 본인인지 확인
  const isProposer = user?.id === proposal.proposer?.id;

  // Discussion 형식: 의견 목록 조회
  const { data: opinions } = useQuery({
    queryKey: ['proposal-opinions', proposal.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_proposal_opinions')
        .select(`
          id,
          opinion,
          lightstick_count,
          votes_for,
          votes_against,
          total_vote_weight,
          created_at,
          user:profiles!support_proposal_opinions_user_id_fkey(id, username, avatar_url)
        `)
        .eq('proposal_id', proposal.id)
        .order('votes_for', { ascending: false });
      
      if (error) throw error;
      return data as ProposalOpinion[];
    },
    enabled: isDiscussion,
  });

  // 사용자의 의견 투표 현황 조회
  const { data: userOpinionVotes } = useQuery({
    queryKey: ['user-opinion-votes', proposal.id, user?.id],
    queryFn: async () => {
      if (!user?.id || !opinions?.length) return {};
      
      const opinionIds = opinions.map(o => o.id);
      const { data, error } = await supabase
        .from('support_proposal_opinion_votes')
        .select('id, opinion_id, vote_type, vote_weight')
        .eq('user_id', user.id)
        .in('opinion_id', opinionIds);
      
      if (error) throw error;
      
      const voteMap: Record<string, OpinionVote> = {};
      data?.forEach(v => {
        voteMap[v.opinion_id] = v as OpinionVote;
      });
      return voteMap;
    },
    enabled: isDiscussion && !!user?.id && !!opinions?.length,
  });

  // 의견에 투표하기
  const voteOpinionMutation = useMutation({
    mutationFn: async ({ opinionId, voteType }: { opinionId: string; voteType: 'for' | 'against' }) => {
      if (!user?.id) throw new Error('Login required');
      const minRequired = proposal.min_lightstick_required ?? 0;
      if (minRequired > 0 && userLightstickBalance < minRequired) {
        throw new Error(`You need at least ${minRequired} Lightstick(s) to vote`);
      }

      const tier = getVoteWeight(userLightstickBalance);

      const { error } = await supabase
        .from('support_proposal_opinion_votes')
        .upsert({
          opinion_id: opinionId,
          user_id: user.id,
          vote_type: voteType,
          vote_weight: tier.weight,
          lightstick_count: userLightstickBalance,
        }, {
          onConflict: 'opinion_id,user_id',
        });

      if (error) throw error;

      // 온체인 기록 (백그라운드)
      supabase.functions.invoke('record-opinion-vote-onchain', {
        body: {
          opinionId,
          userId: user.id,
          voteType,
          voteWeight: tier.weight,
        },
      }).then(({ error: onchainError }) => {
        if (onchainError) {
          console.error('On-chain opinion vote recording failed:', onchainError);
        } else {
          console.log('Opinion vote recorded on-chain successfully');
          // 온체인 트랜잭션 카운트 갱신 이벤트
          window.dispatchEvent(new CustomEvent('onchainTxUpdated'));
        }
      });
    },
    onSuccess: () => {
      toast.success('Vote recorded!');
      queryClient.invalidateQueries({ queryKey: ['proposal-opinions', proposal.id] });
      queryClient.invalidateQueries({ queryKey: ['user-opinion-votes', proposal.id, user?.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 사용자가 이미 의견을 제출했는지 확인
  const userOpinion = opinions?.find(o => o.user?.id === user?.id);

  // 의견 제출 mutation
  const submitOpinionMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Login required');
      const minRequired = proposal.min_lightstick_required ?? 0;
      if (minRequired > 0 && userLightstickBalance < minRequired) {
        throw new Error(`You need at least ${minRequired} Lightstick(s) to submit an opinion`);
      }
      if (!newOpinion.trim()) throw new Error('Please enter your opinion');

      const { data, error } = await supabase
        .from('support_proposal_opinions')
        .upsert({
          proposal_id: proposal.id,
          user_id: user.id,
          opinion: newOpinion.trim(),
          lightstick_count: userLightstickBalance,
        }, {
          onConflict: 'proposal_id,user_id',
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('Opinion submitted!');
      setNewOpinion('');
      queryClient.invalidateQueries({ queryKey: ['proposal-opinions', proposal.id] });

      // 온체인 기록 (백그라운드)
      if (data?.id) {
        supabase.functions.invoke('record-opinion-onchain', {
          body: {
            opinionId: data.id,
            userId: user?.id,
            proposalId: proposal.id,
            opinion: newOpinion.trim(),
          },
        }).then(({ error: onchainError }) => {
          if (onchainError) {
            console.error('On-chain opinion recording failed:', onchainError);
          } else {
            console.log('Opinion recorded on-chain successfully');
            // 온체인 트랜잭션 카운트 갱신 이벤트
            window.dispatchEvent(new CustomEvent('onchainTxUpdated'));
          }
        });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 의견 삭제 mutation (본인 또는 관리자)
  const deleteOpinionMutation = useMutation({
    mutationFn: async (opinionId?: string) => {
      if (!user?.id) throw new Error('Login required');
      
      // 관리자는 특정 의견 ID로 삭제, 일반 사용자는 자신의 의견 삭제
      if (isAdmin && opinionId) {
        const { error } = await supabase
          .from('support_proposal_opinions')
          .delete()
          .eq('id', opinionId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('support_proposal_opinions')
          .delete()
          .eq('proposal_id', proposal.id)
          .eq('user_id', user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Opinion deleted!');
      queryClient.invalidateQueries({ queryKey: ['proposal-opinions', proposal.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 이름 선정 mutation (community_naming 제안용)
  const selectNameMutation = useMutation({
    mutationFn: async (selectedName: string) => {
      if (!isAdmin) throw new Error('Admin access required');
      
      const { error } = await supabase
        .from('support_proposals')
        .update({ selected_result: selectedName })
        .eq('id', proposal.id);

      if (error) throw error;
    },
    onSuccess: (_, selectedName) => {
      toast.success(`"${selectedName}" selected as the fandom name!`);
      queryClient.invalidateQueries({ queryKey: ['support-proposals'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const isCommunityNaming = proposal.proposal_category === 'community_naming';

  return (
    <div className={`p-3 sm:p-4 rounded-2xl border-2 transition-all duration-300 hover:shadow-lg ${
      isActive 
        ? 'bg-white dark:bg-card border-blue-500/30 hover:border-blue-500/50 shadow-md shadow-blue-500/5' 
        : 'bg-muted/20 border-border/30 opacity-70'
    }`}>
      {/* Proposal 타이틀 + Chat 버튼 행 */}
      {isActive && (
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <span className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Proposal</span>
          <Button 
            size="sm"
            className="h-6 sm:h-7 rounded-full text-[9px] sm:text-[10px] px-2.5 sm:px-3 bg-primary text-white hover:bg-primary/90 gap-1"
            onClick={() => navigate(`/proposal/${proposal.id}/chat`)}
          >
            <MessageCircle className="w-3 h-3" />
            <span>Chat</span>
          </Button>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
        <div className="flex-1 min-w-0">
          <span className="font-bold text-base sm:text-lg line-clamp-2 block leading-tight">{proposalT ? proposalT(`p_title_${proposal.id}`) : proposal.title}</span>
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
            <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0.5 h-5">
              {typeConfig.label}
            </Badge>
            {isDiscussion && (
              <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0.5 h-5 border-purple-500/50 text-purple-500">
                💬 Discussion
              </Badge>
            )}
          </div>
        </div>
        {/* 삭제 버튼 (제안자 본인 또는 관리자) */}
        {(isProposer || isAdmin) && proposal.status === 'voting' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this proposal?')) {
                onDelete?.(proposal.id);
              }
            }}
            disabled={isDeleting}
          >
            <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </Button>
        )}
      </div>

      {/* 설명 */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
        {proposalT ? proposalT(`p_desc_${proposal.id}`) : proposal.description}
      </p>

      {/* 요청 금액 */}
      {proposal.requested_amount > 0 && (
        <div className="flex items-center gap-1 text-sm text-primary mb-3">
          <span>💰</span>
          <span>Est. Budget: ${proposal.requested_amount.toFixed(2)}</span>
        </div>
      )}

      {/* Decision 형식: 투표 현황 */}
      {!isDiscussion && (
        <>
          <div className="space-y-3 mb-4 p-3 rounded-xl bg-muted/30">
            <div className="flex items-center justify-between text-base font-medium">
              <span className="flex items-center gap-2 text-green-500">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <ThumbsUp className="w-3.5 h-3.5" />
                </div>
                {proposal.total_votes_for} Agree
              </span>
              <span className="flex items-center gap-2 text-red-500">
                {proposal.total_votes_against} Disagree
                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                  <ThumbsDown className="w-3.5 h-3.5" />
                </div>
              </span>
            </div>
            <div className="relative">
              <Progress 
                value={forPercentage} 
                className="h-3 bg-red-500/20 rounded-full overflow-hidden"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white drop-shadow-sm">
                  {forPercentage.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <Badge 
                variant="outline" 
                className={`text-[10px] ${quorumReached ? 'border-green-500/50 text-green-500 bg-green-500/10' : 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10'}`}
              >
                {quorumReached ? '✓ Quorum reached' : `⏳ Quorum: ${proposal.quorum_threshold}%`}
              </Badge>
            </div>
          </div>

          {/* 투표 완료 표시 */}
          {hasVoted && (
            <div className={`flex items-center justify-center gap-2 p-3 rounded-xl ${
              userVote.vote_type === 'for' 
                ? 'bg-gradient-to-r from-green-500/10 to-green-500/5 border-2 border-green-500/30' 
                : 'bg-gradient-to-r from-red-500/10 to-red-500/5 border-2 border-red-500/30'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                userVote.vote_type === 'for' ? 'bg-green-500' : 'bg-red-500'
              }`}>
                <Check className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold">
                You voted {userVote.vote_type === 'for' ? 'Agree' : 'Disagree'} 
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({userTier.weight}x power)
                </span>
              </span>
            </div>
          )}

          {/* 투표 버튼 */}
          {canVote && (
            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg shadow-green-500/20 transition-all hover:scale-[1.02]"
                onClick={() => {
                  const minRequired = proposal.min_lightstick_required ?? 0;
                  if (minRequired > 0 && userLightstickBalance < minRequired) {
                    toast.error(`You need at least ${minRequired} Lightstick(s) to vote`);
                    return;
                  }
                  onVote(proposal.id, 'for');
                }}
                disabled={isVoting}
              >
                <ThumbsUp className="w-5 h-5 mr-2" />
                Agree
              </Button>
              <Button
                size="lg"
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02]"
                onClick={() => {
                  const minRequired = proposal.min_lightstick_required ?? 0;
                  if (minRequired > 0 && userLightstickBalance < minRequired) {
                    toast.error(`You need at least ${minRequired} Lightstick(s) to vote`);
                    return;
                  }
                  onVote(proposal.id, 'against');
                }}
                disabled={isVoting}
              >
                <ThumbsDown className="w-5 h-5 mr-2" />
                Disagree
              </Button>
            </div>
          )}
        </>
      )}

      {/* Discussion 형식: 의견 목록 및 제출 */}
      {isDiscussion && (
        <div className="space-y-2 sm:space-y-3">
          {/* 의견 목록 */}
          <div className="space-y-2 max-h-60 sm:max-h-72 overflow-y-auto">
            {opinions && opinions.length > 0 ? (
              opinions.map((opinion, index) => {
                const opinionVote = userOpinionVotes?.[opinion.id];
                const hasVotedThisOpinion = !!opinionVote;
                const canVoteOpinion = isActive && !isExpired && user && opinion.user?.id !== user?.id;
                const totalOpinionVotes = opinion.votes_for + opinion.votes_against;
                const opinionForPercentage = totalOpinionVotes > 0 ? (opinion.votes_for / totalOpinionVotes) * 100 : 0;

                return (
                  <div 
                    key={opinion.id} 
                    className={`p-2.5 rounded-xl text-xs border-2 transition-all ${
                      opinion.user?.id === user?.id 
                        ? 'bg-primary/10 border-primary/30' 
                        : hasVotedThisOpinion
                          ? opinionVote.vote_type === 'for'
                            ? 'bg-green-500/5 border-green-500/30'
                            : 'bg-red-500/5 border-red-500/30'
                          : 'bg-muted/20 border-border/30 hover:border-border/50'
                    }`}
                  >
                    {/* 헤더: 순위, 작성자, 라이트스틱 */}
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <span className="font-semibold text-[11px] sm:text-xs truncate flex-1">
                        {index === 0 && '🥇 '}
                        {index === 1 && '🥈 '}
                        {index === 2 && '🥉 '}
                        @{opinion.user?.username || 'unknown'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-muted-foreground text-[10px]">
                          🪄 {opinion.lightstick_count}
                        </span>
                        {/* 관리자가 community_naming 제안에서 이름 선정 */}
                        {isAdmin && isCommunityNaming && proposal.status === 'approved' && (
                          <Button
                            size="sm"
                            variant={proposal.selected_result === opinion.opinion ? "default" : "outline"}
                            className="h-5 px-1.5 text-[9px]"
                            onClick={() => selectNameMutation.mutate(opinion.opinion)}
                            disabled={selectNameMutation.isPending}
                          >
                            {proposal.selected_result === opinion.opinion ? '✓' : 'Select'}
                          </Button>
                        )}
                        {/* 관리자는 모든 의견 삭제 가능 */}
                        {isAdmin && opinion.user?.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm('Delete this opinion?')) {
                                deleteOpinionMutation.mutate(opinion.id);
                              }
                            }}
                            disabled={deleteOpinionMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 의견 내용 */}
                    <p className="text-foreground text-[12px] sm:text-xs font-medium break-words mb-2">
                      "{opinion.opinion}"
                    </p>

                    {/* 투표 현황 바 */}
                    <div className="relative h-2 rounded-full bg-red-500/20 overflow-hidden mb-2">
                      <div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                        style={{ width: `${opinionForPercentage}%` }}
                      />
                    </div>

                    {/* 투표 상태 또는 버튼 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-green-500 font-medium flex items-center gap-0.5">
                          <ThumbsUp className="w-3 h-3" /> {opinion.votes_for}
                        </span>
                        <span className="text-red-500 font-medium flex items-center gap-0.5">
                          <ThumbsDown className="w-3 h-3" /> {opinion.votes_against}
                        </span>
                      </div>

                      {/* 이미 투표했으면 표시 */}
                      {hasVotedThisOpinion ? (
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] px-1.5 py-0 h-4 ${
                            opinionVote.vote_type === 'for' 
                              ? 'border-green-500/50 text-green-500 bg-green-500/10' 
                              : 'border-red-500/50 text-red-500 bg-red-500/10'
                          }`}
                        >
                          You voted {opinionVote.vote_type === 'for' ? '👍' : '👎'}
                        </Badge>
                      ) : canVoteOpinion ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px] border-green-500/50 text-green-500 hover:bg-green-500 hover:text-white"
                            onClick={() => {
                              const minRequired = proposal.min_lightstick_required ?? 0;
                              if (minRequired > 0 && userLightstickBalance < minRequired) {
                                toast.error(`You need at least ${minRequired} Lightstick(s) to vote`);
                                return;
                              }
                              voteOpinionMutation.mutate({ opinionId: opinion.id, voteType: 'for' });
                            }}
                            disabled={voteOpinionMutation.isPending}
                          >
                            <ThumbsUp className="w-3 h-3 mr-0.5" /> Agree
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px] border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white"
                            onClick={() => {
                              const minRequired = proposal.min_lightstick_required ?? 0;
                              if (minRequired > 0 && userLightstickBalance < minRequired) {
                                toast.error(`You need at least ${minRequired} Lightstick(s) to vote`);
                                return;
                              }
                              voteOpinionMutation.mutate({ opinionId: opinion.id, voteType: 'against' });
                            }}
                            disabled={voteOpinionMutation.isPending}
                          >
                            <ThumbsDown className="w-3 h-3 mr-0.5" /> Disagree
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-[11px] sm:text-xs text-muted-foreground text-center py-4">
                No suggestions yet. Be the first!
              </p>
            )}
          </div>

          {/* 의견 제출 폼 */}
          {isActive && !isExpired && !userOpinion && (
            <div className="flex gap-1.5 sm:gap-2">
              <Input
                placeholder="Your suggestion..."
                value={newOpinion}
                onChange={(e) => setNewOpinion(e.target.value)}
                className="text-xs h-8 sm:h-9"
              />
              <Button
                size="sm"
                className="h-8 sm:h-9 px-2.5 sm:px-3 shrink-0"
                onClick={() => {
                  const minRequired = proposal.min_lightstick_required ?? 0;
                  if (minRequired > 0 && userLightstickBalance < minRequired) {
                    toast.error(`You need at least ${minRequired} Lightstick(s) to submit an opinion`);
                    return;
                  }
                  submitOpinionMutation.mutate();
                }}
                disabled={submitOpinionMutation.isPending || !newOpinion.trim()}
              >
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
            </div>
          )}

          {/* 이미 의견 제출함 */}
          {userOpinion && (
            <div className="flex items-start sm:items-center justify-between gap-2 p-2 rounded-lg bg-primary/10 border border-primary/30">
              <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5 sm:mt-0" />
                <span className="text-[11px] sm:text-xs font-medium break-words">Your suggestion: "{userOpinion.opinion}"</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => {
                  if (confirm('Delete your suggestion?')) {
                    deleteOpinionMutation.mutate(undefined);
                  }
                }}
                disabled={deleteOpinionMutation.isPending}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* 참여 현황 */}
          <div className="flex items-center justify-center gap-2 text-[11px] sm:text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{opinions?.length || 0} suggestions submitted</span>
          </div>
        </div>
      )}

      {/* 메타 정보 */}
      <div className="flex items-center justify-between mt-2 sm:mt-3 text-[9px] sm:text-[10px] text-muted-foreground">
        <span className="truncate max-w-[40%]">by @{proposal.proposer?.username || 'unknown'}</span>
        <span className="flex items-center gap-1 shrink-0">
          <Clock className="w-3 h-3" />
          {isExpired 
            ? `Ended ${formatDistanceToNow(new Date(proposal.voting_end_at))} ago`
            : `${formatDistanceToNow(new Date(proposal.voting_end_at))} left`
          }
        </span>
      </div>

      {/* 투표 조건 충족 + 승인 대기 (Approve 버튼) - Decision 형식만 */}
      {!isDiscussion && ((forPercentage === 100 && quorumReached) || (isExpired && forPercentage >= 50 && quorumReached)) && proposal.status === 'voting' && (
        <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Check className="w-4 h-4" />
              <span className="text-sm font-semibold">Voting Conditions Met!</span>
            </div>
            {isAdmin && onApprove && (
              <Button
                size="sm"
                onClick={() => onApprove(proposal.id)}
                disabled={isApproving}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isApproving ? 'Approving...' : 'Approve'}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isAdmin 
              ? 'Click "Approve" to officially pass this proposal.'
              : 'Awaiting admin approval to confirm this proposal has passed.'
            }
          </p>
        </div>
      )}

      {/* Discussion 형식: 종료 후 승인 버튼 */}
      {isDiscussion && isExpired && proposal.status === 'voting' && (
        <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Check className="w-4 h-4" />
              <span className="text-sm font-semibold">Discussion Ended!</span>
            </div>
            {isAdmin && onApprove && (
              <Button
                size="sm"
                onClick={() => onApprove(proposal.id)}
                disabled={isApproving}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isApproving ? 'Approving...' : 'Approve'}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isAdmin 
              ? 'Review the suggestions and approve to proceed.'
              : 'Awaiting admin review of the suggestions.'
            }
          </p>
        </div>
      )}

      {/* 승인 완료 + 실행 대기 (Execute 버튼) */}
      {proposal.status === 'approved' && (
        <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="w-4 h-4" />
              <span className="text-sm font-semibold">Proposal Passed!</span>
            </div>
            {isAdmin && onExecute && (
              <Button
                size="sm"
                onClick={() => onExecute(proposal.id)}
                disabled={isExecuting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isExecuting ? 'Executing...' : 'Execute'}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isAdmin 
              ? 'Click "Execute" to proceed with implementation.'
              : 'This proposal has been approved. Awaiting admin execution.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default SupportProposals;
