import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sdk } from "@farcaster/miniapp-sdk";
import { Button } from "@/components/ui/button";
import { Loader2, X, ShoppingBag, Heart, TrendingUp, Trophy, ChevronLeft, ChevronRight, CheckCircle, Sparkles, Wand2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ethers } from "ethers";
import { toast } from "sonner";

const FANZTOKEN_V5_ADDRESS = "0x2003eF9610A34Dc5771CbB9ac1Db2B2c056C66C7";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const FANZTOKEN_ABI = [
  "function buy(uint256 tokenId, uint256 amount, uint256 maxCost) external",
  "function calculateBuyCost(uint256 tokenId, uint256 amount) view returns (uint256 reserveCost, uint256 artistFundFee, uint256 platformFee, uint256 totalCost)"
];

interface FanzToken {
  id: string;
  token_id: string;
  wiki_entry_id?: string | null;
  wiki_entry?: {
    title?: string;
    image_url?: string;
    entry_community_funds?: { total_fund: number } | null;
  } | null;
}

const VALUE_SLIDES = [
  {
    icon: Heart,
    title: "SUPPORT",
    value: "20%",
    subtitle: "to Artist Fund",
    description: "Direct support, on-chain proof",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    icon: TrendingUp,
    title: "SECURE",
    value: "70%",
    subtitle: "in reserve",
    description: "Sell anytime at fair price",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Trophy,
    title: "WIN MORE",
    value: "7:3",
    subtitle: "priority",
    description: "Real USDC quiz prizes",
    gradient: "from-amber-500 to-orange-500",
  },
];

export default function MiniAppShop() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [userAddresses, setUserAddresses] = useState<string[]>([]);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isBuying, setIsBuying] = useState(false);
  const [purchasedToken, setPurchasedToken] = useState<FanzToken | null>(null);

  // SDK ready 호출 - 즉시 실행하여 스플래시 화면 제거
  useEffect(() => {
    let cancelled = false;
    
    const initSDK = async () => {
      // 즉시 ready 호출 시도 (스플래시 화면 제거)
      for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
        try {
          await sdk.actions.ready();
          console.log("[MiniAppShop] SDK ready successful on attempt", attempt + 1);
          break;
        } catch (err) {
          console.warn(`[MiniAppShop] SDK ready attempt ${attempt + 1} failed`);
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }
      
      if (cancelled) return;
      
      // 사용자 지갑 주소 가져오기
      try {
        const provider = sdk.wallet.ethProvider;
        if (provider) {
          // eth_requestAccounts를 사용하여 지갑 연결 요청
          let accounts: string[] = [];
          try {
            accounts = await provider.request({ method: 'eth_accounts' }) as string[];
          } catch {
            // 연결되지 않은 경우 무시
          }
          
          if (accounts && accounts.length > 0) {
            console.log("[MiniAppShop] User eth addresses:", accounts);
            setUserAddresses(accounts);
          }
        }
      } catch (err) {
        console.warn("[MiniAppShop] Failed to get wallet addresses:", err);
      } finally {
        setIsLoadingBalance(false);
      }
    };
    
    // 즉시 실행
    void initSDK();
    
    return () => { cancelled = true; };
  }, []);

  // USDC 잔액 조회
  useEffect(() => {
    if (userAddresses.length === 0) return;

    const fetchUsdcBalance = async () => {
      try {
        const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
        const provider = new ethers.JsonRpcProvider("https://base-mainnet.g.alchemy.com/v2/OeF4gzEMrS-sF9IXBETZV");
        const usdcContract = new ethers.Contract(USDC_ADDRESS, ["function balanceOf(address) view returns (uint256)"], provider);
        
        let total = 0n;
        for (const addr of userAddresses) {
          const balance = await usdcContract.balanceOf(addr);
          total += balance;
        }
        setUsdcBalance(Number(total) / 1e6);
      } catch (err) {
        console.error("[MiniAppShop] Failed to fetch USDC balance:", err);
      }
    };

    void fetchUsdcBalance();
  }, [userAddresses]);

  // Fanz Tokens 목록
  const { data: tokens = [], isLoading: tokensLoading } = useQuery({
    queryKey: ['miniapp-shop-tokens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fanz_tokens')
        .select(`
          id,
          token_id,
          wiki_entry_id,
          wiki_entry:wiki_entries(title, image_url, entry_community_funds(total_fund))
        `)
        .eq('contract_address', FANZTOKEN_V5_ADDRESS)
        .eq('is_active', true);

      if (error) throw error;
      return (data || []) as FanzToken[];
    },
  });

  // 토큰별 가격 조회 - Edge Function 사용 (플랫폼과 동일)
  const { data: tokenPrices = {} } = useQuery({
    queryKey: ['miniapp-shop-prices', tokens.map(t => t.token_id).join(',')],
    queryFn: async () => {
      if (tokens.length === 0) return {};
      
      const prices: Record<string, number> = {};
      for (const token of tokens) {
        try {
          const { data, error } = await supabase.functions.invoke('get-fanztoken-price', {
            body: { tokenId: token.token_id, amount: 1 }
          });
          
          if (!error && data?.success && data?.data?.buyCost) {
            // USDC 직접 결제이므로 Stripe 수수료 없이 온체인 가격만 사용
            prices[token.token_id] = data.data.buyCost;
          } else {
            prices[token.token_id] = 2.74; // fallback
          }
        } catch (err) {
          console.error(`Failed to get price for token ${token.token_id}:`, err);
          prices[token.token_id] = 2.74; // fallback
        }
      }
      return prices;
    },
    enabled: tokens.length > 0,
  });

  const handleClose = async () => {
    try {
      await sdk.actions.close();
    } catch {
      // 브라우저에서는 닫기 불가
    }
  };

  const handleBuy = async (token: FanzToken) => {
    if (userAddresses.length === 0) {
      toast.error("Please connect your wallet first");
      return;
    }

    const price = tokenPrices[token.token_id];
    if (!price) {
      toast.error("Price not available");
      return;
    }

    if (usdcBalance !== null && usdcBalance < price) {
      toast.error(`Insufficient USDC balance. You need $${price.toFixed(2)}`);
      return;
    }

    setIsBuying(true);

    try {
      const provider = sdk.wallet.ethProvider;
      if (!provider) throw new Error("Wallet provider not available");

      const userAddress = userAddresses[0];
      
      // 1. Fetch real-time price from contract
      const rpcProvider = new ethers.JsonRpcProvider("https://base-mainnet.g.alchemy.com/v2/OeF4gzEMrS-sF9IXBETZV");
      const fanzContract = new ethers.Contract(FANZTOKEN_V5_ADDRESS, FANZTOKEN_ABI, rpcProvider);
      const [, , , currentTotalCost] = await fanzContract.calculateBuyCost(BigInt(token.token_id), 1n);
      const maxCost = (currentTotalCost * 105n) / 100n; // 5% slippage buffer
      
      // 2. Check and approve USDC if needed (use maxCost for buffer)
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, rpcProvider);
      const currentAllowance = await usdcContract.allowance(userAddress, FANZTOKEN_V5_ADDRESS);

      if (currentAllowance < maxCost) {
        toast.info("Approving USDC...");
        
        const approveData = usdcContract.interface.encodeFunctionData("approve", [
          FANZTOKEN_V5_ADDRESS,
          maxCost
        ]);

        const approveTxHash = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: userAddress,
            to: USDC_ADDRESS,
            data: approveData,
          }]
        });

        console.log("[MiniAppShop] Approve tx:", approveTxHash);
        
        // Wait for approval confirmation
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // 3. Buy token with slippage protection
      toast.info("Purchasing Lightstick...");
      
      const buyData = fanzContract.interface.encodeFunctionData("buy", [
        BigInt(token.token_id),
        1n, // amount
        maxCost // maxCost for slippage protection (already calculated above)
      ]);

      const buyTxHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: userAddress,
          to: FANZTOKEN_V5_ADDRESS,
          data: buyData,
        }]
      });

      console.log("[MiniAppShop] Buy tx:", buyTxHash);

      // Success!
      setPurchasedToken(token);
      
      // Refresh balances
      const fetchBalance = async () => {
        try {
          const balance = await usdcContract.balanceOf(userAddress);
          setUsdcBalance(Number(balance) / 1e6);
        } catch (err) {
          console.error("Failed to refresh balance:", err);
        }
      };
      void fetchBalance();
      
      queryClient.invalidateQueries({ queryKey: ['miniapp-shop-prices'] });

    } catch (err: any) {
      console.error("[MiniAppShop] Buy error:", err);
      if (err?.code === 4001 || err?.message?.includes('rejected')) {
        toast.error("Transaction cancelled");
      } else {
        toast.error("Purchase failed. Please try again.");
      }
    } finally {
      setIsBuying(false);
    }
  };

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % VALUE_SLIDES.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + VALUE_SLIDES.length) % VALUE_SLIDES.length);

  // Auto-slide
  useEffect(() => {
    const interval = setInterval(nextSlide, 4000);
    return () => clearInterval(interval);
  }, []);

  // Success screen
  if (purchasedToken) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 overflow-auto">
        <div className="min-h-full flex flex-col items-center justify-center px-6 py-12">
          <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-3xl p-8 text-center max-w-sm w-full">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircle className="h-10 w-10 text-white" />
            </div>
            
            <h1 className="text-2xl font-black text-white mb-2">🎉 You Got It!</h1>
            <p className="text-white/80 mb-6">
              You now own a <span className="font-bold">{purchasedToken.wiki_entry?.title || 'Lightstick'}</span> Lightstick!
            </p>

            {purchasedToken.wiki_entry?.image_url && (
              <div className="w-32 h-32 mx-auto mb-6 rounded-2xl overflow-hidden border-2 border-white/30">
                <img 
                  src={purchasedToken.wiki_entry.image_url} 
                  alt={purchasedToken.wiki_entry.title || 'Lightstick'} 
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="space-y-3">
              <Button
                onClick={() => setPurchasedToken(null)}
                className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-full h-12"
              >
                Buy Another
              </Button>
              <Button
                onClick={handleClose}
                className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-full h-12 font-semibold"
              >
                Done
              </Button>
            </div>
          </div>

          <p className="text-white/50 text-xs mt-6">
            Your Lightstick gives you 7:3 priority in quiz prizes!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/miniapp')}
              className="text-white hover:text-white bg-white/20 hover:bg-white/30 rounded-full w-9 h-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white">Lightstick Shop</h1>
              <p className="text-xs text-white/70">Support Your Artist</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* USDC Balance */}
            {usdcBalance !== null && (
              <div className="bg-white/20 rounded-full px-3 py-1.5">
                <span className="text-sm font-semibold text-white">${usdcBalance.toFixed(2)}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-white hover:text-white bg-white/20 hover:bg-white/30 rounded-full w-9 h-9"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 pb-24 space-y-6">
        {/* Value Proposition Carousel */}
        <div className="relative">
          <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl p-6 overflow-hidden">
            <div className="text-center mb-4">
              <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                Why Own a Lightstick?
              </span>
            </div>
            
            <div className="relative h-32">
              {VALUE_SLIDES.map((slide, index) => {
                const Icon = slide.icon;
                return (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-all duration-500 ${
                      index === currentSlide
                        ? 'opacity-100 translate-x-0'
                        : index < currentSlide
                        ? 'opacity-0 -translate-x-full'
                        : 'opacity-0 translate-x-full'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${slide.gradient} flex items-center justify-center mb-3 shadow-lg`}>
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <div className="text-xs font-bold text-white/60 uppercase tracking-wider mb-1">
                        {slide.title}
                      </div>
                      <div className="text-3xl font-black text-white mb-1">
                        {slide.value} <span className="text-lg font-medium text-white/80">{slide.subtitle}</span>
                      </div>
                      <div className="text-sm text-white/70">
                        {slide.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <button onClick={prevSlide} className="text-white/60 hover:text-white transition-colors">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex gap-2">
                {VALUE_SLIDES.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentSlide ? 'bg-white w-6' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
              <button onClick={nextSlide} className="text-white/60 hover:text-white transition-colors">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Lightstick List - Sorted by Price (High to Low) */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">Choose Your Lightstick</h2>
          
          {tokensLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          ) : tokens.length > 0 ? (
            <div className="space-y-4">
              {[...tokens]
                .sort((a, b) => (tokenPrices[b.token_id] || 0) - (tokenPrices[a.token_id] || 0))
                .map((token) => {
                const price = tokenPrices[token.token_id] || 2.74;
                const imageUrl = token.wiki_entry?.image_url;
                const title = token.wiki_entry?.title || 'Lightstick';
                
                return (
                  <div
                    key={token.id}
                    className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl overflow-hidden"
                  >
                    {imageUrl && (
                      <div className="aspect-[2/1] w-full overflow-hidden relative">
                        <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
                        {/* Funding amount badge */}
                        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
                          <span className="text-xs font-semibold text-white">
                            ${(token.wiki_entry?.entry_community_funds?.total_fund || 0).toFixed(2)} funded
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-bold text-white text-lg">{title}</div>
                          <div className="text-sm text-white/60">Lightstick Token</div>
                        </div>
                        <div className="text-xl font-bold text-white">${price.toFixed(2)}</div>
                      </div>
                      <button
                        onClick={() => handleBuy(token)}
                        disabled={isBuying}
                        className="w-full bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm font-semibold rounded-full py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 backdrop-blur-sm"
                      >
                        {isBuying ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <ShoppingBag className="h-5 w-5" />
                            <span>Buy & Support</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-white/60 py-10">
              No lightsticks available
            </div>
          )}
        </div>

        {/* Quiz Show Banner */}
        <button
          onClick={() => navigate('/miniapp')}
          className="w-full bg-gradient-to-r from-purple-500/30 to-pink-500/30 backdrop-blur-xl border border-white/30 rounded-2xl p-4 flex items-center justify-between hover:from-purple-500/40 hover:to-pink-500/40 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <div className="font-bold text-white">Win USDC Prizes!</div>
              <div className="text-xs text-white/70">Join free quiz challenges</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-white/60" />
        </button>
      </div>
    </div>
  );
}