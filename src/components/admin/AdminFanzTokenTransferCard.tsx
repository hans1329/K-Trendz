import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminFanzTokenTransferCardProps = {
  defaultToAddress?: string;
};

// Backend Operator SimpleAccount 주소(온체인 가스리스 트랜잭션 실행 주체)
const DEFAULT_FROM_ADDRESS = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";

export default function AdminFanzTokenTransferCard({ defaultToAddress }: AdminFanzTokenTransferCardProps) {
  const { toast } = useToast();

  const [fromAddress, setFromAddress] = useState(DEFAULT_FROM_ADDRESS);
  const [toAddress, setToAddress] = useState(defaultToAddress ?? "");
  const [tokenId, setTokenId] = useState("7963681970480434413");
  const [amount, setAmount] = useState("2");

  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // 지갑 주소가 늦게 로드되는 경우를 대비해, 아직 입력값이 없을 때만 자동 채움
  useEffect(() => {
    if (defaultToAddress && !toAddress) {
      setToAddress(defaultToAddress);
    }
  }, [defaultToAddress, toAddress]);

  const amountNumber = useMemo(() => Number(amount), [amount]);

  const canSubmit =
    fromAddress.trim().length > 0 &&
    tokenId.trim().length > 0 &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0;

  const canTransfer = canSubmit && toAddress.trim().length > 0;

  const handleTransfer = async () => {
    if (!canTransfer || submitting) return;

    const ok = window.confirm("Transfer tokens now? This action is irreversible.");
    if (!ok) return;

    setSubmitting(true);
    setTxHash(null);

    try {
      const { data, error } = await supabase.functions.invoke("admin-transfer-fanz-token", {
        body: {
          fromAddress: fromAddress.trim(),
          toAddress: toAddress.trim(),
          tokenId: tokenId.trim(),
          amount: amountNumber,
        },
      });

      const returnedTxHash = (data?.txHash as string | undefined) ?? null;
      setTxHash(returnedTxHash);

      if (error) throw error;

      if (data?.success !== true) {
        const message = typeof data?.error === "string" ? data.error : "UserOperation failed";
        throw new Error(returnedTxHash ? `${message}. Tx: ${returnedTxHash}` : message);
      }

      toast({
        title: "Transfer completed",
        description: returnedTxHash ? `Tx: ${returnedTxHash}` : "Transaction confirmed.",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({
        title: "Transfer failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSell = async () => {
    if (!canSubmit || submitting) return;

    const ok = window.confirm(`Sell ${amountNumber} token(s) from ${fromAddress}? USDC will be sent to that address.`);
    if (!ok) return;

    setSubmitting(true);
    setTxHash(null);

    try {
      const { data, error } = await supabase.functions.invoke("admin-sell-fanz-token", {
        body: {
          fromAddress: fromAddress.trim(),
          tokenId: tokenId.trim(),
          amount: amountNumber,
        },
      });

      const returnedTxHash = (data?.txHash as string | undefined) ?? null;
      setTxHash(returnedTxHash);

      if (error) throw error;

      if (data?.success !== true) {
        const message = typeof data?.error === "string" ? data.error : "UserOperation failed";
        throw new Error(returnedTxHash ? `${message}. Tx: ${returnedTxHash}` : message);
      }

      toast({
        title: "Sell completed",
        description: `Net refund: $${data.netRefund}. Tx: ${returnedTxHash ?? "confirmed"}`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({
        title: "Sell failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col gap-1 mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-foreground">Admin: Token Transfer / Sell</h2>
        <p className="text-sm text-muted-foreground">
          Transfer or sell ERC-1155 Fanz tokens using the Backend Operator smart account.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="admin-transfer-from">From Address</Label>
          <Input
            id="admin-transfer-from"
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            placeholder={DEFAULT_FROM_ADDRESS}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="admin-transfer-to">To Address (for Transfer)</Label>
          <Input
            id="admin-transfer-to"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder="0x..."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="admin-transfer-tokenid">Token ID</Label>
          <Input
            id="admin-transfer-tokenid"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="7963681970480434413"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="admin-transfer-amount">Amount</Label>
          <Input
            id="admin-transfer-amount"
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button onClick={handleTransfer} disabled={!canTransfer || submitting} className="w-full sm:w-auto">
            {submitting ? "Processing..." : "Transfer"}
          </Button>
          <Button onClick={handleSell} disabled={!canSubmit || submitting} variant="secondary" className="w-full sm:w-auto">
            {submitting ? "Processing..." : "Sell"}
          </Button>
        </div>

        {txHash && (
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            View on Basescan
          </a>
        )}
      </div>
    </Card>
  );
}
