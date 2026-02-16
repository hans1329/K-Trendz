import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { MessageCircle, Plus, Users, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface WikiEntryChatroomsProps {
  wikiEntryId: string;
  hasLightstick: boolean;
}

interface Chatroom {
  id: string;
  title: string;
  description: string | null;
  creator_id: string;
  wiki_entry_id: string;
  is_active: boolean;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
    display_name: string | null;
  };
  message_count?: number;
  last_message_at?: string;
}

const WikiEntryChatrooms = ({ wikiEntryId, hasLightstick }: WikiEntryChatroomsProps) => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // 채팅방 목록 가져오기
  const { data: chatrooms, isLoading } = useQuery({
    queryKey: ['wiki-entry-chatrooms', wikiEntryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wiki_entry_chatrooms')
        .select(`
          *,
          profiles:creator_id(username, avatar_url, display_name)
        `)
        .eq('wiki_entry_id', wikiEntryId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 각 채팅방의 메시지 수와 마지막 메시지 시간 가져오기
      const chatroomsWithStats = await Promise.all(
        (data || []).map(async (room) => {
          const { count } = await supabase
            .from('wiki_entry_chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('chatroom_id', room.id);

          const { data: lastMessage } = await supabase
            .from('wiki_entry_chat_messages')
            .select('created_at')
            .eq('chatroom_id', room.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...room,
            message_count: count || 0,
            last_message_at: lastMessage?.created_at,
          };
        })
      );

      return chatroomsWithStats as Chatroom[];
    },
    enabled: !!wikiEntryId,
  });

  // 채팅방 생성
  const createChatroomMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('wiki_entry_chatrooms')
        .insert({
          wiki_entry_id: wikiEntryId,
          title: title.trim(),
          description: description.trim() || null,
          creator_id: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Chatroom created!');
      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['wiki-entry-chatrooms', wikiEntryId] });
    },
    onError: (error: Error) => {
      if (error.message.includes('policy')) {
        toast.error('Only lightstick holders can create chatrooms');
      } else {
        toast.error(error.message);
      }
    },
  });

  // 채팅방 삭제
  const deleteChatroomMutation = useMutation({
    mutationFn: async (chatroomId: string) => {
      const { error } = await supabase
        .from('wiki_entry_chatrooms')
        .delete()
        .eq('id', chatroomId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Chatroom deleted');
      queryClient.invalidateQueries({ queryKey: ['wiki-entry-chatrooms', wikiEntryId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    createChatroomMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:max-w-2xl sm:mx-auto px-0">
      {/* 생성 버튼 */}
      {user && hasLightstick && (
        <div className="flex justify-end">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-full">
                <Plus className="w-4 h-4" />
                Create Chatroom
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md mx-4">
              <DialogHeader>
                <DialogTitle>Create New Chatroom</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter chatroom title..."
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter description..."
                    rows={3}
                    maxLength={500}
                  />
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-full w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createChatroomMutation.isPending || !title.trim()}
                  className="rounded-full w-full sm:w-auto"
                >
                  {createChatroomMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* 채팅방 안내 */}
      {!hasLightstick && user && (
        <Card className="bg-muted/50">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            Get a lightstick to create and join chatrooms
          </CardContent>
        </Card>
      )}

      {/* 채팅방 목록 */}
      {chatrooms && chatrooms.length > 0 ? (
        <div className="space-y-2">
          {chatrooms.map((room) => {
            const canDelete = room.creator_id === user?.id || isAdmin;
            
            return (
              <Card
                key={room.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/k/${room.wiki_entry_id}/chat/${room.id}`)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate mb-0.5">{room.title}</h3>
                      {room.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 sm:line-clamp-2 mb-1.5">
                          {room.description}
                        </p>
                      )}
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Avatar className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                            <AvatarImage src={room.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="text-[7px] sm:text-[8px]">
                              {(room.profiles?.display_name || room.profiles?.username || 'U')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[80px] sm:max-w-none">{room.profiles?.display_name || room.profiles?.username}</span>
                        </div>
                        <span className="hidden sm:inline">•</span>
                        <span>{room.message_count} msgs</span>
                        {room.last_message_at && (
                          <>
                            <span>•</span>
                            <span className="truncate">{formatDistanceToNow(new Date(room.last_message_at), { addSuffix: true })}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this chatroom?')) {
                            deleteChatroomMutation.mutate(room.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No chatrooms yet</p>
            {hasLightstick && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Be the first to create one!
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WikiEntryChatrooms;
