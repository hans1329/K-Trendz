import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const REFERRAL_CODE_KEY = 'ktrendz_referral_code';

/**
 * URL에서 ref 파라미터를 읽어 localStorage에 저장하는 훅
 * 예: k-trendz.com?ref=ABC123
 */
export const useReferralCode = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const refCode = searchParams.get('ref');
    
    if (refCode) {
      // 대문자로 저장
      localStorage.setItem(REFERRAL_CODE_KEY, refCode.toUpperCase());
      
      // URL에서 ref 파라미터 제거 (깔끔하게)
      searchParams.delete('ref');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
};

/**
 * 저장된 레퍼럴 코드 가져오기
 */
export const getReferralCode = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFERRAL_CODE_KEY);
};

/**
 * 레퍼럴 코드 사용 후 삭제
 */
export const clearReferralCode = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REFERRAL_CODE_KEY);
};
