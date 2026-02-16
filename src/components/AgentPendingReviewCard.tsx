// 에이전트가 생성한 pending 메시지를 리뷰하는 카드 컴포넌트
import { useState } from 'react';
import LinkPreviewCard, { extractUrls } from '@/components/LinkPreviewCard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Check, Pencil, RefreshCw, Trash2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PendingMessage {
  id: string;
  message: string;
  topic_type: string | null;
  created_at: string;
  metadata?: {
    user_agent_name?: string;
    user_agent_emoji?: string;
    user_agent_id?: string;
  } | null;
  agent_personas?: {
    name: string;
    avatar_emoji: string;
  } | null;
}

interface AgentPendingReviewCardProps {
  msg: PendingMessage;
  translateFn?: (key: string) => string;
}

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

const AgentPendingReviewCard = ({ msg, translateFn }: AgentPendingReviewCardProps) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState(msg.message);
  const topic = topicConfig[msg.topic_type || 'general'] || topicConfig.general;
  const meta = msg.metadata as PendingMessage['metadata'];
  const agentName = msg.agent_personas?.name || meta?.user_agent_name || 'Agent';
  const agentEmoji = msg.agent_personas?.avatar_emoji || meta?.user_agent_emoji || '🤖';
  const userAgentId = meta?.user_agent_id;

  // 유저 에이전트 아바타 조회
  const { data: agentAvatar } = useQuery({
    queryKey: ['agent-avatar', userAgentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_agents')
        .select('avatar_url')
        .eq('id', userAgentId!)
        .single();
      return data?.avatar_url || null;
    },
    enabled: !!userAgentId,
  });

  // 승인 뮤테이션
  const approveMutation = useMutation({
    mutationFn: async (messageText?: string) => {
      const updateData: any = { status: 'approved' };
      if (messageText) updateData.message = messageText;
      const { error } = await supabase
        .from('agent_chat_messages')
        .update(updateData)
        .eq('id', msg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Message approved!');
      setIsEditing(false);
      // 번역 캐시 무효화 (수정된 메시지가 즉시 재번역되도록)
      try { localStorage.removeItem(`page-translation:agent-chat:${navigator.language.split('-')[0].toLowerCase()}`); } catch { /* ignore */ }
      queryClient.invalidateQueries({ queryKey: ['agent-chat-messages'] });
      queryClient.invalidateQueries({ queryKey: ['agent-pending-messages'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // 삭제(거절) 뮤테이션
  const removeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('agent_chat_messages')
        .update({ status: 'rejected' })
        .eq('id', msg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Message removed');
      queryClient.invalidateQueries({ queryKey: ['agent-pending-messages'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isPending = approveMutation.isPending || removeMutation.isPending;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        {/* 헤더: 에이전트 이름 + 토픽 + 시간 */}
        <div className="flex items-center gap-2 mb-2">
          <Avatar className="w-7 h-7 shrink-0">
            {agentAvatar ? (
              <img src={agentAvatar} alt={agentName} className="w-full h-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="text-sm bg-primary/10">{agentEmoji}</AvatarFallback>
            )}
          </Avatar>
          <span className="text-sm font-semibold">{agentName}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${topic.color}`}>
            {topic.label}
          </span>
          <span className="text-[10px] text-muted-foreground/50 ml-auto">
            {format(new Date(msg.created_at), 'HH:mm')}
          </span>
        </div>

        {/* 메시지 내용 또는 편집 영역 */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setIsEditing(false); setEditedMessage(msg.message); }}
                disabled={isPending}
                className="rounded-full"
              >
                <X className="w-3 h-3 mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => approveMutation.mutate(editedMessage)}
                disabled={isPending || !editedMessage.trim()}
                className="rounded-full bg-primary text-white hover:bg-primary/90"
              >
                {approveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                Save & Approve
              </Button>
            </div>
          </div>
        ) : (
          <>
            {(() => {
              const rawText = translateFn ? translateFn(`msg_${msg.id}`) : msg.message;
              const urls = extractUrls(msg.message || '');
              // URL이 카드로 표시되면 메시지에서 URL 텍스트 제거
              const displayText = urls.length > 0
                ? urls.reduce((text, u) => text.replace(u, '').replace(/\(\s*\)/, ''), rawText).trim()
                : rawText;
              return (
                <>
                  {displayText && (
                    <p className="text-sm whitespace-pre-wrap break-words text-foreground/80 mb-3">
                      {displayText}
                    </p>
                  )}
                  {urls.length > 0 && (
                    <div className="mb-3">{urls.map((u) => <LinkPreviewCard key={u} url={u} />)}</div>
                  )}
                </>
              );
            })()}

            {/* 액션 버튼들 */}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => approveMutation.mutate(undefined)}
                disabled={isPending}
                className="flex-1 rounded-full bg-primary text-white hover:bg-primary/90"
              >
                {approveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                disabled={isPending}
                className="flex-1 rounded-full"
              >
                <Pencil className="w-3 h-3 mr-1" /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => removeMutation.mutate()}
                disabled={isPending}
                className="flex-1 rounded-full text-destructive hover:text-destructive"
              >
                {removeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                Remove
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentPendingReviewCard;
