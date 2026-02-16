import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Twitter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OwnerApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  entryTitle: string;
  userId: string;
  onSuccess?: () => void;
}

const OwnerApplicationDialog = ({
  open,
  onOpenChange,
  entryId,
  entryTitle,
  userId,
  onSuccess
}: OwnerApplicationDialogProps) => {
  const [twitterHandle, setTwitterHandle] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!twitterHandle.trim()) {
      toast.error('Please enter your Twitter/X handle');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please enter your application reason');
      return;
    }

    setIsSubmitting(true);
    try {
      // 트위터 핸들에서 @ 제거
      const cleanHandle = twitterHandle.replace('@', '').trim();

      const { error } = await supabase
        .from('owner_applications')
        .insert({
          wiki_entry_id: entryId,
          user_id: userId,
          twitter_handle: cleanHandle,
          reason: reason.trim(),
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('You have already applied for this entry');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Application submitted successfully!');
      setTwitterHandle('');
      setReason('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting application:', error);
      toast.error('Failed to submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply for Fandom Master</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">Apply to become the Fandom Master of "{entryTitle}"</span>
            <span className="block text-xs text-muted-foreground">
              As a Fandom Master, you will manage fans by posting various content and receive 6% of lightstick sales in USDC.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="twitter">Twitter/X Handle</Label>
            <div className="relative">
              <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="twitter"
                placeholder="@yourusername"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Why do you want to manage this page?</Label>
            <Textarea
              id="reason"
              placeholder="Tell us why you're the right person to manage this fan page..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Application'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OwnerApplicationDialog;
