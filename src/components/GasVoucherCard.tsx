import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Check, Ticket, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface VoucherData {
  voucher_code: string;
  daily_limit_usd: number;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
}

export default function GasVoucherCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [voucher, setVoucher] = useState<VoucherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [copied, setCopied] = useState(false);

  // 소셜 로그인 여부 확인
  const provider = user?.app_metadata?.provider;
  const isFarcasterLinked = user?.user_metadata?.fid !== undefined;
  const isSocialUser = provider === 'google' || provider === 'discord' || isFarcasterLinked;

  useEffect(() => {
    if (user) {
      fetchVoucher();
    }
  }, [user]);

  const fetchVoucher = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gas_vouchers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setVoucher(data);
    } catch (error) {
      console.error('Error fetching voucher:', error);
    } finally {
      setLoading(false);
    }
  };

  const issueVoucher = async () => {
    setIssuing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('issue-gas-voucher', {
        headers: {
          authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.error) throw new Error(response.error.message);
      
      const result = response.data;
      if (!result.success) {
        throw new Error(result.error);
      }

      setVoucher(result.data);
      toast({
        title: result.data.already_exists ? "Voucher Retrieved" : "Voucher Issued!",
        description: `Your voucher code: ${result.data.voucher_code}`,
      });
    } catch (error: any) {
      console.error('Error issuing voucher:', error);
      toast({
        title: "Failed to Issue Voucher",
        description: error.message || "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIssuing(false);
    }
  };

  const copyToClipboard = async () => {
    if (!voucher) return;
    
    try {
      await navigator.clipboard.writeText(voucher.voucher_code);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Voucher code copied to clipboard"
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Failed to Copy",
        description: "Please copy manually",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">OpenClaw Gas Voucher</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Use this voucher in OpenClaw to get gas fees sponsored
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSocialUser && !voucher && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Sign in with Google or link your Farcaster account to get a gas voucher.
            </AlertDescription>
          </Alert>
        )}

        {voucher ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={voucher.voucher_code}
                readOnly
                className="font-mono text-sm bg-muted"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Daily Limit: ${voucher.daily_limit_usd}</span>
              <span className={voucher.is_active ? "text-green-600" : "text-red-600"}>
                {voucher.is_active ? "● Active" : "○ Inactive"}
              </span>
            </div>

            <Alert className="bg-muted/50">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Add this to your OpenClaw agent settings:
                <code className="block mt-1 p-2 bg-background rounded text-[10px]">
                  KTRENDZ_VOUCHER={voucher.voucher_code}
                </code>
              </AlertDescription>
            </Alert>
          </div>
        ) : isSocialUser ? (
          <Button
            onClick={issueVoucher}
            disabled={issuing}
            className="w-full rounded-full"
          >
            {issuing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Issuing...
              </>
            ) : (
              <>
                <Ticket className="h-4 w-4 mr-2" />
                Issue Gas Voucher
              </>
            )}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
