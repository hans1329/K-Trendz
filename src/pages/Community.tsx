import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, ArrowLeft, Settings, Trash2, Upload, BadgeCheck, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Post {
  id: string;
  title: string;
  content: string;
  votes: number;
  created_at: string;
  image_url: string | null;
  source_url: string | null;
  category: string;
  userVote?: "up" | "down" | null;
  profiles: {
    username: string;
    display_name: string | null;
  };
}

const Community = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<"hot" | "new" | "top">("hot");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    icon_url: "",
    banner_url: "",
  });
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const { data: community, isLoading: communityLoading } = useQuery({
    queryKey: ["community", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: isMember, refetch: refetchMembership } = useQuery({
    queryKey: ["community-membership", community?.id, user?.id],
    queryFn: async () => {
      if (!user || !community) return false;
      
      const { data } = await supabase
        .from("community_members")
        .select("id")
        .eq("community_id", community.id)
        .eq("user_id", user.id)
        .single();

      return !!data;
    },
    enabled: !!user && !!community,
  });

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["community-posts", community?.id, sortBy, user?.id],
    queryFn: async () => {
      if (!community) return [];

      let query = supabase
        .from("posts")
        .select(`
          *,
          profiles (username, display_name, avatar_url, is_verified, verification_type),
          wiki_entries:wiki_entry_id (
            title
          )
        `)
        .eq("community_id", community.id);

      if (sortBy === "new") {
        query = query.order("created_at", { ascending: false });
      } else if (sortBy === "top") {
        query = query.order("votes", { ascending: false });
      } else {
        query = query.order("votes", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;

      // 사용자의 투표 정보 가져오기
      let userVotes: any[] = [];
      if (user) {
        const postIds = data?.map(p => p.id) || [];
        if (postIds.length > 0) {
          const { data: votesData } = await supabase
            .from('post_votes')
            .select('post_id, vote_type')
            .eq('user_id', user.id)
            .in('post_id', postIds);
          userVotes = votesData || [];
        }
      }

      // posts에 userVote 추가
      return (data || []).map(post => {
        const userVote = userVotes.find(v => v.post_id === post.id);
        return {
          ...post,
          userVote: userVote ? userVote.vote_type : null
        };
      });
    },
    enabled: !!community,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!user || !community) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("community_members")
        .insert({
          community_id: community.id,
          user_id: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      refetchMembership();
      queryClient.invalidateQueries({ queryKey: ["community", slug] });
      toast({
        title: "Joined club",
        description: `You are now a member of ${community?.name}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to join club",
        variant: "destructive",
      });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !community) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", community.id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchMembership();
      queryClient.invalidateQueries({ queryKey: ["community", slug] });
      toast({
        title: "Left club",
        description: `You are no longer a member of ${community?.name}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to leave club",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (community && settingsOpen) {
      setEditForm({
        name: community.name,
        description: community.description || "",
        icon_url: community.icon_url || "",
        banner_url: community.banner_url || "",
      });
    }
  }, [community, settingsOpen]);

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !community || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${community.id}/icon-${Date.now()}.${fileExt}`;

    setUploadingIcon(true);

    try {
      // Delete old icon if exists
      if (editForm.icon_url) {
        const oldPath = editForm.icon_url.split('/community-assets/').pop();
        if (oldPath) {
          await supabase.storage.from('community-assets').remove([oldPath]);
        }
      }

      // Upload new icon
      const { error: uploadError } = await supabase.storage
        .from('community-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('community-assets')
        .getPublicUrl(fileName);

      setEditForm({ ...editForm, icon_url: publicUrl });

      toast({
        title: "Icon uploaded",
        description: "Club icon has been uploaded",
      });
    } catch (error) {
      console.error('Error uploading icon:', error);
      toast({
        title: "Upload error",
        description: "Failed to upload icon",
        variant: "destructive",
      });
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !community || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${community.id}/banner-${Date.now()}.${fileExt}`;

    setUploadingBanner(true);

    try {
      // Delete old banner if exists
      if (editForm.banner_url) {
        const oldPath = editForm.banner_url.split('/community-assets/').pop();
        if (oldPath) {
          await supabase.storage.from('community-assets').remove([oldPath]);
        }
      }

      // Upload new banner
      const { error: uploadError } = await supabase.storage
        .from('community-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('community-assets')
        .getPublicUrl(fileName);

      setEditForm({ ...editForm, banner_url: publicUrl });

      toast({
        title: "Banner uploaded",
        description: "Club banner has been uploaded",
      });
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast({
        title: "Upload error",
        description: "Failed to upload banner",
        variant: "destructive",
      });
    } finally {
      setUploadingBanner(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user || !community) throw new Error("Not authenticated");
      
      // 이름이 변경되었을 경우 중복 체크
      if (editForm.name !== community.name) {
        const { data: existing } = await supabase
          .from("communities")
          .select("id")
          .eq("name", editForm.name)
          .single();
        
        if (existing) {
          throw new Error("DUPLICATE_NAME");
        }
      }
      
      const { error } = await supabase
        .from("communities")
        .update({
          name: editForm.name,
          description: editForm.description || null,
          icon_url: editForm.icon_url || null,
          banner_url: editForm.banner_url || null,
        })
        .eq("id", community.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community", slug] });
      setSettingsOpen(false);
      toast({
        title: "Club updated",
        description: "Your changes have been saved",
      });
    },
    onError: (error: Error) => {
      const message = error.message === "DUPLICATE_NAME"
        ? "A club with this name already exists"
        : "Failed to update club";
      
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !community) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("communities")
        .delete()
        .eq("id", community.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Club deleted",
        description: "The club has been permanently deleted",
      });
      navigate("/communities");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete club",
        variant: "destructive",
      });
    },
  });

  const handleVote = async (postId: string, type: "up" | "down") => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to vote on posts",
        variant: "destructive",
      });
      return;
    }

    const post = posts?.find(p => p.id === postId);
    if (!post) return;

    // 투표 취소는 일일 제한에서 제외
    const isUnvoting = post.userVote === type;
    // 투표 전환 (up→down 또는 down→up)은 에너지 소모 없음
    const newUserVotePreview = isUnvoting ? null : type;
    const isVoteSwitch = post.userVote !== null && newUserVotePreview !== null && post.userVote !== newUserVotePreview;
    
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

        if (!checkData?.is_first_vote_today) {
          toast({
            title: "Already voted today",
            description: "You can only vote once per post per day.",
            variant: "destructive",
          });
          return;
        }

        if (!checkData.can_vote) {
          toast({
            title: "Daily vote limit reached",
            description: `You've used all ${checkData.max_votes} votes today. Come back tomorrow!`,
            variant: "destructive",
          });
          return;
        }

        // 13개 모두 사용시 포인트 획득 메시지
        if (checkData.completion_rewarded) {
          toast({
            title: "🎉 Daily voting completed!",
            description: "You earned bonus points for voting 13 times today!",
          });
        } else {
          toast({
            title: "Vote counted",
            description: `${checkData.remaining_votes} votes remaining today`,
          });
        }
      } catch (error) {
        console.error("Error checking vote count:", error);
        toast({
          title: "Vote check failed",
          description: "Failed to check daily vote limit",
          variant: "destructive",
        });
        return;
      }
    }

    const oldUserVote = post.userVote;
    let newUserVote: "up" | "down" | null = type;
    let voteDelta = 0;

    if (post.userVote === type) {
      newUserVote = null;
      voteDelta = type === "up" ? -1 : 1;
    } else if (post.userVote) {
      voteDelta = type === "up" ? 2 : -2;
    } else {
      voteDelta = type === "up" ? 1 : -1;
    }

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

      // 쿼리 무효화하여 재조회
      queryClient.invalidateQueries({ queryKey: ["community-posts", community?.id] });
    } catch (error) {
      console.error('Error updating vote:', error);
      toast({
        title: "Vote failed",
        description: "Failed to update your vote. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isCreator = user && community && user.id === community.creator_id;

  if (communityLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Club not found</h1>
          <Button onClick={() => navigate("/communities")}>
            Browse Clubs
          </Button>
        </div>
      </div>
    );
  }

  // SEO 메타 태그 준비
  const pageTitle = community ? `${community.name} - KTrendz Club | K-Pop Community` : 'Community - KTrendz';
  const pageDescription = community?.description || `Join the ${community?.name || ''} club on KTrendz - Connect with K-Pop fans who share your interests`;
  const pageUrl = `https://k-trendz.com/c/${slug}`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content={`KTrendz, ${community?.name}, K-Pop club, K-Pop community, fan club`} />
        <link rel="canonical" href={pageUrl} />
        
        <meta property="og:type" content="website" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:site_name" content="KTrendz" />
        {community?.icon_url && <meta property="og:image" content={community.icon_url} />}
        
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        {community?.icon_url && <meta name="twitter:image" content={community.icon_url} />}
      </Helmet>
      
      <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Community Header */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/communities")}
              className="gap-2 -ml-2"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">All Clubs</span>
              <span className="sm:hidden">Back</span>
            </Button>

            <div className="flex gap-2">
              {user && (
                <>
                  <Button
                    onClick={() => navigate(`/create?community=${slug}`)}
                    className="gap-2"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden md:inline">Create Post</span>
                  </Button>
                  
                  {isCreator && (
                    <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {community.banner_url && (
            <div className="w-full h-32 md:h-48 overflow-hidden rounded-lg mb-4 md:mb-6">
              <img
                src={community.banner_url}
                alt={`${community.name} banner`}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 md:gap-4">
              {community.icon_url ? (
                <img
                  src={community.icon_url}
                  alt={community.name}
                  className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 md:gap-2 mb-1">
                  <h1 className="text-xl md:text-3xl font-bold text-foreground truncate">
                    {community.name}
                  </h1>
                  {community.is_verified && (
                    <BadgeCheck className="h-5 w-5 md:h-7 md:w-7 text-primary shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">/c/{community.slug}</p>
                {community.description && (
                  <p className="text-sm md:text-base text-muted-foreground mt-2 line-clamp-2">
                    {community.description}
                  </p>
                )}
                <div className="flex items-center gap-3 md:gap-4 mt-2 text-xs md:text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span>{community.member_count}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span>{community.post_count}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto mt-4">
              {user && !isCreator && (
                <>
                  {isMember ? (
                    <Button
                      variant="outline"
                      onClick={() => leaveMutation.mutate()}
                      disabled={leaveMutation.isPending}
                      className="flex-1 md:flex-none"
                      size="sm"
                    >
                      Leave
                    </Button>
                  ) : (
                    <Button
                      onClick={() => joinMutation.mutate()}
                      disabled={joinMutation.isPending}
                      className="flex-1 md:flex-none"
                      size="sm"
                    >
                      Join Community
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Community Settings Dialog */}
      {isCreator && (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Community Settings</DialogTitle>
              <DialogDescription>
                Update your community information
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Community Name</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="icon_file">Community Icon</Label>
                <div className="flex items-center gap-4">
                  {editForm.icon_url && (
                    <img
                      src={editForm.icon_url}
                      alt="Icon preview"
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <Input
                      id="icon_file"
                      type="file"
                      accept="image/*"
                      onChange={handleIconUpload}
                      disabled={uploadingIcon || updateMutation.isPending}
                      className="hidden"
                    />
                    <Label
                      htmlFor="icon_file"
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      {uploadingIcon ? "Uploading..." : "Upload Icon"}
                    </Label>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="banner_file">Community Banner</Label>
                <div className="flex flex-col gap-4">
                  {editForm.banner_url && (
                    <img
                      src={editForm.banner_url}
                      alt="Banner preview"
                      className="w-full h-32 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <Input
                      id="banner_file"
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      disabled={uploadingBanner || updateMutation.isPending}
                      className="hidden"
                    />
                    <Label
                      htmlFor="banner_file"
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      {uploadingBanner ? "Uploading..." : "Upload Banner"}
                    </Label>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Community
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the community and all its posts.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Posts */}
      <main className="container mx-auto px-4 md:px-6 py-6 md:py-8">
        <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as any)} className="mb-4 md:mb-6">
          <TabsList className="w-full md:w-auto grid grid-cols-3 md:inline-grid">
            <TabsTrigger value="hot" className="text-sm">Hot</TabsTrigger>
            <TabsTrigger value="new" className="text-sm">New</TabsTrigger>
            <TabsTrigger value="top" className="text-sm">Top</TabsTrigger>
          </TabsList>
        </Tabs>

        {postsLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-6 bg-muted rounded mb-2" />
                <div className="h-4 bg-muted rounded" />
              </Card>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                id={post.id}
                title={post.title}
                content={post.content}
                author={post.profiles.display_name || post.profiles.username}
                votes={post.votes}
                commentCount={0}
                createdAt={new Date(post.created_at)}
                imageUrl={post.image_url}
                sourceUrl={post.source_url}
                category={post.category}
                userVote={post.userVote}
                onVote={handleVote}
                authorAvatarUrl={post.profiles.avatar_url}
                authorIsVerified={post.profiles.is_verified}
                authorVerificationType={post.profiles.verification_type}
                wikiEntryTitle={(post as any).wiki_entries?.title}
                wikiEntryId={(post as any).wiki_entry_id}
                userId={post.user_id}
                visibility={(post as any).visibility}
                currentUserId={user?.id}
                onRefresh={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["community-posts", community?.id],
                  })
                }
              />
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">No posts yet</p>
            {user && (
              <Button onClick={() => navigate(`/create?community=${slug}`)}>
                Be the first to post
              </Button>
            )}
           </Card>
        )}
      </main>
    </div>
    </>
  );
};

export default Community;
