// 멘션 처리 유틸리티
import { supabase } from '@/integrations/supabase/client';

/**
 * 텍스트에서 @username 패턴 추출
 */
export const extractMentions = (text: string): string[] => {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]); // username만 추출 (@ 제외)
  }

  return [...new Set(mentions)]; // 중복 제거
};

/**
 * 텍스트의 @username을 클릭 가능한 링크로 변환
 */
export const renderMentions = (text: string): string => {
  return text.replace(/@(\w+)/g, (match, username) => {
    return `<a href="/profile/${username}" class="text-primary font-semibold hover:underline">${match}</a>`;
  });
};

/**
 * username으로 user ID 조회
 */
export const getUserIdByUsername = async (username: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (error || !data) {
    console.error('Error fetching user by username:', error);
    return null;
  }

  return data.id;
};

/**
 * 멘션 저장 (포스트용)
 */
export const saveMentionsForPost = async (
  postId: string,
  content: string,
  mentionerUserId: string
): Promise<void> => {
  const usernames = extractMentions(content);
  
  for (const username of usernames) {
    const userId = await getUserIdByUsername(username);
    
    if (userId && userId !== mentionerUserId) {
      await supabase.from('mentions').insert({
        post_id: postId,
        mentioned_user_id: userId,
        mentioner_user_id: mentionerUserId,
      });
    }
  }
};

/**
 * 멘션 저장 (댓글용)
 */
export const saveMentionsForComment = async (
  commentId: string,
  content: string,
  mentionerUserId: string
): Promise<void> => {
  const usernames = extractMentions(content);
  
  for (const username of usernames) {
    const userId = await getUserIdByUsername(username);
    
    if (userId && userId !== mentionerUserId) {
      await supabase.from('mentions').insert({
        comment_id: commentId,
        mentioned_user_id: userId,
        mentioner_user_id: mentionerUserId,
      });
    }
  }
};
