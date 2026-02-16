import * as React from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getWebpUrl } from "@/lib/image";

type SmartImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  src?: string | null;
  alt: string;
  rootMargin?: string;
  fallback?: React.ReactNode;
  /** true면 IntersectionObserver를 건너뛰고 즉시 로드 */
  eager?: boolean;
  /** false면 webp 변환 건너뛰기 (기본: true) */
  convertToWebp?: boolean;
};

export default function SmartImage({
  src,
  alt,
  className,
  rootMargin = "800px",
  fallback = null,
  eager = false,
  convertToWebp = true, // Supabase Image Transformations 활성화 (format 파라미터 제거됨)
  loading,
  decoding,
  onLoad,
  onError,
  ...rest
}: SmartImageProps) {
  // Supabase Storage 이미지를 webp로 자동 변환
  const optimizedSrc = convertToWebp ? getWebpUrl(src) : src;
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [shouldLoad, setShouldLoad] = React.useState(eager);
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    // 이미지가 없으면 fallback만 렌더
    if (!optimizedSrc) {
      setShouldLoad(false);
      setLoaded(false);
      setFailed(false);
      return;
    }

    // eager 모드면 즉시 로드
    if (eager) {
      setShouldLoad(true);
      return;
    }

    // IntersectionObserver 미지원 환경에서는 즉시 로드
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const el = imgRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [optimizedSrc, rootMargin, eager]);

  React.useEffect(() => {
    // src가 바뀌거나 로딩 트리거가 바뀌면 상태 리셋
    setLoaded(false);
    setFailed(false);
  }, [optimizedSrc, shouldLoad]);

  if (!optimizedSrc || failed) return <>{fallback}</>;

  return (
    <>
      {!loaded && <Skeleton className="absolute inset-0" />}
      <img
        ref={imgRef}
        src={shouldLoad ? optimizedSrc : undefined}
        alt={alt}
        loading={loading ?? (eager ? "eager" : "lazy")}
        decoding={decoding ?? "async"}
        className={cn(
          "h-full w-full transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setFailed(true);
          onError?.(e);
        }}
        {...rest}
      />
    </>
  );
}
