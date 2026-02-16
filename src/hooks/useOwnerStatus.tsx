import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// 사용자가 하나 이상의 wiki_entry의 owner인지 확인하는 훅
export const useOwnerStatus = () => {
  const { user, loading: authLoading } = useAuth();

  // 소유한 엔트리 목록 조회 (먼저 조회)
  const { data: ownedEntries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ['ownedEntries', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }
      
      const { data, error } = await supabase
        .from('wiki_entries')
        .select(`
          id,
          title,
          slug,
          image_url,
          schema_type,
          votes,
          view_count,
          follower_count,
          trending_score,
          page_status,
          created_at,
          updated_at
        `)
        .eq('owner_id', user.id)
        .order('trending_score', { ascending: false });

      if (error) {
        console.error('Error fetching owned entries:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 1000 * 60 * 2, // 2분간 캐시 유지
  });

  // isOwner는 ownedEntries에서 파생
  const isOwner = ownedEntries.length > 0;
  const isLoading = authLoading || isLoadingEntries;

  return { isOwner, isLoading, ownedEntries, isLoadingEntries };
};
