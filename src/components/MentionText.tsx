// 멘션이 포함된 텍스트를 렌더링하는 컴포넌트
import { Link } from 'react-router-dom';

interface MentionTextProps {
  text: string;
  className?: string;
}

const MentionText = ({ text, className = "" }: MentionTextProps) => {
  // @username 패턴을 찾아서 링크로 변환
  const parts = text.split(/(@\w+)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          const username = part.substring(1);
          return (
            <Link
              key={index}
              to={`/u/${username}`}
              className="text-primary font-semibold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export default MentionText;
