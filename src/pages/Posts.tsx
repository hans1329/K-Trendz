import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, FileText, Lock, ArrowBigUp, MessageSquare, TrendingUp, Verified } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import SmartImage from "@/components/SmartImage";
import { getAvatarThumbnail, getCardThumbnail } from "@/lib/image";
import { cn } from "@/lib/utils";
import V2Layout from "@/components/home/V2Layout";

interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  votes: number;
  commentCount: number;
  createdAt: Date;
  userVote?: "up" | "down" | null;
  authorIsVerified?: boolean;
  imageUrl?: string;
  user_id?: string;
  authorAvatarUrl?: string;
  isBoosted?: boolean;
  wikiEntryTitle?: string;
  wikiEntrySlug?: string;
  isFollowing?: boolean;
  visibility?: string;
  slug?: string;
  isFanPost?: boolean;
}

const timeAgo = (dateString: string | Date) => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
};

const Posts = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);

  // 관리자 권한 체크
  const { data: isAdmin = false } = useQuery({
    queryKey: ['user-is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      return !!data;
    },
    enabled: !!user
  });

  // New 탭 데이터 (Rankings.tsx의 new-posts 쿼리와 동일)
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts-page', page],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const limit = 60;
      const offset = (page - 1) * limit;

      // 최신 posts 가져오기
      const { data: postsData } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url,
            is_verified,
            verification_type
          ),
          wiki_entries:wiki_entry_id (
            title,
            slug,
            owner_id,
            creator_id
          )
        `)
        .eq('is_approved', true)
        .or('category.is.null,category.neq.announcement')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      let userVotes: any[] = [];
      let followedWikiIds: string[] = [];
      
      if (authUser) {
        const { data: votesData } = await supabase
          .from('post_votes')
          .select('post_id, vote_type')
          .eq('user_id', authUser.id);
        userVotes = votesData || [];

        const { data: followedEntries } = await supabase
          .from('wiki_entry_followers')
          .select('wiki_entry_id')
          .eq('user_id', authUser.id);
        followedWikiIds = followedEntries?.map(f => f.wiki_entry_id) || [];
      }

      const allPosts: Post[] = [];

      if (postsData && postsData.length > 0) {
        const postIds = postsData.map(post => post.id);
        const { data: commentCounts } = await supabase
          .from('comments')
          .select('post_id')
          .in('post_id', postIds);
        
        const commentCountMap = new Map<string, number>();
        commentCounts?.forEach(comment => {
          const count = commentCountMap.get(comment.post_id) || 0;
          commentCountMap.set(comment.post_id, count + 1);
        });

        postsData.forEach((post: any) => {
          const userVote = userVotes.find(v => v.post_id === post.id);
          const operatorId = post.wiki_entries?.owner_id || post.wiki_entries?.creator_id;
          const isFanPost = !!post.wiki_entry_id && !!operatorId && post.user_id !== operatorId;
          
          allPosts.push({
            id: post.id,
            title: post.title,
            content: post.content,
            author: post.profiles?.display_name || post.profiles?.username || 'Unknown',
            votes: post.votes || 0,
            commentCount: commentCountMap.get(post.id) || 0,
            createdAt: new Date(post.created_at),
            userVote: userVote ? userVote.vote_type : null,
            imageUrl: post.image_url,
            user_id: post.user_id,
            authorAvatarUrl: post.profiles?.avatar_url,
            authorIsVerified: post.profiles?.is_verified,
            isBoosted: post.is_boosted,
            wikiEntryTitle: post.wiki_entries?.title,
            wikiEntrySlug: post.wiki_entries?.slug,
            isFollowing: post.wiki_entry_id ? followedWikiIds.includes(post.wiki_entry_id) : false,
            visibility: post.visibility,
            slug: post.slug,
            isFanPost
          });
        });
      }

      // 최신순 정렬
      return allPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    staleTime: 5 * 60 * 1000
  });

  // 이미지 블러 처리 여부 확인
  const shouldBlurImage = (post: Post): boolean => {
    if (isAdmin) return false;
    const visibility = post.visibility || 'public';
    if (visibility === 'fans_only') {
      if (!user) return true;
      return !post.isFollowing;
    }
    return false;
  };

  const pageContent = (
    <div className="bg-background">
      <main className={cn("pb-8", isMobile ? "px-2" : "pt-3 px-0")}>
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-64 h-4 bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 rounded-full animate-rainbow-flow bg-[length:200%_100%]" />
              <div className="text-center mt-4 text-sm text-muted-foreground">
                Loading...
              </div>
            </div>
          ) : posts.length === 0 ? (
            <div className="p-12 text-center bg-card rounded-lg">
              <p className="text-muted-foreground">No posts available</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4">
                {posts.map(post => {
                  const displayImage = post.imageUrl;
                  const imageBlurred = shouldBlurImage(post);
                  const linkTo = post.slug ? `/p/${post.slug}` : `/post/${post.id}`;

                  // 팬 포스트는 가로형 카드
                  if (post.isFanPost) {
                    return (
                      <Link 
                        key={post.id} 
                        to={linkTo} 
                        className={cn(
                          "group bg-card rounded-lg overflow-hidden",
                          isMobile 
                            ? "flex flex-col" 
                            : "flex flex-row h-64"
                        )}
                      >
                        <div className={cn(
                          "relative bg-muted",
                          isMobile 
                            ? "aspect-[16/9]" 
                            : "w-72 h-64 flex-shrink-0"
                        )}>
                          <SmartImage
                            src={getCardThumbnail(displayImage) || displayImage}
                            alt={post.title}
                            rootMargin="600px"
                            className={cn("w-full h-full object-cover", imageBlurred && "blur-xl")}
                            fallback={
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <FileText className="w-8 h-8" />
                              </div>
                            }
                          />
                          {imageBlurred && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                              <Lock className="w-4 h-4 text-white/80" />
                            </div>
                          )}
                          {post.wikiEntryTitle && (
                            <Badge 
                              variant="outline" 
                              className="absolute bottom-2 right-2 text-xs bg-black/50 backdrop-blur-sm border-white/50 text-white line-clamp-1 max-w-[80%]"
                            >
                              {post.wikiEntryTitle}
                            </Badge>
                          )}
                        </div>
                        <div className={cn("flex flex-col flex-1 min-w-0", isMobile ? "p-3" : "p-4")}>
                          <h3 className={cn("font-semibold line-clamp-2 mb-1.5", isMobile ? "text-sm" : "text-base")}>
                            {post.title}
                          </h3>
                          {!isMobile && post.content && (
                            <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                              {post.content.replace(/<[^>]*>/g, '').slice(0, 200)}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Avatar className="w-4 h-4 flex-shrink-0">
                              <AvatarImage src={getAvatarThumbnail(post.authorAvatarUrl, 32) || post.authorAvatarUrl} />
                              <AvatarFallback className="text-[8px]">
                                {(post.author || 'U')[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate">
                              {post.author || 'Unknown'}
                              {post.authorIsVerified && <Verified className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <ArrowBigUp className="w-3.5 h-3.5" />
                              {post.votes}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {post.commentCount}
                            </span>
                            <span className="ml-auto">{timeAgo(post.createdAt)}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  }

                  // 운영자 포스트는 세로형 카드
                  return (
                    <Link 
                      key={post.id} 
                      to={linkTo} 
                      className="group flex flex-col bg-card rounded-lg overflow-hidden"
                    >
                      <div className="relative aspect-video lg:aspect-auto lg:h-[600px] bg-muted">
                        <SmartImage
                          src={getCardThumbnail(displayImage) || displayImage}
                          alt={post.title}
                          rootMargin="600px"
                          className={cn("w-full h-full object-cover", imageBlurred && "blur-xl")}
                          fallback={
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <FileText className="w-12 h-12" />
                            </div>
                          }
                        />
                        {imageBlurred && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                            <Lock className="w-6 h-6 text-white/80" />
                            <span className="text-xs text-white/80 mt-1">Fans Only</span>
                          </div>
                        )}
                        {post.isBoosted && (
                          <Badge className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-red-500 gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Boosted
                          </Badge>
                        )}
                        {post.wikiEntryTitle && (
                          <Badge 
                            variant="outline" 
                            className="absolute bottom-2 right-2 text-xs bg-black/50 backdrop-blur-sm border-white/50 text-white line-clamp-1 max-w-[80%]"
                          >
                            {post.wikiEntryTitle}
                          </Badge>
                        )}
                      </div>
                      <div className="p-3 flex flex-col flex-1">
                        <h3 className="font-semibold text-sm mb-2 line-clamp-2">
                          {post.title}
                        </h3>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Avatar className="w-4 h-4">
                            <AvatarImage src={getAvatarThumbnail(post.authorAvatarUrl, 32) || post.authorAvatarUrl} />
                            <AvatarFallback className="text-[8px]">
                              {(post.author || 'U')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate">
                            {post.author || 'Unknown'}
                            {post.authorIsVerified && <Verified className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                          <span className="flex items-center gap-1">
                            <ArrowBigUp className="w-3.5 h-3.5" />
                            {post.votes}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {post.commentCount}
                          </span>
                          <span className="ml-auto">{timeAgo(post.createdAt)}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              
              {posts.length === 60 && (
                <div className="flex justify-center mt-8">
                  <Button onClick={() => setPage(prev => prev + 1)} variant="outline" size="lg">
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>Posts - KTRENDZ</title>
        <meta name="description" content="Latest posts from K-Pop fans and artists" />
      </Helmet>
      <V2Layout pcHeaderTitle="Posts" showBackButton={true}>
        {pageContent}
      </V2Layout>
    </>
  );
};

export default Posts;
