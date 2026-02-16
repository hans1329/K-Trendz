// DM 대화 관련 유틸리티 함수
import { supabase } from '@/integrations/supabase/client';

/**
 * 두 사용자 간의 대화방 찾기 또는 생성
 */
export const findOrCreateConversation = async (
  currentUserId: string,
  otherUserId: string
): Promise<string | null> => {
  try {
    // 기존 대화방 찾기 (양방향 확인)
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(user1_id.eq.${currentUserId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${currentUserId})`
      )
      .maybeSingle();

    if (existingConversation) {
      return existingConversation.id;
    }

    // 새 대화방 생성
    const { data: newConversation, error } = await supabase
      .from('conversations')
      .insert({
        user1_id: currentUserId,
        user2_id: otherUserId,
      })
      .select('id')
      .single();

    if (error) throw error;
    return newConversation.id;
  } catch (error) {
    console.error('Error finding or creating conversation:', error);
    return null;
  }
};

/**
 * 대화 상대방 ID 가져오기
 */
export const getOtherUserId = (
  conversation: { user1_id: string; user2_id: string },
  currentUserId: string
): string => {
  return conversation.user1_id === currentUserId
    ? conversation.user2_id
    : conversation.user1_id;
};
