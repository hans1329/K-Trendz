import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, ExternalLink, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PendingPost {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  source_url: string | null;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    display_name: string | null;
  };
}

const PendingPosts = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isModerator, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // News generation state
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [autoGenCount, setAutoGenCount] = useState("5");
  const [autoGenCategory, setAutoGenCategory] = useState("Entertainment-News");
  const [autoGenKeyword, setAutoGenKeyword] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    console.log('PendingPosts - Auth check:', { user: !!user, isAdmin, isModerator, authLoading });
    
    // Wait for auth to load
    if (authLoading) {
      console.log('PendingPosts - Auth still loading, waiting...');
      return;
    }
    
    // Check if user is logged in
    if (!user) {
      console.log('PendingPosts - No user, redirecting to home');
      navigate('/');
      return;
    }
    
    // Check if user has permission
    if (!isAdmin && !isModerator) {
      console.log('PendingPosts - No admin/moderator permission, redirecting to home');
      navigate('/');
      return;
    }
    
    // User has permission, fetch posts
    console.log('PendingPosts - User has permission, fetching posts');
    fetchPendingPosts();
  }, [user, isAdmin, isModerator, authLoading, navigate]);

  const fetchPendingPosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          title,
          content,
          category,
          image_url,
          source_url,
          created_at,
          user_id,
          profiles:user_id (
            username,
            display_name
          )
        `)
        .eq('is_auto_generated', true)
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingPosts(data || []);
    } catch (error: any) {
      console.error('Error fetching pending posts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch pending posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (postId: string) => {
    try {
      setProcessingId(postId);
      const { error } = await supabase
        .from('posts')
        .update({
          is_approved: true,
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post approved successfully",
      });

      // Remove from list
      setPendingPosts(prev => prev.filter(p => p.id !== postId));
    } catch (error: any) {
      console.error('Error approving post:', error);
      toast({
        title: "Error",
        description: "Failed to approve post",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (postId: string) => {
    try {
      setProcessingId(postId);
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post rejected and deleted",
      });

      // Remove from list
      setPendingPosts(prev => prev.filter(p => p.id !== postId));
    } catch (error: any) {
      console.error('Error rejecting post:', error);
      toast({
        title: "Error",
        description: "Failed to reject post",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleAutoGenerate = async () => {
    const count = parseInt(autoGenCount);
    if (count < 1 || count > 10) {
      toast({
        title: "Invalid Count",
        description: "Please enter a number between 1 and 10.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-news-posts', {
        body: {
          count,
          category: autoGenCategory,
          keyword: autoGenKeyword,
          userId: user?.id,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Success",
          description: `Generated ${data.generated} news posts successfully!`,
        });
        fetchPendingPosts();
        setAutoGenKeyword("");
        setShowGenerateDialog(false);
      } else {
        throw new Error(data?.error || "Failed to generate posts");
      }
    } catch (error: any) {
      console.error('Error generating news:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate news posts",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const isMobile = useIsMobile();
  
  return (
    <>
      <Helmet>
        <title>Pending Approval - KTRENDZ</title>
      </Helmet>
      <V2Layout pcHeaderTitle="Pending Approval">
        <div className={`${isMobile ? 'pt-16 px-4' : ''} py-6 space-y-6`}>
          {/* Header with Generate Button */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Pending Approval</h1>
              <p className="text-muted-foreground">
                Review and approve auto-generated news posts
              </p>
            </div>
            
            <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
              <DialogTrigger asChild>
                <Button className="rounded-full">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate News
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Generate News Posts</DialogTitle>
                  <DialogDescription>
                    Auto-generate Korean news from Naver (연예, 여행, 음식, etc.)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="count">Number of Posts</Label>
                    <Input
                      id="count"
                      type="number"
                      min="1"
                      max="10"
                      value={autoGenCount}
                      onChange={(e) => setAutoGenCount(e.target.value)}
                      placeholder="1-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={autoGenCategory} onValueChange={setAutoGenCategory}>
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Entertainment-News">Entertainment (연예)</SelectItem>
                        <SelectItem value="Culture-News">Culture (문화)</SelectItem>
                        <SelectItem value="Culture-Travel">Travel (여행)</SelectItem>
                        <SelectItem value="Culture-Food">Food (음식)</SelectItem>
                        <SelectItem value="Culture-Fashion/Beauty">Fashion (패션)</SelectItem>
                        <SelectItem value="Culture-Events">Events (축제)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="keyword">Keyword (Optional)</Label>
                    <Input
                      id="keyword"
                      value={autoGenKeyword}
                      onChange={(e) => setAutoGenKeyword(e.target.value)}
                      placeholder="e.g., BTS, 뉴진스, 한식..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to use default (연예, 여행, 음식, etc.)
                    </p>
                  </div>
                  <Button 
                    onClick={handleAutoGenerate}
                    disabled={isGenerating}
                    className="w-full rounded-full"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Pending Posts List */}
          <div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : pendingPosts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No pending posts</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingPosts.map((post) => (
                <Card key={post.id} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      {post.image_url && (
                        <img
                          src={post.image_url}
                          alt={post.title}
                          className="w-32 h-32 object-cover rounded-lg shrink-0"
                        />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg mb-1 line-clamp-2">
                              {post.title}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <Badge variant="secondary">{post.category}</Badge>
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(post.created_at))} ago</span>
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                          {(() => {
                            try {
                              const parser = new DOMParser();
                              const doc = parser.parseFromString(post.content || '', 'text/html');
                              return doc.body.textContent || doc.body.innerText || '';
                            } catch {
                              return post.content || '';
                            }
                          })()}
                        </p>

                        {post.source_url && (
                          <a
                            href={post.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1 mb-4"
                          >
                            View Source
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(post.id)}
                            disabled={processingId === post.id}
                            className="rounded-full"
                          >
                            {processingId === post.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Check className="w-4 h-4 mr-2" />
                            )}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(post.id)}
                            disabled={processingId === post.id}
                            className="rounded-full"
                          >
                            {processingId === post.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <X className="w-4 h-4 mr-2" />
                            )}
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          </div>
        </div>
      </V2Layout>
    </>
  );
};

export default PendingPosts;
