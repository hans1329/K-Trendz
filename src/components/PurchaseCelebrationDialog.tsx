import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles, PartyPopper, Wand2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Confetti from "./Confetti";

interface PurchaseCelebrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryTitle: string;
  entrySlug?: string;
  userName?: string;
  userAvatar?: string;
  tokenBalance?: number;
}

const PurchaseCelebrationDialog = ({
  open,
  onOpenChange,
  entryTitle,
  entrySlug,
  userName,
  userAvatar,
  tokenBalance = 1
}: PurchaseCelebrationDialogProps) => {
  const navigate = useNavigate();

  const handleViewCollection = () => {
    onOpenChange(false);
    navigate('/my-fanz-tokens');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] p-0 overflow-y-auto" hideCloseButton>
        {/* 컨페티 효과 */}
        {open && <Confetti />}
        
        {/* 그라데이션 헤더 */}
        <div className="bg-gradient-to-br from-primary via-orange-500 to-amber-400 p-8 text-white text-center relative overflow-hidden">
          {/* 배경 장식 */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-4 left-4 text-4xl animate-bounce">🎉</div>
            <div className="absolute top-8 right-8 text-3xl animate-bounce delay-100">✨</div>
            <div className="absolute bottom-4 left-8 text-3xl animate-bounce delay-200">🪄</div>
            <div className="absolute bottom-8 right-4 text-4xl animate-bounce delay-300">🎊</div>
          </div>
          
          <div className="relative z-10">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm animate-pulse">
                <PartyPopper className="w-10 h-10" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold mb-2">
              🎉 Congratulations! 🎉
            </h2>
            <p className="text-white/90 text-sm">
              You're now a proud LightStick holder!
            </p>
          </div>
        </div>

        {/* 사용자 정보 */}
        <div className="p-6 text-center space-y-6">
          {/* 사용자 아바타와 이름 */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="w-20 h-20 ring-4 ring-primary/20 shadow-lg">
                <AvatarImage src={userAvatar} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-orange-200 text-2xl">
                  {userName?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-1.5 shadow-lg">
                <Wand2 className="w-4 h-4" />
              </div>
            </div>
            
            <div>
              <p className="font-bold text-lg">
                {userName || 'Fan'}
              </p>
              <p className="text-sm text-muted-foreground">
                just joined the fan club!
              </p>
            </div>
          </div>

          {/* 구매 정보 박스 */}
          <div className="bg-gradient-to-r from-primary/5 via-orange-50 to-amber-50 dark:from-primary/10 dark:via-orange-950/20 dark:to-amber-950/20 rounded-2xl p-5 border-2 border-primary/20">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold text-primary">New LightStick</span>
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            
            <p className="text-xl font-bold mb-1">
              {entryTitle}
            </p>
            
          </div>

          {/* 혜택 안내 */}
          <div className="text-left bg-muted/50 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-center mb-3">✨ Your Fan Benefits</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="text-primary">•</span> Voting Power Boost
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-primary">•</span> Governance Rights
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-primary">•</span> Challenge Bonuses
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-primary">•</span> Exclusive Content
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => onOpenChange(false)}
              className="w-full h-12 text-base gap-2 rounded-full"
            >
              <PartyPopper className="w-5 h-5" />
              Awesome! Let's Go!
            </Button>
            <Button 
              variant="outline"
              onClick={handleViewCollection}
              className="w-full gap-2 rounded-full"
            >
              View My Collection
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseCelebrationDialog;
