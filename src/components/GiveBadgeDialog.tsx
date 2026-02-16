import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Wand2, ShoppingCart, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GiveBadgeDialogProps {
  wikiEntryId: string;
  wikiEntryTitle: string;
  onBadgeGiven: () => void;
}

interface GiftBadge {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  usd_price: number;
  color: string;
}

interface InventoryItem {
  gift_badge_id: string;
  quantity: number;
  gift_badges: GiftBadge;
}

const GiveBadgeDialog = ({
  wikiEntryId,
  wikiEntryTitle,
  onBadgeGiven
}: GiveBadgeDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isGiving, setIsGiving] = useState(false);

  // 사용자의 포인트 가져오기
  const { data: userProfile, refetch: refetchProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('available_points')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user && isOpen
  });


  // 사용자 인벤토리
  const { data: inventory, refetch: refetchInventory } = useQuery({
    queryKey: ['user-inventory', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_gift_badge_inventory')
        .select('*, gift_badges(*)')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as InventoryItem[];
    },
    enabled: !!user && isOpen
  });


  const handleGiveBadge = async (badgeId: string) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to give lightsticks",
        variant: "destructive",
      });
      return;
    }

    setIsGiving(true);
    
    // 즉각적인 UI 피드백
    toast({
      title: "Sending Lightstick",
      description: "Please wait...",
    });

    try {
      const { data, error } = await supabase.rpc('give_badge_to_entry', {
        entry_id_param: wikiEntryId,
        badge_id_param: badgeId
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Lightstick given to ${wikiEntryTitle}`,
      });

      refetchInventory();
      onBadgeGiven();
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error giving lightstick:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to give lightstick",
        variant: "destructive",
      });
    } finally {
      setIsGiving(false);
    }
  };

  const getInventoryQuantity = (badgeId: string) => {
    const item = inventory?.find(i => i.gift_badge_id === badgeId);
    return item?.quantity || 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 h-auto px-2 py-1 hover:text-white bg-muted/50">
          <Wand2 className="w-3 h-3" />
          <span className="text-xs font-semibold">+</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            Give Lightstick to {wikiEntryTitle}
          </DialogTitle>
          <DialogDescription>
            Purchase lightsticks with stars or give from your inventory
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!user && (
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <p className="text-muted-foreground">Please login to give lightsticks</p>
            </div>
          )}

          {/* 인벤토리 */}
          {user && inventory && inventory.length > 0 ? (
            <div>
              <h3 className="font-semibold mb-3">Your Lightstick Inventory</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {inventory.map((item) => (
                  <div
                    key={item.gift_badge_id}
                    className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-2">{item.gift_badges.icon}</div>
                      <p className="font-medium text-sm">{item.gift_badges.name}</p>
                      <Badge variant="secondary" className="mt-1">
                        x{item.quantity}
                      </Badge>
                      <Button
                        size="sm"
                        className="w-full mt-2 rounded-full"
                        onClick={() => handleGiveBadge(item.gift_badge_id)}
                        disabled={isGiving}
                      >
                        {isGiving ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-3 h-3 mr-1" />
                            Give
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : user ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">You don't have any lightsticks yet</p>
              <Button onClick={() => navigate('/purchase?tab=badges')} className="rounded-full">
                Purchase Lightsticks
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GiveBadgeDialog;
