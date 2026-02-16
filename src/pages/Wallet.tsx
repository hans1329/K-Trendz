import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Copy, ExternalLink, Loader2, Send, RefreshCw, ArrowRightLeft, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ConnectExternalWallet from "@/components/ConnectExternalWallet";
import TransferToExternalWallet from "@/components/TransferToExternalWallet";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

const WalletPage = () => {
  const { user, profile } = useAuth();
  const { wallet, isLoading, hasWallet, createWallet } = useWallet();
  const [ktnzBalance, setKtnzBalance] = useState<number | null>(null);
  const [ethBalance, setEthBalance] = useState<number | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [isWalletDeployed, setIsWalletDeployed] = useState<boolean>(true); // 배포 여부
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [ethToAddress, setEthToAddress] = useState("");
  const [ethSendAmount, setEthSendAmount] = useState("");
  const [isSendingEth, setIsSendingEth] = useState(false);
  const [usdcToAddress, setUsdcToAddress] = useState("");
  const [usdcSendAmount, setUsdcSendAmount] = useState("");
  const [isSendingUsdc, setIsSendingUsdc] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [exchangePoints, setExchangePoints] = useState("");
  const [isExchanging, setIsExchanging] = useState(false);
  const [walletType, setWalletType] = useState<string | null>(null);
  const [externalWallet, setExternalWallet] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    if (user && hasWallet) {
      fetchKtnzBalance();
      fetchWalletType();
    }
  }, [user, hasWallet]);

  const fetchWalletType = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("wallet_addresses")
      .select("wallet_type, wallet_address")
      .eq("user_id", user.id);
    
    const smartWallet = data?.find(w => w.wallet_type === 'smart_wallet');
    const external = data?.find(w => w.wallet_type === 'external');
    
    setWalletType(smartWallet?.wallet_type || "eoa");
    setExternalWallet(external?.wallet_address || null);
  };

  const fetchKtnzBalance = async () => {
    setIsLoadingBalance(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-ktnz-balance");
      
      if (error) throw error;
      
      setKtnzBalance(data.balance);
      setEthBalance(data.ethBalance || 0);
      setUsdcBalance(data.usdcBalance || 0);
      setIsWalletDeployed(data.isWalletDeployed ?? true); // 배포 여부 업데이트
    } catch (error) {
      console.error("Error fetching KTNZ balance:", error);
      toast.error("Failed to load KTNZ balance");
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleSendKtnz = async () => {
    if (!toAddress || !sendAmount) {
      toast.error("Please enter recipient address and amount");
      return;
    }

    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (ktnzBalance !== null && amount > ktnzBalance) {
      toast.error("Insufficient KTNZ balance");
      return;
    }

    if (ethBalance === 0) {
      toast.error("You need ETH in your wallet to pay for gas fees. Please add ETH to your wallet first.");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-ktnz", {
        body: { toAddress, amount },
      });

      if (error) throw error;

      toast.success("Transaction sent successfully!");
      setToAddress("");
      setSendAmount("");
      fetchKtnzBalance();
    } catch (error) {
      console.error("Error sending KTNZ:", error);
      toast.error("Failed to send KTNZ");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendEth = async () => {
    if (!ethToAddress || !ethSendAmount) {
      toast.error("Please enter recipient address and amount");
      return;
    }

    const amount = parseFloat(ethSendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (ethBalance !== null && amount > ethBalance) {
      toast.error("Insufficient ETH balance");
      return;
    }

    setIsSendingEth(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-eth", {
        body: { toAddress: ethToAddress, amount },
      });

      if (error) throw error;

      toast.success("ETH sent successfully!");
      setEthToAddress("");
      setEthSendAmount("");
      fetchKtnzBalance();
    } catch (error: any) {
      console.error("Error sending ETH:", error);
      
      let errorMsg = "Failed to send ETH";
      if (error?.context?.body) {
        try {
          const errorBody = JSON.parse(error.context.body);
          errorMsg = errorBody.error || errorMsg;
        } catch (e) {
          // JSON 파싱 실패 시 기본 메시지 사용
        }
      } else if (error?.message) {
        errorMsg = error.message;
      }
      
      toast.error(errorMsg);
    } finally {
      setIsSendingEth(false);
    }
  };

  const handleSendUsdc = async () => {
    if (!usdcToAddress || !usdcSendAmount) {
      toast.error("Please enter recipient address and amount");
      return;
    }

    const amount = parseFloat(usdcSendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (usdcBalance !== null && amount > usdcBalance) {
      toast.error("Insufficient USDC balance");
      return;
    }

    setIsSendingUsdc(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-usdc", {
        body: { toAddress: usdcToAddress, amount },
      });

      if (error) throw error;

      toast.success("USDC sent successfully!");
      setUsdcToAddress("");
      setUsdcSendAmount("");
      fetchKtnzBalance();
    } catch (error: any) {
      console.error("Error sending USDC:", error);
      
      let errorMsg = "Failed to send USDC";
      if (error?.context?.body) {
        try {
          const errorBody = JSON.parse(error.context.body);
          errorMsg = errorBody.error || errorMsg;
        } catch (e) {
          // JSON 파싱 실패 시 기본 메시지 사용
        }
      } else if (error?.message) {
        errorMsg = error.message;
      }
      
      toast.error(errorMsg);
    } finally {
      setIsSendingUsdc(false);
    }
  };

  const copyAddress = () => {
    if (wallet?.wallet_address) {
      navigator.clipboard.writeText(wallet.wallet_address);
      toast.success("Wallet address copied!");
    }
  };

  const openExplorer = () => {
    if (wallet?.wallet_address) {
      window.open(`https://basescan.org/address/${wallet.wallet_address}`, '_blank');
    }
  };

  const handleRegenerateWallet = async () => {
    if (!confirm("Are you sure you want to regenerate your wallet? This will delete your current wallet address and create a new one. This action cannot be undone.")) {
      return;
    }

    setIsRegenerating(true);
    try {
      const result = await createWallet({ forceRegenerate: true });
      console.log("Wallet regenerated:", result);
      toast.success("New wallet created successfully!");
      // 새 지갑 생성 후 walletType과 잔액 갱신
      await fetchWalletType();
      await fetchKtnzBalance();
    } catch (error) {
      console.error("Error regenerating wallet:", error);
      toast.error("Failed to regenerate wallet");
    } finally {
      setIsRegenerating(false);
    }
  };

  // EOA 지갑인지 확인 (Smart Wallet으로 업그레이드 필요)
  const isEoaWallet = walletType === "eoa";

  const handleUpgradeToSmartWallet = async () => {
    if (!confirm("Upgrade to Smart Wallet? This will create a new gasless wallet. Your current wallet balance will remain, but you'll need to transfer funds to the new wallet.")) {
      return;
    }

    setIsUpgrading(true);
    try {
      const result = await createWallet({ forceRegenerate: true });
      console.log("Wallet upgraded:", result);
      toast.success("Smart Wallet created successfully!");
      await fetchWalletType();
      await fetchKtnzBalance();
    } catch (error) {
      console.error("Error upgrading wallet:", error);
      toast.error("Failed to upgrade wallet");
    } finally {
      setIsUpgrading(false);
    }
  };

  // 옛날 주소 형식(user_id 기반)인지 확인
  // 새 유저는 ethers.js로 생성된 랜덤 주소를 가지므로 재생성 불필요
  const isOldWalletFormat = () => {
    if (!wallet?.wallet_address || !user?.id) return false;
    
    // user_id에서 하이픈 제거한 형태가 wallet_address와 같으면 옛날 형식
    const userIdWithoutHyphens = user.id.replace(/-/g, '');
    const walletAddressWithout0x = wallet.wallet_address.replace('0x', '').toLowerCase();
    
    return userIdWithoutHyphens === walletAddressWithout0x;
  };

  const shouldShowRegenerateButton = isOldWalletFormat();

  const handleExchangePoints = async () => {
    if (!exchangePoints) {
      toast.error("Please enter token amount");
      return;
    }

    const tokens = parseFloat(exchangePoints);
    if (isNaN(tokens) || tokens <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (ktnzBalance !== null && tokens > ktnzBalance) {
      toast.error("Insufficient KTNZ balance");
      return;
    }

    // ETH 잔액 확인 (가스비 필요)
    if (ethBalance === null || ethBalance < 0.00005) {
      toast.error(
        <div className="space-y-2">
          <p className="font-semibold">Insufficient ETH for gas fees</p>
          <p className="text-sm">You need at least 0.00005 ETH in your wallet to burn KTNZ tokens.</p>
          <p className="text-sm">Current ETH balance: {ethBalance?.toFixed(6) || '0'} ETH</p>
          <p className="text-sm">Please add ETH to your wallet on Base network.</p>
        </div>,
        { duration: 8000 }
      );
      return;
    }

    setIsExchanging(true);
    try {
      const { data, error } = await supabase.functions.invoke("exchange-ktnz-to-points", {
        body: { tokensToExchange: tokens },
      });

      if (error) throw error;

      toast.success(
        <div className="space-y-1">
          <p className="font-semibold">KTNZ Exchanged Successfully!</p>
          <p className="text-sm">{data.message}</p>
        </div>,
        { duration: 5000 }
      );
      setExchangePoints("");
      await fetchKtnzBalance();
    } catch (error: any) {
      console.error("Error exchanging tokens:", error);
      
      // FunctionsHttpError에서 실제 에러 메시지 추출
      let errorMsg = "Failed to exchange tokens";
      
      if (error?.context?.body) {
        try {
          const errorBody = JSON.parse(error.context.body);
          errorMsg = errorBody.error || errorMsg;
        } catch (e) {
          // JSON 파싱 실패 시 기본 메시지 사용
        }
      } else if (error?.message) {
        errorMsg = error.message;
      }
      
      if (errorMsg.includes("insufficient funds") || errorMsg.includes("Insufficient ETH")) {
        toast.error(
          <div className="space-y-2">
            <p className="font-semibold">Insufficient ETH for gas fees</p>
            <p className="text-sm">You need more ETH in your wallet to complete this transaction.</p>
            <p className="text-sm">Please add ETH to your wallet: {wallet?.wallet_address}</p>
          </div>,
          { duration: 8000 }
        );
      } else {
        toast.error(errorMsg, { duration: 5000 });
      }
    } finally {
      setIsExchanging(false);
    }
  };


  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
          <title>K-Trendz Wallet - KTRENDZ</title>
          <meta name="description" content="Manage your K-Trendz Wallet on KTRENDZ" />
        </Helmet>
        <Navbar />
        <div className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Login Required</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Please login to access your K-Trendz Wallet</CardDescription>
            </CardHeader>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>K-Trendz Wallet - KTRENDZ</title>
        <meta name="description" content="Manage your K-Trendz Wallet on KTRENDZ" />
      </Helmet>
      <Navbar />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-bold">K-Trendz Wallet</h1>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </Card>
          ) : hasWallet ? (
            <>
              {/* Your Wallet - at top */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg sm:text-xl">Your Wallet</CardTitle>
                    <Badge variant="secondary" className="bg-[#0052FF]/10 text-[#0052FF] border-[#0052FF]/20">
                      Base
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-muted-foreground">Smart Wallet Address</label>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="flex-1 p-2 sm:p-3 bg-muted rounded-lg text-xs sm:text-sm break-all">
                        {wallet?.wallet_address}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={copyAddress}
                        className="shrink-0 h-9 w-9 sm:h-10 sm:w-10"
                      >
                        <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={openExplorer}
                        className="shrink-0 h-9 w-9 sm:h-10 sm:w-10"
                      >
                        <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      ⚠️ Do not send USDC directly to this address. USDC deposits are not supported and funds may be lost.
                    </p>
                  </div>

                  {/* EOA 유저 또는 구형 지갑에만 새 지갑 생성 버튼 표시 */}
                  {(isEoaWallet || shouldShowRegenerateButton) && (
                    <div className="pt-4 border-t">
                      <div className="mb-3 p-3 bg-muted rounded-lg">
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Create a new Smart Wallet to enable gasless transactions and better token management.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleRegenerateWallet}
                        disabled={isRegenerating}
                        className="w-full text-sm"
                      >
                        {isRegenerating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Create New Wallet
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* External Wallet Section */}
              <ConnectExternalWallet onConnected={(addr) => setExternalWallet(addr)} />

              {/* Transfer Lightsticks to External Wallet */}
              {externalWallet && (
                <TransferToExternalWallet 
                  externalWalletAddress={externalWallet}
                  onTransferComplete={fetchKtnzBalance}
                />
              )}

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg sm:text-xl">
                    Exchange KTNZ to Points
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Burn your KTNZ tokens to receive points (1 KTNZ = 10 points)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2">Available KTNZ</p>
                    <div className="text-xl sm:text-2xl font-bold">
                      {ktnzBalance !== null ? ktnzBalance.toLocaleString() : "0"} KTNZ
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exchangeTokens" className="text-sm">KTNZ to Exchange</Label>
                    <Input
                      id="exchangeTokens"
                      type="number"
                      placeholder="1"
                      step="0.001"
                      value={exchangePoints}
                      onChange={(e) => setExchangePoints(e.target.value)}
                      className="text-base"
                    />
                    {exchangePoints && (
                      <p className="text-xs text-muted-foreground">
                        You will receive: {(parseFloat(exchangePoints) * 10).toFixed(0)} points
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleExchangePoints}
                    disabled={isExchanging || !exchangePoints}
                    className="w-full"
                  >
                    {isExchanging ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exchanging...
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        Exchange to Points
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg sm:text-xl">Token Balances</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">Your wallet balances on Base network</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={fetchKtnzBalance}
                      disabled={isLoadingBalance}
                      className="shrink-0"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                  {isLoadingBalance ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground mb-2">KTNZ Token</p>
                        <div className="text-2xl sm:text-3xl font-bold text-primary break-all">
                          {ktnzBalance !== null ? ktnzBalance.toLocaleString() : "0"} KTNZ
                        </div>
                      </div>
                      <div className="pt-4 border-t">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-2">USDC</p>
                        <div className="text-lg sm:text-xl font-semibold text-green-600">
                          ${usdcBalance !== null ? usdcBalance.toFixed(2) : "0.00"} USDC
                        </div>
                      </div>
                      <div className="pt-4 border-t">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-2">ETH (for gas fees)</p>
                        <div className={`text-lg sm:text-xl font-semibold ${ethBalance === 0 ? 'text-destructive' : ''}`}>
                          {ethBalance !== null ? ethBalance.toFixed(6) : "0.000000"} ETH
                          {ethBalance === 0 && (
                            <p className="text-xs sm:text-sm mt-2 text-destructive font-normal">
                              ⚠️ You need ETH to send transactions. Please add ETH to your wallet.
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>


              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg sm:text-xl">
                    Send KTNZ
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Transfer KTNZ to another wallet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="toAddress" className="text-sm">Recipient Address</Label>
                    <Input
                      id="toAddress"
                      placeholder="0x..."
                      value={toAddress}
                      onChange={(e) => setToAddress(e.target.value)}
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm">Amount (KTNZ)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.0"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="text-base"
                    />
                    {ktnzBalance !== null && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Available: {ktnzBalance.toLocaleString()} KTNZ</p>
                        <p className={ethBalance === 0 ? 'text-destructive' : ''}>
                          ETH for gas: {ethBalance !== null ? ethBalance.toFixed(6) : "0.000000"} ETH
                        </p>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleSendKtnz}
                    disabled={isSending || !toAddress || !sendAmount}
                    className="w-full"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send KTNZ
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg sm:text-xl">
                    Send ETH
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Transfer ETH to another wallet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ethToAddress" className="text-sm">Recipient Address</Label>
                    <Input
                      id="ethToAddress"
                      placeholder="0x..."
                      value={ethToAddress}
                      onChange={(e) => setEthToAddress(e.target.value)}
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ethAmount" className="text-sm">Amount (ETH)</Label>
                    <Input
                      id="ethAmount"
                      type="number"
                      placeholder="0.0"
                      step="0.000001"
                      value={ethSendAmount}
                      onChange={(e) => setEthSendAmount(e.target.value)}
                      className="text-base"
                    />
                    {ethBalance !== null && (
                      <div className="text-xs text-muted-foreground">
                        <p>Available: {ethBalance.toFixed(6)} ETH</p>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleSendEth}
                    disabled={isSendingEth || !ethToAddress || !ethSendAmount}
                    className="w-full"
                  >
                    {isSendingEth ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send ETH
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg sm:text-xl">
                    Send USDC
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Transfer USDC to another wallet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="usdcToAddress" className="text-sm">Recipient Address</Label>
                    <Input
                      id="usdcToAddress"
                      placeholder="0x..."
                      value={usdcToAddress}
                      onChange={(e) => setUsdcToAddress(e.target.value)}
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="usdcAmount" className="text-sm">Amount (USDC)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="usdcAmount"
                        type="number"
                        placeholder="0.0"
                        step="0.01"
                        value={usdcSendAmount}
                        onChange={(e) => setUsdcSendAmount(e.target.value)}
                        className="text-base flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (usdcBalance !== null && usdcBalance > 0) {
                            // 소수점 둘째자리에서 내림 (잔액 부족 방지)
                            const maxAmount = Math.floor(usdcBalance * 100) / 100;
                            setUsdcSendAmount(maxAmount.toFixed(2));
                          }
                        }}
                        disabled={!usdcBalance || usdcBalance <= 0}
                        className="shrink-0"
                      >
                        Max
                      </Button>
                    </div>
                    {usdcBalance !== null && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Available: ${usdcBalance.toFixed(3)} USDC</p>
                        <p className="text-amber-600">⚠ $1 transfer fee will be deducted</p>
                        {usdcBalance <= 1 && (
                          <p className="text-destructive">✗ Need more than $1 USDC to transfer</p>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleSendUsdc}
                    disabled={isSendingUsdc || !usdcToAddress || !usdcSendAmount}
                    className="w-full"
                  >
                    {isSendingUsdc ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send USDC
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">No Wallet Found</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Your wallet is being created automatically</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default WalletPage;
