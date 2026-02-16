import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FanUpButtonProps {
  wikiEntryId: string;
  userId: string | null;
  followerCount: number;
  onFollowChange?: () => void;
}

const FanUpButton = ({ wikiEntryId, userId, followerCount, onFollowChange }: FanUpButtonProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  // 토큰 발행 여부 확인 (존재 여부만 체크하므로 별도 쿼리 키 사용)
  const { data: fanzToken } = useQuery({
    queryKey: ['fanz-token-exists', wikiEntryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fanz_tokens')
        .select('id')
        .eq('wiki_entry_id', wikiEntryId)
        .eq('is_active', true)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!wikiEntryId
  });

  // 사용자가 팔로우했는지 확인
  const { data: isFollowing, refetch: refetchFollowStatus } = useQuery({
    queryKey: ['wiki-entry-follow', wikiEntryId, userId],
    queryFn: async () => {
      if (!userId) return false;

      const { data, error } = await supabase
        .from('wiki_entry_followers')
        .select('id')
        .eq('wiki_entry_id', wikiEntryId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!userId
  });

  const handleFanUpToggle = async () => {
    if (!userId) {
      toast({
        title: "Login Required",
        description: "Please login to become a fan",
        variant: "destructive",
      });
      return;
    }

    // 이미 팔로우 중이면 아무것도 하지 않음
    if (isFollowing) {
      return;
    }

    setIsProcessing(true);

    try {
      // Fan Up
      const { error } = await supabase
        .from('wiki_entry_followers')
        .insert({
          wiki_entry_id: wikiEntryId,
          user_id: userId
        })
        .select()
        .single();

      // 중복 키 에러는 무시 (이미 팔로우 중인 경우)
      if (error && !error.message.includes('duplicate key')) throw error;

      toast({
        title: "Fanned Up!",
        description: "You are now a fan!",
      });

      // Refetch follow status
      await refetchFollowStatus();
      
      // 부모 컴포넌트에 변경 알림
      if (onFollowChange) {
        onFollowChange();
      }
    } catch (error: any) {
      console.error('Error toggling fan status:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update fan status",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 토큰 발행 후 팔로워인 경우 숨김
  if (fanzToken && isFollowing) {
    return null;
  }

  return (
    <Button
      variant={isFollowing ? "secondary" : "default"}
      onClick={handleFanUpToggle}
      disabled={isProcessing || isFollowing}
      className="gap-2"
    >
      <Users className="w-4 h-4" />
      {isFollowing ? "Following" : "Fan Up"}
    </Button>
  );
};

export default FanUpButton;
