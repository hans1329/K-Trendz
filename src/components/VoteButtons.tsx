import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoteButtonsProps {
  votes: number;
  userVote?: "up" | "down" | null;
  onVote: (type: "up" | "down") => void;
  vertical?: boolean;
}

const VoteButtons = ({ votes, userVote, onVote, vertical = true }: VoteButtonsProps) => {
  const handleVote = (type: "up" | "down") => {
    console.log('VoteButtons clicked:', type, 'votes:', votes, 'userVote:', userVote);
    onVote(type);
  };
  
  return (
    <div className={cn(
      "flex items-center gap-0.5 md:gap-1",
      vertical ? "flex-col" : "flex-row"
    )}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-6 w-6 md:h-8 md:w-8 p-0 rounded-full transition-colors",
          userVote === "up" 
            ? "bg-primary text-white hover:bg-primary/90" 
            : "hover:bg-orange-500/10 hover:text-orange-500"
        )}
        onClick={() => handleVote("up")}
      >
        <ThumbsUp className="w-3 h-3 md:w-5 md:h-5" />
      </Button>
      
      <span className={cn(
        "text-xs md:text-sm font-bold min-w-[1.5rem] md:min-w-[2rem] text-center",
        userVote === "up" && "text-orange-500",
        userVote === "down" && "text-gray-500"
      )}>
        {votes}
      </span>
      
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-6 w-6 md:h-8 md:w-8 p-0 text-gray-400 hover:bg-gray-500/10 hover:text-gray-600 transition-colors",
          userVote === "down" && "text-gray-600 bg-gray-500/10"
        )}
        onClick={() => handleVote("down")}
      >
        <ThumbsDown className="w-3 h-3 md:w-5 md:h-5" />
      </Button>
    </div>
  );
};

export default VoteButtons;
