-- Create function to calculate wiki entry badge score
CREATE OR REPLACE FUNCTION public.calculate_wiki_badge_score(wiki_entry_id_param uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    SUM(
      CASE 
        WHEN gb.color = '#C0C0C0' THEN 1  -- Silver = 1 point
        WHEN gb.color = '#FFD700' THEN 2  -- Gold = 2 points
        WHEN gb.color = '#1E90FF' THEN 3  -- Diamond = 3 points
        ELSE 0
      END
    )::integer,
    0
  )
  FROM public.wiki_entry_gift_badges wegb
  JOIN public.gift_badges gb ON wegb.gift_badge_id = gb.id
  WHERE wegb.wiki_entry_id = wiki_entry_id_param;
$function$;