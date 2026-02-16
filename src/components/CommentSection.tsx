import { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import VoteButtons from "./VoteButtons";
import MentionText from "./MentionText";
import MentionAutocomplete from "./MentionAutocomplete";
import { Trash2, CornerDownRight, Edit2, Crown } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  votes: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  parent_comment_id?: string | null;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  replies?: Comment[];
}

interface CommentSectionProps {
  comments: Comment[];
  currentUserId?: string;
  postAuthorId?: string;
  wikiCreatorId?: string;
  commentVotes: Map<string, "up" | "down" | null>;
  onAddComment: (content: string, parentCommentId?: string) => void;
  onVoteComment: (commentId: string, type: "up" | "down") => void;
  onDeleteComment: (commentId: string) => void;
  isFollower?: boolean;
  isAdmin?: boolean;
  showInputForm?: boolean;
  sortBy?: SortType;
  onSortChange?: (sortBy: SortType) => void;
}

export interface CommentSectionRef {
  focusInput: () => void;
}

type SortType = "best" | "top" | "new" | "controversial";

const CommentSection = forwardRef<CommentSectionRef, CommentSectionProps>(({ 
  comments, 
  currentUserId,
  postAuthorId,
  wikiCreatorId,
  commentVotes,
  onAddComment, 
  onVoteComment,
  onDeleteComment,
  isFollower = true,
  isAdmin = false,
  showInputForm = true,
  sortBy: externalSortBy,
  onSortChange
}, ref) => {
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [internalSortBy, setInternalSortBy] = useState<SortType>("best");
  const sortBy = externalSortBy || internalSortBy;
  const setSortBy = onSortChange || setInternalSortBy;
  const [visibleCount, setVisibleCount] = useState(10);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focusInput: () => {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;
    if (wikiCreatorId && !isFollower && !isAdmin) return;
    if (newComment.trim()) {
      onAddComment(newComment);
      setNewComment("");
    }
  };

  const handleReplySubmit = (parentId: string) => {
    if (!currentUserId) return;
    if (wikiCreatorId && !isFollower && !isAdmin) return;
    if (replyContent.trim()) {
      onAddComment(replyContent, parentId);
      setReplyContent("");
      setReplyingTo(null);
    }
  };

  const isEdited = (comment: Comment) => {
    return new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime() > 60000; // 1분 이상 차이
  };

  const timeAgo = (date: string) => {
    const dateObj = new Date(date);
    const seconds = Math.floor((new Date().getTime() - dateObj.getTime()) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    
    return "just now";
  };

  const getControversialScore = (comment: Comment) => {
    const upvotes = Math.max(0, comment.votes);
    const downvotes = Math.abs(Math.min(0, comment.votes));
    if (upvotes + downvotes === 0) return 0;
    return Math.min(upvotes, downvotes) + (Math.abs(upvotes - downvotes) / 10);
  };

  const sortComments = (commentsToSort: Comment[]): Comment[] => {
    const sorted = [...commentsToSort].sort((a, b) => {
      switch (sortBy) {
        case "top":
          return b.votes - a.votes;
        case "new":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "controversial":
          return getControversialScore(b) - getControversialScore(a);
        case "best":
        default:
          // Best = 투표수 + 시간 가중치
          const aScore = a.votes + (1000 / (Date.now() - new Date(a.created_at).getTime()));
          const bScore = b.votes + (1000 / (Date.now() - new Date(b.created_at).getTime()));
          return bScore - aScore;
      }
    });

    // 대댓글도 정렬
    return sorted.map(comment => ({
      ...comment,
      replies: comment.replies ? sortComments(comment.replies) : undefined
    }));
  };

  const countReplies = (comment: Comment): number => {
    if (!comment.replies || comment.replies.length === 0) return 0;
    return comment.replies.length + comment.replies.reduce((sum, reply) => sum + countReplies(reply), 0);
  };

  const renderComment = (comment: Comment, depth: number = 0) => {
    const replyCount = countReplies(comment);
    
    return (
      <div key={comment.id} className={depth > 0 ? "ml-4 sm:ml-8 mt-3" : "mb-4"}>
        <div className="py-2 sm:p-4 relative">
          {depth > 0 && (
            <div className="absolute left-[-16px] sm:left-[-24px] top-5">
              <CornerDownRight className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex items-start gap-2 sm:gap-3 mb-2">
            <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
              <AvatarImage src={comment.profiles?.avatar_url || undefined} />
              <AvatarFallback>
                {(comment.profiles?.display_name || comment.profiles?.username || "A")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">
                    {comment.profiles?.display_name || comment.profiles?.username || "Anonymous"}
                  </span>
                  
                  {/* Creator 왕관 아이콘 */}
                  {wikiCreatorId && comment.user_id === wikiCreatorId && (
                    <Crown className="w-4 h-4 text-[#ff4500]" />
                  )}
                  
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(comment.created_at)}
                  </span>
                  
                  {/* 수정됨 표시 */}
                  {isEdited(comment) && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Edit2 className="w-3 h-3" />
                      edited
                    </span>
                  )}
                </div>
            
                {currentUserId === comment.user_id && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this comment? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDeleteComment(comment.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </div>
          
          <div 
            className="text-sm mb-3 ml-9 sm:ml-11"
            lang="en"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            <MentionText text={comment.content} />
          </div>
      
          <div className="flex justify-between items-center ml-9 sm:ml-11">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs border border-border"
              onClick={() => {
                if (!currentUserId) return;
                if (wikiCreatorId && !isFollower && !isAdmin) return;
                setReplyingTo(replyingTo === comment.id ? null : comment.id);
                setReplyContent("");
              }}
              disabled={!currentUserId || (wikiCreatorId && !isFollower && !isAdmin)}
            >
              Reply
            </Button>
            
            <VoteButtons
              votes={comment.votes}
              userVote={commentVotes.get(comment.id) || null}
              onVote={(type) => onVoteComment(comment.id, type)}
              vertical={false}
            />
          </div>
          
          {replyingTo === comment.id && (
            <div className="mt-3 space-y-2 ml-9 sm:ml-11">
              <MentionAutocomplete
                value={replyContent}
                onChange={setReplyContent}
                placeholder={`Reply to ${comment.profiles?.display_name || comment.profiles?.username || "user"}...`}
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => handleReplySubmit(comment.id)}
                  disabled={!replyContent.trim()}
                >
                  Post Reply
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-3">
            {comment.replies.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const sortedComments = sortComments(comments);
  const visibleComments = sortedComments.slice(0, visibleCount);
  const hasMore = sortedComments.length > visibleCount;

  return (
    <div className="space-y-4">
      {showInputForm && (
        <form onSubmit={handleSubmit} className="relative" id="comment">
          <MentionAutocomplete
            ref={inputRef}
            value={newComment}
            onChange={setNewComment}
            placeholder="Write a Comment"
            disabled={!currentUserId || (wikiCreatorId && !isFollower && !isAdmin)}
            className={isFocused ? "min-h-[80px] pr-24" : "min-h-[44px]"}
            minHeight={isFocused ? "80px" : "44px"}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              if (!newComment.trim()) {
                setIsFocused(false);
              }
            }}
          />
          {isFocused && (
            <Button 
              type="submit" 
              disabled={!newComment.trim() || !currentUserId || (wikiCreatorId && !isFollower && !isAdmin)}
              size="sm"
              className="absolute right-2 bottom-2"
            >
              Comment
            </Button>
          )}
        </form>
      )}

      {/* 정렬 옵션 - 부모에서 제어하지 않을 때만 표시 */}
      {!externalSortBy && (
        <div className="flex items-center justify-end mb-4">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortType)}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="best">Best</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="top">Old</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-3">
        {visibleComments.map((comment) => renderComment(comment))}
      </div>

      {/* 더 보기 버튼 */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => setVisibleCount(prev => prev + 10)}
            className="w-full sm:w-auto"
          >
            Load More Comments ({sortedComments.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
});

CommentSection.displayName = 'CommentSection';

export default CommentSection;
