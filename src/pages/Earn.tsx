import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import { useIsMobile } from '@/hooks/use-mobile';
import V2Layout from '@/components/home/V2Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Coins, Zap, Copy, Check, DollarSign, Loader2, RefreshCw, ExternalLink, ArrowRightLeft, Wand2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ConnectExternalWallet from '@/components/ConnectExternalWallet';
import TransferToExternalWallet from '@/components/TransferToExternalWallet';
import ExternalPrizeClaim from '@/components/ExternalPrizeClaim';
interface PointTransaction {
  id: string;
  action_type: string;
  points: number;
  created_at: string;
}
// 퀴즈쇼 상금 Earning 인터페이스
interface ChallengeEarning {
  id: string;
  prize_amount: number;
  claimed_at: string;
  challenge: {
    id: string;
    question: string;
    image_url: string | null;
  };
}
const Earn = () => {
  const {
    user,
    profile,
    loading: authLoading
  } = useAuth();
  const {
    wallet,
    isLoading: isWalletLoading,
    hasWallet,
    createWallet
  } = useWallet();
  const isMobile = useIsMobile();
  // KTNZ 출금용 상태 (백엔드 직접 transfer 방식)
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [challengeEarnings, setChallengeEarnings] = useState<ChallengeEarning[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalNotes, setWithdrawalNotes] = useState("");
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [showCountryDialog, setShowCountryDialog] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("KR");

  // K-Wallet states
  const [ktnzBalance, setKtnzBalance] = useState<number | null>(null);
  const [ethBalance, setEthBalance] = useState<number | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [ethToAddress, setEthToAddress] = useState("");
  const [ethSendAmount, setEthSendAmount] = useState("");
  const [isSendingEth, setIsSendingEth] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [exchangePoints, setExchangePoints] = useState("");
  const [isExchanging, setIsExchanging] = useState(false);
  
  // USDC Withdrawal states
  const [usdcWithdrawAddress, setUsdcWithdrawAddress] = useState("");
  const [usdcWithdrawAmount, setUsdcWithdrawAmount] = useState("");
  const [isWithdrawingUsdc, setIsWithdrawingUsdc] = useState(false);
  const [usdcWithdrawalRequests, setUsdcWithdrawalRequests] = useState<any[]>([]);
  const [monthlyWithdrawals, setMonthlyWithdrawals] = useState(0);
  const [externalWalletAddress, setExternalWalletAddress] = useState<string | null>(null);
  
  // Fanz Token states
  const [fanzBalances, setFanzBalances] = useState<any[]>([]);
  const [loadingFanzBalances, setLoadingFanzBalances] = useState(false);
  const FANZTOKEN_CONTRACT_ADDRESS = "0x2003eF9610A34Dc5771CbB9ac1Db2B2c056C66C7"; // V5 컨트랙트
  const KTNZ_CONTRACT_ADDRESS = "0x19B08De23C809eb89178DD8eb8DA94e2c8F3bF33"; // KTNZ 컨트랙트
  
  // KTNZ Withdrawal states (simplified - backend direct transfer)
  const [ktnzWithdrawAddress, setKtnzWithdrawAddress] = useState("");
  const [ktnzWithdrawAmount, setKtnzWithdrawAmount] = useState("");
  const [isWithdrawingKtnz, setIsWithdrawingKtnz] = useState(false);
  const [showKtnzWithdrawDialog, setShowKtnzWithdrawDialog] = useState(false);
  
  // USDC 출금 정책 상수 ($0.50 고정 수수료, 1회 최대 $100)
  const WITHDRAWAL_FEE_USD = 0.50;
  const MAX_WITHDRAWAL_AMOUNT = 100;
  // USDC 잔액을 DB에서 직접 조회 (빠름)
  const fetchUsdcBalance = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('usdc_balances')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!error && data) {
        setUsdcBalance(data.balance);
      } else {
        setUsdcBalance(0);
      }
    } catch (error) {
      console.error("Error fetching USDC balance:", error);
      setUsdcBalance(0);
    }
  };

  // 외부 지갑 주소 조회
  const fetchExternalWallet = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('wallet_addresses')
        .select('wallet_address')
        .eq('user_id', user.id)
        .eq('wallet_type', 'external')
        .maybeSingle();
      
      if (!error && data) {
        setExternalWalletAddress(data.wallet_address);
      }
    } catch (error) {
      console.error("Error fetching external wallet:", error);
    }
  };

  // KTNZ/ETH 잔액은 Edge Function으로 조회 (온체인)
  const fetchKtnzBalance = async () => {
    setIsLoadingBalance(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-ktnz-balance");
      if (error) throw error;
      setKtnzBalance(data.balance);
      setEthBalance(data.ethBalance || 0);
      // USDC는 DB에서 이미 로드했으므로 Edge Function 결과는 무시
    } catch (error) {
      console.error("Error fetching KTNZ balance:", error);
      toast({
        title: "Error",
        description: "Failed to load KTNZ balance",
        variant: "destructive"
      });
    } finally {
      setIsLoadingBalance(false);
    }
  };
  const handleSendKtnz = async () => {
    if (!toAddress || !sendAmount) {
      toast({
        title: "Error",
        description: "Please enter recipient address and amount",
        variant: "destructive"
      });
      return;
    }
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }
    if (ktnzBalance !== null && amount > ktnzBalance) {
      toast({
        title: "Error",
        description: "Insufficient KTNZ balance",
        variant: "destructive"
      });
      return;
    }
    if (ethBalance === 0) {
      toast({
        title: "Error",
        description: "You need ETH in your wallet to pay for gas fees. Please add ETH to your wallet first.",
        variant: "destructive"
      });
      return;
    }
    setIsSending(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("send-ktnz", {
        body: {
          toAddress,
          amount
        }
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: "Transaction sent successfully!"
      });
      setToAddress("");
      setSendAmount("");
      fetchKtnzBalance();
    } catch (error) {
      console.error("Error sending KTNZ:", error);
      toast({
        title: "Error",
        description: "Failed to send KTNZ",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  // KTNZ 출금 (백엔드 직접 transfer 방식)
  const handleWithdrawKtnz = async () => {
    if (!ktnzWithdrawAddress) {
      toast({
        title: "Error",
        description: "Please enter recipient address",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(ktnzWithdrawAmount);
    if (isNaN(amount) || amount < 100) {
      toast({
        title: "Error",
        description: "Minimum withdrawal is 100 KTNZ",
        variant: "destructive"
      });
      return;
    }

    if (ktnzBalance !== null && amount > ktnzBalance) {
      toast({
        title: "Error",
        description: "Insufficient KTNZ balance",
        variant: "destructive"
      });
      return;
    }

    setIsWithdrawingKtnz(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-ktnz", {
        body: {
          toAddress: ktnzWithdrawAddress,
          amount: amount
        }
      });

      if (error) throw error;

      toast({
        title: "Withdrawal Successful!",
        description: `${amount} KTNZ sent to ${ktnzWithdrawAddress.slice(0, 6)}...${ktnzWithdrawAddress.slice(-4)}`
      });
      
      setKtnzWithdrawAddress("");
      setKtnzWithdrawAmount("");
      setShowKtnzWithdrawDialog(false);
      fetchKtnzBalance();
    } catch (error: any) {
      console.error("Error withdrawing KTNZ:", error);
      let errorMsg = "Failed to withdraw KTNZ";
      if (error?.context?.body) {
        try {
          const errorBody = JSON.parse(error.context.body);
          errorMsg = errorBody.error || errorMsg;
        } catch (e) {}
      } else if (error?.message) {
        errorMsg = error.message;
      }
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsWithdrawingKtnz(false);
    }
  };

  const handleSendEth = async () => {
    if (!ethToAddress || !ethSendAmount) {
      toast({
        title: "Error",
        description: "Please enter recipient address and amount",
        variant: "destructive"
      });
      return;
    }
    const amount = parseFloat(ethSendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }
    if (ethBalance !== null && amount > ethBalance) {
      toast({
        title: "Error",
        description: "Insufficient ETH balance",
        variant: "destructive"
      });
      return;
    }
    setIsSendingEth(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("send-eth", {
        body: {
          toAddress: ethToAddress,
          amount
        }
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: "ETH sent successfully!"
      });
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
        } catch (e) {}
      } else if (error?.message) {
        errorMsg = error.message;
      }
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsSendingEth(false);
    }
  };
  const copyAddress = () => {
    if (wallet?.wallet_address) {
      navigator.clipboard.writeText(wallet.wallet_address);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Wallet address copied to clipboard"
      });
      setTimeout(() => setCopied(false), 2000);
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
      const result = await createWallet({
        forceRegenerate: true
      });
      console.log("Wallet regenerated:", result);
      toast({
        title: "Success",
        description: "New wallet created successfully!"
      });
      await fetchKtnzBalance();
    } catch (error) {
      console.error("Error regenerating wallet:", error);
      toast({
        title: "Error",
        description: "Failed to regenerate wallet",
        variant: "destructive"
      });
    } finally {
      setIsRegenerating(false);
    }
  };
  const isOldWalletFormat = () => {
    if (!wallet?.wallet_address || !user?.id) return false;
    const userIdWithoutHyphens = user.id.replace(/-/g, '');
    const walletAddressWithout0x = wallet.wallet_address.replace('0x', '').toLowerCase();
    return userIdWithoutHyphens === walletAddressWithout0x;
  };
  const shouldShowRegenerateButton = isOldWalletFormat();
  const handleExchangePoints = async () => {
    if (!exchangePoints) {
      toast({
        title: "Error",
        description: "Please enter token amount",
        variant: "destructive"
      });
      return;
    }
    const tokens = parseFloat(exchangePoints);
    if (isNaN(tokens) || tokens <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }
    if (ktnzBalance !== null && tokens > ktnzBalance) {
      toast({
        title: "Error",
        description: "Insufficient KTNZ balance",
        variant: "destructive"
      });
      return;
    }
    if (ethBalance === null || ethBalance < 0.00005) {
      toast({
        title: "Insufficient ETH for gas fees",
        description: `You need at least 0.00005 ETH in your wallet to burn KTNZ tokens. Current ETH balance: ${ethBalance?.toFixed(6) || '0'} ETH. Please add ETH to your wallet on Base network.`,
        variant: "destructive"
      });
      return;
    }
    setIsExchanging(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("exchange-ktnz-to-points", {
        body: {
          tokensToExchange: tokens
        }
      });
      if (error) throw error;
      toast({
        title: "KTNZ Exchanged Successfully!",
        description: data.message
      });
      setExchangePoints("");
      await fetchKtnzBalance();
    } catch (error: any) {
      console.error("Error exchanging tokens:", error);
      let errorMsg = "Failed to exchange tokens";
      if (error?.context?.body) {
        try {
          const errorBody = JSON.parse(error.context.body);
          errorMsg = errorBody.error || errorMsg;
        } catch (e) {}
      } else if (error?.message) {
        errorMsg = error.message;
      }
      if (errorMsg.includes("insufficient funds") || errorMsg.includes("Insufficient ETH")) {
        toast({
          title: "Insufficient ETH for gas fees",
          description: `You need more ETH in your wallet to complete this transaction. Please add ETH to your wallet: ${wallet?.wallet_address}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive"
        });
      }
    } finally {
      setIsExchanging(false);
    }
  };
  
  // USDC 출금 기록 조회
  const fetchUsdcWithdrawalRequests = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('usdc_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('transaction_type', 'withdrawal')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUsdcWithdrawalRequests(data || []);
      
      // 이번 달 완료된 출금 횟수 계산
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const monthlyCount = (data || []).filter(
        (w: any) => w.status === 'completed' && new Date(w.created_at) >= startOfMonth
      ).length;
      setMonthlyWithdrawals(monthlyCount);
    } catch (error) {
      console.error("Error fetching withdrawal requests:", error);
    }
  };
  
  // USDC 출금 처리
  const handleWithdrawUsdc = async () => {
    if (!usdcWithdrawAddress || !usdcWithdrawAmount) {
      toast({
        title: "Error",
        description: "Please enter recipient address and amount",
        variant: "destructive"
      });
      return;
    }
    
    const amount = parseFloat(usdcWithdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }
    
    
    if (usdcBalance !== null && amount > usdcBalance) {
      toast({
        title: "Error",
        description: "Insufficient USDC balance",
        variant: "destructive"
      });
      return;
    }

    // 1회 최대 출금 한도 검사
    if (amount > MAX_WITHDRAWAL_AMOUNT) {
      toast({
        title: "Error",
        description: `Maximum withdrawal amount is $${MAX_WITHDRAWAL_AMOUNT} per transaction`,
        variant: "destructive"
      });
      return;
    }
    
    const confirmMsg = `Withdraw $${amount} USDC? A $${WITHDRAWAL_FEE_USD} fee will be deducted. Net amount: $${(amount - WITHDRAWAL_FEE_USD).toFixed(2)}`;
    
    if (!confirm(confirmMsg)) return;
    
    setIsWithdrawingUsdc(true);
    try {
    const { data, error } = await supabase.functions.invoke("withdraw-usdc", {
        body: {
          toAddress: usdcWithdrawAddress,
          amount: amount
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Withdrawal Successful!",
        description: `$${data.netAmount} USDC sent to ${usdcWithdrawAddress.slice(0, 6)}...${usdcWithdrawAddress.slice(-4)}`
      });
      
      setUsdcWithdrawAddress("");
      setUsdcWithdrawAmount("");
      setShowWithdrawalDialog(false);
      // 잔액 및 출금 기록 갱신
      await fetchUsdcBalance();
      fetchUsdcWithdrawalRequests();
    } catch (error: any) {
      console.error("Error withdrawing USDC:", error);
      let errorMsg = "Failed to withdraw USDC";
      if (error?.context?.body) {
        try {
          const errorBody = JSON.parse(error.context.body);
          errorMsg = errorBody.error || errorMsg;
        } catch (e) {}
      } else if (error?.message) {
        errorMsg = error.message;
      }
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsWithdrawingUsdc(false);
    }
  };
  
  const addTokenToWallet = async () => {
    try {
      const {
        data: tokenInfo,
        error
      } = await supabase.functions.invoke("get-token-info");
      if (error || !tokenInfo) {
        console.error("Failed to get token info:", error);
        toast({
          title: "Error",
          description: "Failed to get token information",
          variant: "destructive"
        });
        return;
      }
      if (!(window as any).ethereum) {
        navigator.clipboard.writeText(tokenInfo.address);
        toast({
          title: "Success",
          description: "Token address copied! Manually add it in your wallet."
        });
        return;
      }
      try {
        const wasAdded = await (window as any).ethereum.request({
          method: 'wallet_watchAsset',
          params: {
            type: 'ERC20',
            options: {
              address: tokenInfo.address,
              symbol: tokenInfo.symbol,
              decimals: tokenInfo.decimals,
              image: tokenInfo.image
            }
          }
        });
        if (wasAdded) {
          toast({
            title: "Success",
            description: "KTNZ token added to your wallet!"
          });
        }
      } catch (walletError: any) {
        if (walletError.message?.includes("isn't implemented")) {
          navigator.clipboard.writeText(tokenInfo.address);
          toast({
            title: "Success",
            description: `Token address copied! Add it manually in your wallet: ${tokenInfo.address.slice(0, 10)}...`
          });
        } else {
          throw walletError;
        }
      }
    } catch (error) {
      console.error("Error adding token:", error);
      toast({
        title: "Error",
        description: "Failed to add token. Try copying the address manually.",
        variant: "destructive"
      });
    }
  };

  const fetchFanzBalances = async () => {
    if (!user) return;
    
    setLoadingFanzBalances(true);
    try {
      const { data, error } = await supabase
        .from('fanz_balances')
        .select(`
          *,
          fanz_token:fanz_tokens!inner (
            id,
            token_id,
            post_id,
            wiki_entry_id,
            base_price,
            k_value,
            total_supply,
            posts (
              id,
              title,
              image_url
            ),
            wiki_entries (
              id,
              title,
              slug,
              image_url
            )
          )
        `)
        .eq('user_id', user.id)
        .gt('balance', 0);

      if (error) throw error;
      setFanzBalances(data || []);
    } catch (error) {
      console.error('Error fetching fanz balances:', error);
    } finally {
      setLoadingFanzBalances(false);
    }
  };
  const fetchTransactions = async () => {
    if (!user) return;
    try {
      const {
        data,
        error
      } = await supabase.from('point_transactions').select('*').eq('user_id', user.id).order('created_at', {
        ascending: false
      }).limit(50);
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: "Error",
        description: "Failed to load transaction history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  // 퀴즈쇼 상금 조회
  const fetchChallengeEarnings = async () => {
    if (!user) return;
    try {
      setLoadingEarnings(true);
      const { data, error } = await supabase
        .from('challenge_participations')
        .select(`
          id,
          prize_amount,
          claimed_at,
          challenges!inner (
            id,
            question,
            image_url
          )
        `)
        .eq('user_id', user.id)
        .eq('is_winner', true)
        .not('claimed_at', 'is', null)
        .order('claimed_at', { ascending: false });

      if (error) {
        console.error('Challenge earnings query error:', error);
        throw error;
      }

      // 챌린지별 중복 제거 (복수 참여 시 최고 상금만 표시)
      const deduped = new Map<string, any>();
      for (const item of (data || [])) {
        const challengeId = item.challenges.id;
        const existing = deduped.get(challengeId);
        if (!existing || (item.prize_amount || 0) > (existing.prize_amount || 0)) {
          deduped.set(challengeId, item);
        }
      }

      const formattedEarnings: ChallengeEarning[] = Array.from(deduped.values()).map((item: any) => ({
        id: item.id,
        prize_amount: item.prize_amount || 0,
        claimed_at: item.claimed_at,
        challenge: {
          id: item.challenges.id,
          question: item.challenges.question,
          image_url: item.challenges.image_url
        }
      }));
      
      setChallengeEarnings(formattedEarnings);
      const total = formattedEarnings.reduce((sum, item) => sum + (item.prize_amount || 0), 0);
      setTotalEarnings(total);
    } catch (error) {
      console.error('Error fetching challenge earnings:', error);
    } finally {
      setLoadingEarnings(false);
    }
  };
  const fetchWithdrawalRequests = async () => {
    if (!user) return;
    try {
      const {
        data,
        error
      } = await supabase.from('withdrawal_requests').select('*').eq('user_id', user.id).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setWithdrawalRequests(data || []);
    } catch (error) {
      console.error('Error fetching withdrawal requests:', error);
      toast({
        title: "Error",
        description: "Failed to load withdrawal requests",
        variant: "destructive"
      });
    }
  };
  const fetchStripeAccount = async () => {
    if (!user) return;
    try {
      const {
        data,
        error
      } = await supabase.from('profiles').select('stripe_account_id').eq('id', user.id).single();
      if (error) throw error;
      setStripeAccountId(data?.stripe_account_id || null);
    } catch (error) {
      console.error('Error fetching Stripe account:', error);
    }
  };
  const handleConnectStripe = async () => {
    if (!user) return;
    setConnectingStripe(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('create-connect-account', {
        body: {
          userId: user.id,
          country: selectedCountry
        }
      });
      if (error) {
        console.error('Stripe Connect error:', error);
        toast({
          title: "Error",
          description: typeof error === 'string' ? error : (error as any)?.message || "Failed to connect Stripe account",
          variant: "destructive"
        });
        return;
      }

      // Check if Stripe platform profile setup is required (not an error)
      if (data?.requiresSetup && data?.setupUrl) {
        // Open in new window
        window.open(data.setupUrl, '_blank', 'noopener,noreferrer');
        toast({
          title: "Stripe Connect",
          description: "Please complete the setup in the new window"
        });
        return;
      }

      // Normal case - proceed with onboarding
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
        toast({
          title: "Stripe Connect",
          description: "Please complete the onboarding in the new window"
        });
      }
    } catch (error) {
      console.error('Error connecting Stripe:', error);
      toast({
        title: "Error",
        description: "Failed to connect Stripe account",
        variant: "destructive"
      });
    } finally {
      setConnectingStripe(false);
    }
  };
  const handleWithdrawalRequest = async () => {
    if (!user) return;
    if (!stripeAccountId) {
      toast({
        title: "Stripe Account Required",
        description: "Please connect your Stripe account first",
        variant: "destructive"
      });
      return;
    }
    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }
    try {
      const {
        error
      } = await supabase.from('withdrawal_requests').insert({
        user_id: user.id,
        amount,
        stripe_account_id: stripeAccountId,
        notes: withdrawalNotes
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: "Withdrawal request submitted successfully"
      });
      setShowWithdrawalDialog(false);
      setWithdrawalAmount("");
      setWithdrawalNotes("");
      fetchWithdrawalRequests();
    } catch (error) {
      console.error('Error creating withdrawal request:', error);
      toast({
        title: "Error",
        description: "Failed to submit withdrawal request",
        variant: "destructive"
      });
    }
  };
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    // USDC 잔액 먼저 빠르게 로드 (DB 직접 조회)
    fetchUsdcBalance();
    fetchExternalWallet();
    fetchTransactions();
    fetchChallengeEarnings();
    fetchWithdrawalRequests();
    fetchStripeAccount();
    fetchFanzBalances();
    fetchUsdcWithdrawalRequests();
    if (hasWallet) {
      // KTNZ/ETH는 Edge Function으로 별도 로드 (느림)
      fetchKtnzBalance();
    }
  }, [user, authLoading, navigate, hasWallet]);

  // USDC 잔액 실시간 업데이트 구독
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('usdc-balance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'usdc_balances',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Earn] USDC balance changed:', payload);
          // 새 잔액으로 직접 업데이트
          if (payload.new && 'balance' in payload.new) {
            setUsdcBalance((payload.new as any).balance);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'usdc_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log('[Earn] USDC transaction changed, refreshing...');
          fetchUsdcWithdrawalRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
  const getActionTypeLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'create_post': 'Post Created',
      'write_comment': 'Comment Written',
      'receive_upvote': 'Upvote Received',
      'daily_login': 'Daily Login',
      'first_post_in_community': 'First Post in Community',
      'post_trending': 'Post Trending',
      'create_custom_community': 'Community Created',
      'boost_post_per_hour': 'Post Boosted',
      'exchange_ktnz_to_points': 'KTNZ Exchanged',
      'daily_token_mint': 'Daily Tokens Earned'
    };
    return labels[actionType] || actionType;
  };
  if (authLoading) {
    return (
      <V2Layout pcHeaderTitle="Rewards" showBackButton={true}>
        <div className={`${isMobile ? 'px-4' : ''} py-8`}>
          <div className="text-center">Loading...</div>
        </div>
      </V2Layout>
    );
  }
  if (!user) {
    return null;
  }
  return (
    <V2Layout pcHeaderTitle="Rewards" showBackButton={true}>
      <div className={`${isMobile ? 'px-4' : ''} py-4 max-w-4xl mx-auto`}>

        <Tabs defaultValue="earnings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="earnings" className="gap-2 h-full">
              <DollarSign className="w-4 h-4" />
              USDC
            </TabsTrigger>
            <TabsTrigger value="ktnz" className="gap-2 h-full">
              <Zap className="w-4 h-4" />
              $KTNZ
            </TabsTrigger>
            <TabsTrigger value="points" className="gap-2 h-full">
              <Coins className="w-4 h-4" />
              Stars
            </TabsTrigger>
          </TabsList>

          <TabsContent value="points" className="space-y-6">
            {/* Point Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Earned (XP)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {profile?.total_points?.toLocaleString() || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {profile?.available_points?.toLocaleString() || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Current Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {profile?.current_level || 1}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Transaction History */}
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
                <CardDescription>Recent star earning and spending activity</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : transactions.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                    No transactions yet. Start earning stars!
                  </div> : <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Action</TableHead>
                          <TableHead>Stars</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map(tx => <TableRow key={tx.id}>
                            <TableCell className="font-medium">
                              {getActionTypeLabel(tx.action_type)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={tx.points > 0 ? "default" : "secondary"} className={tx.points > 0 ? "bg-green-600" : "bg-red-600 text-white"}>
                                {tx.points > 0 ? '+' : ''}{tx.points}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDistanceToNow(new Date(tx.created_at), {
                          addSuffix: true
                        })}
                            </TableCell>
                          </TableRow>)}
                      </TableBody>
                    </Table>
                  </div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ktnz" className="space-y-6">
            {/* KTNZ Balance Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" />
                      $KTNZ Balance
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Daily voting activity rewards on Base blockchain
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={fetchKtnzBalance}
                      disabled={isLoadingBalance}
                    >
                      {isLoadingBalance ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </Button>
                    <Dialog open={showKtnzWithdrawDialog} onOpenChange={setShowKtnzWithdrawDialog}>
                      <DialogTrigger asChild>
                        <Button 
                          className="rounded-full"
                          disabled={!hasWallet || ktnzBalance === null || ktnzBalance < 100}
                        >
                          Withdraw KTNZ
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="w-[calc(100%-2rem)] max-w-[400px] p-0 gap-0" hideCloseButton>
                        {/* Gradient Header */}
                        <div className="bg-gradient-to-r from-primary to-primary/80 p-4 rounded-t-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Zap className="w-5 h-5 text-primary-foreground" />
                              <span className="text-lg font-bold text-primary-foreground">Withdraw KTNZ</span>
                            </div>
                            <button
                              onClick={() => setShowKtnzWithdrawDialog(false)}
                              className="w-7 h-7 rounded-full bg-primary-foreground/15 hover:bg-primary-foreground/25 flex items-center justify-center transition-colors"
                            >
                              <span className="text-primary-foreground text-sm font-medium">✕</span>
                            </button>
                          </div>
                          <p className="text-primary-foreground/80 text-xs mt-1">Send to external wallet</p>
                        </div>

                        <div className="p-4 space-y-4">
                          {/* Balance */}
                          <div className="p-3 bg-muted rounded-lg text-center">
                            <div className="text-xs text-muted-foreground">Available Balance</div>
                            <div className="text-2xl font-bold text-primary">{ktnzBalance?.toLocaleString() || 0} KTNZ</div>
                          </div>

                          {/* Withdrawal Conditions */}
                          <div className="p-3 bg-muted/50 border border-border rounded-lg space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Withdrawal Conditions:</p>
                            <ul className="text-xs text-muted-foreground space-y-0.5">
                              <li>• Minimum: 100 KTNZ</li>
                              <li>• Gas fee: Free (platform sponsored)</li>
                              <li>• Network: Base Mainnet</li>
                            </ul>
                          </div>

                          {/* Address Input */}
                          <div className="space-y-1.5">
                            <Label htmlFor="ktnzWithdrawAddress" className="text-xs text-muted-foreground">Recipient Address</Label>
                            <Input
                              id="ktnzWithdrawAddress"
                              placeholder="0x..."
                              value={ktnzWithdrawAddress}
                              onChange={e => setKtnzWithdrawAddress(e.target.value)}
                              className="font-mono text-sm"
                            />
                          </div>

                          {/* Amount Input */}
                          <div className="space-y-1.5">
                            <Label htmlFor="ktnzWithdrawAmountModal" className="text-xs text-muted-foreground">Amount (KTNZ)</Label>
                            <div className="flex gap-2">
                              <Input
                                id="ktnzWithdrawAmountModal"
                                type="number"
                                min="100"
                                placeholder="100"
                                value={ktnzWithdrawAmount}
                                onChange={e => setKtnzWithdrawAmount(e.target.value)}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setKtnzWithdrawAmount(String(ktnzBalance || 0))}
                                className="text-xs whitespace-nowrap"
                              >
                                Max
                              </Button>
                            </div>
                          </div>

                          {/* Buttons */}
                          <div className="flex flex-col gap-2 pt-2">
                            <Button
                              onClick={handleWithdrawKtnz}
                              disabled={
                                isWithdrawingKtnz ||
                                !ktnzWithdrawAddress ||
                                !ktnzWithdrawAmount ||
                                parseFloat(ktnzWithdrawAmount) < 100 ||
                                parseFloat(ktnzWithdrawAmount) > (ktnzBalance || 0)
                              }
                              className="w-full rounded-full"
                            >
                              {isWithdrawingKtnz ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                              ) : (
                                'Withdraw'
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setShowKtnzWithdrawDialog(false)}
                              className="w-full text-muted-foreground"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!hasWallet ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground mb-4">No wallet connected</p>
                    <Button onClick={() => createWallet()}>
                      Create Wallet
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <div className="text-3xl font-bold text-primary">
                        {isLoadingBalance ? (
                          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                        ) : (
                          <>{ktnzBalance?.toLocaleString() || 0} KTNZ</>
                        )}
                      </div>
                      {wallet?.wallet_address && (
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">
                            {wallet.wallet_address}
                          </span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={copyAddress}>
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={openExplorer}>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Earned by voting daily • Proof of fan activity on-chain
                    </p>
                    {ktnzBalance !== null && ktnzBalance < 100 && ktnzBalance > 0 && (
                      <p className="text-xs text-center text-amber-600">
                        Minimum 100 KTNZ required for withdrawal
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Convert to Stars Section */}
            {hasWallet && ktnzBalance !== null && ktnzBalance > 0 && (
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ArrowRightLeft className="w-5 h-5 text-primary" />
                    Convert to Stars
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Exchange your KTNZ tokens for Stars (1 KTNZ = 10 Stars)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Input
                          type="number"
                          placeholder="Amount to convert"
                          value={exchangePoints}
                          onChange={(e) => setExchangePoints(e.target.value)}
                          min="1"
                          max={ktnzBalance || 0}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExchangePoints(String(ktnzBalance || 0))}
                        className="text-xs"
                      >
                        Max
                      </Button>
                    </div>
                    
                    {parseFloat(exchangePoints) > 0 && (
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <span className="text-sm text-muted-foreground">You'll receive: </span>
                        <span className="text-lg font-bold text-primary">
                          {(parseFloat(exchangePoints) * 10).toLocaleString()} Stars ⭐
                        </span>
                      </div>
                    )}
                    
                    <Button
                      onClick={handleExchangePoints}
                      disabled={
                        isExchanging || 
                        !exchangePoints || 
                        parseFloat(exchangePoints) <= 0 ||
                        parseFloat(exchangePoints) > (ktnzBalance || 0) ||
                        (ethBalance !== null && ethBalance < 0.00005)
                      }
                      className="w-full rounded-full"
                    >
                      {isExchanging ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Converting...</>
                      ) : (
                        <>Convert to Stars</>
                      )}
                    </Button>
                    
                  </div>
                </CardContent>
              </Card>
            )}

            {/* KTNZ Transaction History */}
            <Card>
              <CardHeader>
                <CardTitle>KTNZ Activity</CardTitle>
                <CardDescription>Recent KTNZ token activities</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : (
                  (() => {
                    const ktnzTransactions = transactions.filter(
                      tx => tx.action_type === 'exchange_ktnz_to_points' || 
                            tx.action_type === 'daily_token_mint'
                    );
                    
                    return ktnzTransactions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No KTNZ activity yet</p>
                        <p className="text-sm mt-2">Earn KTNZ through daily activities!</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Activity</TableHead>
                              <TableHead>Stars</TableHead>
                              <TableHead>Time</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ktnzTransactions.map(tx => (
                              <TableRow key={tx.id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {tx.action_type === 'daily_token_mint' ? (
                                      <Wand2 className="w-4 h-4 text-primary" />
                                    ) : (
                                      <ArrowRightLeft className="w-4 h-4 text-orange-500" />
                                    )}
                                    {getActionTypeLabel(tx.action_type)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={tx.points > 0 ? "default" : "secondary"} 
                                    className={tx.points > 0 ? "bg-green-600" : "bg-orange-600 text-white"}
                                  >
                                    {tx.points > 0 ? '+' : ''}{tx.points}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="earnings" className="space-y-6">
            {/* Quiz Show Earnings - 최상단 배치 */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
                      Quiz Show Earnings
                    </CardTitle>
                    <CardDescription className="mt-1">
                      USDC prizes you've won from quiz challenges
                    </CardDescription>
                  </div>
                  <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full sm:w-auto rounded-full">
                        Withdraw USDC
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[calc(100%-2rem)] max-w-[400px] p-0 gap-0" hideCloseButton>
                      {/* Gradient Header */}
                      <div className="bg-gradient-to-r from-primary to-primary/80 p-4 rounded-t-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-primary-foreground" />
                            <span className="text-lg font-bold text-primary-foreground">Withdraw USDC</span>
                          </div>
                          <button
                            onClick={() => setShowWithdrawalDialog(false)}
                            className="w-7 h-7 rounded-full bg-primary-foreground/15 hover:bg-primary-foreground/25 flex items-center justify-center transition-colors"
                          >
                            <span className="text-primary-foreground text-sm font-medium">✕</span>
                          </button>
                        </div>
                        <p className="text-primary-foreground/80 text-xs mt-1">Send to external wallet</p>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Balance */}
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <div className="text-xs text-muted-foreground">Available Balance</div>
                          <div className="text-2xl font-bold text-primary">${usdcBalance?.toFixed(2) || '0.00'}</div>
                        </div>

                        {/* External Wallet Banner */}
                        {!externalWalletAddress && (
                          <div className="flex items-start gap-3 p-3 bg-[#0052FF]/10 border border-[#0052FF]/20 rounded-lg">
                            <Shield className="h-5 w-5 text-[#0052FF] shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">Connect Base Wallet for secure withdrawals</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Your connected wallet address will be auto-filled
                              </p>
                              <Button
                                variant="link"
                                className="text-[#0052FF] p-0 h-auto text-xs mt-1"
                                onClick={() => {
                                  setShowWithdrawalDialog(false);
                                  window.location.href = '/wallet';
                                }}
                              >
                                Connect in Wallet Settings →
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Address Input */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="withdrawAddress" className="text-xs text-muted-foreground">Recipient Address</Label>
                            {externalWalletAddress && !usdcWithdrawAddress && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-[#0052FF] hover:text-[#0052FF]/80"
                                onClick={() => setUsdcWithdrawAddress(externalWalletAddress)}
                              >
                                Use Connected Wallet
                              </Button>
                            )}
                          </div>
                          <Input
                            id="withdrawAddress"
                            placeholder="0x..."
                            value={usdcWithdrawAddress}
                            onChange={e => setUsdcWithdrawAddress(e.target.value)}
                            className="font-mono text-sm"
                          />
                          {externalWalletAddress && usdcWithdrawAddress.toLowerCase() === externalWalletAddress.toLowerCase() && (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                              <Check className="h-3 w-3" /> Using your connected Base wallet
                            </p>
                          )}
                        </div>

                        {/* Amount Input */}
                        <div className="space-y-1.5">
                          <Label htmlFor="withdrawAmount" className="text-xs text-muted-foreground">Amount (USDC)</Label>
                          <Input
                            id="withdrawAmount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={MAX_WITHDRAWAL_AMOUNT}
                            placeholder="0.00"
                            value={usdcWithdrawAmount}
                            onChange={e => setUsdcWithdrawAmount(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Fee: ${WITHDRAWAL_FEE_USD.toFixed(2)} · Max: ${MAX_WITHDRAWAL_AMOUNT} per transaction
                          </p>
                          {parseFloat(usdcWithdrawAmount) > MAX_WITHDRAWAL_AMOUNT && (
                            <p className="text-xs text-destructive">
                              Maximum ${ MAX_WITHDRAWAL_AMOUNT} per transaction
                            </p>
                          )}
                          {parseFloat(usdcWithdrawAmount) > WITHDRAWAL_FEE_USD && parseFloat(usdcWithdrawAmount) <= MAX_WITHDRAWAL_AMOUNT && (
                            <div className="p-2 bg-muted border border-border rounded text-center">
                              <span className="text-xs text-muted-foreground">You'll receive: </span>
                              <span className="text-sm font-semibold text-primary">
                                ${(parseFloat(usdcWithdrawAmount) - WITHDRAWAL_FEE_USD).toFixed(2)} USDC
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Buttons */}
                        <div className="flex flex-col gap-2 pt-2">
                          <Button
                            onClick={handleWithdrawUsdc}
                            disabled={
                              isWithdrawingUsdc ||
                              !usdcWithdrawAddress ||
                              !usdcWithdrawAmount ||
                              !usdcBalance ||
                              parseFloat(usdcWithdrawAmount) <= WITHDRAWAL_FEE_USD ||
                              parseFloat(usdcWithdrawAmount) > usdcBalance ||
                              parseFloat(usdcWithdrawAmount) > MAX_WITHDRAWAL_AMOUNT
                            }
                            className="w-full rounded-full"
                          >
                            {isWithdrawingUsdc ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                            ) : (
                              'Withdraw'
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setShowWithdrawalDialog(false)}
                            className="w-full text-muted-foreground"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loadingEarnings ? <div className="text-center py-8">Loading earnings...</div> : <>
                    <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-muted rounded-lg">
                      <div className="text-xl sm:text-2xl font-bold text-primary">
                        ${usdcBalance?.toFixed(2) || '0.00'} USDC
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        Available balance (Total earned: ${totalEarnings.toFixed(2)})
                      </div>
                    </div>

                    {usdcWithdrawalRequests.length > 0 && <div className="mb-4 sm:mb-6">
                        <h3 className="text-sm sm:text-md font-semibold mb-2 sm:mb-3">Withdrawal History</h3>
                        <div className="space-y-2">
                          {usdcWithdrawalRequests.slice(0, 5).map(request => <Card key={request.id} className="p-2 sm:p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="font-medium text-sm sm:text-base">${Math.abs(request.amount).toFixed(2)} USDC</div>
                                  <div className="text-xs text-muted-foreground">
                                    Fee: ${request.fee?.toFixed(2) || '0.00'}
                                  </div>
                                  <div className="text-xs sm:text-sm text-muted-foreground">
                                    {new Date(request.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm whitespace-nowrap ${request.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : request.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'}`}>
                                  {request.status}
                                </div>
                              </div>
                            </Card>)}
                        </div>
                      </div>}

                    {challengeEarnings.length === 0 ? <div className="text-center py-6 sm:py-8 text-muted-foreground">
                        <DollarSign className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                        <p className="text-sm sm:text-base">No quiz earnings yet</p>
                        <p className="text-xs sm:text-sm mt-2">
                          Win quiz challenges to earn USDC prizes!
                        </p>
                      </div> : <div className="space-y-3 sm:space-y-4">
                        <h3 className="text-sm sm:text-md font-semibold">Earning History</h3>
                        {challengeEarnings.map(earning => {
                          // YouTube URL에서 썸네일 추출
                          const getYoutubeThumbnail = (url: string | null): string | null => {
                            if (!url) return null;
                            const patterns = [
                              /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
                              /^([a-zA-Z0-9_-]{11})$/
                            ];
                            for (const pattern of patterns) {
                              const match = url.match(pattern);
                              if (match) {
                                return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
                              }
                            }
                            return null;
                          };
                          
                          const thumbnailUrl = getYoutubeThumbnail(earning.challenge.image_url) || earning.challenge.image_url;
                          
                          return (
                            <Card key={earning.id} className="border">
                              <CardContent className="p-3 sm:p-4">
                                <div className="flex items-start gap-3 sm:gap-4">
                                  {thumbnailUrl && <img src={thumbnailUrl} alt="Quiz" className="w-12 h-12 sm:w-16 sm:h-16 rounded object-cover flex-shrink-0" />}
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold mb-1 text-sm sm:text-base line-clamp-2">
                                      {earning.challenge.question}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                                      <span className="text-xs">{formatDistanceToNow(new Date(earning.claimed_at), {
                                  addSuffix: true
                                })}</span>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="text-base sm:text-xl font-bold text-green-600">
                                      +${earning.prize_amount.toFixed(2)}
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                                      USDC
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>}
                  </>}
              </CardContent>
            </Card>

            {/* Connect Base Wallet Section */}
            <ConnectExternalWallet 
              variant="banner"
              onConnected={(addr) => setExternalWalletAddress(addr)} 
            />

            {/* Transfer Lightsticks to External Wallet */}
            {externalWalletAddress && (
              <TransferToExternalWallet 
                externalWalletAddress={externalWalletAddress}
                onTransferComplete={() => {
                  fetchFanzBalances();
                }}
              />
            )}

            {/* External Wallet Prize Claim Section */}
            <ExternalPrizeClaim 
              externalWalletAddress={externalWalletAddress} 
              onClaimSuccess={() => {
                fetchUsdcBalance();
                fetchChallengeEarnings();
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </V2Layout>
  );
};
export default Earn;