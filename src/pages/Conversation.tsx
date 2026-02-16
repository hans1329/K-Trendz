import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import V2Layout from '@/components/home/V2Layout';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Send, MoreVertical, Ban, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { getOtherUserId } from '@/lib/conversations';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface OtherUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

const Conversation = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!conversationId) {
      navigate('/messages');
      return;
    }

    fetchConversationData();
    fetchMessages();

    // Realtime 구독
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          scrollToBottom();
          
          // 상대방이 보낸 메시지면 읽음 처리
          if (payload.new.sender_id !== user.id) {
            markAsRead(payload.new.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, authLoading, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversationData = async () => {
    if (!user || !conversationId) return;

    try {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) throw error;

      if (!conversation) {
        toast.error('Conversation not found');
        navigate('/messages');
        return;
      }

      // 상대방 ID 가져오기
      const otherUserId = getOtherUserId(conversation, user.id);

      // 차단 여부 확인 (차단됐어도 대화는 표시)
      const { data: blockData } = await supabase
        .from('blocked_users')
        .select('id, user_id')
        .or(`and(user_id.eq.${user.id},blocked_user_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},blocked_user_id.eq.${user.id})`)
        .maybeSingle();

      // 상대방 프로필 가져오기
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', otherUserId)
        .single();

      if (profileError) throw profileError;

      setOtherUser(profile);
      
      // 차단 상태 설정
      if (blockData) {
        setIsBlocked(true);
        setBlockedByMe(blockData.user_id === user.id);
      } else {
        setIsBlocked(false);
        setBlockedByMe(false);
      }
    } catch (error) {
      console.error('Error fetching conversation data:', error);
      toast.error('Failed to load conversation');
      navigate('/messages');
    }
  };

  const fetchMessages = async () => {
    if (!conversationId || !user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);

      // 읽지 않은 메시지 읽음 처리
      const unreadMessages = (data || []).filter(
        (msg) => !msg.is_read && msg.sender_id !== user.id
      );

      for (const msg of unreadMessages) {
        await markAsRead(msg.id);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('direct_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', messageId);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !user) {
      console.log('Send message validation failed:', {
        hasMessage: !!newMessage.trim(),
        hasConversationId: !!conversationId,
        hasUser: !!user
      });
      return;
    }

    try {
      setSending(true);
      console.log('Sending message:', {
        conversation_id: conversationId,
        sender_id: user.id,
        content: newMessage.trim()
      });

      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: newMessage.trim(),
        })
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Message sent successfully:', data);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleBlockUser = async () => {
    if (!otherUser || !user) return;
    
    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert({
          user_id: user.id,
          blocked_user_id: otherUser.id,
        });

      if (error) throw error;

      toast.success(`Blocked ${otherUser.display_name || otherUser.username}`);
      setShowBlockDialog(false);
      navigate('/messages');
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
    }
  };

  const handleReportUser = async () => {
    if (!otherUser || !user) return;
    
    try {
      const { error } = await supabase
        .from('user_reports')
        .insert({
          reporter_id: user.id,
          reported_user_id: otherUser.id,
          reason: 'Inappropriate behavior in direct messages',
          status: 'pending',
        });

      if (error) throw error;

      toast.success('Report submitted successfully');
      setShowReportDialog(false);
    } catch (error) {
      console.error('Error reporting user:', error);
      toast.error('Failed to submit report');
    }
  };

  const isMobile = useIsMobile();
  
  if (authLoading || loading) {
    return (
      <V2Layout pcHeaderTitle="Conversation" showBackButton>
        <div className="py-8 text-center">Loading...</div>
      </V2Layout>
    );
  }

  if (!user || !otherUser) {
    return null;
  }

  return (
    <V2Layout pcHeaderTitle={otherUser.display_name || otherUser.username} showBackButton>
      <div className={`${isMobile ? 'pt-16 px-4' : ''} py-4 flex-1 flex flex-col`}>
        {/* Header */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/messages')}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                
                <Avatar className="w-10 h-10">
                  <AvatarImage src={otherUser.avatar_url || undefined} />
                  <AvatarFallback>
                    {otherUser.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <h2 className="font-semibold">
                    {otherUser.display_name || otherUser.username}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    @{otherUser.username}
                  </p>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setShowBlockDialog(true)}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Block User
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowReportDialog(true)}
                    className="cursor-pointer"
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    Report User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className="mb-4 flex-1 flex flex-col min-h-0">
          <CardContent className="p-4 flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-center">
                <div>
                  No messages yet.
                  <br />
                  Start the conversation!
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => {
                  const isOwn = message.sender_id === user.id;
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`w-fit rounded-lg p-3 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 px-1">
                          {formatDistanceToNow(new Date(message.created_at), {
                            addSuffix: true,
                          })}
                          {isOwn && message.is_read && ' · Read'}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Input - Fixed at bottom on mobile */}
        <Card className="mt-auto">
          <CardContent className="p-4">
            {isBlocked ? (
              <div className="text-center py-2 text-sm text-muted-foreground">
                {blockedByMe 
                  ? `You have blocked ${otherUser.display_name || otherUser.username}` 
                  : `${otherUser.display_name || otherUser.username} has blocked you`}
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  disabled={sending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-full shrink-0 p-0 hover:bg-transparent"
                >
                  <Send className="w-6 h-6 text-[#ff4500]" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Block Confirmation Dialog */}
        <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Block User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to block {otherUser?.display_name || otherUser?.username}? 
                They will no longer be able to send you messages.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBlockUser} className="bg-destructive hover:bg-destructive/90">
                Block
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Report Confirmation Dialog */}
        <AlertDialog open={showReportDialog} onOpenChange={setShowReportDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Report User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to report {otherUser?.display_name || otherUser?.username}? 
                Our team will review your report.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReportUser}>
                Report
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </V2Layout>
  );
};

export default Conversation;
