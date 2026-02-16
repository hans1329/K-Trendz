import { useState, useEffect, useRef, memo } from "react";

// 플립 카운트다운 컴포넌트 - 메모이제이션 + IntersectionObserver로 화면에 보일 때만 갱신
export const FlipCountdown = memo(({ targetTime, isActive = false, label }: { targetTime: Date; isActive?: boolean; label?: string }) => {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [flipping, setFlipping] = useState({
    hours: false,
    minutes: false,
    seconds: false,
  });
  const [prevValues, setPrevValues] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isVisible, setIsVisible] = useState(true);
  
  // useRef로 현재 값을 추적하여 closure 문제 해결
  const timeLeftRef = useRef(timeLeft);
  const flippingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  timeLeftRef.current = timeLeft;

  // IntersectionObserver로 화면에 보일 때만 타이머 갱신
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const target = targetTime.getTime();
      const diff = Math.max(0, target - now);

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const current = timeLeftRef.current;
      
      // 값이 동일하면 업데이트 스킵
      if (hours === current.hours && minutes === current.minutes && seconds === current.seconds) {
        return;
      }
      
      // 실제로 변경된 값만 플립 애니메이션 트리거
      const newFlipping = {
        hours: hours !== current.hours,
        minutes: minutes !== current.minutes,
        seconds: seconds !== current.seconds,
      };
      
      // 변경이 있을 때만 플립 상태 업데이트
      if (newFlipping.hours || newFlipping.minutes || newFlipping.seconds) {
        setPrevValues(current);
        setFlipping(newFlipping);
        
        // 이전 타임아웃 클리어
        if (flippingTimeoutRef.current) {
          clearTimeout(flippingTimeoutRef.current);
        }
        
        // 애니메이션 후 플립 상태 리셋
        flippingTimeoutRef.current = setTimeout(() => {
          setFlipping({ hours: false, minutes: false, seconds: false });
        }, 350);
      }
      
      setTimeLeft({ hours, minutes, seconds });
    };

    calculateTimeLeft();
    
    // 화면에 보이지 않으면 타이머 중지
    if (!isVisible) return;
    
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => {
      clearInterval(timer);
      if (flippingTimeoutRef.current) {
        clearTimeout(flippingTimeoutRef.current);
      }
    };
  }, [targetTime, isVisible]);

  const FlipCard = ({ value, prevValue, label: cardLabel, isFlipping }: { value: number; prevValue: number; label: string; isFlipping: boolean }) => {
    const displayValue = String(value).padStart(2, '0');
    const displayPrevValue = String(prevValue).padStart(2, '0');
    
    return (
      <div className="flex flex-col items-center">
        <div className="relative" style={{ perspective: '300px' }}>
          {/* 상단 패널 - 글래스모피즘 스타일 */}
          <div className={`rounded-t-xl min-w-[60px] sm:min-w-[80px] h-[30px] sm:h-[42px] shadow-lg overflow-hidden flex items-end justify-center ${
            isActive 
              ? 'bg-gradient-to-b from-amber-500/40 to-amber-600/50 border border-b-0 border-amber-400/40' 
              : 'bg-white/10 border border-b-0 border-white/20'
          }`}>
            <span className="text-2xl sm:text-4xl font-bold text-white font-mono leading-none translate-y-1/2 drop-shadow-lg">
              {displayValue}
            </span>
          </div>
          
          {/* 하단 패널 - 글래스모피즘 스타일 */}
          <div className={`rounded-b-xl min-w-[60px] sm:min-w-[80px] h-[30px] sm:h-[42px] shadow-lg overflow-hidden flex items-start justify-center ${
            isActive 
              ? 'bg-gradient-to-b from-amber-600/50 to-amber-700/60 border border-t-0 border-amber-400/40' 
              : 'bg-white/5 border border-t-0 border-white/20'
          }`}>
            <span className="text-2xl sm:text-4xl font-bold text-white font-mono leading-none -translate-y-1/2 drop-shadow-lg">
              {displayValue}
            </span>
          </div>

          {/* 플립 상단 - 이전 값 (내려가는 애니메이션) */}
          {isFlipping && (
            <div 
              className={`absolute inset-x-0 top-0 rounded-t-xl min-w-[60px] sm:min-w-[80px] h-[30px] sm:h-[42px] overflow-hidden flex items-end justify-center z-20 ${
                isActive 
                  ? 'bg-gradient-to-b from-amber-500/40 to-amber-600/50 border border-b-0 border-amber-400/40' 
                  : 'bg-white/10 border border-b-0 border-white/20'
              }`}
              style={{ 
                animation: 'flipDown 0.3s ease-in forwards',
                transformOrigin: 'bottom center',
              }}
            >
              <span className="text-2xl sm:text-4xl font-bold text-white font-mono leading-none translate-y-1/2 drop-shadow-lg">
                {displayPrevValue}
              </span>
            </div>
          )}

          {/* 중앙 구분선 */}
          <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-black/30 z-10 -translate-y-1/2" />
        </div>
        <span className="text-[8px] sm:text-[10px] text-white/60 mt-1.5 uppercase tracking-wider">{cardLabel}</span>
      </div>
    );
  };

  return (
    <div ref={containerRef}>
      <style>{`
        @keyframes flipDown {
          0% { transform: rotateX(0deg); }
          100% { transform: rotateX(-90deg); opacity: 0; }
        }
      `}</style>
      <div className="flex items-start gap-2 sm:gap-4">
        <FlipCard value={timeLeft.hours} prevValue={prevValues.hours} label="Hours" isFlipping={flipping.hours} />
        <span className="text-2xl sm:text-4xl font-bold text-primary mt-4 sm:mt-6">:</span>
        <FlipCard value={timeLeft.minutes} prevValue={prevValues.minutes} label="Minutes" isFlipping={flipping.minutes} />
        <span className="text-2xl sm:text-4xl font-bold text-primary mt-4 sm:mt-6">:</span>
        <FlipCard value={timeLeft.seconds} prevValue={prevValues.seconds} label="Seconds" isFlipping={flipping.seconds} />
      </div>
    </div>
  );
});
