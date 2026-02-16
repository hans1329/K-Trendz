-- search_path 보안 경고 수정
CREATE OR REPLACE FUNCTION public.calculate_fanz_buy_cost(
  token_id_param uuid,
  amount_param bigint DEFAULT 1
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_record RECORD;
  supply BIGINT;
  base_price NUMERIC;
  k_value NUMERIC;
  c NUMERIC := 9;
  offset_value NUMERIC := 3;
  s0 NUMERIC;
  s1 NUMERIC;
  sqrt_s0 NUMERIC;
  sqrt_s1 NUMERIC;
  s0_3_2 NUMERIC;
  s1_3_2 NUMERIC;
  linear NUMERIC;
  curve NUMERIC;
  offset_term NUMERIC;
  base_cost NUMERIC;
  total_cost NUMERIC;
BEGIN
  -- 토큰 정보 조회
  SELECT ft.base_price, ft.k_value, ft.total_supply
  INTO token_record
  FROM fanz_tokens ft
  WHERE ft.id = token_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token not found';
  END IF;
  
  supply := token_record.total_supply;
  base_price := token_record.base_price;
  k_value := token_record.k_value;
  
  -- 적분 계산: C = a·N + (2k/3)·[(S+N+9)^(3/2) - (S+9)^(3/2)] - 3k·N
  s0 := supply + c;
  s1 := supply + amount_param + c;
  
  sqrt_s0 := SQRT(s0);
  sqrt_s1 := SQRT(s1);
  
  -- (s)^(3/2) = sqrt(s) * s
  s0_3_2 := sqrt_s0 * s0;
  s1_3_2 := sqrt_s1 * s1;
  
  linear := base_price * amount_param;
  curve := (2.0 * k_value * (s1_3_2 - s0_3_2)) / 3.0;
  offset_term := k_value * offset_value * amount_param;
  
  base_cost := linear + curve - offset_term;
  
  -- 수수료 추가 (10%: 6% creator + 4% platform)
  total_cost := base_cost * 1.10;
  
  RETURN total_cost;
END;
$$;