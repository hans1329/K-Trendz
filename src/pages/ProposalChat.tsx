import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Send, Loader2, MessageCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ChatMessage {
  id: string;
  proposal_id: string;
  user_id: string;
  original_message: string;
  translated_message: string;
  original_language: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
    display_name: string | null;
  };
}

interface Proposal {
  id: string;
  title: string;
  wiki_entry_id: string;
}

const ProposalChat = () => {
  const { proposalId } = useParams<{ proposalId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [userLanguage, setUserLanguage] = useState('en');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});

  // 사용자 언어 감지
  useEffect(() => {
    const browserLang = navigator.language.split('-')[0];
    setUserLanguage(browserLang);
  }, []);

  // Proposal 정보 가져오기
  const { data: proposal, isLoading: proposalLoading } = useQuery({
    queryKey: ['proposal', proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_proposals')
        .select('id, title, wiki_entry_id')
        .eq('id', proposalId)
        .single();
      
      if (error) throw error;
      return data as Proposal;
    },
    enabled: !!proposalId,
  });

  // 응원봉 소유 확인
  const { data: hasLightstick } = useQuery({
    queryKey: ['has-lightstick-for-proposal', proposalId, user?.id],
    queryFn: async () => {
      if (!user?.id || !proposal?.wiki_entry_id) return false;
      
      const { data, error } = await supabase
        .from('fanz_balances')
        .select(`
          balance,
          fanz_tokens!inner(wiki_entry_id)
        `)
        .eq('user_id', user.id)
        .eq('fanz_tokens.wiki_entry_id', proposal.wiki_entry_id)
        .gte('balance', 1);
      
      if (error) {
        console.error('Error checking lightstick:', error);
        return false;
      }
      
      return data && data.length > 0;
    },
    enabled: !!user?.id && !!proposal?.wiki_entry_id,
  });

  // 채팅 메시지 가져오기
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['proposal-chat', proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_chat_messages')
        .select(`
          *,
          profiles:user_id(username, avatar_url, display_name)
        `)
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!proposalId,
    refetchInterval: 5000, // 5초마다 새로고침
  });

  // 메시지가 업데이트되면 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 메시지 전송
  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      if (!user?.id || !proposalId) throw new Error('Not authenticated');
      
      // 번역 API 호출
      const { data: translateData, error: translateError } = await supabase.functions.invoke('translate-chat-message', {
        body: { message: messageText, targetLanguage: 'en' }
      });

      if (translateError) {
        console.error('Translation error:', translateError);
        throw new Error('Translation failed');
      }

      const { translatedMessage, originalLanguage } = translateData;

      // 메시지 저장
      const { error } = await supabase
        .from('proposal_chat_messages')
        .insert({
          proposal_id: proposalId,
          user_id: user.id,
          original_message: messageText,
          translated_message: translatedMessage,
          original_language: originalLanguage,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['proposal-chat', proposalId] });
    },
    onError: (error: Error) => {
      if (error.message.includes('policy')) {
        toast.error('Only lightstick holders can send messages');
      } else {
        toast.error(error.message);
      }
    },
  });

  // 메시지 삭제
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('proposal_chat_messages')
        .delete()
        .eq('id', messageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-chat', proposalId] });
      toast.success('Message deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    if (!hasLightstick) {
      toast.error('Only lightstick holders can send messages');
      return;
    }
    sendMessageMutation.mutate(message.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 상대방 메시지를 내 언어로 번역
  const translateOtherMessage = async (msg: ChatMessage) => {
    // 이미 번역된 경우 스킵
    if (translatedMessages[msg.id]) return;
    // 내 메시지면 스킵
    if (msg.user_id === user?.id) return;
    // 원본 언어가 내 언어와 같으면 스킵
    if (msg.original_language === userLanguage) return;
    // 내가 영어 사용자면 영어 번역본 사용
    if (userLanguage === 'en') return;

    try {
      const { data, error } = await supabase.functions.invoke('translate-chat-message', {
        body: { message: msg.translated_message, targetLanguage: userLanguage }
      });
      
      if (!error && data?.displayMessage) {
        setTranslatedMessages(prev => ({
          ...prev,
          [msg.id]: data.displayMessage
        }));
      }
    } catch (err) {
      console.error('Translation error:', err);
    }
  };

  // 메시지가 로드되면 상대방 메시지 번역
  useEffect(() => {
    if (messages && userLanguage !== 'en') {
      messages.forEach(msg => {
        if (msg.user_id !== user?.id && msg.original_language !== userLanguage) {
          translateOtherMessage(msg);
        }
      });
    }
  }, [messages, userLanguage, user?.id]);

  // 메시지 표시 (사용자 언어에 맞게)
  const getDisplayMessage = (msg: ChatMessage, isOwn: boolean) => {
    // 자신의 메시지: 원본 그대로 표시
    if (isOwn) {
      return msg.original_message;
    }
    
    // 상대방 메시지
    // 원본 언어가 내 언어와 같으면 원본 표시
    if (msg.original_language === userLanguage) {
      return msg.original_message;
    }
    // 영어 사용자면 영어 번역본 표시
    if (userLanguage === 'en') {
      return msg.translated_message;
    }
    // 내 언어로 번역된 버전이 있으면 표시
    if (translatedMessages[msg.id]) {
      return translatedMessages[msg.id];
    }
    // 번역 중이면 영어 번역본 표시
    return msg.translated_message;
  };

  if (proposalLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Proposal not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <h1 className="font-semibold truncate text-sm sm:text-base">{proposal.title}</h1>
            </div>
            <p className="text-xs text-muted-foreground">
              {hasLightstick ? 'You can chat' : 'View only - Get lightstick to chat'}
            </p>
          </div>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messagesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages && messages.length > 0 ? (
            messages.map((msg) => {
              const isOwn = msg.user_id === user?.id;
              const displayName = msg.profiles?.display_name || msg.profiles?.username || 'Anonymous';
              
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={msg.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">{displayName}</span>
                      <span className="text-xs text-muted-foreground/60">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                      {msg.original_language !== 'en' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {msg.original_language.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-end gap-1">
                      {(isOwn || isAdmin) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
                          aria-label="Delete message"
                          onClick={() => {
                            if (confirm('Delete this message?')) {
                              deleteMessageMutation.mutate(msg.id);
                            }
                          }}
                          disabled={deleteMessageMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2 ${
                          isOwn
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {getDisplayMessage(msg, isOwn)}
                        </p>
                      </div>
                    </div>
                    {/* 원본 메시지 표시 */}
                    <p className="text-xs text-muted-foreground/60 mt-1 italic">
                      Original: {msg.original_message}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground/60">Start the conversation!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border px-4 py-3">
        <div className="max-w-3xl mx-auto">
          {user ? (
            hasLightstick ? (
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message in any language..."
                  className="flex-1"
                  disabled={sendMessageMutation.isPending}
                />
                <Button
                  onClick={handleSend}
                  disabled={!message.trim() || sendMessageMutation.isPending}
                  className="shrink-0"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">
                  Get a lightstick to join the conversation
                </p>
              </div>
            )
          ) : (
            <div className="text-center py-2">
              <Button variant="outline" onClick={() => navigate('/auth')}>
                Login to chat
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProposalChat;
