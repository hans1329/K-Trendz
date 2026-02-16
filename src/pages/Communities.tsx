import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Search, BadgeCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  member_count: number;
  post_count: number;
  created_at: string;
  is_verified: boolean;
}
const Communities = () => {
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const {
    data: communities,
    isLoading
  } = useQuery({
    queryKey: ["communities"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("communities").select("*").order("member_count", {
        ascending: false
      });
      if (error) throw error;
      return data as Community[];
    }
  });

  // 사용자가 가입한 클럽 ID 목록 가져오기
  const { data: userCommunities } = useQuery({
    queryKey: ["user-communities", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map(m => m.community_id);
    },
    enabled: !!user,
  });
  const filteredCommunities = communities?.filter(community => community.name.toLowerCase().includes(searchQuery.toLowerCase()));
  
  return (
    <>
      <Helmet>
        <title>Clubs - KTrendz | K-Pop Community Clubs</title>
        <meta name="description" content="Discover and join K-Pop community clubs on KTrendz. Connect with fans who share your interests in K-Pop groups, artists, and Korean culture." />
        <meta name="keywords" content="KTrendz, K-Pop clubs, K-Pop community, K-Pop fans, fan clubs, K-Pop groups, Korean culture communities" />
        <link rel="canonical" href="https://k-trendz.com/communities" />
        
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Clubs - KTrendz" />
        <meta property="og:description" content="Discover and join K-Pop community clubs on KTrendz" />
        <meta property="og:url" content="https://k-trendz.com/communities" />
        <meta property="og:site_name" content="KTrendz" />
        
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Clubs - KTrendz" />
        <meta name="twitter:description" content="Discover and join K-Pop community clubs on KTrendz" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-6 md:px-8 py-8 max-w-5xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="font-bold text-foreground mb-2 text-3xl">Clubs</h1>
            <p className="text-muted-foreground">
              Discover and join clubs that match your interests
            </p>
          </div>
          {user && <Button onClick={() => navigate("/create-community")} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Club
            </Button>}
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="text" placeholder="Search clubs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>

        {isLoading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <Card key={i} className="p-6 animate-pulse">
                <div className="h-12 w-12 bg-muted rounded-full mb-4" />
                <div className="h-6 bg-muted rounded mb-2" />
                <div className="h-4 bg-muted rounded" />
              </Card>)}
          </div> : filteredCommunities && filteredCommunities.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCommunities.map(community => <Card key={community.id} className="overflow-hidden hover:shadow-lg transition-all cursor-pointer flex flex-col h-full group" onClick={() => navigate(`/c/${community.slug}`)}>
                <div className="relative w-full aspect-video bg-gradient-to-br from-primary/20 to-primary/5">
                  {community.icon_url ? (
                    <img 
                      src={community.icon_url} 
                      alt={community.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="h-16 w-16 text-primary/40" />
                    </div>
                  )}
                  {userCommunities?.includes(community.id) && (
                    <Badge variant="secondary" className="absolute top-3 right-3 text-xs shadow-md">
                      My Club
                    </Badge>
                  )}
                  <div className="absolute bottom-3 right-3 flex gap-3 text-xs text-white bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span>{(community.member_count || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">{(community.post_count || 0).toLocaleString()}</span>
                      <span>posts</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg text-foreground truncate">
                      {community.name}
                    </h3>
                    {community.is_verified && (
                      <BadgeCheck className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    c/{community.slug}
                  </p>
                  {community.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {community.description}
                    </p>
                  )}
                </div>
              </Card>)}
          </div> : <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No clubs found</p>
          </div>}
      </main>
      <Footer />
    </div>
    </>
  );
};
export default Communities;