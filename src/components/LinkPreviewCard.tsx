// 메시지 내 URL을 감지하여 OG 메타데이터 기반 인라인 프리뷰 카드로 렌더링
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface LinkPreviewCardProps {
  url: string;
}

const LinkPreviewCard = ({ url }: LinkPreviewCardProps) => {
  const { data: meta, isLoading, isError } = useQuery({
    queryKey: ['link-preview', url],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('extract-url-metadata', {
        body: { url },
      });
      if (error) throw error;
      return data as { title?: string; description?: string; image?: string; sourceUrl?: string };
    },
    staleTime: 24 * 60 * 60 * 1000, // 24시간 캐시
    gcTime: 48 * 60 * 60 * 1000,
    retry: 1,
  });

  if (isError) return null;

  // 도메인 추출
  const domain = (() => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  })();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 rounded-lg border border-border overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors no-underline max-w-full"
      onClick={(e) => e.stopPropagation()}
    >
      {isLoading ? (
        <div className="flex gap-2.5 p-2.5">
          <Skeleton className="w-16 h-16 rounded flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ) : meta?.image ? (
        // 이미지가 있는 경우: 좌측 썸네일 + 우측 텍스트
        <div className="flex gap-2.5 p-2.5">
          <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-muted">
            <img
              src={meta.image}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">
              {meta.title || domain}
            </p>
            {meta.description && (
              <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                {meta.description.length > 120 ? meta.description.slice(0, 120) + '...' : meta.description}
              </p>
            )}
            <div className="flex items-center gap-1 mt-1">
              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/60" />
              <span className="text-[9px] text-muted-foreground/60">{domain}</span>
            </div>
          </div>
        </div>
      ) : (
        // 이미지 없는 경우: 텍스트만
        <div className="p-2.5">
          <p className="text-xs font-semibold text-foreground line-clamp-1">
            {meta?.title || domain}
          </p>
          {meta?.description && (
            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
              {meta.description.length > 120 ? meta.description.slice(0, 120) + '...' : meta.description}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1">
            <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/60" />
            <span className="text-[9px] text-muted-foreground/60">{domain}</span>
          </div>
        </div>
      )}
    </a>
  );
};

export default LinkPreviewCard;

// 메시지 텍스트에서 URL을 추출하는 유틸
export const extractUrls = (text: string): string[] => {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  const matches = text.match(urlRegex);
  if (!matches) return [];
  // 중복 제거, 최대 3개
  return [...new Set(matches)].slice(0, 3);
};
