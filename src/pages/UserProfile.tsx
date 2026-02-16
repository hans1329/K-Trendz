import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import V2Layout from '@/components/home/V2Layout';
import { useIsMobile } from '@/hooks/use-mobile';
import PostCard from '@/components/PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Calendar, Edit, Star, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import lightstickImage from '@/assets/ktrendz_lightstick.webp';
interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  current_level: number;
  total_points: number;
}

interface FanzTokenBalance {
  tokenId: string;
  balance: number;
  wikiEntryId: string | null;
  wikiEntryTitle: string | null;
  wikiEntryImage: string | null;
}
interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  votes: number;
  created_at: string;
  userVote?: "up" | "down" | null;
  wikiEntryTitle?: string;
  wikiEntryId?: string;
}
const UserProfile = () => {
  const isMobile = useIsMobile();
  const {
    username
  } = useParams<{
    username: string;
  }>();
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [levelInfo, setLevelInfo] = useState<{
    name: string;
    icon: string | null;
    color: string | null;
    requiredPoints: number;
  } | null>(null);
  const [nextLevelInfo, setNextLevelInfo] = useState<{
    name: string;
    requiredPoints: number;
  } | null>(null);
  const [totalUpvotes, setTotalUpvotes] = useState(0);
  const [fanzTokens, setFanzTokens] = useState<FanzTokenBalance[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  useEffect(() => {
    if (username) {
      fetchUserProfile();
    }
  }, [username]);

  const fetchUserProfile = async () => {
    // 사용자 프로필은 username 기반으로 조회되는데, 과거 데이터 이슈로
    // 대소문자만 다른 동일 username(예: bluesky / BlueSky)이 공존할 수 있다.
    // `.ilike(...).single()`은 다중 행 매칭 시 에러가 나므로,
    // 1) 정확히 일치(eq) 우선
    // 2) 없으면 ilike 결과 중 (본인 로그인 시) 내 user.id 우선
    // 3) 그 외에는 최근 updated_at 우선
    // 방식으로 안전하게 1개만 선택한다.
    setLoading(true);
    setNotFound(false);

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      const profileSelect =
        'id, username, display_name, avatar_url, bio, created_at, current_level, total_points';

      // 1) URL 파라미터와 완전히 동일한 username을 우선 조회 (케이스 포함)
      const { data: exactProfile, error: exactError } = await supabase
        .from('profiles')
        .select(profileSelect)
        .eq('username', username)
        .maybeSingle();

      if (exactError) {
        throw exactError;
      }

      let profileData = exactProfile as Profile | null;

      // 2) 정확 일치가 없으면 case-insensitive 후보 리스트에서 1개를 결정
      if (!profileData) {
        const { data: candidates, error: candidatesError } = await supabase
          .from('profiles')
          .select(profileSelect)
          .ilike('username', username)
          .order('updated_at', { ascending: false })
          .limit(5);

        if (candidatesError) {
          throw candidatesError;
        }

        if (!candidates || candidates.length === 0) {
          setNotFound(true);
          return;
        }

        // 본인 프로필이면 auth uid와 매칭되는 레코드를 우선 사용
        profileData =
          (authUser?.id ? (candidates as Profile[]).find((p) => p.id === authUser.id) : null) ??
          (candidates as Profile[])[0];
      }

      setProfile(profileData);

      // Fetch level info
      await fetchLevelInfo(profileData.current_level);

      // Fetch user's posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          id,
          title,
          content,
          category,
          image_url,
          votes,
          created_at,
          wiki_entry_id,
          wiki_entries:wiki_entry_id (
            title
          )
        `)
        .eq('user_id', profileData.id)
        .order('created_at', {
          ascending: false,
        });

      if (postsError) throw postsError;

      // 사용자의 투표 정보 가져오기
      let userVotes: any[] = [];
      if (authUser && postsData && postsData.length > 0) {
        const postIds = postsData.map((p) => p.id);
        const { data: votesData } = await supabase
          .from('post_votes')
          .select('post_id, vote_type')
          .eq('user_id', authUser.id)
          .in('post_id', postIds);
        userVotes = votesData || [];
      }

      // posts에 userVote 추가
      const postsWithVotes = (postsData || []).map((post) => {
        const userVote = userVotes.find((v) => v.post_id === post.id);
        return {
          ...post,
          userVote: userVote ? userVote.vote_type : null,
          wikiEntryTitle: (post as any).wiki_entries?.title,
          wikiEntryId: (post as any).wiki_entry_id,
        };
      });

      setPosts(postsWithVotes);

      // Calculate total upvotes
      const totalVotes =
        postsData?.reduce((sum, post) => sum + (post.votes || 0), 0) || 0;
      setTotalUpvotes(totalVotes);

      // Fetch user's Fanz Tokens
      fetchUserFanzTokens(profileData.id);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserFanzTokens = async (userId: string) => {
    setLoadingTokens(true);
    try {
      // 타인 프로필에서도 보유 응원봉을 보여주기 위해, 지갑 주소는 Edge Function에서 service role로 조회 후
      // 잔액(토큰 수량)만 안전하게 반환한다. (클라이언트에서 wallet_addresses 직접 조회 금지)
      const { data, error } = await supabase.functions.invoke('get-public-user-fanz-balances', {
        body: { userId },
      });

      if (error) {
        console.error('Error fetching public fanz balances:', error);
        setFanzTokens([]);
        return;
      }

      const balances = (data?.balances || []) as FanzTokenBalance[];
      setFanzTokens(balances.filter((b) => Number(b.balance ?? 0) > 0));
    } catch (error) {
      console.error('Error fetching fanz tokens:', error);
      setFanzTokens([]);
    } finally {
      setLoadingTokens(false);
    }
  };
  const fetchLevelInfo = async (level: number) => {
    try {
      // Fetch current level
      const {
        data: currentLevelData,
        error: currentError
      } = await supabase.from('levels').select('name, icon, color, required_points').eq('id', level).maybeSingle();
      if (currentError) throw currentError;
      if (currentLevelData) {
        setLevelInfo({
          name: currentLevelData.name,
          icon: currentLevelData.icon,
          color: currentLevelData.color,
          requiredPoints: currentLevelData.required_points
        });
      }

      // Fetch next level
      const {
        data: nextLevelData,
        error: nextError
      } = await supabase.from('levels').select('name, required_points').eq('id', level + 1).maybeSingle();
      if (!nextError && nextLevelData) {
        setNextLevelInfo({
          name: nextLevelData.name,
          requiredPoints: nextLevelData.required_points
        });
      } else {
        setNextLevelInfo(null);
      }
    } catch (error) {
      console.error('Error fetching level info:', error);
    }
  };
  const handleVote = async (postId: string, type: 'up' | 'down') => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return;
    }

    const post = posts.find(p => p.id === postId);
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
        const { data: voteCheck, error: checkError } = await supabase
          .rpc('check_and_increment_vote_count', { 
            user_id_param: user.id,
            target_id_param: postId,
            target_type_param: 'post'
          });

        if (checkError) throw checkError;

        const checkData = (Array.isArray(voteCheck) ? voteCheck[0] : voteCheck) as { can_vote: boolean; max_votes: number; remaining_votes: number; current_level: number; completion_rewarded: boolean; is_first_vote_today: boolean };

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
    setPosts(prevPosts => prevPosts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          votes: p.votes + voteDelta,
          userVote: newUserVote
        };
      }
      return p;
    }));

    try {
      if (newUserVote === null) {
        const { error } = await supabase
          .from('post_votes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else if (oldUserVote === null) {
        const { error } = await supabase
          .from('post_votes')
          .insert({
            post_id: postId,
            user_id: user.id,
            vote_type: newUserVote
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_votes')
          .update({ vote_type: newUserVote })
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating vote:', error);
      // Revert on error
      fetchUserProfile();
    }
  };
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  if (loading) {
    return (
      <V2Layout pcHeaderTitle="Profile" showBackButton={true}>
        <div className={`${isMobile ? 'pt-16' : ''} flex items-center justify-center py-20`}>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </V2Layout>
    );
  }
  if (notFound || !profile) {
    return (
      <V2Layout pcHeaderTitle="Profile" showBackButton={true}>
        <div className={`${isMobile ? 'pt-16 px-4' : ''} py-20 max-w-5xl mx-auto text-center`}>
          <h1 className="text-3xl font-bold mb-4">User Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The user @{username} doesn't exist.
          </p>
          <Link to="/">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </V2Layout>
    );
  }
  const isOwnProfile = user?.id === profile.id;
  return (
    <V2Layout pcHeaderTitle={profile.display_name || profile.username} showBackButton={true}>
      <div className={`${isMobile ? 'pt-16 px-3' : ''} py-4 max-w-5xl mx-auto`}>
        <Card className="p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.display_name || profile.username} />
              <AvatarFallback className="text-3xl">
                {(profile.display_name || profile.username).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h1 className="text-2xl font-bold">
                    {profile.display_name || profile.username}
                  </h1>
                  <p className="text-muted-foreground">@{profile.username}</p>
                </div>
                {isOwnProfile && <Link to="/profile">
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  </Link>}
              </div>

              {profile.bio && <p className="text-foreground mb-3">{profile.bio}</p>}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Joined {formatDate(profile.created_at)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Level & Stats Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Level & Experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {levelInfo && <div className="text-center py-3 rounded-lg bg-slate-50">
                  <div className="text-3xl font-bold text-primary mb-1">
                    Level {profile.current_level}
                  </div>
                  <p className="text-sm text-muted-foreground">{levelInfo.name}</p>
                </div>}

              <div className="text-center py-2">
                <div className="text-5xl font-bold text-primary mb-2">
                  {profile.total_points.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">Total Stars Earned</p>
              </div>

              {nextLevelInfo && <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress to Level {profile.current_level + 1}</span>
                    <span className="font-medium">
                      {profile.total_points.toLocaleString()} / {nextLevelInfo.requiredPoints.toLocaleString()} XP
                    </span>
                  </div>
                  <Progress value={profile.total_points / nextLevelInfo.requiredPoints * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">
                    {(nextLevelInfo.requiredPoints - profile.total_points).toLocaleString()} XP until {nextLevelInfo.name}
                  </p>
                </div>}

              {!nextLevelInfo && <div className="text-center py-4 bg-primary/5 rounded-lg">
                  <p className="text-sm font-medium text-primary">🎉 Max Level Reached!</p>
                  <p className="text-xs text-muted-foreground mt-1">Achieved the highest level</p>
                </div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Community Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Posts</span>
                  <span className="text-2xl font-bold">{posts.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Upvotes Received</span>
                  <span className="text-2xl font-bold text-primary">{totalUpvotes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Average per Post</span>
                  <span className="text-lg font-semibold">
                    {posts.length > 0 ? (totalUpvotes / posts.length).toFixed(1) : '0'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lightsticks Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src={lightstickImage} alt="Lightstick" className="w-5 h-5" />
              Lightsticks
            </CardTitle>
            <CardDescription>
              Fanz tokens held by this user
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTokens ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : fanzTokens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No lightsticks yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {fanzTokens.map((token) => (
                  <Link
                    key={token.tokenId}
                    to={token.wikiEntryId ? `/wiki/${token.wikiEntryId}` : '#'}
                    className="block"
                  >
                    <div className="relative group rounded-lg border bg-card p-3 hover:border-primary transition-colors">
                      <div className="aspect-square rounded-md overflow-hidden bg-muted mb-2">
                        {token.wikiEntryImage ? (
                          <img
                            src={token.wikiEntryImage}
                            alt={token.wikiEntryTitle || 'Token'}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <img src={lightstickImage} alt="Lightstick" className="w-12 h-12 opacity-50" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">
                        {token.wikiEntryTitle || 'Supporters'}
                      </p>
                      <div className="flex items-center gap-1 text-primary">
                        <img src={lightstickImage} alt="" className="w-4 h-4" />
                        <span className="font-bold">{token.balance}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </V2Layout>
  );
};
export default UserProfile;