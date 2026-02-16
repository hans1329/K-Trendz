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
import { Bell, MessageSquare, Heart, AtSign, TrendingUp, Trash2, Check, Coins, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  reference_id: string | null;
  actor_id: string | null;
  created_at: string;
  actor?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface PointTransaction {
  id: string;
  user_id: string;
  action_type: string;
  points: number;
  reference_id: string | null;
  created_at: string;
}

interface CombinedNotification extends Notification {
  points?: number;
  action_type?: string;
}

const Notifications = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchNotifications();

    // Realtime 구독
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, navigate]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      setLoading(true);

      console.log('Fetching notifications for user:', user.id);

      // 일반 알림 가져오기
      const { data: notifData, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      console.log('Notifications data:', notifData, 'error:', notifError);

      if (notifError) throw notifError;

      // 포인트 거래 내역 가져오기
      const { data: pointData, error: pointError } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (pointError) throw pointError;

      // 각 알림의 actor 정보 가져오기
      const enrichedNotifications = await Promise.all(
        (notifData || []).map(async (notification) => {
          if (notification.actor_id) {
            const { data: actorProfile } = await supabase
              .from('profiles')
              .select('username, display_name, avatar_url')
              .eq('id', notification.actor_id)
              .single();

            return {
              ...notification,
              actor: actorProfile || undefined,
            };
          }
          return notification;
        })
      );

      // 포인트 거래를 알림 형식으로 변환
      const pointNotifications: CombinedNotification[] = (pointData || []).map((transaction) => {
        const isPositive = transaction.points > 0;
        const actionTypeMap: Record<string, string> = {
          'signup_bonus': 'Welcome Bonus',
          'create_post': 'Post Created',
          'write_comment': 'Comment Written',
          'receive_upvote': 'Upvote Received',
          'first_post_in_community': 'First Community Post',
          'daily_login': 'Daily Login',
          'post_trending': 'Post Trending',
          'create_custom_community': 'Community Created',
          'boost_post_per_hour': 'Post Boosted',
        };

        return {
          id: transaction.id,
          user_id: transaction.user_id,
          type: 'points',
          title: actionTypeMap[transaction.action_type] || transaction.action_type,
          message: `${isPositive ? '+' : ''}${transaction.points} stars`,
          is_read: true, // 포인트 거래는 항상 읽음 처리
          reference_id: transaction.reference_id,
          actor_id: null,
          created_at: transaction.created_at,
          points: transaction.points,
          action_type: transaction.action_type,
        };
      });

      // 모든 알림을 통합하여 시간순으로 정렬
      const allNotifications = [...enrichedNotifications, ...pointNotifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(allNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.reference_id) {
      switch (notification.type) {
        case 'comment':
        case 'vote':
        case 'mention':
          navigate(`/post/${notification.reference_id}`);
          break;
        case 'message':
          navigate(`/messages/${notification.reference_id}`);
          break;
        default:
          break;
      }
    }
  };

  const getNotificationIcon = (type: string, points?: number) => {
    switch (type) {
      case 'comment':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'vote':
        return <Heart className="w-5 h-5 text-red-500" />;
      case 'mention':
        return <AtSign className="w-5 h-5 text-purple-500" />;
      case 'message':
        return <MessageSquare className="w-5 h-5 text-green-500" />;
      case 'boost':
      case 'pin':
        return <TrendingUp className="w-5 h-5 text-orange-500" />;
      case 'points':
        return points && points > 0 
          ? <Coins className="w-5 h-5 text-yellow-500" />
          : <TrendingDown className="w-5 h-5 text-gray-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const filteredNotifications = notifications.filter((n) =>
    filter === 'all' ? true : !n.is_read
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const isMobile = useIsMobile();

  if (authLoading) {
    return (
      <V2Layout pcHeaderTitle="Notifications" showBackButton={true}>
        <div className="py-8 text-center">Loading...</div>
      </V2Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <V2Layout pcHeaderTitle="Notifications" showBackButton={true}>
      <div className={`${isMobile ? 'px-4' : ''} py-4`}>
        <div className="mb-4 flex items-center justify-end gap-2">
          {unreadCount > 0 && (
            <Button
              onClick={markAllAsRead}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              <Check className="w-4 h-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')} className="mb-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="text-center py-12">Loading notifications...</div>
        ) : filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>
                {filter === 'unread'
                  ? 'No unread notifications'
                  : 'No notifications yet'}
              </p>
              <p className="text-sm mt-2">
                {filter === 'all'
                  ? "You'll see notifications here when someone interacts with your content"
                  : 'All caught up!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={`hover:shadow-md transition-shadow cursor-pointer ${
                  !notification.is_read ? 'bg-muted/50' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-start gap-2 md:gap-3">
                    {notification.actor?.avatar_url ? (
                      <Avatar className="w-10 h-10 md:w-12 md:h-12 shrink-0">
                        <AvatarImage src={notification.actor.avatar_url} />
                        <AvatarFallback>
                          {notification.actor.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 flex items-center justify-center bg-muted rounded-full">
                        {getNotificationIcon(notification.type, (notification as CombinedNotification).points)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-semibold text-sm md:text-base">
                          {notification.title}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-primary transition-colors" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mb-1">
                        {notification.message}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </V2Layout>
  );
};

export default Notifications;
