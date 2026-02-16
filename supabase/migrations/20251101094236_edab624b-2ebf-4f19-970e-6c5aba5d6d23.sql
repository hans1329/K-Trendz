-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'comment', 'vote', 'mention', 'message', 'boost', 'pin'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  reference_id UUID, -- ID of related post, comment, or message
  actor_id UUID, -- User who triggered the notification
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can mark their notifications as read
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- System can insert notifications
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  user_id_param UUID,
  type_param TEXT,
  title_param TEXT,
  message_param TEXT,
  reference_id_param UUID DEFAULT NULL,
  actor_id_param UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  -- Don't create notification if actor is the same as recipient
  IF actor_id_param = user_id_param THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO public.notifications (user_id, type, title, message, reference_id, actor_id)
  VALUES (user_id_param, type_param, title_param, message_param, reference_id_param, actor_id_param)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Trigger for comment notifications
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author_id UUID;
  commenter_username TEXT;
  post_title TEXT;
BEGIN
  -- Get post author and title
  SELECT user_id, title INTO post_author_id, post_title
  FROM public.posts
  WHERE id = NEW.post_id;
  
  -- Get commenter username
  SELECT username INTO commenter_username
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- Create notification for post author
  IF post_author_id IS NOT NULL AND post_author_id != NEW.user_id THEN
    PERFORM public.create_notification(
      post_author_id,
      'comment',
      'New Comment',
      commenter_username || ' commented on your post: ' || post_title,
      NEW.post_id,
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_on_comment
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_comment();

-- Trigger for upvote notifications
CREATE OR REPLACE FUNCTION public.notify_on_upvote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author_id UUID;
  voter_username TEXT;
  post_title TEXT;
BEGIN
  -- Only notify on upvotes
  IF NEW.vote_type = 'up' THEN
    -- Get post author and title
    SELECT user_id, title INTO post_author_id, post_title
    FROM public.posts
    WHERE id = NEW.post_id;
    
    -- Get voter username
    SELECT username INTO voter_username
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    -- Create notification for post author
    IF post_author_id IS NOT NULL AND post_author_id != NEW.user_id THEN
      PERFORM public.create_notification(
        post_author_id,
        'vote',
        'New Upvote',
        voter_username || ' upvoted your post: ' || post_title,
        NEW.post_id,
        NEW.user_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_on_upvote
AFTER INSERT ON public.post_votes
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_upvote();

-- Trigger for mention notifications
CREATE OR REPLACE FUNCTION public.notify_on_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mentioner_username TEXT;
  mention_context TEXT;
BEGIN
  -- Get mentioner username
  SELECT username INTO mentioner_username
  FROM public.profiles
  WHERE id = NEW.mentioner_user_id;
  
  -- Determine context
  IF NEW.post_id IS NOT NULL THEN
    mention_context := 'mentioned you in a post';
  ELSIF NEW.comment_id IS NOT NULL THEN
    mention_context := 'mentioned you in a comment';
  ELSE
    mention_context := 'mentioned you';
  END IF;
  
  -- Create notification
  PERFORM public.create_notification(
    NEW.mentioned_user_id,
    'mention',
    'You were mentioned',
    mentioner_username || ' ' || mention_context,
    COALESCE(NEW.post_id, NEW.comment_id),
    NEW.mentioner_user_id
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_on_mention
AFTER INSERT ON public.mentions
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_mention();

-- Trigger for direct message notifications
CREATE OR REPLACE FUNCTION public.notify_on_direct_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_username TEXT;
  recipient_id UUID;
BEGIN
  -- Get sender username
  SELECT username INTO sender_username
  FROM public.profiles
  WHERE id = NEW.sender_id;
  
  -- Get recipient ID (the other user in the conversation)
  SELECT CASE
    WHEN user1_id = NEW.sender_id THEN user2_id
    ELSE user1_id
  END INTO recipient_id
  FROM public.conversations
  WHERE id = NEW.conversation_id;
  
  -- Create notification for recipient
  IF recipient_id IS NOT NULL THEN
    PERFORM public.create_notification(
      recipient_id,
      'message',
      'New Message',
      sender_username || ' sent you a message',
      NEW.conversation_id,
      NEW.sender_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_on_direct_message
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_direct_message();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;