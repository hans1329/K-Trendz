-- Create vesting schedules table
CREATE TABLE public.vesting_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  beneficiary_address TEXT NOT NULL,
  beneficiary_user_id UUID REFERENCES public.profiles(id),
  total_amount NUMERIC NOT NULL,
  cliff_duration_days INTEGER NOT NULL DEFAULT 0,
  vesting_duration_days INTEGER NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  claimed_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.vesting_schedules ENABLE ROW LEVEL SECURITY;

-- Admin can view all
CREATE POLICY "Admins can view all vesting schedules"
ON public.vesting_schedules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Admin can create
CREATE POLICY "Admins can create vesting schedules"
ON public.vesting_schedules
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Admin can update
CREATE POLICY "Admins can update vesting schedules"
ON public.vesting_schedules
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Beneficiaries can view their own schedules
CREATE POLICY "Users can view their own vesting schedules"
ON public.vesting_schedules
FOR SELECT
USING (beneficiary_user_id = auth.uid());

-- Create index for beneficiary lookup
CREATE INDEX idx_vesting_schedules_beneficiary ON public.vesting_schedules(beneficiary_address);
CREATE INDEX idx_vesting_schedules_status ON public.vesting_schedules(status);