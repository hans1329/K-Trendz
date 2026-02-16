import { Languages, Loader2, RotateCcw } from 'lucide-react';

interface TranslationBannerProps {
  isTranslating: boolean;
  isTranslated: boolean;
  showOriginal: boolean;
  languageName: string;
  onToggle: () => void;
}

// 번역 상태를 보여주는 배너 컴포넌트
const TranslationBanner = ({
  isTranslating,
  isTranslated,
  showOriginal,
  languageName,
  onToggle,
}: TranslationBannerProps) => {
  // 배너는 항상 표시 (부모에서 isTranslatableLanguage로 제어)

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 mb-3 rounded-lg bg-muted/60 border border-border/50">
      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground min-w-0">
        {isTranslating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin text-primary" />
            <span>Translating to {languageName}...</span>
          </>
        ) : (
          <>
            <Languages className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
            <span>
              {showOriginal ? 'Showing original' : `Translated to ${languageName}`}
            </span>
          </>
        )}
      </div>
      {isTranslated && (
        <button
          onClick={onToggle}
          className="h-7 px-3 text-xs rounded-full border border-border bg-background text-foreground flex-shrink-0 flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          {showOriginal ? 'Translate' : 'Show Original'}
        </button>
      )}
    </div>
  );
};

export default TranslationBanner;
