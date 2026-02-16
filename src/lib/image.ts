/**
 * Supabase Storage 이미지 URL을 썸네일 URL로 변환
 * https://supabase.com/docs/guides/storage/serving/image-transformations
 */

const SUPABASE_URL = "https://jguylowswwgjvotdcsfj.supabase.co";

interface ThumbnailOptions {
  width?: number;
  height?: number;
  /** cover(기본), contain, fill */
  resize?: "cover" | "contain" | "fill";
  /** 품질 1-100, 기본 75 */
  quality?: number;
}

/**
 * Supabase Storage 이미지 URL을 썸네일 URL로 변환
 * @param url 원본 이미지 URL
 * @param options 썸네일 옵션
 * @returns 썸네일 URL (Supabase Storage가 아니면 원본 반환)
 */
export function getThumbnailUrl(
  url: string | null | undefined,
  options: ThumbnailOptions = {}
): string | null {
  if (!url) return null;

  // Supabase Storage URL인지 확인
  if (!url.includes(SUPABASE_URL) || !url.includes("/storage/v1/object/public/")) {
    return url; // 외부 이미지는 그대로 반환
  }

  const { width = 300, height = 360, resize = "cover", quality = 75 } = options;

  // /storage/v1/object/public/ → /storage/v1/render/image/public/
  const thumbnailUrl = url.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/"
  );

  // 쿼리 파라미터 추가 (format 제거 - Supabase에서 허용하지 않음)
  const separator = thumbnailUrl.includes("?") ? "&" : "?";
  return `${thumbnailUrl}${separator}width=${width}&height=${height}&resize=${resize}&quality=${quality}`;
}

/**
 * 카드용 썸네일 (300x360, 5:6 비율, webp)
 */
export function getCardThumbnail(url: string | null | undefined): string | null {
  return getThumbnailUrl(url, { width: 300, height: 360, quality: 75 });
}

/**
 * 캐러셀용 썸네일 (400x480, 5:6 비율, webp)
 */
export function getCarouselThumbnail(url: string | null | undefined): string | null {
  return getThumbnailUrl(url, { width: 400, height: 480, quality: 80 });
}

/**
 * 아바타용 썸네일 (정사각형, webp)
 */
export function getAvatarThumbnail(
  url: string | null | undefined,
  size: number = 80
): string | null {
  return getThumbnailUrl(url, { width: size, height: size, quality: 80 });
}

/**
 * 이미지 URL을 webp로 변환 (리사이즈 없이)
 */
export function getWebpUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Supabase Storage URL인지 확인
  if (!url.includes(SUPABASE_URL) || !url.includes("/storage/v1/object/public/")) {
    return url; // 외부 이미지는 그대로 반환
  }

  // /storage/v1/object/public/ → /storage/v1/render/image/public/
  const transformUrl = url.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/"
  );

  // format 파라미터 제거 - Supabase에서 허용하지 않음
  const separator = transformUrl.includes("?") ? "&" : "?";
  return `${transformUrl}${separator}quality=80`;
}
