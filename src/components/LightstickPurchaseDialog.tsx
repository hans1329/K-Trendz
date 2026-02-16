import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface GiftBadge {
  id: string;
  name: string;
  icon: string;
  color: string;
  point_price: number;
  description: string | null;
}

interface LightstickPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LightstickPurchaseDialog = ({ open, onOpenChange }: LightstickPurchaseDialogProps) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [badges, setBadges] = useState<GiftBadge[]>([]);

  // Load gift badges when dialog opens
  useEffect(() => {
    if (open) {
      loadBadges();
    }
  }, [open]);

  const loadBadges = async () => {
    const { data, error } = await supabase
      .from('gift_badges')
      .select('id, name, icon, color, point_price, description')
      .eq('is_active', true)
      .order('display_order');

    if (error) {
      console.error('Error loading badges:', error);
      return;
    }

    setBadges(data || []);
  };

  const handlePurchase = async (badge: GiftBadge) => {
    if (!user || !profile) {
      toast.error("Please login to purchase");
      return;
    }

    if (profile.available_points < badge.point_price) {
      toast.error("Insufficient Stars", {
        description: `You need ${badge.point_price} Stars but only have ${profile.available_points} Stars`,
      });
      return;
    }

    setLoading(true);
    try {
      // Deduct points
      const { error: deductError } = await supabase.rpc('deduct_points', {
        user_id_param: user.id,
        points_amount_param: badge.point_price,
        action_type_param: `purchase_lightstick_${badge.id}`,
      });

      if (deductError) throw deductError;

      // Add to inventory
      const { data: existing } = await supabase
        .from('user_gift_badge_inventory')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('gift_badge_id', badge.id)
        .single();

      if (existing) {
        // Increment quantity
        const { error: updateError } = await supabase
          .from('user_gift_badge_inventory')
          .update({ quantity: existing.quantity + 1 })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('user_gift_badge_inventory')
          .insert({
            user_id: user.id,
            gift_badge_id: badge.id,
            quantity: 1,
          });

        if (insertError) throw insertError;
      }

      toast.success("Purchase Successful!", {
        description: `You purchased ${badge.icon} ${badge.name}`,
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error("Purchase Failed", {
        description: error.message || "An error occurred during purchase",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            Purchase Lightstick
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {badges.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No lightsticks available
            </p>
          ) : (
            badges.map((badge) => (
              <div
                key={badge.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl" style={{ color: badge.color }}>
                    {badge.icon}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{badge.name}</p>
                    {badge.description && (
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => handlePurchase(badge)}
                  disabled={loading || !profile || profile.available_points < badge.point_price}
                  className="rounded-full gap-1"
                  size="sm"
                >
                  <Star className="w-4 h-4 fill-current" />
                  {badge.point_price}
                </Button>
              </div>
            ))
          )}

          {profile && (
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your Stars:</span>
                <span className="font-bold text-foreground flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  {profile.available_points}
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LightstickPurchaseDialog;
