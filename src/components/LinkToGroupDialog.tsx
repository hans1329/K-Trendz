import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link2, Search, X, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LinkToGroupDialogProps {
  memberId: string;
  memberTitle: string;
  currentGroupId?: string;
  onGroupLinked: () => void;
}

const LinkToGroupDialog = ({ memberId, memberTitle, currentGroupId, onGroupLinked }: LinkToGroupDialogProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // 그룹 검색
  const { data: groups, isLoading } = useQuery({
    queryKey: ['search-groups', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      const { data, error } = await supabase
        .from('wiki_entries')
        .select('id, title, slug, image_url, metadata')
        .eq('schema_type', 'artist')
        .ilike('title', `%${searchQuery}%`)
        .order('title')
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: searchQuery.length >= 2
  });

  // 현재 연결된 그룹 정보
  const { data: currentGroup } = useQuery({
    queryKey: ['current-group', currentGroupId],
    queryFn: async () => {
      if (!currentGroupId) return null;
      
      const { data, error } = await supabase
        .from('wiki_entries')
        .select('id, title, slug, image_url')
        .eq('id', currentGroupId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentGroupId
  });

  const handleLinkToGroup = async (groupId: string, groupTitle: string) => {
    try {
      // 멤버의 metadata 업데이트
      const { data: currentData } = await supabase
        .from('wiki_entries')
        .select('metadata')
        .eq('id', memberId)
        .single();

      const currentMetadata = (currentData?.metadata as Record<string, any>) || {};
      const updatedMetadata = {
        ...currentMetadata,
        group_id: groupId,
        group_name: groupTitle
      };

      const { error } = await supabase
        .from('wiki_entries')
        .update({ metadata: updatedMetadata })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${memberTitle} has been linked to ${groupTitle}`,
      });

      onGroupLinked();
      setOpen(false);
      setSearchQuery("");
    } catch (error) {
      console.error('Error linking to group:', error);
      toast({
        title: "Error",
        description: "Failed to link to group",
        variant: "destructive",
      });
    }
  };

  const handleUnlinkFromGroup = async () => {
    try {
      const { data: currentData } = await supabase
        .from('wiki_entries')
        .select('metadata')
        .eq('id', memberId)
        .single();

      const currentMetadata = (currentData?.metadata as Record<string, any>) || {};
      const updatedMetadata = { ...currentMetadata };
      delete updatedMetadata.group_id;
      delete updatedMetadata.group_name;

      const { error } = await supabase
        .from('wiki_entries')
        .update({ metadata: updatedMetadata })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${memberTitle} has been unlinked from the group`,
      });

      onGroupLinked();
    } catch (error) {
      console.error('Error unlinking from group:', error);
      toast({
        title: "Error",
        description: "Failed to unlink from group",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          <Link2 className="w-4 h-4 mr-2" />
          {currentGroupId ? "Change Group" : "Link to Group"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link {memberTitle} to a Group</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 현재 연결된 그룹 */}
          {currentGroup && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {currentGroup.image_url ? (
                      <img 
                        src={currentGroup.image_url} 
                        alt={currentGroup.title}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <Users className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-sm">Currently linked to:</p>
                      <p className="text-lg">{currentGroup.title}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUnlinkFromGroup}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Unlink
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 그룹 검색 */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search for a group (artist)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* 검색 결과 */}
          {searchQuery.length >= 2 && (
            <div className="space-y-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Searching...</p>
              ) : groups && groups.length > 0 ? (
                <div className="space-y-2">
                  {groups.map((group) => (
                    <Card 
                      key={group.id}
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => handleLinkToGroup(group.id, group.title)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          {group.image_url ? (
                            <img 
                              src={group.image_url} 
                              alt={group.title}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                              <Users className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-semibold">{group.title}</p>
                            {group.metadata && typeof group.metadata === 'object' && 'members' in group.metadata && Array.isArray(group.metadata.members) && (
                              <p className="text-sm text-muted-foreground">
                                {group.metadata.members.length} members
                              </p>
                            )}
                          </div>
                          <Badge variant="secondary">Artist</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No groups found. Try a different search.
                </p>
              )}
            </div>
          )}

          {searchQuery.length < 2 && !currentGroup && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Type at least 2 characters to search for groups
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkToGroupDialog;
