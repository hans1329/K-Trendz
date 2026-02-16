import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Coins, Zap, Shield, Clock, Loader2, CheckCircle2, Wand2, ArrowRightLeft, Sparkles, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Product {
  id: string;
  name: string;
  description: string;
  points: number;
  price_usd: number;
  stripe_price_id: string | null;
  product_type: string;
  billing_interval: string | null;
  badge_text: string | null;
  display_order: number;
}

const Purchase = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingProductId, setProcessingProductId] = useState<string | null>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [processingBadgeId, setProcessingBadgeId] = useState<string | null>(null);
  const [ktnzBalance, setKtnzBalance] = useState<number>(0);
  const [exchangeAmount, setExchangeAmount] = useState<string>("");
  const [exchangeDialogOpen, setExchangeDialogOpen] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [ktnzToStarsRate, setKtnzToStarsRate] = useState<number>(10); // 기본값 10

  useEffect(() => {
    fetchProducts();
    fetchBadges();
    fetchKtnzToStarsRate();
    if (user) {
      fetchKtnzBalance();
    }
  }, [user]);

  const fetchKtnzToStarsRate = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'ktnz_to_stars_rate')
        .single();
      
      if (!error && data?.setting_value) {
        const rate = (data.setting_value as any)?.rate || 10;
        setKtnzToStarsRate(parseFloat(rate) || 10);
      }
    } catch (error) {
      console.error('Error fetching KTNZ to Stars rate:', error);
    }
  };

  const fetchKtnzBalance = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke('get-ktnz-balance', {
        body: { userId: user.id }
      });
      if (!error && data?.balance) {
        setKtnzBalance(parseFloat(data.balance));
      }
    } catch (error) {
      console.error('Error fetching KTNZ balance:', error);
    }
  };

  const handleExchange = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please login to exchange KTNZ",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    const amount = parseFloat(exchangeAmount);
    if (!amount || amount <= 0 || amount > ktnzBalance) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setExchanging(true);
    try {
      const { data, error } = await supabase.functions.invoke('exchange-ktnz-to-points', {
        body: { tokensToExchange: amount }
      });

      if (error) throw error;

      toast({
        title: "Exchange Successful!",
        description: `Converted ${amount} KTNZ to ${amount * ktnzToStarsRate} Stars`,
      });

      setExchangeDialogOpen(false);
      setExchangeAmount("");
      fetchKtnzBalance();
    } catch (error) {
      console.error('Exchange error:', error);
      toast({
        title: "Exchange Failed",
        description: error instanceof Error ? error.message : "Failed to exchange tokens",
        variant: "destructive",
      });
    } finally {
      setExchanging(false);
    }
  };

  const fetchBadges = async () => {
    try {
      const { data, error } = await supabase
        .from('gift_badges')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setBadges(data || []);
    } catch (error) {
      console.error('Error fetching badges:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('point_products')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (product: Product) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please login to purchase stars",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setProcessingProductId(product.id);

    try {
      // Call Tebex checkout edge function
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          productName: product.name,
          price: product.price_usd,
          productId: product.id,
          quantity: 1
        }
      });

      if (error) throw error;

      if (data?.url) {
        // Open Tebex checkout in new tab
        window.open(data.url, '_blank');
        toast({
          title: "Redirecting to Checkout",
          description: "Opening payment page in new tab...",
        });
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: "Failed to initiate checkout",
        variant: "destructive",
      });
    } finally {
      setProcessingProductId(null);
    }
  };

  const handleBadgePurchase = async (badge: any) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please login to purchase lightsticks",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (!badge.usd_price) {
      toast({
        title: "Not Available",
        description: "This lightstick is not configured for purchase yet. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    setProcessingBadgeId(badge.id);
    
    // 즉각적인 UI 피드백
    toast({
      title: "Processing",
      description: "Creating checkout session...",
    });

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          productName: badge.name,
          price: badge.usd_price,
          badgeId: badge.id,
          quantity: 1
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Checkout Ready",
          description: "Payment page opened in new tab. Please complete your purchase.",
        });
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingBadgeId(null);
    }
  };

  const oneTimeProducts = products.filter(p => p.product_type === 'one_time');
  const subscriptionProducts = products.filter(p => p.product_type === 'subscription');
  
  // URL에서 탭 파라미터 읽기
  const urlParams = new URLSearchParams(window.location.search);
  const defaultTab = urlParams.get('tab') || 'one-time';

  // Handle successful purchase
  useEffect(() => {
    const handleSuccessfulPurchase = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success');
      const badgeId = urlParams.get('badge_id');
      const userId = urlParams.get('user_id');
      const quantity = urlParams.get('quantity');
      const productId = urlParams.get('product_id');

      if (success === 'true') {
        // Badge purchase
        if (badgeId && userId) {
          try {
            const { error } = await supabase.functions.invoke('verify-badge-purchase', {
              body: { 
                badgeId,
                userId,
                quantity: quantity || '1'
              }
            });

            if (error) throw error;

            toast({
              title: "Purchase Successful",
              description: "Lightstick has been added to your inventory!",
            });

            // Clear URL params
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (error) {
            console.error('Error verifying purchase:', error);
            toast({
              title: "Error",
              description: "Failed to verify purchase. Please contact support.",
              variant: "destructive",
            });
          }
        }
        
        // Product purchase (Stars)
        if (productId && userId) {
          toast({
            title: "Purchase Successful",
            description: "Stars will be added to your account shortly!",
          });
          
          // Clear URL params
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Reload products to reflect purchase
          fetchProducts();
        }
      }
    };

    handleSuccessfulPurchase();
  }, []);

  if (loading) {
    return (
      <V2Layout pcHeaderTitle="Purchase" showBackButton={true}>
        <div className={`${isMobile ? 'px-4' : ''} py-20 flex justify-center items-center`}>
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </V2Layout>
    );
  }

  return (
    <V2Layout pcHeaderTitle="Purchase" showBackButton={true}>
      <div className={`${isMobile ? 'px-4' : ''} py-4 max-w-7xl mx-auto`}>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-2 mb-4 h-12">
            <TabsTrigger value="one-time" className="gap-1 sm:gap-2 px-2 sm:px-3 h-full">
              <Zap className="w-4 h-4 flex-shrink-0 hidden sm:block" />
              <span className="text-xs sm:text-sm">One-Time</span>
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-1 sm:gap-2 px-2 sm:px-3 h-full">
              <Clock className="w-4 h-4 flex-shrink-0 hidden sm:block" />
              <span className="text-xs sm:text-sm">Subscriptions</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="one-time">
            <div className="flex justify-center px-2 sm:px-4">
              <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto w-full">
                {oneTimeProducts.map((product) => (
                  <Card 
                    key={product.id}
                    className={`relative overflow-hidden transition-all hover:shadow-lg w-full ${
                      product.badge_text ? 'border-primary' : ''
                    }`}
                  >
                    {product.badge_text && (
                      <div className="absolute top-2 right-2 z-10">
                        <Badge className="bg-primary text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1">{product.badge_text}</Badge>
                      </div>
                    )}
                    
                    <CardHeader className={`pb-3 ${product.badge_text ? 'pr-20 sm:pr-24' : ''}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                        <CardTitle className="text-base sm:text-lg truncate">{product.name}</CardTitle>
                      </div>
                      <CardDescription className="min-h-[40px] text-sm">
                        {product.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-3 sm:space-y-4">
                      <div className="text-center py-3">
                        <div className="text-3xl sm:text-4xl font-bold text-primary mb-1">
                          {product.points.toLocaleString()}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground">stars</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-xl sm:text-2xl font-bold mb-1">
                          ${product.price_usd}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${(product.price_usd / product.points * 100).toFixed(2)} per 100 stars
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => handlePurchase(product)}
                        disabled={processingProductId === product.id}
                        className="w-full rounded-full"
                        size="lg"
                      >
                        {processingProductId === product.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Purchase Now
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="subscription">
            <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
              {subscriptionProducts.map((product) => (
                <Card 
                  key={product.id}
                  className="relative overflow-hidden transition-all hover:shadow-lg border-primary"
                >
                  <CardHeader className={product.badge_text ? 'pt-12' : ''}>
                    {product.badge_text && (
                      <div className="absolute top-3 right-3 z-10">
                        <Badge className="bg-primary text-xs px-2 py-1">{product.badge_text}</Badge>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-5 h-5 text-primary flex-shrink-0" />
                      <CardTitle className="truncate">{product.name}</CardTitle>
                    </div>
                    <CardDescription className="min-h-[40px]">
                      {product.description}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">${product.price_usd}</span>
                        <span className="text-muted-foreground">
                          /{product.billing_interval}
                        </span>
                      </div>
                      <div className="text-primary font-semibold">
                        {product.points.toLocaleString()} stars per {product.billing_interval}
                      </div>
                    </div>

                    <div className="space-y-2 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span>Automatic renewal</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span>Cancel anytime</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span>Best value per star</span>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handlePurchase(product)}
                      disabled={processingProductId === product.id}
                      className="w-full rounded-full"
                      size="lg"
                    >
                      {processingProductId === product.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4 mr-2" />
                          Subscribe Now
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* KTNZ to Stars Exchange Section */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="mt-12 max-w-2xl mx-auto">
            <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
              <CardHeader className="text-center pb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <ArrowRightLeft className="w-6 h-6 text-primary" />
                  <CardTitle className="text-xl">Convert Activity Rewards to Stars!</CardTitle>
                </div>
                <CardDescription>
                  Turn your KTNZ tokens into Stars instantly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">K</span>
                    </div>
                    <div>
                      <p className="font-semibold">Your KTNZ Balance</p>
                      <p className="text-2xl font-bold text-primary">{ktnzBalance.toLocaleString()} KTNZ</p>
                    </div>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-5 h-5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>1 KTNZ = {ktnzToStarsRate} Stars</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="text-center text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    Exchange Rate: <strong>1 KTNZ = {ktnzToStarsRate} Stars</strong>
                  </span>
                </div>
                
                <Dialog open={exchangeDialogOpen} onOpenChange={setExchangeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full rounded-full" size="lg">
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      Exchange Now
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[calc(100%-2rem)] max-w-[380px] sm:max-w-[400px] max-h-fit p-0" hideCloseButton>
                    {/* Gradient Header */}
                    <div className="bg-gradient-to-r from-primary via-orange-500 to-amber-500 py-3 px-4 text-white rounded-t-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1" />
                        <DialogTitle className="text-lg font-bold text-white flex-shrink-0">
                          ✨ Convert to Stars
                        </DialogTitle>
                        <div className="flex-1 flex justify-end">
                          <button 
                            onClick={() => setExchangeDialogOpen(false)}
                            className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                          >
                            <span className="text-white text-sm font-bold">×</span>
                          </button>
                        </div>
                      </div>
                      <DialogDescription className="text-white/80 text-xs text-center mt-1">
                        1 KTNZ = {ktnzToStarsRate} Stars
                      </DialogDescription>
                    </div>
                    
                    <div className="p-4 space-y-4">
                      {/* Balance */}
                      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                        <span className="text-sm text-muted-foreground">Your Balance</span>
                        <span className="text-lg font-bold text-primary">{ktnzBalance.toLocaleString()} KTNZ</span>
                      </div>
                      
                      {/* Input */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Amount to Exchange</label>
                        <Input
                          type="number"
                          placeholder="Enter KTNZ amount"
                          value={exchangeAmount}
                          onChange={(e) => setExchangeAmount(e.target.value)}
                          max={ktnzBalance}
                          min={1}
                          className="text-center text-lg font-semibold h-12"
                        />
                      </div>
                      
                      {/* Result Preview */}
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
                        <p className="text-xs text-muted-foreground mb-1">You will receive</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {parseFloat(exchangeAmount) > 0 
                            ? (parseFloat(exchangeAmount) * ktnzToStarsRate).toLocaleString() 
                            : '0'} ⭐
                        </p>
                      </div>
                      
                      {/* Actions */}
                      <div className="space-y-2 pt-2">
                        <Button
                          onClick={handleExchange}
                          disabled={exchanging || !exchangeAmount || parseFloat(exchangeAmount) <= 0 || parseFloat(exchangeAmount) > ktnzBalance}
                          className="w-full rounded-full h-11 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90"
                        >
                          {exchanging ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Exchanging...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Exchange Now
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setExchangeDialogOpen(false)}
                          className="w-full text-muted-foreground rounded-full"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Why Purchase Stars?</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <Coins className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">Create Content</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Use stars to create posts, wiki entries, and engage with the community
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Zap className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">Boost Posts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Boost your posts to reach more users and increase engagement
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Shield className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">Premium Features</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Access exclusive features and customization options
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </V2Layout>
  );
};

export default Purchase;
