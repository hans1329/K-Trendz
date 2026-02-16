-- Create blocked email domains table
CREATE TABLE public.blocked_email_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  reason TEXT
);

-- Enable RLS
ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;

-- Admins can manage blocked domains
CREATE POLICY "Admins can manage blocked domains"
ON public.blocked_email_domains
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can view blocked domains (for signup validation)
CREATE POLICY "Everyone can view blocked domains"
ON public.blocked_email_domains
FOR SELECT
USING (true);

-- Insert some common temporary email domains
INSERT INTO public.blocked_email_domains (domain, reason) VALUES
('tempmail.com', 'Temporary email service'),
('10minutemail.com', 'Temporary email service'),
('guerrillamail.com', 'Temporary email service'),
('mailinator.com', 'Temporary email service'),
('throwaway.email', 'Temporary email service'),
('temp-mail.org', 'Temporary email service'),
('getnada.com', 'Temporary email service'),
('maildrop.cc', 'Temporary email service'),
('fakeinbox.com', 'Temporary email service'),
('trashmail.com', 'Temporary email service');