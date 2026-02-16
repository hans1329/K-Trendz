import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Loader2, Wallet, ExternalLink } from "lucide-react";
import { ethers } from "ethers";

// 백엔드 스마트 어카운트 주소
const SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;

// ERC20 balanceOf ABI
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

// Base RPC 엔드포인트
const BASE_RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
];

export const AdminWalletBalance = () => {
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [ethBalance, setEthBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    try {
      for (const rpcUrl of BASE_RPC_URLS) {
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);

          // ETH와 USDC 잔액을 동시에 조회
          const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
          const [ethBal, usdcBal] = await Promise.all([
            provider.getBalance(SMART_ACCOUNT),
            usdcContract.balanceOf(SMART_ACCOUNT),
          ]);

          setEthBalance(Number(ethers.formatEther(ethBal)));
          setUsdcBalance(Number(usdcBal) / Math.pow(10, USDC_DECIMALS));
          setLastUpdated(new Date());
          break;
        } catch (err) {
          console.warn(`RPC ${rpcUrl} failed:`, err);
          continue;
        }
      }
    } catch (error) {
      console.error("Failed to fetch wallet balances:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Backend Smart Account</CardTitle>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchBalances}
          disabled={loading}
          className="rounded-full"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-1 mb-3">
          <a
            href={`https://basescan.org/address/${SMART_ACCOUNT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-muted-foreground hover:text-primary hover:underline flex items-center gap-1"
          >
            {SMART_ACCOUNT.slice(0, 10)}...{SMART_ACCOUNT.slice(-8)}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {usdcBalance === null && !loading ? (
          <p className="text-sm text-muted-foreground">Press refresh to load balances</p>
        ) : loading && usdcBalance === null ? (
          <div className="flex gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">USDC Balance</p>
              <p className="text-2xl font-bold text-green-600">
                ${usdcBalance?.toFixed(2) ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">ETH (Gas)</p>
              <p className="text-2xl font-bold">
                {ethBalance?.toFixed(6) ?? "—"} <span className="text-sm font-normal text-muted-foreground">ETH</span>
              </p>
            </div>
            {lastUpdated && (
              <div className="flex items-end">
                <p className="text-xs text-muted-foreground">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
