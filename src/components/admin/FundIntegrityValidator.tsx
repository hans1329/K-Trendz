import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink,
  Database,
  Wallet,
  TrendingUp,
  Clock
} from "lucide-react";
import { format } from "date-fns";

interface ValidationResult {
  status: 'matched' | 'discrepancy' | 'error';
  timestamp: string;
  summary: {
    dbTotalUsd: number;
    onchainBalanceUsd: number;
    discrepancyUsd: number;
    discrepancyPercent: number;
    artistFundWallet: string;
    providerUsed: string;
  };
  entryBreakdown: Array<{
    entryId: string;
    title: string;
    slug: string;
    fundUsd: number;
  }>;
  recentTransactions: Array<{
    id: string;
    amount: number;
    type: string;
    description: string;
    createdAt: string;
    entryTitle: string;
  }>;
}

export const FundIntegrityValidator = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleValidate = async () => {
    setIsValidating(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('validate-fund-integrity', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setResult(response.data);
      
      toast({
        title: response.data.status === 'matched' ? "Validation Passed" : "Discrepancy Detected",
        description: response.data.status === 'matched' 
          ? "DB and on-chain balances match" 
          : `Discrepancy of $${response.data.summary.discrepancyUsd.toFixed(2)} detected`,
        variant: response.data.status === 'matched' ? 'default' : 'destructive',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      setError(message);
      toast({
        title: "Validation Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const basescanUrl = result?.summary?.artistFundWallet 
    ? `https://basescan.org/address/${result.summary.artistFundWallet}` 
    : '';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Fund Integrity Validator
            </CardTitle>
            <CardDescription>
              Compare DB community fund totals with on-chain Artist Fund Wallet balance
            </CardDescription>
          </div>
          <Button 
            onClick={handleValidate} 
            disabled={isValidating}
            className="rounded-full"
          >
            {isValidating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Validate Now
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {result && (
          <>
            {/* Status Banner */}
            <div className={`p-4 rounded-lg border-2 ${
              result.status === 'matched' 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-destructive/10 border-destructive/30'
            }`}>
              <div className="flex items-center gap-3">
                {result.status === 'matched' ? (
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                )}
                <div>
                  <h3 className="font-bold text-lg">
                    {result.status === 'matched' ? 'Funds Verified' : 'Discrepancy Detected'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Last checked: {format(new Date(result.timestamp), 'PPpp')}
                  </p>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Database className="w-4 h-4" />
                    <span className="text-xs">DB Total Fund</span>
                  </div>
                  <p className="text-2xl font-bold">${result.summary.dbTotalUsd.toFixed(2)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Wallet className="w-4 h-4" />
                    <span className="text-xs">On-chain Balance</span>
                  </div>
                  <p className="text-2xl font-bold">${result.summary.onchainBalanceUsd.toFixed(2)}</p>
                  <a 
                    href={basescanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                  >
                    View on Basescan <ExternalLink className="w-3 h-3" />
                  </a>
                </CardContent>
              </Card>

              <Card className={result.status === 'discrepancy' ? 'border-destructive' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs">Discrepancy</span>
                  </div>
                  <p className={`text-2xl font-bold ${
                    result.status === 'discrepancy' ? 'text-destructive' : 'text-green-500'
                  }`}>
                    ${result.summary.discrepancyUsd.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {result.summary.discrepancyPercent.toFixed(2)}% difference
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Entry Breakdown */}
            {result.entryBreakdown.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Fund Breakdown by Entry (Top 20)
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entry</TableHead>
                        <TableHead className="text-right">Fund Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.entryBreakdown.map((entry) => (
                        <TableRow key={entry.entryId}>
                          <TableCell>
                            <a 
                              href={`/k/${entry.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {entry.title}
                            </a>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${entry.fundUsd.toFixed(4)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            {result.recentTransactions.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Fund Transactions
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entry</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.recentTransactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>{tx.entryTitle}</TableCell>
                          <TableCell>
                            <Badge variant={tx.type === 'purchase' ? 'default' : 'secondary'}>
                              {tx.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            +${tx.amount.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(tx.createdAt), 'PP')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Wallet Info */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Artist Fund Wallet:</strong> {result.summary.artistFundWallet}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>RPC Provider:</strong> {result.summary.providerUsed}
              </p>
            </div>
          </>
        )}

        {!result && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Click "Validate Now" to compare DB and on-chain fund balances</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
