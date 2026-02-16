import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Image, Bold, Italic, Underline, List, ListOrdered, Link2, Heading1, Heading2, Heading3, Type } from "lucide-react";

// TikTok URL 패턴 감지 및 비디오 ID 추출
const extractTikTokVideoId = (url: string): string | null => {
  const patterns = [
    /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
    /vm\.tiktok\.com\/([\w]+)/i,
    /vt\.tiktok\.com\/([\w]+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// TikTok 임베드 HTML 생성
const createTikTokEmbed = (videoId: string, originalUrl: string): string => {
  return `<div class="tiktok-embed-container" style="max-width: 605px; margin: 20px auto;">
    <blockquote class="tiktok-embed" cite="${originalUrl}" data-video-id="${videoId}" style="max-width: 605px; min-width: 325px;">
      <section></section>
    </blockquote>
  </div>`;
};

interface User {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onMention?: (userId: string, username: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const RichTextEditor = ({
  value,
  onChange,
  onMention,
  placeholder = "Enter text...",
  className,
  minHeight = "200px",
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const isUpdatingRef = useRef(false);

  // Update content when value changes externally
  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      if (value !== currentHtml) {
        editorRef.current.innerHTML = value;
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current && !isUpdatingRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html);

      // Check for @ mentions
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const textBeforeCursor = range.startContainer.textContent?.substring(0, range.startOffset) || "";
        const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

        if (mentionMatch) {
          const query = mentionMatch[1];
          setMentionQuery(query);
          fetchUsers(query);
          setShowSuggestions(true);
        } else {
          setShowSuggestions(false);
        }
      }
    }
  };

  const fetchUsers = async (query: string) => {
    try {
      let supabaseQuery = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .limit(5);

      if (query) {
        supabaseQuery = supabaseQuery.or(`username.ilike.%${query}%,display_name.ilike.%${query}%`);
      }

      const { data, error } = await supabaseQuery;

      if (error) throw error;
      setSuggestions(data || []);
      setSelectedIndex(0);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const insertMention = (user: User) => {
    if (!editorRef.current) return;

    isUpdatingRef.current = true;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    const textContent = textNode.textContent || "";
    const cursorPos = range.startOffset;

    // Find the @ symbol position
    const textBeforeCursor = textContent.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      // Create mention element
      const mentionSpan = document.createElement("span");
      mentionSpan.className = "mention";
      mentionSpan.style.color = "#ff4500";
      mentionSpan.style.fontWeight = "500";
      mentionSpan.setAttribute("data-user-id", user.id);
      mentionSpan.textContent = `@${user.username}`;
      mentionSpan.contentEditable = "false";

      // Create space after mention
      const space = document.createTextNode(" ");

      // Replace the @query text with the mention
      const beforeText = textContent.substring(0, atIndex);
      const afterText = textContent.substring(cursorPos);

      // Clear and rebuild
      if (textNode.nodeType === Node.TEXT_NODE) {
        const beforeNode = document.createTextNode(beforeText);
        const afterNode = document.createTextNode(afterText);

        const parent = textNode.parentNode;
        if (parent) {
          parent.insertBefore(beforeNode, textNode);
          parent.insertBefore(mentionSpan, textNode);
          parent.insertBefore(space, textNode);
          parent.insertBefore(afterNode, textNode);
          parent.removeChild(textNode);

          // Move cursor after space
          const newRange = document.createRange();
          newRange.setStartAfter(space);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }

      if (onMention) {
        onMention(user.id, user.username);
      }
    }

    setShowSuggestions(false);
    setMentionQuery("");
    
    setTimeout(() => {
      isUpdatingRef.current = false;
      handleInput();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!showSuggestions) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && suggestions.length > 0) {
      e.preventDefault();
      insertMention(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // 이미지 붙여넣기 처리 우선
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await uploadAndInsertImage(file);
        }
        return;
      }
    }

    // 텍스트 붙여넣기 확인
    const pastedText = e.clipboardData.getData('text/plain');
    
    // URL 패턴 감지
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const urls = pastedText.match(urlPattern);
    
    if (urls && urls.length === 1) {
      const url = urls[0].trim();
      
      // TikTok URL 확인
      const videoId = extractTikTokVideoId(url);
      if (videoId) {
        e.preventDefault();
        isUpdatingRef.current = true;
        
        const embedHtml = createTikTokEmbed(videoId, url);
        
        // 현재 커서 위치에 임베드 삽입
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = embedHtml;
          const fragment = document.createDocumentFragment();
          while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
          }
          range.insertNode(fragment);
        }
        
        // TikTok embed script 로드 (페이지당 한 번만)
        if (!document.querySelector('script[src="https://www.tiktok.com/embed.js"]')) {
          const script = document.createElement('script');
          script.src = 'https://www.tiktok.com/embed.js';
          script.async = true;
          document.body.appendChild(script);
        }
        
        setTimeout(() => {
          isUpdatingRef.current = false;
          handleInput();
        }, 0);
        
        return;
      }
    }

    // 일반 텍스트 붙여넣기 - 스타일 제거하고 plain text로 삽입
    e.preventDefault();
    isUpdatingRef.current = true;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      // 줄바꿈을 <br>로 변환하여 삽입
      const lines = pastedText.split('\n');
      const fragment = document.createDocumentFragment();
      
      lines.forEach((line, index) => {
        const textNode = document.createTextNode(line);
        fragment.appendChild(textNode);
        
        // 마지막 줄이 아니면 줄바꿈 추가
        if (index < lines.length - 1) {
          fragment.appendChild(document.createElement('br'));
        }
      });
      
      range.insertNode(fragment);
      
      // 커서를 삽입된 텍스트 끝으로 이동
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    setTimeout(() => {
      isUpdatingRef.current = false;
      handleInput();
    }, 0);
  };

  const uploadAndInsertImage = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    isUpdatingRef.current = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName);

      // Insert image at cursor
      const img = document.createElement('img');
      img.src = publicUrl;
      img.alt = 'Uploaded image';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.margin = '10px 0';

      if (editorRef.current) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
          
          // Move cursor after image
          const newRange = document.createRange();
          newRange.setStartAfter(img);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } else {
          editorRef.current.appendChild(img);
        }
        
        setTimeout(() => {
          isUpdatingRef.current = false;
          handleInput();
        }, 0);
      }

      toast({
        title: "Success",
        description: "Image inserted",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      isUpdatingRef.current = false;
    } finally {
      setIsUploading(false);
      isUpdatingRef.current = false;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadAndInsertImage(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const execCommand = (command: string, value?: string) => {
    isUpdatingRef.current = true;
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    setTimeout(() => {
      isUpdatingRef.current = false;
      handleInput();
    }, 0);
  };

  const formatBlock = (tagName: string) => {
    isUpdatingRef.current = true;
    document.execCommand('formatBlock', false, `<${tagName}>`);
    editorRef.current?.focus();
    setTimeout(() => {
      isUpdatingRef.current = false;
      handleInput();
    }, 0);
  };

  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      execCommand("createLink", url);
    }
  };

  return (
    <div className="relative border border-input rounded-md">
      {isUploading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-md">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
      
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand("bold")}
          className="h-8 w-8 p-0"
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand("italic")}
          className="h-8 w-8 p-0"
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand("underline")}
          className="h-8 w-8 p-0"
          title="Underline"
        >
          <Underline className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-8 mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => formatBlock("P")}
          className="h-8 w-8 p-0"
          title="Body Text"
        >
          <Type className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => formatBlock("H1")}
          className="h-8 w-8 p-0"
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => formatBlock("H2")}
          className="h-8 w-8 p-0"
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => formatBlock("H3")}
          className="h-8 w-8 p-0"
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-8 mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand("insertUnorderedList")}
          className="h-8 w-8 p-0"
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand("insertOrderedList")}
          className="h-8 w-8 p-0"
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-8 mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={insertLink}
          className="h-8 w-8 p-0"
          title="Insert Link"
        >
          <Link2 className="w-4 h-4" />
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          id="rich-text-image-upload"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="h-8 w-8 p-0"
          title="Insert Image"
        >
          <Image className="w-4 h-4" />
        </Button>
      </div>

      <div
        ref={editorRef}
        contentEditable={true}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={cn(
          "w-full bg-background px-3 py-2 text-sm overflow-auto",
          "focus-visible:outline-none",
          "prose prose-xs sm:prose-sm dark:prose-invert max-w-none",
          "prose-headings:text-foreground prose-p:text-muted-foreground",
          "prose-strong:font-semibold prose-a:text-primary hover:prose-a:underline",
          "prose-img:rounded-lg prose-img:shadow-md prose-img:max-w-full",
          "[&_h1]:text-2xl [&_h1]:sm:text-3xl [&_h1]:font-extrabold [&_h1]:mb-2 [&_h1]:mt-2 [&_h1]:leading-tight",
          "[&_h2]:text-xl [&_h2]:sm:text-2xl [&_h2]:font-bold [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2 [&_h2]:mb-2 [&_h2]:mt-2",
          "[&_h3]:text-lg [&_h3]:sm:text-xl [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-2",
          "[&_p]:text-base [&_p]:leading-relaxed [&_p]:mb-3",
          "prose-ul:list-disc prose-ol:list-decimal prose-li:text-muted-foreground",
          "prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic",
          "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
          "break-words",
          "[&_.mention]:text-primary [&_.mention]:font-medium",
          "[&_.tiktok-embed-container]:my-4 [&_.tiktok-embed-container]:mx-auto",
          className
        )}
        style={{ minHeight, height: 'auto' }}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-64 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
          {suggestions.map((user, index) => (
            <div
              key={user.id}
              onClick={() => insertMention(user)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer",
                index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
              )}
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {(user.display_name || user.username).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {user.display_name || user.username}
                </span>
                <span className="text-xs text-muted-foreground">@{user.username}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;
