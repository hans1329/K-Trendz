import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface CreateSpecialEventDialogProps {
  wikiEntryId: string;
  wikiEntryTitle: string;
  trigger?: React.ReactNode;
}

const CreateSpecialEventDialog = ({ 
  wikiEntryId, 
  wikiEntryTitle,
  trigger 
}: CreateSpecialEventDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!user?.id) return;

    setIsCreating(true);
    try {
      // 기존 활성 이벤트 비활성화
      await supabase
        .from('special_vote_events')
        .update({ is_active: false })
        .eq('is_active', true);

      // 새 이벤트 생성 (24시간)
      const endTime = new Date();
      endTime.setHours(endTime.getHours() + 24);

      const { error } = await supabase
        .from('special_vote_events')
        .insert({
          wiki_entry_id: wikiEntryId,
          title: `Reach 1000 Votes & Start Supporting ${wikiEntryTitle}!`,
          end_time: endTime.toISOString(),
          created_by: user.id,
        });

      if (error) throw error;

      toast.success(`Special event created for ${wikiEntryTitle}!`);
      queryClient.invalidateQueries({ queryKey: ['special-event-active'] });
      setOpen(false);
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Event
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Create Special Voting Event
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Entry</Label>
            <p className="text-lg font-medium">{wikiEntryTitle}</p>
          </div>
          
          <div className="space-y-2">
            <Label>Duration</Label>
            <p className="text-sm text-muted-foreground">24 hours from now</p>
          </div>
          
          <div className="space-y-2">
            <Label>Event Type</Label>
            <p className="text-sm text-muted-foreground">
              Users can vote 1-13 times (13 for logged-in users, 1 for guests)
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              This will deactivate any existing special event and create a new one.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating} className="gap-2">
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Create Event
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateSpecialEventDialog;