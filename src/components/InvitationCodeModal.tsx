import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Ticket, ExternalLink, LogOut } from 'lucide-react';
import { getReferralCode, clearReferralCode } from '@/hooks/useReferralCode';

interface InvitationCodeModalProps {
  open: boolean;
  onSuccess: () => void;
  username?: string;
}

export const InvitationCodeModal = ({ open, onSuccess, username }: InvitationCodeModalProps) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  // URL 레퍼럴 코드가 있으면 자동 입력
  useEffect(() => {
    if (open) {
      const savedCode = getReferralCode();
      if (savedCode) {
        setCode(savedCode);
      }
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      toast.error('Please enter an invitation code');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('use_invitation_code', {
        code_param: code.trim().toUpperCase()
      });

      if (error) throw error;

      if (data === true) {
        // 성공 시 저장된 레퍼럴 코드 삭제
        clearReferralCode();
        toast.success('Welcome to KTRENDZ!', {
          description: 'Your invitation code has been verified.'
        });
        onSuccess();
      } else {
        toast.error('Invalid invitation code', {
          description: 'Please check the code and try again.'
        });
      }
    } catch (error) {
      console.error('Error using invitation code:', error);
      toast.error('Failed to verify invitation code');
    } finally {
      setLoading(false);
    }
  };

  const handleTwitterSearch = () => {
    window.open('https://twitter.com/search?q=KTRENDZ+code', '_blank');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="w-[calc(100vw-2rem)] max-w-md mx-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-full bg-primary/10">
              <Ticket className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-xl text-center">
            Welcome, {username || 'User'}!
          </DialogTitle>
          <DialogDescription className="text-center">
            K-TRENDZ is currently in private beta.
            <br />
            Please enter your invitation code to continue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            className="text-center text-lg tracking-widest uppercase h-12"
            autoComplete="off"
          />

          <Button 
            type="submit" 
            className="w-full h-11"
            disabled={loading || code.length < 6}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Enter KTRENDZ'
            )}
          </Button>
        </form>

        <div className="mt-4 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleTwitterSearch}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Get Invitation Code (Twitter Search)
          </Button>
        </div>

        <div className="mt-2 text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign in with a different account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
