import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import V2Layout from '@/components/home/V2Layout';
import PostCard from '@/components/PostCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Sparkles, MessageSquare, FileText, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
interface Mention {
  id: string;
  created_at: string;
  post_id: string | null;
  comment_id: string | null;
  mentioner: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  post?: {
    id: string;
    title: string;
  };
  comment?: {
    id: string;
    content: string;
    post_id: string;
  };
}
interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  category: string | null;
  votes: number;
  image_url: string | null;
  visibility: string | null;
  userVote?: "up" | "down" | null;
}
interface WikiEntry {
  id: string;
  title: string;
  slug: string | null;
  schema_type: string;
  image_url: string | null;
  votes: number;
  view_count: number;
  created_at: string;
  is_verified: boolean;
}

interface FollowedEntry {
  id: string;
  created_at: string;
  wiki_entry_id: string;
  // wiki_entries 조인 결과를 수용하기 위한 느슨한 타입
  wiki_entry: any;
}
const Mentions = () => {
  const {
    user,
    profile,
    loading: authLoading
  } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [myEntries, setMyEntries] = useState<WikiEntry[]>([]);
  const [followedEntries, setFollowedEntries] = useState<FollowedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchMentions();
    fetchMyPosts();
    fetchMyEntries();
    fetchFollowedEntries();
  }, [user, authLoading, navigate]);
  const fetchMentions = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const {
        data: mentionsData,
        error
      } = await supabase.from('mentions').select(`
          id,
          created_at,
          post_id,
          comment_id,
          mentioner_user_id
        `).eq('mentioned_user_id', user.id).order('created_at', {
        ascending: false
      }).limit(50);
      if (error) throw error;

      // Fetch additional data
      const enrichedMentions = await Promise.all((mentionsData || []).map(async mention => {
        // Fetch mentioner profile
        const {
          data: mentionerProfile
        } = await supabase.from('profiles').select('username, display_name, avatar_url').eq('id', mention.mentioner_user_id).single();
        let postData = null;
        let commentData = null;
        if (mention.post_id) {
          const {
            data
          } = await supabase.from('posts').select('id, title').eq('id', mention.post_id).single();
          postData = data;
        }
        if (mention.comment_id) {
          const {
            data
          } = await supabase.from('comments').select('id, content, post_id').eq('id', mention.comment_id).single();
          commentData = data;
        }
        return {
          ...mention,
          mentioner: mentionerProfile || {
            username: 'unknown',
            display_name: null,
            avatar_url: null
          },
          post: postData,
          comment: commentData
        };
      }));
      setMentions(enrichedMentions);
    } catch (error) {
      console.error('Error fetching mentions:', error);
    } finally {
      setLoading(false);
    }
  };
  const fetchMyPosts = async () => {
    if (!user) return;
    try {
      const {
        data,
        error
      } = await supabase.from('posts').select('id, title, content, created_at, category, votes, image_url, visibility').eq('user_id', user.id).order('created_at', {
        ascending: false
      }).limit(50);
      if (error) throw error;

      // 사용자의 투표 정보 가져오기
      const postIds = (data || []).map(p => p.id);
      let userVotes: any[] = [];
      if (postIds.length > 0) {
        const {
          data: votesData
        } = await supabase.from('post_votes').select('post_id, vote_type').eq('user_id', user.id).in('post_id', postIds);
        userVotes = votesData || [];
      }

      // posts에 userVote 추가
      const postsWithVotes = (data || []).map(post => {
        const userVote = userVotes.find(v => v.post_id === post.id);
        return {
          ...post,
          userVote: userVote ? userVote.vote_type : null
        };
      });
      setMyPosts(postsWithVotes);
    } catch (error) {
      console.error('Error fetching my posts:', error);
    }
  };
  const fetchMyEntries = async () => {
    if (!user) return;
    try {
      // creator_id 또는 owner_id가 나인 엔트리 조회
      const { data, error } = await supabase
        .from('wiki_entries')
        .select('id, title, slug, schema_type, image_url, votes, view_count, created_at, is_verified, owner_id')
        .or(`creator_id.eq.${user.id},owner_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setMyEntries(data || []);
    } catch (error) {
      console.error('Error fetching my entries:', error);
    }
  };

  const fetchFollowedEntries = async () => {
    if (!user) return;
    try {
      // 1) 내가 팔로우한 row만 가져오기
      const { data: followerRows, error } = await supabase
        .from('wiki_entry_followers')
        .select('id, created_at, wiki_entry_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!followerRows || followerRows.length === 0) {
        setFollowedEntries([]);
        return;
      }

      // 2) 해당 wiki_entry 들을 한 번에 조회
      const entryIds = followerRows.map(row => row.wiki_entry_id);
      const { data: entries, error: entriesError } = await supabase
        .from('wiki_entries')
        .select('id, title, slug, image_url, schema_type, follower_count')
        .in('id', entryIds);

      if (entriesError) throw entriesError;

      // 3) 응원봉 보유 엔트리 확인 (fanz_tokens와 fanz_balances 조인)
      const { data: fanzTokens } = await supabase
        .from('fanz_tokens')
        .select('wiki_entry_id')
        .in('wiki_entry_id', entryIds);

      const fanzTokenEntryIds = new Set((fanzTokens || []).map(t => t.wiki_entry_id));

      // 해당 토큰에 대해 내 밸런스 확인
      const { data: myBalances } = await supabase
        .from('fanz_balances')
        .select('fanz_token_id, balance, fanz_tokens!inner(wiki_entry_id)')
        .eq('user_id', user.id)
        .gt('balance', 0);

      const entryIdsWithLightstick = new Set(
        (myBalances || [])
          .filter((b: any) => b.fanz_tokens?.wiki_entry_id)
          .map((b: any) => b.fanz_tokens.wiki_entry_id)
      );

      const entriesById = Object.fromEntries(
        (entries || []).map(entry => [entry.id, {
          ...entry,
          hasLightstick: entryIdsWithLightstick.has(entry.id)
        }])
      );

      // 4) Supporting 리스트 형태로 매핑 + 응원봉 보유 엔트리 상위 정렬
      const transformedData: FollowedEntry[] = (followerRows || [])
        .map(row => {
          const entry = entriesById[row.wiki_entry_id];
          if (!entry) return null;
          return {
            id: row.id,
            created_at: row.created_at,
            wiki_entry_id: row.wiki_entry_id,
            wiki_entry: entry,
          };
        })
        .filter((item): item is FollowedEntry => item !== null)
        .sort((a, b) => {
          // 응원봉 보유 엔트리를 상위에 배치
          const aHasLightstick = a.wiki_entry?.hasLightstick ? 1 : 0;
          const bHasLightstick = b.wiki_entry?.hasLightstick ? 1 : 0;
          return bHasLightstick - aHasLightstick;
        });

      setFollowedEntries(transformedData);
    } catch (error) {
      console.error('Error fetching followed entries:', error);
    }
  };
  const handleMentionClick = (mention: Mention) => {
    if (mention.post_id) {
      navigate(`/post/${mention.post_id}`);
    } else if (mention.comment?.post_id) {
      navigate(`/post/${mention.comment.post_id}`);
    }
  };
  const handleVote = async (postId: string, type: "up" | "down") => {
    if (!user) return;
    const post = myPosts.find(p => p.id === postId);
    if (!post) return;

    // 투표 취소는 일일 제한에서 제외
    const isUnvoting = post.userVote === type;
    // 투표 전환 (up→down 또는 down→up)은 에너지 소모 없음
    const previewNewVote = isUnvoting ? null : type;
    const isVoteSwitch = post.userVote !== null && previewNewVote !== null && post.userVote !== previewNewVote;
    
    // 새 투표만 에너지 체크 (취소나 전환은 제외)
    if (!isUnvoting && !isVoteSwitch) {
      // 일일 투표 수 체크 (새 투표 또는 투표 변경시만)
      try {
        const {
          data: voteCheck,
          error: checkError
        } = await supabase.rpc('check_and_increment_vote_count', {
          user_id_param: user.id,
          target_id_param: postId,
          target_type_param: 'post'
        });
        if (checkError) throw checkError;
        const checkData = (Array.isArray(voteCheck) ? voteCheck[0] : voteCheck) as {
          can_vote: boolean;
          max_votes: number;
          remaining_votes: number;
          current_level: number;
          completion_rewarded: boolean;
          is_first_vote_today: boolean;
        };
        if (!checkData?.is_first_vote_today || !checkData.can_vote) {
          return;
        }
      } catch (error) {
        console.error("Error checking vote count:", error);
        return;
      }
    }
    const oldUserVote = post.userVote;
    let newUserVote: "up" | "down" | null = type;
    let voteDelta = 0;
    if (post.userVote === type) {
      newUserVote = null;
      voteDelta = type === 'up' ? -1 : 1;
    } else if (post.userVote) {
      voteDelta = type === 'up' ? 2 : -2;
    } else {
      voteDelta = type === 'up' ? 1 : -1;
    }

    // Optimistic update
    setMyPosts(prevPosts => prevPosts.map(p => p.id === postId ? {
      ...p,
      votes: p.votes + voteDelta,
      userVote: newUserVote
    } : p));
    try {
      if (newUserVote === null) {
        const {
          error
        } = await supabase.from('post_votes').delete().eq('post_id', postId).eq('user_id', user.id);
        if (error) throw error;
      } else if (oldUserVote === null) {
        const {
          error
        } = await supabase.from('post_votes').insert({
          post_id: postId,
          user_id: user.id,
          vote_type: newUserVote
        });
        if (error) throw error;
      } else {
        const {
          error
        } = await supabase.from('post_votes').update({
          vote_type: newUserVote
        }).eq('post_id', postId).eq('user_id', user.id);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error voting:', error);
      // Revert on error
      fetchMyPosts();
    }
  };
  if (authLoading) {
    return (
      <V2Layout pcHeaderTitle="My Fanz" showBackButton={true}>
        <div className="py-8 text-center">Loading...</div>
      </V2Layout>
    );
  }
  if (!user) {
    return null;
  }
  return (
    <V2Layout pcHeaderTitle="My Fanz" showBackButton={true}>
      <div className={`${isMobile ? 'px-4' : ''} py-4`}>

        <Tabs defaultValue="supporting" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 h-10">
            <TabsTrigger value="supporting" className="h-10 text-sm sm:text-base">Supporting</TabsTrigger>
            <TabsTrigger value="posts" className="h-10 text-sm sm:text-base">My Posts</TabsTrigger>
            <TabsTrigger value="mentions" className="h-10 text-sm sm:text-base">Mentions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="mentions">
            {loading ? <div className="text-center py-12">Loading mentions...</div> : mentions.length === 0 ? <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No mentions yet</p>
                  <p className="text-sm mt-2">When someone mentions you with @{profile?.username}, it will appear here</p>
                </CardContent>
              </Card> : <div className="space-y-4">
                {mentions.map(mention => <Card key={mention.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleMentionClick(mention)}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={mention.mentioner.avatar_url || undefined} />
                          <AvatarFallback>
                            {mention.mentioner.username[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">
                              {mention.mentioner.display_name || mention.mentioner.username}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              mentioned you
                            </span>
                            {mention.post_id && <Badge variant="secondary" className="gap-1">
                                <FileText className="w-3 h-3" />
                                Post
                              </Badge>}
                            {mention.comment_id && <Badge variant="secondary" className="gap-1">
                                <MessageSquare className="w-3 h-3" />
                                Comment
                              </Badge>}
                          </div>

                          <p className="text-sm text-muted-foreground mb-2">
                            {formatDistanceToNow(new Date(mention.created_at), {
                        addSuffix: true
                      })}
                          </p>

                          {mention.post && <p className="text-sm font-medium line-clamp-2">
                              {mention.post.title}
                            </p>}

                          {mention.comment && <p className="text-sm text-muted-foreground line-clamp-3">
                              {mention.comment.content}
                            </p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>)}
              </div>}
          </TabsContent>

          <TabsContent value="posts">
            {loading ? <div className="text-center py-8 sm:py-12 text-sm sm:text-base">Loading...</div> : myPosts.length === 0 && myEntries.length === 0 ? <Card>
                <CardContent className="py-8 sm:py-12 text-center text-muted-foreground">
                  <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">No activity yet</p>
                  <p className="text-xs sm:text-sm mt-2">Create posts or wiki entries to see them here</p>
                </CardContent>
              </Card> : <div className="space-y-3 sm:space-y-4">
                {/* Wiki Entries */}
                {myEntries.map(entry => <Card key={`entry-${entry.id}`} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/k/${entry.slug || entry.id}`)}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex gap-3 sm:gap-4">
                        {entry.image_url && <img src={entry.image_url} alt={entry.title} className="w-16 h-16 sm:w-20 sm:h-20 rounded object-cover flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm sm:text-lg truncate">{entry.title}</h3>
                              <div className="flex flex-wrap gap-1 sm:gap-2 mt-1">
                                <Badge variant="secondary" className="text-[10px] sm:text-xs">Fanz</Badge>
                                <Badge variant="outline" className="text-[10px] sm:text-xs">{entry.schema_type}</Badge>
                                {entry.is_verified && <Badge variant="default" className="text-[10px] sm:text-xs">✓ Verified</Badge>}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground">
                            <span>👍 {entry.votes}</span>
                            <span>👁️ {entry.view_count}</span>
                            <span className="text-[10px] sm:text-xs">{new Date(entry.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>)}

                {/* Posts */}
                {myPosts.map(post => <PostCard key={post.id} id={post.id} title={post.title} content={post.content} author={profile?.display_name || profile?.username || 'Unknown'} authorAvatarUrl={profile?.avatar_url} category={post.category || 'general'} votes={post.votes || 0} commentCount={0} createdAt={new Date(post.created_at)} userVote={post.userVote} onVote={handleVote} imageUrl={post.image_url || undefined} userId={user?.id} currentUserId={user?.id} visibility={post.visibility} onRefresh={fetchMyPosts} />)}
              </div>}
          </TabsContent>

          <TabsContent value="supporting">
            {loading ? (
              <div className="text-center py-8 sm:py-12 text-sm sm:text-base">Loading...</div>
            ) : followedEntries.length === 0 ? (
              <Card>
                <CardContent className="py-8 sm:py-12 text-center text-muted-foreground">
                  <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">No supporting entries yet</p>
                  <p className="text-xs sm:text-sm mt-2">Start supporting your favorite artists, groups, and more!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {followedEntries.map(follow => (
                  <Card key={follow.id} className={follow.wiki_entry?.hasLightstick ? "border-primary/50 bg-primary/5" : ""}>
                    <CardContent className="p-3 sm:p-4">
                      <div className={isMobile ? "flex flex-col gap-3" : "flex gap-4 items-start"}>
                        <div className="flex gap-3 sm:gap-4 flex-1 min-w-0">
                          {follow.wiki_entry.image_url && (
                            <img 
                              src={follow.wiki_entry.image_url} 
                              alt={follow.wiki_entry.title}
                              className="w-16 h-16 sm:w-20 sm:h-20 rounded object-cover flex-shrink-0 cursor-pointer"
                              onClick={() => navigate(`/fanz/${follow.wiki_entry.slug || follow.wiki_entry.id}`)}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 
                                className="font-semibold text-base sm:text-lg truncate cursor-pointer hover:text-primary"
                                onClick={() => navigate(`/fanz/${follow.wiki_entry.slug || follow.wiki_entry.id}`)}
                              >
                                {follow.wiki_entry.title}
                              </h3>
                              {follow.wiki_entry?.hasLightstick && (
                                <span className="text-base" title="LightStick holder">🪄</span>
                              )}
                            </div>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] sm:text-xs">
                                {follow.wiki_entry.schema_type}
                              </Badge>
                              <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {follow.wiki_entry.follower_count} fans
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                              Supporting since {formatDistanceToNow(new Date(follow.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size={isMobile ? "default" : "sm"}
                          className={isMobile ? "w-full" : ""}
                          onClick={async () => {
                            try {
                              const { error } = await supabase
                                .from('wiki_entry_followers')
                                .delete()
                                .eq('id', follow.id);

                              if (error) throw error;

                              setFollowedEntries(prev => prev.filter(f => f.id !== follow.id));

                              toast({
                                title: "Unfollowed",
                                description: `You are no longer supporting ${follow.wiki_entry.title}`,
                              });
                            } catch (error) {
                              console.error('Error unfollowing:', error);
                              toast({
                                title: "Error",
                                description: "Failed to unfollow",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Unfollow
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </V2Layout>
  );
};
export default Mentions;