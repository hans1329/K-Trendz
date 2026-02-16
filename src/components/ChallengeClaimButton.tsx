import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Gift, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChallengeClaimButtonProps {
  challengeId: string;
  userId: string;
  prizeAmount: number;
  hasLightstick: boolean;
  isClaimed: boolean;
  onClaimed?: () => void;
}

export const ChallengeClaimButton = ({
  challengeId,
  userId,
  prizeAmount,
  hasLightstick,
  isClaimed,
  onClaimed,
}: ChallengeClaimButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleClaim = async () => {
    setIsLoading(true);
    try {
      // DB 기반 claim 사용 (claim-prize-db)
      const { data, error } = await supabase.functions.invoke('claim-prize-db', {
        body: { challengeId, userId },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Prize added to your balance! $${prizeAmount} USDC`);
        onClaimed?.();
      } else {
        throw new Error(data?.error || 'Failed to claim');
      }
    } catch (err) {
      console.error('Claim error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to claim prize');
    } finally {
      setIsLoading(false);
    }
  };

  if (isClaimed) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <CheckCircle className="h-4 w-4 text-green-500" />
        Claimed ${prizeAmount}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleClaim}
      disabled={isLoading}
      size="sm"
      className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Claiming...
        </>
      ) : (
        <>
          <Gift className="h-4 w-4" />
          Claim ${prizeAmount} USDC
          {hasLightstick && <span className="text-xs opacity-75">(+Lightstick Bonus)</span>}
        </>
      )}
    </Button>
  );
};
