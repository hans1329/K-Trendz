// @username 자동완성 컴포넌트
import { useState, useEffect, useRef, forwardRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface User {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface MentionAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onMention?: (username: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

const MentionAutocomplete = forwardRef<HTMLTextAreaElement, MentionAutocompleteProps>(({
  value,
  onChange,
  onMention,
  placeholder = "Write a comment...",
  className = "min-h-[100px]",
  minHeight,
  disabled = false,
  onFocus,
  onBlur
}, ref) => {
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // @ 입력 감지 및 자동완성 트리거
  useEffect(() => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setShowSuggestions(true);
      fetchUsers(query);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [value]);

  const fetchUsers = async (query: string) => {
    try {
      let queryBuilder = supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .limit(5);

      if (query) {
        queryBuilder = queryBuilder.ilike('username', `${query}%`);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      setSuggestions(data || []);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Error fetching users:', error);
      setSuggestions([]);
    }
  };

  const insertMention = (user: User) => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    
    // @ 및 현재 쿼리 제거
    const newTextBefore = textBeforeCursor.replace(/@\w*$/, `@${user.username} `);
    const newValue = newTextBefore + textAfterCursor;
    
    onChange(newValue);
    setShowSuggestions(false);
    setSuggestions([]);
    
    onMention?.(user.username);
    
    // 커서 위치 복원
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = newTextBefore.length;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        if (e.shiftKey) return; // Shift+Enter는 줄바꿈
        e.preventDefault();
        insertMention(suggestions[selectedIndex]);
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={(node) => {
          textareaRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        style={{ minHeight: minHeight || '100px' }}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-60 overflow-auto"
        >
          {suggestions.map((user, index) => (
            <div
              key={user.id}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
              }`}
              onClick={() => insertMention(user)}
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="text-sm font-medium">@{user.username}</div>
                {user.display_name && (
                  <div className="text-xs text-muted-foreground">{user.display_name}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

MentionAutocomplete.displayName = 'MentionAutocomplete';

export default MentionAutocomplete;
