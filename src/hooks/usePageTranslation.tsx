import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// 브라우저 언어 코드 추출 (예: "ko-KR" → "ko")
const getBrowserLanguage = (): string => {
  const lang = navigator.language || (navigator as any).userLanguage || 'en';
  return lang.split('-')[0].toLowerCase();
};

// 간단한 해시 생성 (translate-page edge function과 동일한 알고리즘)
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${hash.toString(36)}_${text.length}`;
}

// 지원하는 번역 대상 언어 목록
const SUPPORTED_LANGUAGES = [
  'ko', 'ja', 'zh', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'ar',
  'hi', 'th', 'vi', 'id', 'ms', 'tr', 'pl', 'nl', 'sv', 'da',
  'fi', 'nb', 'uk', 'cs', 'ro', 'hu', 'el', 'he', 'bn', 'tl',
];

// 언어 코드를 사람이 읽을 수 있는 이름으로 변환
const LANGUAGE_NAMES: Record<string, string> = {
  ko: '한국어', ja: '日本語', zh: '中文', es: 'Español', fr: 'Français',
  de: 'Deutsch', pt: 'Português', it: 'Italiano', ru: 'Русский', ar: 'العربية',
  hi: 'हिन्दी', th: 'ไทย', vi: 'Tiếng Việt', id: 'Bahasa Indonesia', ms: 'Bahasa Melayu',
  tr: 'Türkçe', pl: 'Polski', nl: 'Nederlands', sv: 'Svenska', da: 'Dansk',
  fi: 'Suomi', nb: 'Norsk', uk: 'Українська', cs: 'Čeština', ro: 'Română',
  hu: 'Magyar', el: 'Ελληνικά', he: 'עברית', bn: 'বাংলা', tl: 'Filipino',
};

interface UsePageTranslationOptions {
  // 캐시 키 (예: wiki entry ID)
  cacheKey: string;
  // 번역할 세그먼트들 (key-value)
  segments: Record<string, string>;
  // 번역 활성화 여부
  enabled?: boolean;
  // 외부에서 showOriginal 상태를 제어할 때 사용
  overrideShowOriginal?: boolean;
}

interface UsePageTranslationResult {
  translated: Record<string, string>;
  isTranslating: boolean;
  isTranslated: boolean;
  // 번역 대상 언어인지 여부 (배너 표시용 - segments 비어있어도 true)
  isTranslatableLanguage: boolean;
  userLanguage: string;
  languageName: string;
  showOriginal: boolean;
  toggleOriginal: () => void;
  t: (key: string) => string;
}

export const usePageTranslation = ({
  cacheKey,
  segments,
  enabled = true,
  overrideShowOriginal,
}: UsePageTranslationOptions): UsePageTranslationResult => {
  const userLanguage = getBrowserLanguage();
  const [translated, setTranslated] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [showOriginalInternal, setShowOriginalInternal] = useState(false);
  const translatingRef = useRef(false);
  // 외부 제어가 있으면 외부 값 사용, 없으면 내부 상태 사용
  const showOriginal = overrideShowOriginal !== undefined ? overrideShowOriginal : showOriginalInternal;
  // 마지막으로 번역 요청한 세그먼트 해시 추적
  const lastSegmentHashRef = useRef<string>('');
  // 번역 중 세그먼트가 변경되었는지 추적
  const pendingRetryRef = useRef(false);

  // 번역 대상 언어인지 확인 (배너 표시용)
  const isTranslatableLanguage = enabled && 
    userLanguage !== 'en' && 
    SUPPORTED_LANGUAGES.includes(userLanguage);

  // 실제 번역 API 호출이 필요한지 확인
  const needsTranslation = isTranslatableLanguage &&
    Object.keys(segments).length > 0;

  // 세그먼트 해시 생성 (변경 감지용)
  const segmentHash = JSON.stringify(
    Object.entries(segments).sort(([a], [b]) => a.localeCompare(b))
  );

  useEffect(() => {
    if (!needsTranslation) return;
    if (segmentHash === lastSegmentHashRef.current) return;
    if (translatingRef.current) {
      // 번역 진행 중이면 재시도 플래그 설정
      pendingRetryRef.current = true;
      return;
    }

    const translate = async () => {
      // localStorage 캐시 확인
      const cacheStorageKey = `page-translation:${cacheKey}:${userLanguage}`;
      try {
        const cached = localStorage.getItem(cacheStorageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const cachedKeys = Object.keys(parsed.translations).sort().join(',');
          const currentKeys = Object.keys(segments).sort().join(',');
          if (cachedKeys === currentKeys && parsed.hash === segmentHash) {
            setTranslated(parsed.translations);
            setIsTranslated(true);
            lastSegmentHashRef.current = segmentHash;
            return;
          }
        }
      } catch {
        // 캐시 파싱 실패 시 무시
      }

      translatingRef.current = true;
      lastSegmentHashRef.current = segmentHash;

      // DB 캐시에서 직접 조회 (edge function 호출 전 빠른 로딩)
      try {
        const segmentEntries = Object.entries(segments);
        const hashMap: Record<string, string> = {}; // key → hash
        const hashToKeys: Record<string, string[]> = {}; // hash → keys[]
        segmentEntries.forEach(([key, text]) => {
          const h = simpleHash(text);
          hashMap[key] = h;
          if (!hashToKeys[h]) hashToKeys[h] = [];
          hashToKeys[h].push(key);
        });

        const allHashes = [...new Set(Object.values(hashMap))];
        // Supabase 쿼리 크기 제한 고려하여 50개씩 배치 조회
        const dbCacheMap: Record<string, string> = {};
        for (let i = 0; i < allHashes.length; i += 50) {
          const batch = allHashes.slice(i, i + 50);
          const { data: cachedRows } = await supabase
            .from('translation_cache')
            .select('source_hash, translated_text')
            .eq('target_language', userLanguage)
            .in('source_hash', batch);
          (cachedRows || []).forEach((r: any) => {
            dbCacheMap[r.source_hash] = r.translated_text;
          });
        }

        // DB 캐시에서 찾은 번역 즉시 적용
        const dbTranslations: Record<string, string> = {};
        const uncachedKeys: string[] = [];
        for (const [key, hash] of Object.entries(hashMap)) {
          if (dbCacheMap[hash]) {
            dbTranslations[key] = dbCacheMap[hash];
          } else {
            uncachedKeys.push(key);
          }
        }

        // DB 캐시 히트가 있으면 즉시 표시
        if (Object.keys(dbTranslations).length > 0) {
          setTranslated(dbTranslations);
          setIsTranslated(true);
        }

        // 미번역 세그먼트가 없으면 완료
        if (uncachedKeys.length === 0) {
          // localStorage에도 캐시
          try {
            localStorage.setItem(cacheStorageKey, JSON.stringify({
              translations: dbTranslations,
              hash: segmentHash,
              timestamp: Date.now(),
            }));
          } catch { /* ignore */ }
          translatingRef.current = false;
          return;
        }

        // 미번역 세그먼트만 edge function으로 번역 요청
        setIsTranslating(true);
        const uncachedSegments = uncachedKeys.map(key => ({
          key,
          text: segments[key],
        }));

        const { data, error } = await supabase.functions.invoke('translate-page', {
          body: { segments: uncachedSegments, targetLanguage: userLanguage },
        });

        if (error) {
          console.error('Translation error:', error);
        } else if (data?.translations) {
          // DB 캐시 결과 + 새 번역 결과 병합
          const merged = { ...dbTranslations, ...data.translations };
          setTranslated(merged);
          setIsTranslated(true);

          // localStorage에 캐시
          try {
            localStorage.setItem(cacheStorageKey, JSON.stringify({
              translations: merged,
              hash: segmentHash,
              timestamp: Date.now(),
            }));
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.error('Translation failed:', err);
      } finally {
        setIsTranslating(false);
        translatingRef.current = false;
        // 번역 중 세그먼트가 변경되었으면 재시도
        if (pendingRetryRef.current) {
          pendingRetryRef.current = false;
          lastSegmentHashRef.current = ''; // 해시 리셋하여 재실행 유도
        }
      }
    };

    translate();
  }, [needsTranslation, segmentHash, cacheKey, userLanguage]);

  const toggleOriginal = useCallback(() => {
    setShowOriginalInternal(prev => !prev);
  }, []);

  // 특정 키의 번역된 텍스트 가져오기 (showOriginal 변경 시 즉시 반영)
  const t = (key: string): string => {
    if (showOriginal || !isTranslated) {
      return segments[key] || '';
    }
    return translated[key] || segments[key] || '';
  };

  return {
    translated,
    isTranslating,
    isTranslated,
    isTranslatableLanguage: !!isTranslatableLanguage,
    userLanguage,
    languageName: LANGUAGE_NAMES[userLanguage] || userLanguage,
    showOriginal,
    toggleOriginal,
    t,
  };
};
