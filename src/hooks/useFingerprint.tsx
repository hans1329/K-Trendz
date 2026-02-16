import { useState, useEffect, useCallback } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

// fingerprint 인스턴스를 전역으로 캐싱
let fpPromise: ReturnType<typeof FingerprintJS.load> | null = null;
let cachedFingerprint: string | null = null;

export const useFingerprint = () => {
  const [fingerprint, setFingerprint] = useState<string | null>(cachedFingerprint);
  const [isLoading, setIsLoading] = useState(!cachedFingerprint);

  useEffect(() => {
    const getFingerprint = async () => {
      if (cachedFingerprint) {
        setFingerprint(cachedFingerprint);
        setIsLoading(false);
        return;
      }

      try {
        if (!fpPromise) {
          fpPromise = FingerprintJS.load();
        }
        const fp = await fpPromise;
        const result = await fp.get();
        cachedFingerprint = result.visitorId;
        setFingerprint(result.visitorId);
      } catch (error) {
        console.error('Failed to get fingerprint:', error);
        // 실패 시 fallback으로 랜덤 ID 생성
        const fallbackId = `fallback_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        setFingerprint(fallbackId);
      } finally {
        setIsLoading(false);
      }
    };

    getFingerprint();
  }, []);

  // 가입용 fingerprint 체크
  const checkFingerprint = useCallback(async (): Promise<{ allowed: boolean; message?: string }> => {
    if (!fingerprint) {
      return { allowed: true }; // fingerprint 없으면 통과
    }

    try {
      const response = await fetch(
        `https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/check-fingerprint`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndXlsb3dzd3dnanZvdGRjc2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTY5MzQsImV4cCI6MjA3NzQ3MjkzNH0.WYZndHJtDXwFITy9FYKv7bhqDcmhqNwZNrj_gEobJiM',
          },
          body: JSON.stringify({
            fingerprint,
            action: 'check'
          })
        }
      );

      if (!response.ok) {
        console.error('Fingerprint check failed:', response.status);
        return { allowed: true }; // API 오류 시 통과
      }

      const result = await response.json();
      return {
        allowed: result.allowed,
        message: result.message
      };
    } catch (error) {
      console.error('Error checking fingerprint:', error);
      return { allowed: true }; // 오류 시 통과
    }
  }, [fingerprint]);

  // 챌린지 참여용 fingerprint 체크 (24시간 내 동일 디바이스에서 3회 제한)
  const checkChallengeFingerprint = useCallback(async (
    challengeId: string,
    accessToken: string
  ): Promise<{ allowed: boolean; attempts?: number; message?: string }> => {
    if (!fingerprint) {
      return { allowed: true };
    }

    try {
      const response = await fetch(
        `https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/check-fingerprint`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndXlsb3dzd3dnanZvdGRjc2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTY5MzQsImV4cCI6MjA3NzQ3MjkzNH0.WYZndHJtDXwFITy9FYKv7bhqDcmhqNwZNrj_gEobJiM',
          },
          body: JSON.stringify({
            fingerprint,
            action: 'check_challenge',
            challengeId
          })
        }
      );

      if (!response.ok) {
        console.error('Challenge fingerprint check failed:', response.status);
        return { allowed: true };
      }

      const result = await response.json();
      return {
        allowed: result.allowed,
        attempts: result.attempts,
        message: result.message
      };
    } catch (error) {
      console.error('Error checking challenge fingerprint:', error);
      return { allowed: true };
    }
  }, [fingerprint]);

  const saveFingerprint = useCallback(async (accessToken: string): Promise<boolean> => {
    if (!fingerprint) return true;

    try {
      const response = await fetch(
        `https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/check-fingerprint`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndXlsb3dzd3dnanZvdGRjc2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTY5MzQsImV4cCI6MjA3NzQ3MjkzNH0.WYZndHJtDXwFITy9FYKv7bhqDcmhqNwZNrj_gEobJiM',
          },
          body: JSON.stringify({
            fingerprint,
            action: 'save'
          })
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error saving fingerprint:', error);
      return false;
    }
  }, [fingerprint]);

  return {
    fingerprint,
    isLoading,
    checkFingerprint,
    checkChallengeFingerprint,
    saveFingerprint
  };
};
