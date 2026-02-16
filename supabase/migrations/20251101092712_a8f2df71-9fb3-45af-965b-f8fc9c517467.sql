-- Allow users to delete their own conversations
CREATE POLICY "Users can delete their own conversations"
ON public.conversations
FOR DELETE
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Allow users to delete messages in their conversations
CREATE POLICY "Users can delete messages in their conversations"
ON public.direct_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = direct_messages.conversation_id
    AND (user1_id = auth.uid() OR user2_id = auth.uid())
  )
);