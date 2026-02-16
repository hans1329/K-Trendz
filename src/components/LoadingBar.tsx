import { useEffect, useState } from "react";

interface LoadingBarProps {
  isLoading: boolean;
}

const LoadingBar = ({ isLoading }: LoadingBarProps) => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setProgress(0);
      
      // 빠르게 70%까지 진행
      const timer1 = setTimeout(() => setProgress(30), 100);
      const timer2 = setTimeout(() => setProgress(60), 300);
      const timer3 = setTimeout(() => setProgress(80), 600);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    } else {
      // 로딩 완료시 100%로 채우고 사라지기
      setProgress(100);
      const timer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 400);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1">
      <div
        className="h-full transition-all duration-300 ease-out animate-rainbow-flow"
        style={{
          width: `${progress}%`,
          background: 'linear-gradient(90deg, hsl(340, 82%, 52%), hsl(291, 64%, 42%), hsl(262, 83%, 58%), hsl(217, 91%, 60%), hsl(189, 94%, 43%), hsl(340, 82%, 52%))',
          backgroundSize: '200% 100%'
        }}
      />
    </div>
  );
};

export default LoadingBar;
