-- Create community_rules table
CREATE TABLE public.community_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  rule_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_rules ENABLE ROW LEVEL SECURITY;

-- Community rules are viewable by everyone
CREATE POLICY "Community rules are viewable by everyone"
ON public.community_rules
FOR SELECT
USING (true);

-- Community creators can insert rules for their communities
CREATE POLICY "Community creators can insert rules"
ON public.community_rules
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = community_id
    AND creator_id = auth.uid()
  )
);

-- Community creators can update rules for their communities
CREATE POLICY "Community creators can update rules"
ON public.community_rules
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = community_id
    AND creator_id = auth.uid()
  )
);

-- Community creators can delete rules for their communities
CREATE POLICY "Community creators can delete rules"
ON public.community_rules
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = community_id
    AND creator_id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_community_rules_updated_at
BEFORE UPDATE ON public.community_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_community_rules_community_id ON public.community_rules(community_id);
CREATE INDEX idx_community_rules_order ON public.community_rules(community_id, rule_order);