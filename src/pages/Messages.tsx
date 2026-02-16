import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import V2Layout from '@/components/home/V2Layout';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getOtherUserId } from '@/lib/conversations';
import NewConversationDialog from '@/components/NewConversationDialog';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string | null;
  updated_at: string;
  otherUser: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  lastMessage?: {
    content: string;
    sender_id: string;
  };
  unreadCount: number;
}
const Messages = () => {
  const {
    user,
    loading: authLoading
  } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchConversations();

    // Realtime 구독
    const channel = supabase.channel('conversations-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'conversations'
    }, () => {
      fetchConversations();
    }).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'direct_messages'
    }, () => {
      fetchConversations();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, navigate]);
  const fetchConversations = async () => {
    if (!user) return;
    try {
      setLoading(true);

      // 대화 목록 가져오기 (차단된 사용자도 포함)
      const {
        data: conversationsData,
        error
      } = await supabase.from('conversations').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).order('updated_at', {
        ascending: false
      });
      if (error) throw error;

      // 각 대화의 상대방 정보와 마지막 메시지, 읽지 않은 메시지 수 가져오기
      const enrichedConversations = await Promise.all((conversationsData || []).map(async conversation => {
        const otherUserId = getOtherUserId(conversation, user.id);

        // 상대방 프로필 가져오기
        const {
          data: otherUserProfile
        } = await supabase.from('profiles').select('id, username, display_name, avatar_url').eq('id', otherUserId).single();

        // 마지막 메시지 가져오기
        const {
          data: lastMessage
        } = await supabase.from('direct_messages').select('content, sender_id').eq('conversation_id', conversation.id).order('created_at', {
          ascending: false
        }).limit(1).maybeSingle();

        // 읽지 않은 메시지 수 가져오기
        const {
          count: unreadCount
        } = await supabase.from('direct_messages').select('*', {
          count: 'exact',
          head: true
        }).eq('conversation_id', conversation.id).eq('is_read', false).neq('sender_id', user.id);
        return {
          ...conversation,
          otherUser: otherUserProfile || {
            id: otherUserId,
            username: 'Unknown',
            display_name: null,
            avatar_url: null
          },
          lastMessage: lastMessage || undefined,
          unreadCount: unreadCount || 0
        };
      }));
      setConversations(enrichedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return;
    try {
      const {
        error
      } = await supabase.from('conversations').delete().eq('id', conversationToDelete);
      if (error) throw error;
      toast.success('Conversation deleted');
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
      fetchConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
    }
  };
  const openDeleteDialog = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };
  const isMobile = useIsMobile();
  
  if (authLoading) {
    return (
      <V2Layout pcHeaderTitle="Messages" showBackButton={true}>
        <div className="py-8 text-center">Loading...</div>
      </V2Layout>
    );
  }
  if (!user) {
    return null;
  }
  return (
    <V2Layout pcHeaderTitle="Messages" showBackButton={true}>
      <div className={`${isMobile ? 'px-4' : ''} py-4`}>
        <div className="mb-4 flex items-center justify-end">
          <Button onClick={() => setShowNewDialog(true)} size="sm" className="md:size-default shrink-0">
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>

        {loading ? <div className="text-center py-12">Loading conversations...</div> : conversations.length === 0 ? <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-sm mt-2">Start a new conversation to get started</p>
            </CardContent>
          </Card> : <div className="space-y-2">
            {conversations.map(conversation => <Card key={conversation.id} className="hover:shadow-md transition-shadow cursor-pointer relative group" onClick={() => navigate(`/messages/${conversation.id}`)}>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-start gap-2 md:gap-3">
                    <Avatar className="w-10 h-10 md:w-12 md:h-12 shrink-0">
                      <AvatarImage src={conversation.otherUser.avatar_url || undefined} />
                      <AvatarFallback>
                        {conversation.otherUser.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm md:text-base truncate">
                          {conversation.otherUser.display_name || conversation.otherUser.username}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {conversation.unreadCount > 0 && <Badge variant="default" className="text-xs">
                              {conversation.unreadCount}
                            </Badge>}
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-transparent" onClick={e => openDeleteDialog(e, conversation.id)}>
                            <Trash2 className="w-4 h-4 text-primary transition-colors" />
                          </Button>
                        </div>
                      </div>

                      {conversation.lastMessage && <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mb-1">
                          {conversation.lastMessage.sender_id === user.id && 'You: '}
                          {conversation.lastMessage.content}
                        </p>}

                      {conversation.last_message_at && <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(conversation.last_message_at), {
                    addSuffix: true
                  })}
                        </p>}
                    </div>
                  </div>
                </CardContent>
              </Card>)}
          </div>}
      </div>

      <NewConversationDialog open={showNewDialog} onOpenChange={setShowNewDialog} onConversationCreated={conversationId => {
      navigate(`/messages/${conversationId}`);
    }} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone and all messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConversation} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </V2Layout>
  );
};
export default Messages;