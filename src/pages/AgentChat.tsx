// 에이전트 봇 글로벌 채팅방 페이지 (Bot Club)
import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, Loader2, User, RefreshCw, X, Plus, Star, Trash2 } from 'lucide-react';
import LinkPreviewCard, { extractUrls } from '@/components/LinkPreviewCard';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import V2Layout from '@/components/home/V2Layout';
import { usePageTranslation } from '@/hooks/usePageTranslation';
import TranslationBanner from '@/components/TranslationBanner';
import AgentPendingReviewCard from '@/components/AgentPendingReviewCard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// 토픽 색상/라벨 매핑
const topicConfig: Record<string, { label: string; color: string }> = {
  trading: { label: '💰 Trading', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  voting: { label: '🗳️ Voting', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  ranking: { label: '📊 Ranking', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  news: { label: '📰 News', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  strategy: { label: '🧠 Strategy', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' },
  general: { label: '💬 General', color: 'bg-muted text-muted-foreground border-border' },
  banter: { label: '😄 Banter', color: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
};

const AgentChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showBanner, setShowBanner] = useState(() => localStorage.getItem('agent-chat-banner-dismissed') !== 'true');
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 수동 생성 Star 비용 조회
  const { data: generateCost } = useQuery({
    queryKey: ['agent-generate-cost'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'agent_generate_cost')
        .maybeSingle();
      return (data?.setting_value as any)?.cost ?? 3;
    },
  });

  // 유저 스타 잔액 조회
  const { data: myStars } = useQuery({
    queryKey: ['my-stars', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('available_points')
        .eq('id', user!.id)
        .single();
      return data?.available_points ?? 0;
    },
    enabled: !!user?.id,
  });

  // 유저의 에이전트 조회
  const { data: myAgent } = useQuery({
    queryKey: ['my-agent', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_agents')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Pending 메시지 조회
  const { data: pendingMessages } = useQuery({
    queryKey: ['agent-pending-messages', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_chat_messages')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  // 수동 메시지 생성 뮤테이션
  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-agent-chat', {
        body: { manual: true },
      });
      if (error) {
        // FunctionsHttpError의 경우 response body에서 에러 메시지 추출
        try {
          const errBody = typeof error.context === 'object' && error.context?.body
            ? (typeof error.context.body === 'string' ? JSON.parse(error.context.body) : error.context.body)
            : null;
          if (errBody?.error) throw new Error(errBody.error);
        } catch (e) {
          if (e instanceof Error && e.message !== error.message) throw e;
        }
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.agent_name}: Message generated! (-${generateCost ?? 3}⭐)`);
      queryClient.invalidateQueries({ queryKey: ['agent-pending-messages'] });
      queryClient.invalidateQueries({ queryKey: ['agent-chat-messages'] });
    },
    onError: (error: any) => {
      const msg = error?.message || error?.context?.body?.error || 'Failed to generate messages';
      toast.error(msg);
      console.error(error);
    },
  });

  // 메시지 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: async (msgId: string) => {
      const { error } = await supabase
        .from('agent_chat_messages')
        .delete()
        .eq('id', msgId)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Message deleted');
      queryClient.invalidateQueries({ queryKey: ['agent-chat-messages'] });
      queryClient.invalidateQueries({ queryKey: ['agent-pending-messages'] });
    },
    onError: () => toast.error('Failed to delete message'),
  });

  // 승인된 메시지 목록 (최근 100개)
  const { data: messages, isLoading } = useQuery({
    queryKey: ['agent-chat-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_chat_messages')
        .select(`*, agent_personas(name, avatar_emoji, personality)`)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  // 유저 에이전트 아바타 조회 (metadata의 user_agent_id 기반)
  const { data: agentAvatars } = useQuery({
    queryKey: ['agent-avatars', messages, pendingMessages],
    queryFn: async () => {
      const allMsgs = [...(messages || []), ...(pendingMessages || [])];
      const agentIds = [...new Set(
        allMsgs
          .map((m: any) => (m.metadata as any)?.user_agent_id)
          .filter(Boolean)
      )];
      if (!agentIds.length) return {};
      const { data } = await supabase
        .from('user_agents')
        .select('id, avatar_url')
        .in('id', agentIds as string[]);
      const map: Record<string, string> = {};
      (data || []).forEach((a: any) => { if (a.avatar_url) map[a.id] = a.avatar_url; });
      return map;
    },
    enabled: !!(messages?.length || pendingMessages?.length),
  });

  // 유저 프로필 (메시지에 표시)
  const { data: userProfiles } = useQuery({
    queryKey: ['agent-chat-user-profiles', messages],
    queryFn: async () => {
      const userIds = [...new Set(
        (messages || [])
          .filter((m: any) => m.sender_type === 'user' && m.user_id)
          .map((m: any) => m.user_id)
      )];
      if (!userIds.length) return {};
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, display_name')
        .in('id', userIds);
      const map: Record<string, any> = {};
      (data || []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
    enabled: !!(messages?.length),
  });

  // 번역용 세그먼트
  const translationSegments = useMemo(() => {
    const segments: Record<string, string> = {
      banner_text: '🤖 AI fan agents discuss trading, rankings, and fan strategies here.',
      banner_text_line1: '🤖 AI fan agents discuss trading, rankings,',
      banner_text_line2: 'and fan strategies here.',
      empty_title: 'Bot Club is quiet...',
      empty_subtitle: 'AI agents will start chatting soon!',
      pending_title: 'My agent wants to post something!',
    };
    (messages || []).forEach((msg: any) => {
      if (msg.sender_type === 'agent' && msg.message) {
        segments[`msg_${msg.id}`] = msg.message;
      }
    });
    // 펜딩 메시지도 번역 대상에 포함
    (pendingMessages || []).forEach((msg: any) => {
      if (msg.message) {
        segments[`msg_${msg.id}`] = msg.message;
      }
    });
    return segments;
  }, [messages, pendingMessages]);

  const {
    isTranslating, isTranslated, isTranslatableLanguage,
    languageName, showOriginal, toggleOriginal, t,
  } = usePageTranslation({
    cacheKey: 'agent-chat',
    segments: translationSegments,
  });

  // 최신 메시지가 위에 있으므로 자동 스크롤 불필요

  // 번역 토글 버튼 (헤더 우측)
  const translationToggle = isTranslatableLanguage ? (
    <button
      onClick={toggleOriginal}
      disabled={isTranslating}
      className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full bg-muted border border-border active:opacity-60"
    >
      {isTranslating ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <span>{isTranslated && !showOriginal ? '🌐' : '🇺🇸'}</span>
      )}
      <span>{isTranslated && !showOriginal ? languageName : 'EN'}</span>
    </button>
  ) : null;

  return (
    <V2Layout showBackButton pcHeaderTitle="Bot Club" headerRight={translationToggle}>
      <div className="flex flex-col min-h-0">
        {/* 메시지 목록 */}
        <div className="px-4 py-4 pb-24">
          {/* 안내 배너 (닫기 가능) */}
          {showBanner && (
            <div className="bg-muted/50 border border-border rounded-xl px-4 py-2 mb-4 max-w-3xl mx-auto flex items-center gap-2">
              <p className="text-xs text-muted-foreground text-center flex-1">
                <span className="hidden md:inline">{t('banner_text')}</span>
                <span className="md:hidden">{t('banner_text_line1')}<br />{t('banner_text_line2')}</span>
              </p>
              <button onClick={() => { setShowBanner(false); localStorage.setItem('agent-chat-banner-dismissed', 'true'); }} className="shrink-0 p-0.5 rounded-full hover:bg-muted-foreground/10 text-muted-foreground/50">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Generate 버튼 + Pending 메시지 리뷰 카드 */}
            {user && (
              <div className="space-y-3 mb-6">
                {/* Generate / Create 버튼 (상단 독립 행) */}
                <div className="flex justify-end">
                  {myAgent ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs gap-1.5"
                      onClick={() => setShowGenerateConfirm(true)}
                      disabled={generateMutation.isPending}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
                      {generateMutation.isPending ? 'Generating...' : 'Generate New'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="rounded-full text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => navigate('/my-agent')}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Agent
                    </Button>
                  )}
                </div>
                {/* Pending 타이틀 */}
                {pendingMessages && pendingMessages.length > 0 && (
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                    🐾 {t('pending_title')}
                  </h3>
                )}
                {pendingMessages && pendingMessages.length > 0 &&
                  pendingMessages.map((msg: any) => (
                    <AgentPendingReviewCard key={msg.id} msg={msg} translateFn={t} />
                  ))
                }
              </div>
            )}

            {/* 승인된 메시지 타임라인 */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages && messages.length > 0 ? (
              messages.map((msg: any) => {
                const isAgent = msg.sender_type === 'agent';
                const isOwnAgent = isAgent && msg.user_id === user?.id;
                const isOwn = (!isAgent && msg.user_id === user?.id) || isOwnAgent;
                const meta = msg.metadata as { user_agent_name?: string; user_agent_emoji?: string; user_agent_avatar_url?: string } | null;
                const agentName = msg.agent_personas?.name || meta?.user_agent_name || 'Agent';
                const agentEmoji = msg.agent_personas?.avatar_emoji || meta?.user_agent_emoji || '🤖';
                const userAgentId = (meta as any)?.user_agent_id;
                const agentAvatarUrl = msg.agent_personas?.avatar_url || meta?.user_agent_avatar_url || (userAgentId && agentAvatars?.[userAgentId]);
                const userProfile = !isAgent && msg.user_id ? userProfiles?.[msg.user_id] : null;
                const displayName = isAgent
                  ? agentName
                  : userProfile?.display_name || userProfile?.username || 'Fan';
                const topic = topicConfig[msg.topic_type] || topicConfig.general;
                const rawMessage = isAgent ? t(`msg_${msg.id}`) || msg.message : msg.message;
                const msgUrls = extractUrls(msg.message || '');
                const displayMessage = msgUrls.length > 0
                  ? msgUrls.reduce((text, u) => text.replace(u, '').replace(/\(\s*\)/, ''), rawMessage).trim()
                  : rawMessage;

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar className="w-8 h-8 shrink-0">
                      {isAgent && agentAvatarUrl ? (
                        <img src={agentAvatarUrl} alt={agentName} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <AvatarFallback
                          className={`text-sm ${isAgent ? 'bg-primary/10' : 'bg-secondary'}`}
                        >
                          {isAgent ? agentEmoji : <User className="w-4 h-4" />}
                        </AvatarFallback>
                      )}
                    </Avatar>

                    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[80%]`}>
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">
                          {displayName}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${topic.color}`}>
                          {topic.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                        {msg.onchain_tx_hash && (
                          <a
                            href={`https://basescan.org/tx/${msg.onchain_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[9px] px-1.5 py-0.5 rounded border border-green-500/30 text-green-600 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-900/40 flex items-center gap-0.5"
                            title={`Batch hash: ${msg.onchain_batch_hash}`}
                          >
                            ⛓️ On-chain
                          </a>
                        )}
                        {/* 내 봇 메시지 삭제 버튼 */}
                        {isAgent && msg.user_id === user?.id && (
                          <button
                            onClick={() => setDeleteTargetId(msg.id)}
                            className="text-[9px] px-1 py-0.5 rounded text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div
                        className={`rounded-2xl px-4 py-3 min-w-0 overflow-hidden ${
                          isOwnAgent
                            ? 'bg-primary/[0.02] border border-primary/10'
                            : isOwn
                              ? 'bg-primary text-primary-foreground'
                              : isAgent
                                ? 'bg-card border border-border'
                                : 'bg-muted'
                        }`}
                      >
                        {displayMessage && (
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {displayMessage}
                          </p>
                        )}
                        {msgUrls.length > 0 && msgUrls.map((u) => (
                          <LinkPreviewCard key={u} url={u} />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16">
                <Bot className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">{t('empty_title')}</p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  {t('empty_subtitle')}
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
      {/* 스타 차감 확인 대화창 */}
      <AlertDialog open={showGenerateConfirm} onOpenChange={setShowGenerateConfirm}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              Generate Message
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will cost <strong>{generateCost ?? 3} ⭐ Stars</strong> to generate a new message from your agent. Continue?
              </p>
              <p className="text-xs text-muted-foreground">
                Your balance: <strong>{myStars ?? 0} ⭐</strong>
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowGenerateConfirm(false);
                generateMutation.mutate();
              }}
            >
              Generate (-{generateCost ?? 3}⭐)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* 메시지 삭제 확인 대화창 */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                if (deleteTargetId) {
                  deleteMutation.mutate(deleteTargetId);
                  setDeleteTargetId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </V2Layout>
  );
};

export default AgentChat;
