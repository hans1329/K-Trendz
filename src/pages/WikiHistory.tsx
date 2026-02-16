import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, User, Calendar } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { formatDistanceToNow } from "date-fns";

const WikiHistory = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [wikiTitle, setWikiTitle] = useState("");

  // 위키 엔트리 정보 로드
  useEffect(() => {
    const loadWikiEntry = async () => {
      if (!id) return;

      const { data } = await supabase
        .from('wiki_entries')
        .select('title')
        .eq('id', id)
        .single();

      if (data) {
        setWikiTitle(data.title);
      }
    };

    loadWikiEntry();
  }, [id]);

  // 편집 이력 가져오기
  const { data: editHistory = [], isLoading } = useQuery({
    queryKey: ['wiki-history', id],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase
        .from('wiki_edit_history')
        .select(`
          *,
          editor:editor_id (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('wiki_entry_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id
  });

  const calculateChanges = (oldContent: string, newContent: string) => {
    const oldLength = oldContent.length;
    const newLength = newContent.length;
    const diff = newLength - oldLength;
    
    return {
      added: diff > 0 ? diff : 0,
      removed: diff < 0 ? Math.abs(diff) : 0,
      diff
    };
  };

  const isMobile = useIsMobile();
  
  return (
    <>
      <Helmet>
        <title>Edit History - {wikiTitle} - Fanz</title>
        <meta name="description" content="View edit history for this Fanz entry" />
      </Helmet>
      
      <V2Layout pcHeaderTitle="Edit History" showBackButton>
        <div className={`${isMobile ? 'pt-16 px-4' : ''} py-6`}>
            <div className="mb-6">
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="mb-4 rounded-full gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <h1 className="text-3xl font-bold mb-2">Edit History</h1>
              <p className="text-muted-foreground">{wikiTitle}</p>
            </div>

            {isLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Loading history...</p>
                </CardContent>
              </Card>
            ) : editHistory.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No edit history yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {editHistory.map((edit: any, index: number) => {
                  const changes = calculateChanges(edit.previous_content, edit.new_content);
                  const isLatest = index === 0;

                  return (
                    <Card key={edit.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {edit.editor?.avatar_url ? (
                              <img
                                src={edit.editor.avatar_url}
                                alt={edit.editor.username}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                <User className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-base">
                                  {edit.editor?.display_name || edit.editor?.username || 'Unknown User'}
                                </CardTitle>
                                {isLatest && (
                                  <Badge variant="secondary">Latest</Badge>
                                )}
                              </div>
                              <CardDescription className="flex items-center gap-2 mt-1">
                                <Calendar className="w-3 h-3" />
                                {formatDistanceToNow(new Date(edit.created_at), { addSuffix: true })}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {changes.added > 0 && (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                +{changes.added}
                              </Badge>
                            )}
                            {changes.removed > 0 && (
                              <Badge variant="outline" className="text-red-600 border-red-600">
                                -{changes.removed}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {edit.previous_title !== edit.new_title && (
                          <div className="mb-4">
                            <p className="text-sm font-medium mb-2">Title changed:</p>
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground line-through">
                                {edit.previous_title}
                              </div>
                              <div className="text-sm font-medium text-green-600">
                                {edit.new_title}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {edit.edit_summary && (
                          <>
                            <Separator className="my-3" />
                            <div>
                              <p className="text-sm font-medium mb-1">Edit Summary:</p>
                              <p className="text-sm text-muted-foreground">{edit.edit_summary}</p>
                            </div>
                          </>
                        )}

                        <div className="mt-4 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // TODO: Implement diff view
                              console.log('View diff:', edit);
                            }}
                            className="rounded-full"
                          >
                            View Changes
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
        </div>
      </V2Layout>
    </>
  );
};

export default WikiHistory;
