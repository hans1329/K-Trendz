import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Shield, Users, FileText, TrendingUp, Activity, Sparkles, Loader2, Coins, Edit, Plus, Minus, RefreshCw, BadgeCheck, Clock, Music, CheckCircle2, User, Package, DollarSign, Gift, Database, BarChart3, Star, Zap, Mail, Tag, GripVertical, Lock, Trophy, Upload, Settings, Wallet, Wand2, Copy, ExternalLink, ListOrdered, Youtube, RotateCcw, Ban, AlertTriangle, Smartphone, ShoppingBag, Bot, MessageSquare } from "lucide-react";
import { ChallengeManager } from "@/components/admin/ChallengeManager";
import { WikiEntryRoleManager } from "@/components/WikiEntryRoleManager";
import { Progress } from "@/components/ui/progress";
import { EmailTemplateSettings } from "@/components/admin/EmailTemplateSettings";
import { EntryScoreManager } from "@/components/admin/EntryScoreManager";
import { VestingManager } from "@/components/admin/VestingManager";
import { OnchainTransactionsManager } from "@/components/admin/OnchainTransactionsManager";
import { FundIntegrityValidator } from "@/components/admin/FundIntegrityValidator";
import { BotDetector } from "@/components/admin/BotDetector";
import AgentVerificationManager from "@/components/admin/AgentVerificationManager";
import { AdminUserActivity } from "@/components/admin/AdminUserActivity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// IP 위치 정보 팝오버 컴포넌트
const IpLocationPopover = ({ ip, lastSeenAt }: { ip: string; lastSeenAt?: string }) => {
  const [locationData, setLocationData] = useState<{
    country?: string;
    regionName?: string;
    city?: string;
    isp?: string;
    loading?: boolean;
    error?: string;
  } | null>(null);

  const fetchLocation = async () => {
    if (locationData && !locationData.loading) return; // 이미 로드됨
    
    setLocationData({ loading: true });
    try {
      // ipapi.co - HTTPS 지원, 무료 1000회/일
      const response = await fetch(`https://ipapi.co/${ip}/json/`);
      const data = await response.json();
      
      if (data.error) {
        setLocationData({ error: data.reason || 'Failed to fetch location' });
      } else {
        setLocationData({
          country: data.country_name,
          regionName: data.region,
          city: data.city,
          isp: data.org,
        });
      }
    } catch (error) {
      setLocationData({ error: 'Network error' });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={fetchLocation}
          className="hover:text-primary hover:underline cursor-pointer text-left"
        >
          {ip}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" side="top">
        <div className="space-y-2">
          <div className="font-mono text-sm font-medium">{ip}</div>
          
          {lastSeenAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(lastSeenAt).toLocaleString()}
            </div>
          )}
          
          <Separator className="my-2" />
          
          {locationData?.loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading location...
            </div>
          ) : locationData?.error ? (
            <div className="text-xs text-destructive">
              {locationData.error}
            </div>
          ) : locationData ? (
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16">Location:</span>
                <span>{[locationData.city, locationData.regionName, locationData.country].filter(Boolean).join(', ')}</span>
              </div>
              {locationData.isp && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-16">ISP:</span>
                  <span className="truncate">{locationData.isp}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Click to load location data
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Mini App Home Preview Component
const MiniAppHomePreview = () => {
  const [showPreview, setShowPreview] = useState(false);

  const copyMiniAppUrl = () => {
    navigator.clipboard.writeText('https://farcaster.xyz/miniapps/vYZgtQLLS1q1/k-trendz');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Mini App Home Preview
        </CardTitle>
        <CardDescription>
          Preview the Mini App landing page as it appears in Warpcast
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowPreview(true)}
            className="gap-2"
          >
            <Smartphone className="h-4 w-4" />
            Open Preview
          </Button>
          <Button
            variant="outline"
            onClick={copyMiniAppUrl}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy Mini App URL
          </Button>
          <a
            href="https://farcaster.xyz/miniapps/vYZgtQLLS1q1/k-trendz"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="icon">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Mini App Directory URL</div>
          <code className="text-xs break-all">
            https://farcaster.xyz/miniapps/vYZgtQLLS1q1/k-trendz
          </code>
        </div>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-[420px] h-[85vh] p-0 overflow-hidden">
            <DialogHeader className="p-4 pb-2">
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Mini App Home Preview
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 px-4 pb-4">
              <div className="w-full h-full rounded-xl overflow-hidden border-4 border-muted shadow-lg">
                <iframe
                  src="/miniapp"
                  className="w-full h-full"
                  style={{ minHeight: 'calc(85vh - 80px)' }}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

// Mini App Shop Preview Component
const MiniAppShopPreview = () => {
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  
  // 캐스트에서 "Mini App"으로 인식되려면 miniapps 딥링크/warpcast://miniapp 형식을 사용해야 한다.
  // homeUrl이 https://k-trendz.com/miniapp 이므로, shop으로의 내부 path는 "/shop"이 맞다.
  const SHOP_DEEPLINK = 'https://farcaster.xyz/miniapps/vYZgtQLLS1q1/k-trendz/shop';
  const SHOP_WARPCAST_LINK = 'warpcast://miniapp?appId=vYZgtQLLS1q1&path=/shop';

  const copyDeeplink = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: `${label} copied!` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5" />
          Mini App Shop Preview
        </CardTitle>
        <CardDescription>
          Preview the Lightstick Shop as it appears in Warpcast
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={() => setShowPreview(true)}
            className="gap-2"
          >
            <ShoppingBag className="h-4 w-4" />
            Open Preview
          </Button>
          <Button
            variant="outline"
            onClick={() => copyDeeplink(SHOP_DEEPLINK, 'Shop Deeplink')}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy Deeplink
          </Button>
          <a
            href={SHOP_DEEPLINK}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="icon">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>

        {/* Deeplinks */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Farcaster Deeplink (Web)</div>
            <div className="flex items-center gap-2">
              <code className="text-xs break-all flex-1 bg-background rounded px-2 py-1">
                {SHOP_DEEPLINK}
              </code>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => copyDeeplink(SHOP_DEEPLINK, 'Deeplink')}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Warpcast Protocol (App)</div>
            <div className="flex items-center gap-2">
              <code className="text-xs break-all flex-1 bg-background rounded px-2 py-1">
                {SHOP_WARPCAST_LINK}
              </code>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => copyDeeplink(SHOP_WARPCAST_LINK, 'Warpcast Link')}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Key Features</div>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Direct purchase with Base Wallet (USDC)</li>
            <li>• Tokens minted directly to user's wallet</li>
            <li>• Real-time bonding curve prices</li>
            <li>• 5% slippage protection</li>
          </ul>
        </div>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-[420px] h-[85vh] p-0 overflow-hidden">
            <DialogHeader className="p-4 pb-2">
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Lightstick Shop Preview
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 px-4 pb-4">
              <div className="w-full h-full rounded-xl overflow-hidden border-4 border-muted shadow-lg">
                <iframe
                  src="/miniapp/shop"
                  className="w-full h-full"
                  style={{ minHeight: 'calc(85vh - 80px)' }}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

// IP 가입 제한 토글 컴포넌트
const IpSignupLimitToggle = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSetting = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'ip_signup_limit_enabled')
        .maybeSingle();
      
      if (data?.setting_value) {
        setIsEnabled((data.setting_value as any)?.enabled !== false);
      }
      setLoading(false);
    };
    fetchSetting();
  }, []);

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    setIsEnabled(checked);

    const { data: existing } = await supabase
      .from('system_settings')
      .select('id')
      .eq('setting_key', 'ip_signup_limit_enabled')
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from('system_settings')
        .update({ setting_value: { enabled: checked }, updated_at: new Date().toISOString() })
        .eq('setting_key', 'ip_signup_limit_enabled'));
    } else {
      ({ error } = await supabase
        .from('system_settings')
        .insert({ setting_key: 'ip_signup_limit_enabled', setting_value: { enabled: checked } }));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsEnabled(!checked);
    } else {
      toast({ title: checked ? "IP Limit Enabled" : "IP Limit Disabled", description: checked ? "Max 3 accounts per IP (24h) is now active" : "IP-based signup restriction is now off" });
    }
    setSaving(false);
  };

  if (loading) return null;

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4" />
            IP Signup Limit
          </h3>
          <p className="text-sm text-muted-foreground">
            Block more than 3 accounts per device/IP within 24 hours
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          <Switch checked={isEnabled} onCheckedChange={handleToggle} disabled={saving} />
        </div>
      </div>
    </Card>
  );
};

// Agent Chat Settings Panel
const AgentChatSettingsPanel = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(10);
  const [generateCost, setGenerateCost] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('agent_chat_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setIsEnabled(data.is_enabled);
      setIntervalMinutes(data.interval_minutes);
      setSettingsId(data.id);
    }

    // 수동 생성 Star 비용 조회
    const { data: costData } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'agent_generate_cost')
      .maybeSingle();
    if (costData?.setting_value) {
      setGenerateCost((costData.setting_value as any)?.cost ?? 3);
    }

    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    if (!settingsId) return;
    setSaving(true);
    const { error } = await supabase
      .from('agent_chat_settings')
      .update({
        is_enabled: isEnabled,
        interval_minutes: intervalMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settingsId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // 수동 생성 Star 비용도 저장
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('setting_key', 'agent_generate_cost')
        .maybeSingle();
      if (existing) {
        await supabase
          .from('system_settings')
          .update({ setting_value: { cost: generateCost }, updated_at: new Date().toISOString() })
          .eq('setting_key', 'agent_generate_cost');
      } else {
        await supabase
          .from('system_settings')
          .insert({ setting_key: 'agent_generate_cost', setting_value: { cost: generateCost } });
      }
      // point_rules도 동기화
      await supabase
        .from('point_rules')
        .update({ points: -generateCost })
        .eq('action_type', 'agent_generate');
      toast({ title: "Settings Saved", description: `Agent chat ${isEnabled ? 'enabled' : 'disabled'}, interval: ${intervalMinutes}min, generate cost: ${generateCost}⭐` });
    }
    setSaving(false);
  };

  const handleGenerateNow = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-agent-chat');
      if (error) throw error;
      toast({
        title: "Chat Generated",
        description: `${data?.messages_generated || 0} messages created (topic: ${data?.topic || 'unknown'})`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setGenerating(false);
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Agent Chat Settings
          </CardTitle>
          <CardDescription>
            Control the AI agent chat auto-generation schedule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* On/Off Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Auto Generation</Label>
              <p className="text-sm text-muted-foreground">
                Periodically generate agent conversations
              </p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
            />
          </div>

          <Separator />

          {/* Interval Selector */}
          <div className="space-y-2">
            <Label>Generation Interval</Label>
            <Select
              value={String(intervalMinutes)}
              onValueChange={(v) => setIntervalMinutes(Number(v))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Every 5 minutes</SelectItem>
                <SelectItem value="10">Every 10 minutes</SelectItem>
                <SelectItem value="15">Every 15 minutes</SelectItem>
                <SelectItem value="30">Every 30 minutes</SelectItem>
                <SelectItem value="60">Every 1 hour</SelectItem>
                <SelectItem value="120">Every 2 hours</SelectItem>
                <SelectItem value="180">Every 3 hours</SelectItem>
                <SelectItem value="360">Every 6 hours</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often the system generates new agent conversations
            </p>
          </div>

          {/* 수동 생성 Star 비용 */}
          <div className="space-y-2">
            <Label>Manual Generate Cost (Stars ⭐)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={generateCost}
              onChange={(e) => setGenerateCost(Number(e.target.value))}
              className="w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Stars deducted when a user manually generates an agent message
            </p>
          </div>

          <Separator />

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Settings
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateNow}
              disabled={generating}
              className="rounded-full"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              Generate Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={isEnabled ? "default" : "secondary"}>
                {isEnabled ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Interval</p>
              <p className="font-medium">{intervalMinutes} minutes</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Challenge Frames List Component with Full Preview
const ChallengeFramesList = () => {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [previewChallengeId, setPreviewChallengeId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchChallenges = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('challenges')
      .select('id, question, status, image_url, start_time, end_time, total_prize_usdc, options')
      .in('status', ['active', 'test', 'ended'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Failed to fetch challenges:', error);
    } else {
      setChallenges(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  const getFrameBaseUrl = (challengeId: string) => {
    // Farcaster Mini App v2 embed - Edge Function이 fc:frame JSON 반환
    return `https://k-trendz.com/api/farcaster-challenge-frame/${challengeId}`;
  };

  const getMiniAppDeepLink = (challengeId: string) => {
    // Warpcast 작성창(Composer)에서 가장 안정적으로 Mini App을 여는 링크는 farcaster.xyz의 miniapps 딥링크다.
    // (도메인에서 직접 frame 메타를 긁는 방식은 캐시/프리뷰 환경에 따라 일반 OG 카드로 떨어질 때가 있음)
    return `https://farcaster.xyz/miniapps/vYZgtQLLS1q1/k-trendz/farcaster-app/${challengeId}`;
  };

  const copyFrameUrl = (challengeId: string) => {
    const url = getFrameBaseUrl(challengeId);
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied!",
      description: "Frame URL copied to clipboard",
    });
  };

  const copyCastTemplate = (challenge: any) => {
    // Cast 본문에 넣을 링크는 farcaster.xyz miniapps 딥링크로 고정 (미리보기/런치 안정성)
    const miniAppUrl = getMiniAppDeepLink(challenge.id);

    const prizeText = challenge.total_prize_usdc > 0 ? `$${challenge.total_prize_usdc} USDC` : 'TBD';
    const endTime = new Date(challenge.end_time);
    const endTimeStr = endTime.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });

    const template = `🎤 K-Trendz Challenge!

Q: ${challenge.question}
💰 Prize: ${prizeText}
⏰ Ends: ${endTimeStr}

👇 Play now in the K-Trendz Mini App!

${miniAppUrl}`;

    navigator.clipboard.writeText(template);
    toast({
      title: "Cast Template Copied!",
      description: "Paste directly into Warpcast",
    });
  };

  const handleGenerateFrameImage = async (challengeId: string) => {
    setGeneratingImage(challengeId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-frame-image', {
        body: { challengeId }
      });

      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: "Frame Image Generated",
          description: "The AI-generated Frame image has been saved.",
        });
        fetchChallenges(); // Refresh to show new image
      } else {
        throw new Error(data?.error || 'Failed to generate image');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingImage(null);
    }
  };

  const handleResetFrameImage = async (challengeId: string) => {
    const defaultImageUrl = 'https://k-trendz.com/images/challenges-og.jpg';
    try {
      const { error } = await supabase
        .from('challenges')
        .update({ image_url: defaultImageUrl })
        .eq('id', challengeId);

      if (error) throw error;
      
      toast({
        title: "Image Reset",
        description: "Frame image has been reset to default.",
      });
      fetchChallenges();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Get challenge type badge
  const getChallengeTypeBadge = (challenge: any) => {
    const options = challenge.options;
    if (options?.type === 'multiple_choice') {
      return <Badge variant="outline" className="text-xs"><ListOrdered className="h-3 w-3 mr-1" /> Multiple</Badge>;
    }
    if (options?.type === 'youtube') {
      return <Badge variant="outline" className="text-xs border-red-500/50 text-red-600"><Youtube className="h-3 w-3 mr-1" /> YouTube</Badge>;
    }
    return <Badge variant="outline" className="text-xs"><FileText className="h-3 w-3 mr-1" /> Open</Badge>;
  };

  // Get option labels for multiple choice
  const getOptionLabels = (challenge: any): string[] => {
    // supabase/functions/farcaster-challenge-frame 의 옵션 파싱 로직과 최대한 동일하게 맞춘다.
    const raw = challenge.options;
    if (!raw) return [];

    // 1) 이미 배열인 경우 (예: ["Dynamite", "Butter", ...])
    if (Array.isArray(raw)) {
      return raw.map((v) => String(v)).filter(Boolean).slice(0, 4);
    }

    // 2) 문자열(JSON)인 경우
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return getOptionLabels({ options: parsed });
      } catch {
        return [];
      }
    }

    // 3) 객체 구조인 경우: { items: [{ text, wiki_entry_title, ... }, ...] }
    if (typeof raw === 'object') {
      const maybeItems = (raw as any).items;
      if (Array.isArray(maybeItems)) {
        return maybeItems
          .map((item: any) => item?.wiki_entry_title ?? item?.text ?? item?.label ?? '')
          .map((v: any) => String(v))
          .filter(Boolean)
          .slice(0, 4);
      }

      const maybeOptions = (raw as any).options;
      if (Array.isArray(maybeOptions)) {
        return maybeOptions.map((v: any) => String(v)).filter(Boolean).slice(0, 4);
      }
    }

    return [];
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (challenges.length === 0) {
    return <p className="text-sm text-muted-foreground">No challenges available</p>;
  }

  return (
    <div className="space-y-4">
      {challenges.map((challenge) => {
        const optionLabels = getOptionLabels(challenge);
        const prizeText = challenge.total_prize_usdc > 0 ? `$${challenge.total_prize_usdc} USDC` : 'TBD';
        const frameUrl = getFrameBaseUrl(challenge.id);
        const isMultipleChoice = optionLabels.length > 0;
        
        // 이미지 우선순위: 1. image_url (비YouTube), 2. YouTube 썸네일, 3. 기본 이미지
        const defaultImageUrl = 'https://k-trendz.com/images/challenges-og.jpg';
        let displayImageUrl = challenge.image_url;
        
        // YouTube URL에서 video ID 추출하는 헬퍼
        const extractYouTubeVideoId = (url: string): string | null => {
          if (!url) return null;
          // youtube_video_id가 직접 전달된 경우 (11자 ID)
          if (url.length === 11 && !url.includes('/') && !url.includes('.')) return url;
          // youtu.be/VIDEO_ID 형식
          const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
          if (shortMatch) return shortMatch[1];
          // youtube.com/watch?v=VIDEO_ID 형식
          const longMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          if (longMatch) return longMatch[1];
          // youtube.com/embed/VIDEO_ID 형식
          const embedMatch = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
          if (embedMatch) return embedMatch[1];
          return null;
        };
        
        const options = challenge.options as any;
        // YouTube 챌린지인 경우 썸네일 추출
        if (options?.type === 'youtube') {
          const videoId = options?.youtube_video_id || extractYouTubeVideoId(options?.youtube_url);
          if (videoId) {
            displayImageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
          }
        }
        // image_url이 YouTube URL인 경우에도 썸네일로 변환
        if (displayImageUrl && (displayImageUrl.includes('youtube.com') || displayImageUrl.includes('youtu.be'))) {
          const videoId = extractYouTubeVideoId(displayImageUrl);
          if (videoId) {
            displayImageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
          }
        }
        if (!displayImageUrl) {
          displayImageUrl = defaultImageUrl;
        }

        return (
          <Card key={challenge.id} className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {/* Frame Image Preview - Left Side */}
              <div className="w-full md:w-80 shrink-0 bg-muted/50 p-4 flex flex-col items-center justify-center">
                <div className="relative w-full">
                  <img 
                    src={displayImageUrl} 
                    alt="Frame preview" 
                    className="w-full aspect-[1.91/1] object-cover rounded-lg border"
                  />
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs bg-black/60 hover:bg-black/80 text-white"
                      onClick={() => handleResetFrameImage(challenge.id)}
                      title="Reset to default"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs bg-black/60 hover:bg-black/80 text-white"
                      onClick={() => handleGenerateFrameImage(challenge.id)}
                      disabled={generatingImage === challenge.id}
                    >
                      {generatingImage === challenge.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Wand2 className="h-3 w-3 mr-1" />
                      )}
                      AI
                    </Button>
                  </div>
                </div>
                
                {/* Simulated Buttons Preview */}
                {isMultipleChoice && (
                  <div className="w-full mt-2 grid grid-cols-2 gap-1">
                    {optionLabels.map((label, idx) => (
                      <div 
                        key={idx}
                        className="text-xs bg-muted border rounded px-2 py-1 text-center truncate"
                        title={`${idx + 1}: ${label}`}
                      >
                        {idx + 1}: {label.substring(0, 20)}{label.length > 20 ? '…' : ''}
                      </div>
                    ))}
                  </div>
                )}

                {!isMultipleChoice && (
                  <div className="w-full mt-2">
                    <div className="text-xs bg-muted border rounded px-2 py-1 text-center text-muted-foreground">
                      📝 Text input + Submit button
                    </div>
                  </div>
                )}
              </div>

              {/* Challenge Details - Right Side */}
              <div className="flex-1 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getChallengeTypeBadge(challenge)}
                      <Badge variant={challenge.status === 'test' ? 'secondary' : challenge.status === 'active' ? 'default' : 'outline'}>
                        {challenge.status === 'test' ? '🧪 Test' : challenge.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <DollarSign className="h-3 w-3 mr-0.5" />
                        {prizeText}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-sm mb-2">{challenge.question}</h3>
                    
                    {/* Options Display */}
                    {isMultipleChoice && (
                      <div className="space-y-1 mb-3">
                        <p className="text-xs text-muted-foreground font-medium">Options:</p>
                        <div className="flex flex-wrap gap-1">
                          {optionLabels.map((label, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs font-normal">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Frame URL */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <Input 
                        value={frameUrl} 
                        readOnly 
                        className="text-xs h-8 font-mono bg-muted flex-1 min-w-[200px]"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={() => copyFrameUrl(challenge.id)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        URL
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={() => copyCastTemplate(challenge)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Cast Template
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0"
                        asChild
                      >
                        <a 
                          href={frameUrl}
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View HTML
                        </a>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 shrink-0 bg-primary/10 hover:bg-primary/20 text-primary"
                        onClick={() => setPreviewChallengeId(challenge.id)}
                      >
                        <Smartphone className="h-3 w-3 mr-1" />
                        Mini App
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}

      {/* Mini App Preview Dialog */}
      <Dialog open={!!previewChallengeId} onOpenChange={(open) => !open && setPreviewChallengeId(null)}>
        <DialogContent className="max-w-[420px] h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Mini App Preview
            </DialogTitle>
            <DialogDescription className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  const iframe = document.querySelector('iframe[data-preview-iframe]') as HTMLIFrameElement;
                  if (iframe && previewChallengeId) {
                    iframe.src = `/farcaster-app/${previewChallengeId}`;
                  }
                }}
              >
                Quiz View
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-green-500/10 text-green-600 hover:bg-green-500/20"
                onClick={() => {
                  const iframe = document.querySelector('iframe[data-preview-iframe]') as HTMLIFrameElement;
                  if (iframe && previewChallengeId) {
                    iframe.src = `/farcaster-app/${previewChallengeId}?preview=success`;
                  }
                }}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Success Screen
              </Button>
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 px-4 pb-4">
            <div className="w-full h-full rounded-xl overflow-hidden border-4 border-muted shadow-lg">
              <iframe
                data-preview-iframe
                src={previewChallengeId ? `/farcaster-app/${previewChallengeId}` : ''}
                className="w-full h-full"
                style={{ minHeight: 'calc(85vh - 80px)' }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Admin = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isModerator, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const hasAccess = isAdmin || isModerator;
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    totalVotes: 0,
    recentUsers: 0,
    onchainDau: 0,
    onchainMau: 0,
  });
  const [autoGenCount, setAutoGenCount] = useState("3");
  const [autoGenCategory, setAutoGenCategory] = useState("Entertainment-News");
  const [autoGenKeyword, setAutoGenKeyword] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [pointRules, setPointRules] = useState<any[]>([]);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editPoints, setEditPoints] = useState<Record<string, number>>({});
  
  // Levels management for token rewards
  const [levels, setLevels] = useState<any[]>([]);
  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [editTokenReward, setEditTokenReward] = useState<Record<number, number>>({});
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [manualPoints, setManualPoints] = useState<string>("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || "dashboard");

  // URL(tab)과 Admin 탭 상태를 양방향으로 동기화
  useEffect(() => {
    const tab = searchParams.get('tab') || "dashboard";
    setActiveTab((prev) => (prev === tab ? prev : tab));
  }, [searchParams]);

  useEffect(() => {
    const current = searchParams.get('tab') || "dashboard";
    if (current === activeTab) return;

    const next = new URLSearchParams(searchParams);
    if (activeTab === "dashboard") {
      next.delete("tab");
    } else {
      next.set("tab", activeTab);
    }

    // 탭 전환 시 히스토리가 과도하게 쌓이지 않도록 replace 사용
    setSearchParams(next, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  const [usersWithRoles, setUsersWithRoles] = useState<any[]>([]);
  
  // Quick point adjustment dialog
  const [showQuickPointDialog, setShowQuickPointDialog] = useState(false);
  const [selectedUserForPoints, setSelectedUserForPoints] = useState<any>(null);
  const [quickPointAmount, setQuickPointAmount] = useState("");
  const [isUpdatingSitemap, setIsUpdatingSitemap] = useState(false);
  const [communities, setCommunities] = useState<any[]>([]);
  const [pendingPosts, setPendingPosts] = useState<any[]>([]);
  const [bulkGroupNames, setBulkGroupNames] = useState("");
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [isSuggestingGroups, setIsSuggestingGroups] = useState(false);
  const [bulkActorNames, setBulkActorNames] = useState("");
  const [isSuggestingActors, setIsSuggestingActors] = useState(false);
  const [isBulkCreatingActors, setIsBulkCreatingActors] = useState(false);
  const [creationProgress, setCreationProgress] = useState({
    total: 0,
    processed: 0,
    created: 0,
    skipped: 0,
    currentGroup: "",
    createdGroups: [] as string[],
  });
  const [actorCreationProgress, setActorCreationProgress] = useState({
    total: 0,
    processed: 0,
    created: 0,
    skipped: 0,
    currentActor: "",
    createdActors: [] as string[],
  });
  const [isEvaluatingAIData, setIsEvaluatingAIData] = useState(false);
  const [aiDataResults, setAiDataResults] = useState<any>(null);
  const [aiContributions, setAiContributions] = useState<any[]>([]);
  const [aiContributionsLoading, setAiContributionsLoading] = useState(false);
  
  // Blocked email domains state
  const [blockedDomains, setBlockedDomains] = useState<any[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [newDomainReason, setNewDomainReason] = useState('');
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [wikiStats, setWikiStats] = useState({
    totalArtists: 0,
    totalMembers: 0,
    totalActors: 0,
    filledArtists: 0,
    filledMembers: 0,
    filledActors: 0,
    withSocialLinks: 0,
    withMusicCharts: 0,
  });
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  const [imageFetchProgress, setImageFetchProgress] = useState({
    total: 0,
    updated: 0,
    failed: 0,
  });
  const [isMigratingBirthdays, setIsMigratingBirthdays] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({
    processed: 0,
    updated: 0,
  });
  
  // Wiki Data Calibration states
  const [autoFillProgress, setAutoFillProgress] = useState({ 
    current: 0, 
    total: 0, 
    isProcessing: false, 
    type: '' as 'artist' | 'member' | 'actor' | '',
    shouldStop: false
  });
  const [autoFillTargets, setAutoFillTargets] = useState({
    artist: 2000,
    member: 5000,
    actor: 1000
  });
  const [wikiContentProgress, setWikiContentProgress] = useState({ 
    current: 0, 
    total: 0, 
    isProcessing: false,
    shouldStop: false,
    currentEntry: ''
  });
  const [socialLinksProgress, setSocialLinksProgress] = useState({ 
    current: 0, 
    total: 0, 
    isProcessing: false,
    shouldStop: false
  });
  const [musicChartsProgress, setMusicChartsProgress] = useState({ 
    current: 0, 
    total: 0, 
    isProcessing: false,
    shouldStop: false
  });
  const [deduplicateProgress, setDeduplicateProgress] = useState({
    type: '' as 'artist' | 'member' | 'actor' | '',
    isProcessing: false,
    total: 0,
    removed: 0,
  });

  // Duplicate entries management
  const [duplicates, setDuplicates] = useState<Record<string, any[]>>({});
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);

  // Track last updated counts for display in badges
  const [lastUpdated, setLastUpdated] = useState({
    content: 0,
    socialLinks: 0,
    musicCharts: 0,
  });

  // Use refs to track stop flags for better closure handling
  const autoFillStopRef = useRef(false);
  const wikiContentStopRef = useRef(false);
  const socialLinksStopRef = useRef(false);
  const musicChartsStopRef = useRef(false);
  const deduplicateStopRef = useRef(false);
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const monitorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const personDetailsStopRef = useRef(false);

  // Point Products Management states
  const [pointProducts, setPointProducts] = useState<any[]>([]);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    points: 0,
    price_usd: 0,
    product_type: 'one_time',
    billing_interval: '',
    badge_text: '',
    stripe_price_id: '',
    display_order: 0,
  });
  const [editProductValues, setEditProductValues] = useState<Record<string, any>>({});

  // Gift Badges Management states
  const [giftBadges, setGiftBadges] = useState<any[]>([]);
  const [editingBadge, setEditingBadge] = useState<string | null>(null);
  const [badgeForm, setBadgeForm] = useState({
    name: '',
    icon: '',
    description: '',
    usd_price: 10,
    point_price: 50,
    color: '#FF4500',
    display_order: 0,
    stripe_price_id: '',
  });
  
  // Schema Type Relationships
  const [schemaRelationships, setSchemaRelationships] = useState<any[]>([]);
  const [newRelationship, setNewRelationship] = useState({
    parent_schema_type: '',
    child_schema_type: ''
  });
  const [editBadgeValues, setEditBadgeValues] = useState<Record<string, any>>({});

  // Wiki Entries Management states
  const [wikiEntries, setWikiEntries] = useState<any[]>([]);
  const [wikiEntriesLoading, setWikiEntriesLoading] = useState(false);
  const [wikiEntryFilter, setWikiEntryFilter] = useState<string>('all');
  const [isMigratingMetadata, setIsMigratingMetadata] = useState(false);
  const [metadataMigrationProgress, setMetadataMigrationProgress] = useState({
    processed: 0,
    updated: 0,
    total: 0,
    remaining: 0,
    currentTitle: '',
    currentBatch: 0
  });
  const [migrationResults, setMigrationResults] = useState<{
    filled: Array<{ title: string; fields: string[] }>;
    empty: Array<{ title: string }>;
  } | null>(null);
  const [dbStats, setDbStats] = useState({
    totalEntries: 0,
    migratedEntries: 0,
    pendingEntries: 0,
    byType: {} as Record<string, { total: number; migrated: number }>,
    byField: {} as Record<string, { filled: number; total: number }>
  });
  const [isAutoFillingDetails, setIsAutoFillingDetails] = useState(false);
  const [personDetailsProgress, setPersonDetailsProgress] = useState({
    total: 0,
    processed: 0,
    updated: 0,
    failed: 0,
    batches: 0,
    currentEntry: '',
    details: [] as Array<{ title: string; status: string; details?: any }>
  });
  const [showPersonDetailsDialog, setShowPersonDetailsDialog] = useState(false);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [wikiCreationMinLevel, setWikiCreationMinLevel] = useState<number>(1);
  const [isUpdatingMinLevel, setIsUpdatingMinLevel] = useState(false);
  
  // Pending AI Content states
  const [pendingAiEntries, setPendingAiEntries] = useState<any[]>([]);
  const [loadingPendingAi, setLoadingPendingAi] = useState(false);
  const [selectedPendingEntries, setSelectedPendingEntries] = useState<Set<string>>(new Set());
  const [totalPendingAiCount, setTotalPendingAiCount] = useState<number>(0);

  // K-pop title entries states
  const [kpopTitleEntries, setKpopTitleEntries] = useState<any[]>([]);
  const [loadingKpopTitles, setLoadingKpopTitles] = useState(false);
  const [selectedKpopEntries, setSelectedKpopEntries] = useState<Set<string>>(new Set());
  const [totalKpopTitleCount, setTotalKpopTitleCount] = useState<number>(0);

  // Legacy Fanz Token cleanup state
  const [isCleaningLegacyTokens, setIsCleaningLegacyTokens] = useState(false);
  const [isDeletingAllTokens, setIsDeletingAllTokens] = useState(false);
  
  // Legacy ETH contract state
  const [legacyContractBalance, setLegacyContractBalance] = useState<{
    balanceEth: string;
    balanceUsd: string;
    contractAddress: string;
    canWithdraw: boolean;
    withdrawMessage: string;
  } | null>(null);
  const [isCheckingLegacyContract, setIsCheckingLegacyContract] = useState(false);

  // Wiki Categories management state
  const [wikiCategories, setWikiCategories] = useState<any[]>([]);
  const [newCategory, setNewCategory] = useState({ value: '', label: '' });
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryValues, setEditCategoryValues] = useState<Record<string, any>>({});
  
  // User search state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showLightstickHoldersOnly, setShowLightstickHoldersOnly] = useState(false);
  const [lightstickHolderIds, setLightstickHolderIds] = useState<Set<string>>(new Set());
  const [loadingLightstickHolders, setLoadingLightstickHolders] = useState(false);

  // Owner Applications state
  const [ownerApplications, setOwnerApplications] = useState<any[]>([]);
  const [approvedApplications, setApprovedApplications] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  
  // Master Applications state (from pitch-master page)
  const [masterApplications, setMasterApplications] = useState<any[]>([]);
  const [loadingMasterApplications, setLoadingMasterApplications] = useState(false);
  
  // Banners Management state
  const [rankingsBannerUrl, setRankingsBannerUrl] = useState('');
  const [rankingsBannerLink, setRankingsBannerLink] = useState('/challenges');
  const [rankingsBannerLinkEnabled, setRankingsBannerLinkEnabled] = useState(true);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isSavingBanner, setIsSavingBanner] = useState(false);
  
  // Password Reset state
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  // KTNZ to Stars exchange rate state
  const [ktnzToStarsRate, setKtnzToStarsRate] = useState<number>(10);
  const [editingKtnzRate, setEditingKtnzRate] = useState(false);
  const [tempKtnzRate, setTempKtnzRate] = useState<number>(10);
  const [isSavingKtnzRate, setIsSavingKtnzRate] = useState(false);
  
  // UI Settings state
  const [showWalletMenu, setShowWalletMenu] = useState<boolean>(false);
  const [isSavingWalletMenu, setIsSavingWalletMenu] = useState(false);
  
  const fetchDbStats = async () => {
    try {
      // 전체 통계
      const { count: totalCount } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .in('schema_type', ['member', 'actor', 'artist']);
      
      // 마이그레이션 완료된 항목 (적어도 하나의 필드라도 채워진 경우)
      const { data: allEntries } = await supabase
        .from('wiki_entries')
        .select('id, real_name, birth_date, gender, nationality, blood_type, height, weight, schema_type')
        .in('schema_type', ['member', 'actor', 'artist']);
      
      const migratedCount = allEntries?.filter(entry => 
        entry.real_name !== null ||
        entry.birth_date !== null ||
        entry.gender !== null ||
        entry.nationality !== null ||
        entry.blood_type !== null ||
        entry.height !== null ||
        entry.weight !== null
      ).length || 0;
      
      // 타입별 통계
      const types = ['member', 'actor', 'artist'];
      const byType: Record<string, { total: number; migrated: number }> = {};
      
      for (const type of types) {
        const { count: typeTotal } = await supabase
          .from('wiki_entries')
          .select('*', { count: 'exact', head: true })
          .eq('schema_type', type as any);
        
        const { data: typeEntries } = await supabase
          .from('wiki_entries')
          .select('id, real_name, birth_date, gender, nationality, blood_type, height, weight')
          .eq('schema_type', type as any);
        
        const typeMigratedCount = typeEntries?.filter(entry => 
          entry.real_name !== null ||
          entry.birth_date !== null ||
          entry.gender !== null ||
          entry.nationality !== null ||
          entry.blood_type !== null ||
          entry.height !== null ||
          entry.weight !== null
        ).length || 0;
        
        byType[type] = {
          total: typeTotal || 0,
          migrated: typeMigratedCount
        };
      }
      
      // 필드별 통계 - 데이터베이스에서 직접 COUNT (정확한 집계)
      const byField: Record<string, { filled: number; total: number }> = {};
      
      // height: 숫자 타입, 0보다 큰 값만
      const { count: heightCount } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .in('schema_type', ['member', 'actor', 'artist'])
        .not('height', 'is', null)
        .gt('height', 0);
      
      console.log('📊 Valid height count:', heightCount);
      byField['height'] = { filled: heightCount || 0, total: totalCount || 0 };
      
      // weight: 숫자 타입, 0보다 큰 값만
      const { count: weightCount } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .in('schema_type', ['member', 'actor', 'artist'])
        .not('weight', 'is', null)
        .gt('weight', 0);
      
      console.log('📊 Valid weight count:', weightCount);
      byField['weight'] = { filled: weightCount || 0, total: totalCount || 0 };
      
      // birth_date: null이 아닌 날짜만
      const { count: birthDateCount } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .in('schema_type', ['member', 'actor', 'artist'])
        .not('birth_date', 'is', null);
      
      console.log('📊 Valid birth_date count:', birthDateCount);
      byField['birth_date'] = { filled: birthDateCount || 0, total: totalCount || 0 };
      
      // 문자열 필드들: RPC로 직접 카운트 (무효한 값 제외)
      // real_name
      const { count: realNameCount } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .in('schema_type', ['member', 'actor', 'artist'])
        .not('real_name', 'is', null)
        .neq('real_name', '')
        .not('real_name', 'ilike', 'not found')
        .not('real_name', 'ilike', 'n/a')
        .not('real_name', 'ilike', 'null')
        .not('real_name', 'ilike', 'unknown');
      
      console.log('📊 Valid real_name count:', realNameCount);
      byField['real_name'] = { filled: realNameCount || 0, total: totalCount || 0 };
      
      // gender
      const { count: genderCount } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .in('schema_type', ['member', 'actor', 'artist'])
        .not('gender', 'is', null)
        .neq('gender', '')
        .not('gender', 'ilike', 'not found')
        .not('gender', 'ilike', 'n/a')
        .not('gender', 'ilike', 'null')
        .not('gender', 'ilike', 'unknown');
      
      console.log('📊 Valid gender count:', genderCount);
      byField['gender'] = { filled: genderCount || 0, total: totalCount || 0 };
      
      // nationality
      const { count: nationalityCount } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .in('schema_type', ['member', 'actor', 'artist'])
        .not('nationality', 'is', null)
        .neq('nationality', '')
        .not('nationality', 'ilike', 'not found')
        .not('nationality', 'ilike', 'n/a')
        .not('nationality', 'ilike', 'null')
        .not('nationality', 'ilike', 'unknown');
      
      console.log('📊 Valid nationality count:', nationalityCount);
      byField['nationality'] = { filled: nationalityCount || 0, total: totalCount || 0 };
      
      // blood_type
      const { count: bloodTypeCount } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .in('schema_type', ['member', 'actor', 'artist'])
        .not('blood_type', 'is', null)
        .neq('blood_type', '')
        .not('blood_type', 'ilike', 'not found')
        .not('blood_type', 'ilike', 'n/a')
        .not('blood_type', 'ilike', 'null')
        .not('blood_type', 'ilike', 'unknown');
      
      console.log('📊 Valid blood_type count:', bloodTypeCount);
      byField['blood_type'] = { filled: bloodTypeCount || 0, total: totalCount || 0 };
      
      console.log('📊 Final byField stats:', byField);
      
      setDbStats({
        totalEntries: totalCount || 0,
        migratedEntries: migratedCount,
        pendingEntries: (totalCount || 0) - migratedCount,
        byType,
        byField
      });
      
      toast({
        title: "Statistics Updated",
        description: "Database statistics refreshed successfully.",
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: "Error",
        description: "Failed to fetch database statistics.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!authLoading && !loading) {
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please login to access admin panel.",
          variant: "destructive",
        });
        navigate("/auth");
      } else if (!hasAccess) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        });
        navigate("/");
      }
    }
  }, [user, hasAccess, authLoading, loading, navigate, toast]);

  useEffect(() => {
    if (hasAccess && user) {
      // 병렬로 실행하여 성능 개선
      Promise.all([
        fetchData(),
        fetchWithdrawalRequests(),
        fetchWikiCreationMinLevel(),
        fetchAiContributions(),
        fetchWikiCategories(),
        fetchOwnerApplications(),
        fetchRankingsBanner(),
      ]);
      // fetchPendingAiEntries()와 fetchKpopTitleEntries()는 버튼 클릭시에만 실행
    }
  }, [hasAccess, user]);

  // Fetch rankings banner URL
  const fetchRankingsBanner = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'rankings_banner_url')
        .maybeSingle();

      if (error) throw error;
      const value = data?.setting_value as { url?: string; link?: string; linkEnabled?: boolean } | null;
      setRankingsBannerUrl(value?.url || '');
      setRankingsBannerLink(value?.link || '/challenges');
      setRankingsBannerLinkEnabled(value?.linkEnabled !== false);
    } catch (error) {
      console.error('Error fetching rankings banner:', error);
    }
  };

  // Save rankings banner URL
  const saveRankingsBanner = async () => {
    setIsSavingBanner(true);
    try {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('setting_key', 'rankings_banner_url')
        .maybeSingle();

      const settingValue = { 
        url: rankingsBannerUrl,
        link: rankingsBannerLink,
        linkEnabled: rankingsBannerLinkEnabled
      };

      if (existing) {
        const { error } = await supabase
          .from('system_settings')
          .update({ 
            setting_value: settingValue,
            updated_at: new Date().toISOString()
          })
          .eq('setting_key', 'rankings_banner_url');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_settings')
          .insert({
            setting_key: 'rankings_banner_url',
            setting_value: settingValue,
            description: 'Rankings page hero banner image URL'
          });
        if (error) throw error;
      }

      toast({
        title: "Banner saved",
        description: "Rankings page banner has been updated",
      });
    } catch (error) {
      console.error('Error saving banner:', error);
      toast({
        title: "Error",
        description: "Failed to save banner",
        variant: "destructive",
      });
    } finally {
      setIsSavingBanner(false);
    }
  };

  // Handle banner image upload
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 형식 확인
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingBanner(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `rankings-banner-${Date.now()}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      // Storage RLS 이슈 우회: admin 전용 Edge Function으로 업로드
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          const commaIdx = result.indexOf(",");
          if (commaIdx === -1) return reject(new Error("Invalid file data"));
          resolve(result.slice(commaIdx + 1));
        };
        reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('admin-upload-brand-asset', {
        body: {
          path: filePath,
          contentType: file.type,
          base64,
        },
      });

      if (error) throw error;

      setRankingsBannerUrl(data?.publicUrl || '');
      toast({
        title: "Upload successful",
        description: "Banner image uploaded. Click 'Save Banner' to apply.",
      });
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload banner image",
        variant: "destructive",
      });
    } finally {
      setIsUploadingBanner(false);
    }
  };

  // Fetch wiki categories
  const fetchWikiCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('wiki_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setWikiCategories(data || []);
    } catch (error) {
      console.error('Error fetching wiki categories:', error);
    }
  };

  // Fetch owner applications
  const fetchOwnerApplications = async () => {
    setLoadingApplications(true);
    try {
      // Pending applications
      const { data: pendingData, error: pendingError } = await supabase
        .from('owner_applications')
        .select(`
          *,
          wiki_entry:wiki_entries(id, title, slug, image_url),
          user:profiles!owner_applications_user_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;
      setOwnerApplications(pendingData || []);

      // Approved applications
      const { data: approvedData, error: approvedError } = await supabase
        .from('owner_applications')
        .select(`
          *,
          wiki_entry:wiki_entries(id, title, slug, image_url),
          user:profiles!owner_applications_user_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false })
        .limit(50);

      if (approvedError) throw approvedError;
      setApprovedApplications(approvedData || []);
    } catch (error) {
      console.error('Error fetching owner applications:', error);
    } finally {
      setLoadingApplications(false);
    }
  };

  // Approve owner application
  const handleApproveApplication = async (application: any) => {
    try {
      // 1. 신청 상태 업데이트
      const { error: updateError } = await supabase
        .from('owner_applications')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', application.id);

      if (updateError) throw updateError;

      // 2. 엔트리 소유권 할당
      const { error: assignError } = await supabase.rpc('assign_entry_owner', {
        entry_id_param: application.wiki_entry_id,
        owner_id_param: application.user_id,
        status_param: 'claimed'
      });

      if (assignError) throw assignError;

      // 3. 유저에게 알림 전송
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: application.user_id,
          type: 'owner_approved',
          title: 'Congratulations! You are now Fandom Master',
          message: `You have been appointed as the Fandom Master of "${application.wiki_entry?.title}". Issue your Light Stick now to start earning!`,
          reference_id: application.wiki_entry_id,
          actor_id: user?.id
        });

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
      }

      toast({
        title: "Application Approved",
        description: `${application.user?.display_name || application.user?.username} is now the owner of "${application.wiki_entry?.title}"`,
      });

      fetchOwnerApplications();
    } catch (error) {
      console.error('Error approving application:', error);
      toast({
        title: "Error",
        description: "Failed to approve application",
        variant: "destructive",
      });
    }
  };

  // Reject owner application
  const handleRejectApplication = async (application: any) => {
    try {
      const { error } = await supabase
        .from('owner_applications')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', application.id);

      if (error) throw error;

      toast({
        title: "Application Rejected",
        description: "The application has been rejected",
      });

      fetchOwnerApplications();
    } catch (error) {
      console.error('Error rejecting application:', error);
      toast({
        title: "Error",
        description: "Failed to reject application",
        variant: "destructive",
      });
    }
  };

  // Revoke owner application (set owner back to admin)
  const handleRevokeApplication = async (application: any) => {
    try {
      // 1. 신청 상태를 pending으로 변경
      const { error: updateError } = await supabase
        .from('owner_applications')
        .update({
          status: 'pending',
          reviewed_at: null,
          reviewed_by: null
        })
        .eq('id', application.id);

      if (updateError) throw updateError;

      // 2. 엔트리 소유권을 현재 관리자로 변경 (또는 unclaimed로)
      const { error: assignError } = await supabase
        .from('wiki_entries')
        .update({
          owner_id: user?.id, // 현재 관리자로 설정
          page_status: 'unclaimed'
        })
        .eq('id', application.wiki_entry_id);

      if (assignError) throw assignError;

      toast({
        title: "Ownership Revoked",
        description: `Ownership of "${application.wiki_entry?.title}" has been revoked and set back to admin.`,
      });

      fetchOwnerApplications();
    } catch (error) {
      console.error('Error revoking application:', error);
      toast({
        title: "Error",
        description: "Failed to revoke ownership",
        variant: "destructive",
      });
    }
  };

  const fetchWikiCreationMinLevel = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'wiki_creation_min_level')
        .single();

      if (error) throw error;
      if (data) {
        setWikiCreationMinLevel((data.setting_value as any).min_level || 1);
      }
    } catch (error) {
      console.error('Error fetching wiki creation min level:', error);
    }
  };

  const updateWikiCreationMinLevel = async (newLevel: number) => {
    setIsUpdatingMinLevel(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          setting_value: { min_level: newLevel },
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'wiki_creation_min_level');

      if (error) throw error;

      setWikiCreationMinLevel(newLevel);
      toast({
        title: "Success",
        description: `Wiki creation minimum level updated to ${newLevel}`,
      });
    } catch (error) {
      console.error('Error updating min level:', error);
      toast({
        title: "Error",
        description: "Failed to update minimum level",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingMinLevel(false);
    }
  };

  const fetchAiContributions = async () => {
    setAiContributionsLoading(true);
    try {
      // 먼저 contributions 데이터 가져오기
      const { data: contributions, error } = await supabase
        .from('ai_data_contributions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      if (contributions && contributions.length > 0) {
        // 고유 user_id 추출
        const userIds = [...new Set(contributions.map(c => c.user_id))];
        
        // 별도로 프로필 가져오기
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('id', userIds);
        
        // 프로필 맵 생성
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        // contributions에 프로필 데이터 병합
        const enrichedContributions = contributions.map(c => ({
          ...c,
          profiles: profileMap.get(c.user_id) || null
        }));
        
        setAiContributions(enrichedContributions);
      } else {
        setAiContributions([]);
      }
    } catch (error) {
      console.error('Error fetching AI contributions:', error);
      setAiContributions([]);
    } finally {
      setAiContributionsLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      // 병렬로 쿼리 실행하여 성능 개선 (posts 전체 로딩 제거)
      const [
        pendingPostsResult,
        usersResult,
        statsResult,
        pointRulesResult,
        communitiesResult,
        blockedDomainsResult
      ] = await Promise.all([
        // Fetch pending approval posts only
        supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id (
              username,
              display_name
            )
          `)
          .eq('is_approved', false)
          .order('created_at', { ascending: false}),
        
        // Fetch users
        supabase.functions.invoke('admin-get-users'),
        
        // Fetch statistics (count only, no full data)
        Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('posts').select('*', { count: 'exact', head: true }),
          supabase.from('post_votes').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        ]),
        
        // Fetch point rules
        supabase
          .from('point_rules')
          .select('*')
          .order('category', { ascending: true })
          .order('action_type', { ascending: true }),
        
        // Fetch communities
        supabase
          .from('communities')
          .select('*')
          .order('created_at', { ascending: false }),
        
        // Fetch blocked email domains
        supabase
          .from('blocked_email_domains')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (pendingPostsResult.error) throw pendingPostsResult.error;
      setPendingPosts(pendingPostsResult.data || []);

      // admin-get-users 에러는 로그만 남기고 진행 (챌린지 관리 등 다른 기능에 영향 안주도록)
      if (usersResult.error) {
        console.error('Error fetching users:', usersResult.error);
      }
      const usersData = usersResult.data?.users || [];
      setUsers(usersData);
      setUsersWithRoles(usersData);

      const [totalUsersResult, totalPostsResult, totalVotesResult, recentUsersResult] = statsResult;
      
      // Onchain DAU/MAU 조회 (별도 쿼리)
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // DAU: 오늘 tx_hash가 있는 고유 사용자
      const { data: dauData } = await supabase
        .from('special_votes')
        .select('user_id')
        .not('tx_hash', 'is', null)
        .not('user_id', 'is', null)
        .gte('created_at', today);
      
      const { data: dauWiki } = await supabase
        .from('wiki_entry_votes')
        .select('user_id')
        .not('tx_hash', 'is', null)
        .not('user_id', 'is', null)
        .gte('created_at', today);
      
      const { data: dauPost } = await supabase
        .from('post_votes')
        .select('user_id')
        .not('tx_hash', 'is', null)
        .not('user_id', 'is', null)
        .gte('created_at', today);
      
      const dauUsers = new Set([
        ...(dauData || []).map(d => d.user_id),
        ...(dauWiki || []).map(d => d.user_id),
        ...(dauPost || []).map(d => d.user_id),
      ]);
      
      // MAU: 30일간 tx_hash가 있는 고유 사용자
      const { data: mauData } = await supabase
        .from('special_votes')
        .select('user_id')
        .not('tx_hash', 'is', null)
        .not('user_id', 'is', null)
        .gte('created_at', thirtyDaysAgo);
      
      const { data: mauWiki } = await supabase
        .from('wiki_entry_votes')
        .select('user_id')
        .not('tx_hash', 'is', null)
        .not('user_id', 'is', null)
        .gte('created_at', thirtyDaysAgo);
      
      const { data: mauPost } = await supabase
        .from('post_votes')
        .select('user_id')
        .not('tx_hash', 'is', null)
        .not('user_id', 'is', null)
        .gte('created_at', thirtyDaysAgo);
      
      const mauUsers = new Set([
        ...(mauData || []).map(d => d.user_id),
        ...(mauWiki || []).map(d => d.user_id),
        ...(mauPost || []).map(d => d.user_id),
      ]);
      
      setStats({
        totalUsers: totalUsersResult.count || 0,
        totalPosts: totalPostsResult.count || 0,
        totalVotes: totalVotesResult.count || 0,
        recentUsers: recentUsersResult.count || 0,
        onchainDau: dauUsers.size,
        onchainMau: mauUsers.size,
      });

      if (pointRulesResult.error) throw pointRulesResult.error;
      const rulesData = pointRulesResult.data;
      setPointRules(rulesData || []);

      // 'create_calendar_event' 규칙이 없으면 자동 추가
      const hasCalendarEventRule = rulesData?.some(rule => rule.action_type === 'create_calendar_event');
      if (!hasCalendarEventRule && isAdmin) {
        const { error: insertError } = await supabase
          .from('point_rules')
          .insert([{
            action_type: 'create_calendar_event',
            description: 'Points deducted when user creates a calendar event',
            points: -10,
            category: 'content',
            is_active: true
          }]);

        if (!insertError) {
          console.log('Added create_calendar_event point rule');
          // Re-fetch point rules to update UI
          const { data: updatedRules } = await supabase
            .from('point_rules')
            .select('*')
            .order('category', { ascending: true })
            .order('action_type', { ascending: true });
          
          if (updatedRules) {
            setPointRules(updatedRules);
          }
        }
      }

      // 'upload_wiki_media' 규칙이 없으면 자동 추가
      const hasUploadMediaRule = rulesData?.some(rule => rule.action_type === 'upload_wiki_media');
      if (!hasUploadMediaRule && isAdmin) {
        const { error: insertError } = await supabase
          .from('point_rules')
          .insert([{
            action_type: 'upload_wiki_media',
            description: 'Points deducted when user uploads media to wiki gallery',
            points: -5,
            category: 'content',
            is_active: true
          }]);

        if (!insertError) {
          console.log('Added upload_wiki_media point rule');
          // Re-fetch point rules to update UI
          const { data: updatedRules } = await supabase
            .from('point_rules')
            .select('*')
            .order('category', { ascending: true })
            .order('action_type', { ascending: true });
          
          if (updatedRules) {
            setPointRules(updatedRules);
          }
        }
      }

      // 'create_wiki_entry' 규칙이 없으면 자동 추가
      const hasCreateWikiRule = rulesData?.some(rule => rule.action_type === 'create_wiki_entry');
      if (!hasCreateWikiRule && isAdmin) {
        const { error: insertError } = await supabase
          .from('point_rules')
          .insert([{
            action_type: 'create_wiki_entry',
            description: 'Stars spent when user creates a Fanz entry',
            points: -10,
            category: 'wiki',
            is_active: true,
          }]);

        if (!insertError) {
          console.log('Added create_wiki_entry point rule');
          const { data: updatedRules } = await supabase
            .from('point_rules')
            .select('*')
            .order('category', { ascending: true })
            .order('action_type', { ascending: true });

          if (updatedRules) {
            setPointRules(updatedRules);
          }
        }
      }

      if (communitiesResult.error) throw communitiesResult.error;
      setCommunities(communitiesResult.data || []);

      if (blockedDomainsResult.error) throw blockedDomainsResult.error;
      setBlockedDomains(blockedDomainsResult.data || []);

      // Fetch wiki entries statistics (using count only, no limit)
      const { count: artistCount, error: artistsError } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .eq('schema_type', 'artist');

      const { count: memberCount, error: membersError } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .eq('schema_type', 'member');

      const { count: actorCount, error: actorsError } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .eq('schema_type', 'actor' as any);

      // 초기 통계는 총 개수만 설정 (filled content, social links, music charts는 수동 로드)
      setWikiStats({
        totalArtists: artistCount || 0,
        totalMembers: memberCount || 0,
        totalActors: actorCount || 0,
        filledArtists: 0,
        filledMembers: 0,
        filledActors: 0,
        withSocialLinks: 0,
        withMusicCharts: 0,
      });

      // Fetch point products
      const { data: productsData, error: productsError } = await supabase
        .from('point_products')
        .select('*')
        .order('display_order', { ascending: true });

      if (productsError) throw productsError;
      setPointProducts(productsData || []);

      // Fetch gift badges
      const { data: badgesData, error: badgesError } = await supabase
        .from('gift_badges')
        .select('*')
        .order('display_order', { ascending: true });

      if (badgesError) throw badgesError;
      setGiftBadges(badgesData || []);

      // Fetch levels for token rewards management
      const { data: levelsData, error: levelsError } = await supabase
        .from('levels')
        .select('*')
        .order('id', { ascending: true });

      if (!levelsError && levelsData) {
        setLevels(levelsData);
      }
      
      // Fetch schema type relationships
      const { data: schemaRelData } = await supabase
        .from('schema_type_relationships' as any)
        .select('*')
        .order('parent_schema_type');
      
      if (schemaRelData) {
        setSchemaRelationships(schemaRelData);
      }
      
      // Fetch master applications
      const { data: masterAppsData } = await supabase
        .from('master_applications' as any)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (masterAppsData) {
        setMasterApplications(masterAppsData);
      }
      
      // Fetch KTNZ to Stars exchange rate
      const { data: ktnzRateData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'ktnz_to_stars_rate')
        .single();
      
      if (ktnzRateData?.setting_value) {
        const rate = (ktnzRateData.setting_value as any)?.rate || 10;
        setKtnzToStarsRate(rate);
        setTempKtnzRate(rate);
      }
      
      // Fetch show_wallet_menu setting
      const { data: walletMenuData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'show_wallet_menu')
        .single();
      
      if (walletMenuData?.setting_value) {
        setShowWalletMenu((walletMenuData.setting_value as any)?.enabled || false);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load admin data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 상세 위키 통계를 수동으로 로드하는 함수
  const [isLoadingDetailedStats, setIsLoadingDetailedStats] = useState(false);

  const loadDetailedWikiStats = async () => {
    setIsLoadingDetailedStats(true);
    try {
      // Fetch filled content counts - 배치로 가져와서 "#"으로 시작하는 항목만 카운트
      const countFilledContent = async (schemaType: any) => {
        let count = 0;
        let offset = 0;
        const batchSize = 1000;
        
        while (true) {
          const { data } = await supabase
            .from('wiki_entries')
            .select('content')
            .eq('schema_type', schemaType)
            .range(offset, offset + batchSize - 1);
          
          if (!data || data.length === 0) break;
          
          count += data.filter(entry => 
            entry.content && entry.content.trim().startsWith('#')
          ).length;
          
          offset += batchSize;
        }
        
        return count;
      };

      const filledArtistCount = await countFilledContent('artist');
      const filledMemberCount = await countFilledContent('member');
      const filledActorCount = await countFilledContent('actor');

      // Fetch social links counts - 배치로 처리
      const countSocialLinks = async () => {
        let count = 0;
        let offset = 0;
        const batchSize = 1000;
        
        while (true) {
          const { data } = await supabase
            .from('wiki_entries')
            .select('metadata')
            .in('schema_type', ['artist', 'member', 'actor'])
            .range(offset, offset + batchSize - 1);
          
          if (!data || data.length === 0) break;
          
          count += data.filter(entry => {
            if (!entry.metadata || typeof entry.metadata !== 'object') return false;
            const socialLinks = (entry.metadata as any).social_links;
            return socialLinks && typeof socialLinks === 'object' && Object.keys(socialLinks).length > 0;
          }).length;
          
          offset += batchSize;
        }
        
        return count;
      };

      const withSocialLinks = await countSocialLinks();

      // Fetch music charts counts - 배치로 처리
      const countMusicCharts = async () => {
        let count = 0;
        let offset = 0;
        const batchSize = 1000;
        
        while (true) {
          const { data } = await supabase
            .from('wiki_entries')
            .select('metadata')
            .in('schema_type', ['artist', 'member'])
            .range(offset, offset + batchSize - 1);
          
          if (!data || data.length === 0) break;
          
          count += data.filter(entry => {
            if (!entry.metadata || typeof entry.metadata !== 'object') return false;
            const musicCharts = (entry.metadata as any).music_charts;
            if (Array.isArray(musicCharts)) {
              return musicCharts.length > 0;
            }
            return musicCharts && typeof musicCharts === 'object' && Object.keys(musicCharts).length > 0;
          }).length;
          
          offset += batchSize;
        }
        
        return count;
      };

      const withMusicCharts = await countMusicCharts();

      // 통계 업데이트
      setWikiStats(prev => ({
        ...prev,
        filledArtists: filledArtistCount || 0,
        filledMembers: filledMemberCount || 0,
        filledActors: filledActorCount || 0,
        withSocialLinks,
        withMusicCharts,
      }));

      toast({
        title: "Success",
        description: "Detailed wiki statistics loaded successfully.",
      });
    } catch (error) {
      console.error('Error loading detailed wiki stats:', error);
      toast({
        title: "Error",
        description: "Failed to load detailed wiki statistics.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetailedStats(false);
    }
  };

  const fetchWithdrawalRequests = async () => {
    try {
      // 먼저 withdrawal_requests 데이터 가져오기
      const { data: requests, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Withdrawal requests table not available:', error);
        setWithdrawalRequests([]);
        return;
      }
      
      if (requests && requests.length > 0) {
        // 고유 user_id 추출
        const userIds = [...new Set(requests.map(r => r.user_id))];
        
        // 별도로 프로필 가져오기
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);
        
        // 프로필 맵 생성
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        // requests에 프로필 데이터 병합
        const enrichedRequests = requests.map(r => ({
          ...r,
          profiles: profileMap.get(r.user_id) || null
        }));
        
        setWithdrawalRequests(enrichedRequests);
      } else {
        setWithdrawalRequests([]);
      }
    } catch (error) {
      console.warn('Error fetching withdrawal requests:', error);
      setWithdrawalRequests([]);
    }
  };

  const fetchPendingAiEntries = async () => {
    setLoadingPendingAi(true);
    try {
      // 먼저 전체 개수 가져오기
      const { count, error: countError } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .ilike('content', '%Pending AI content generation%');

      if (countError) {
        console.warn('Error counting pending AI entries:', countError);
      } else {
        setTotalPendingAiCount(count || 0);
      }

      // 리스트 데이터 가져오기 (최대 100개)
      const { data, error } = await supabase
        .from('wiki_entries')
        .select(`
          id,
          title,
          slug,
          schema_type,
          created_at,
          creator_id,
          profiles:creator_id (
            username,
            display_name
          )
        `)
        .ilike('content', '%Pending AI content generation%')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setPendingAiEntries(data || []);
      setSelectedPendingEntries(new Set()); // 리스트 새로고침시 선택 초기화
    } catch (error) {
      console.error('Error fetching pending AI entries:', error);
      toast({
        title: "Error",
        description: "Failed to load pending AI entries.",
        variant: "destructive",
      });
    } finally {
      setLoadingPendingAi(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedPendingEntries.size === pendingAiEntries.length) {
      setSelectedPendingEntries(new Set());
    } else {
      setSelectedPendingEntries(new Set(pendingAiEntries.map(entry => entry.id)));
    }
  };

  const toggleSelectEntry = (entryId: string) => {
    const newSelection = new Set(selectedPendingEntries);
    if (newSelection.has(entryId)) {
      newSelection.delete(entryId);
    } else {
      newSelection.add(entryId);
    }
    setSelectedPendingEntries(newSelection);
  };

  const handleDeleteSelectedEntries = async () => {
    if (selectedPendingEntries.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select entries to delete.",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedPendingEntries.size} selected entries? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('wiki_entries')
        .delete()
        .in('id', Array.from(selectedPendingEntries));

      if (error) throw error;

      toast({
        title: "Success",
        description: `Successfully deleted ${selectedPendingEntries.size} entries.`,
      });

      // 리스트 새로고침
      fetchPendingAiEntries();
    } catch (error) {
      console.error('Error deleting entries:', error);
      toast({
        title: "Error",
        description: "Failed to delete selected entries.",
        variant: "destructive",
      });
    }
  };

  const fetchKpopTitleEntries = async () => {
    setLoadingKpopTitles(true);
    try {
      // 먼저 전체 개수 가져오기
      const { count, error: countError } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .ilike('title', '%k-pop%');

      if (countError) {
        console.warn('Error counting k-pop title entries:', countError);
      } else {
        setTotalKpopTitleCount(count || 0);
      }

      // 리스트 데이터 가져오기 (최대 100개)
      const { data, error } = await supabase
        .from('wiki_entries')
        .select(`
          id,
          title,
          slug,
          schema_type,
          created_at,
          creator_id,
          profiles:creator_id (
            username,
            display_name
          )
        `)
        .ilike('title', '%k-pop%')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setKpopTitleEntries(data || []);
      setSelectedKpopEntries(new Set());
    } catch (error) {
      console.error('Error fetching k-pop title entries:', error);
      toast({
        title: "Error",
        description: "Failed to load k-pop title entries.",
        variant: "destructive",
      });
    } finally {
      setLoadingKpopTitles(false);
    }
  };

  const toggleSelectAllKpop = () => {
    if (selectedKpopEntries.size === kpopTitleEntries.length) {
      setSelectedKpopEntries(new Set());
    } else {
      setSelectedKpopEntries(new Set(kpopTitleEntries.map(entry => entry.id)));
    }
  };

  const toggleSelectKpopEntry = (entryId: string) => {
    const newSelection = new Set(selectedKpopEntries);
    if (newSelection.has(entryId)) {
      newSelection.delete(entryId);
    } else {
      newSelection.add(entryId);
    }
    setSelectedKpopEntries(newSelection);
  };

  const handleDeleteSelectedKpopEntries = async () => {
    if (selectedKpopEntries.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select entries to delete.",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedKpopEntries.size} selected entries? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('wiki_entries')
        .delete()
        .in('id', Array.from(selectedKpopEntries));

      if (error) throw error;

      toast({
        title: "Success",
        description: `Successfully deleted ${selectedKpopEntries.size} entries.`,
      });

      // 리스트 새로고침
      fetchKpopTitleEntries();
    } catch (error) {
      console.error('Error deleting k-pop entries:', error);
      toast({
        title: "Error",
        description: "Failed to delete selected entries.",
        variant: "destructive",
      });
    }
  };

  const handleWithdrawalAction = async (requestId: string, action: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({ status: action })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Withdrawal request ${action}`,
      });

      fetchWithdrawalRequests();
    } catch (error) {
      console.error('Error updating withdrawal request:', error);
      toast({
        title: "Error",
        description: "Failed to update withdrawal request",
        variant: "destructive",
      });
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post deleted successfully.",
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post.",
        variant: "destructive",
      });
    }
  };

  const handleAutoGenerate = async () => {
    const count = parseInt(autoGenCount);
    if (count < 1 || count > 10) {
      toast({
        title: "Invalid Count",
        description: "Please enter a number between 1 and 10.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-news-posts', {
        body: {
          count,
          category: autoGenCategory,
          keyword: autoGenKeyword,
          userId: user?.id,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Success",
          description: `Generated ${data.generated} news posts successfully!`,
        });
        fetchData();
        setAutoGenKeyword("");
      } else {
        throw new Error(data?.error || "Failed to generate posts");
      }
    } catch (error) {
      console.error('Error generating posts:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate news posts.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEvaluateAIData = async () => {
    setIsEvaluatingAIData(true);
    setAiDataResults(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('evaluate-ai-contributions');
      
      if (error) throw error;
      
      if (data?.success) {
        setAiDataResults(data);
        toast({
          title: "Success",
          description: `Evaluated and registered ${data.details.posts.processed + data.details.wiki_entries.processed} high-quality contributions!`,
        });
      } else {
        throw new Error(data?.error || "Failed to evaluate AI contributions");
      }
    } catch (error) {
      console.error('Error evaluating AI contributions:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to evaluate AI contributions.",
        variant: "destructive",
      });
    } finally {
      setIsEvaluatingAIData(false);
    }
  };

  const handleUpdatePointRule = async (ruleId: string) => {
    const points = editPoints[ruleId];
    if (points === undefined) return;

    try {
      const { error } = await supabase
        .from('point_rules')
        .update({ points })
        .eq('id', ruleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Point rule updated successfully.",
      });
      setEditingRule(null);
      setEditPoints({});
      fetchData();
    } catch (error) {
      console.error('Error updating point rule:', error);
      toast({
        title: "Error",
        description: "Failed to update point rule.",
        variant: "destructive",
      });
    }
  };

  // Level token reward 업데이트 핸들러
  const handleUpdateLevelTokenReward = async (levelId: number) => {
    const tokenReward = editTokenReward[levelId];
    if (tokenReward === undefined) return;

    try {
      const { error } = await supabase
        .from('levels')
        .update({ token_reward: tokenReward })
        .eq('id', levelId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Level ${levelId} token reward updated to ${tokenReward} KTNZ.`,
      });
      setEditingLevel(null);
      setEditTokenReward({});
      
      // Refresh levels data
      const { data: levelsData } = await supabase
        .from('levels')
        .select('*')
        .order('id', { ascending: true });
      
      if (levelsData) {
        setLevels(levelsData);
      }
    } catch (error) {
      console.error('Error updating level token reward:', error);
      toast({
        title: "Error",
        description: "Failed to update level token reward.",
        variant: "destructive",
      });
    }
  };

  const handleSaveKtnzToStarsRate = async () => {
    if (tempKtnzRate <= 0) {
      toast({
        title: "Invalid Rate",
        description: "Exchange rate must be greater than 0.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingKtnzRate(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          setting_value: { rate: tempKtnzRate },
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'ktnz_to_stars_rate');

      if (error) throw error;

      setKtnzToStarsRate(tempKtnzRate);
      setEditingKtnzRate(false);
      toast({
        title: "Success",
        description: `KTNZ to Stars rate updated to 1 KTNZ = ${tempKtnzRate} Stars.`,
      });
    } catch (error) {
      console.error('Error updating KTNZ rate:', error);
      toast({
        title: "Error",
        description: "Failed to update exchange rate.",
        variant: "destructive",
      });
    } finally {
      setIsSavingKtnzRate(false);
    }
  };

  const handleManualPointAdjustment = async (operation: 'add' | 'subtract') => {
    if (!selectedUserId || !manualPoints) {
      toast({
        title: "Invalid Input",
        description: "Please select a user and enter points amount.",
        variant: "destructive",
      });
      return;
    }

    const points = parseInt(manualPoints);
    if (points <= 0) {
      toast({
        title: "Invalid Stars",
        description: "Stars must be greater than 0.",
        variant: "destructive",
      });
      return;
    }

    try {
      const user = users.find(u => u.id === selectedUserId);
      if (!user) throw new Error("User not found");

      const adjustment = operation === 'add' ? points : -points;
      const newAvailablePoints = Math.max(0, (user.available_points || 0) + adjustment);
      const newTotalPoints = Math.max(0, (user.total_points || 0) + adjustment);

      const { error } = await supabase
        .from('profiles')
        .update({ 
          available_points: newAvailablePoints,
          total_points: newTotalPoints
        })
        .eq('id', selectedUserId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${operation === 'add' ? 'Added' : 'Subtracted'} ${points} points ${operation === 'add' ? 'to' : 'from'} ${user.username}.`,
      });
      setManualPoints("");
      setSelectedUserId("");
      fetchData();
    } catch (error) {
      console.error('Error adjusting points:', error);
      toast({
        title: "Error",
        description: "Failed to adjust points.",
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = async (userId: string, role: string, action: 'add' | 'remove') => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          title: "Error",
          description: "You must be logged in to change roles.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.functions.invoke('admin-update-user-role', {
        body: { userId, role, action },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (error) {
        console.error('Error changing role:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: `Successfully ${action === 'add' ? 'added' : 'removed'} ${role} role.`,
      });

      // Refresh user data
      fetchData();
    } catch (error) {
      console.error('Error changing role:', error);
      toast({
        title: "Error",
        description: "Failed to change user role.",
        variant: "destructive",
      });
    }
  };

  const handleQuickPointAdjustment = async (operation: 'add' | 'subtract') => {
    if (!selectedUserForPoints || !quickPointAmount) {
      toast({
        title: "Invalid Input",
        description: "Please enter points amount.",
        variant: "destructive",
      });
      return;
    }

    const points = parseInt(quickPointAmount);
    if (points <= 0) {
      toast({
        title: "Invalid Stars",
        description: "Stars must be greater than 0.",
        variant: "destructive",
      });
      return;
    }

    try {
      const adjustment = operation === 'add' ? points : -points;
      const newAvailablePoints = Math.max(0, (selectedUserForPoints.available_points || 0) + adjustment);

      const { error } = await supabase
        .from('profiles')
        .update({ 
          available_points: newAvailablePoints
          // Note: total_points (XP) is not modified - only available_points change
        })
        .eq('id', selectedUserForPoints.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${operation === 'add' ? 'Added' : 'Subtracted'} ${points} points ${operation === 'add' ? 'to' : 'from'} ${selectedUserForPoints.username}.`,
      });
      
      setShowQuickPointDialog(false);
      setQuickPointAmount("");
      setSelectedUserForPoints(null);
      fetchData();
    } catch (error) {
      console.error('Error adjusting points:', error);
      toast({
        title: "Error",
        description: "Failed to adjust points.",
        variant: "destructive",
      });
    }
  };

  const handleUserRoleUpdate = async (userId: string, currentRoles: string[], newRole: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          title: "Error",
          description: "You must be logged in to change roles.",
          variant: "destructive",
        });
        return;
      }

      // Remove all existing roles sequentially (wait for each to complete)
      for (const role of currentRoles) {
        const { error } = await supabase.functions.invoke('admin-update-user-role', {
          body: { userId, role, action: 'remove' },
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });
        
        if (error) {
          console.error(`Error removing role ${role}:`, error);
          // Continue removing other roles even if one fails
        }
      }

      // Add new role if it's not 'user' (wait for removal to complete first)
      if (newRole !== 'user') {
        const { error } = await supabase.functions.invoke('admin-update-user-role', {
          body: { userId, role: newRole, action: 'add' },
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });

        if (error) {
          console.error('Error adding role:', error);
          throw error;
        }
      }

      toast({
        title: "Success",
        description: `User role updated to ${newRole}.`,
      });

      // Refresh user data
      fetchData();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role.",
        variant: "destructive",
      });
    }
  };

  const handleUserLevelUpdate = async (userId: string, newLevel: number) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ current_level: newLevel })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `User level updated to ${newLevel}.`,
      });

      // Refresh user data
      fetchData();
    } catch (error) {
      console.error('Error updating level:', error);
      toast({
        title: "Error",
        description: "Failed to update user level.",
        variant: "destructive",
      });
    }
  };

  const handleVipToggle = async (userId: string, isVip: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_vip: isVip })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: isVip ? "User set as VIP (unlimited invitations)." : "VIP status removed.",
      });

      // Refresh user data
      fetchData();
    } catch (error) {
      console.error('Error updating VIP status:', error);
      toast({
        title: "Error",
        description: "Failed to update VIP status.",
        variant: "destructive",
      });
    }
  };

  const handleInvitationVerifiedToggle = async (userId: string, isVerified: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ invitation_verified: isVerified })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: isVerified ? "User invitation verified." : "User invitation verification removed.",
      });

      // Refresh user data
      fetchData();
    } catch (error) {
      console.error('Error updating invitation status:', error);
      toast({
        title: "Error",
        description: "Failed to update invitation status.",
        variant: "destructive",
      });
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedUserForPassword || !newPassword) return;
    
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { 
          userId: selectedUserForPassword.id, 
          newPassword 
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: `Password reset for ${selectedUserForPassword.email || selectedUserForPassword.username}`,
      });

      setShowPasswordResetDialog(false);
      setNewPassword('');
      setSelectedUserForPassword(null);
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset password.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  // 유저 밴 핸들러
  const handleBanUser = async (userId: string, username: string) => {
    const reason = prompt(`Enter ban reason for @${username}:`);
    if (reason === null) return; // 취소됨
    
    try {
      const { error } = await supabase
        .from('user_bans')
        .insert({
          user_id: userId,
          banned_by: user?.id,
          reason: reason || 'No reason provided',
          is_permanent: true,
        });

      if (error) throw error;

      toast({
        title: "User Banned",
        description: `@${username} has been banned.`,
      });

      // 사용자 목록 새로고침
      fetchData();
    } catch (error: any) {
      console.error('Error banning user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to ban user.",
        variant: "destructive",
      });
    }
  };

  // 유저 밴 해제 핸들러
  const handleUnbanUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to unban @${username}?`)) return;
    
    try {
      const { error } = await supabase
        .from('user_bans')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "User Unbanned",
        description: `@${username} has been unbanned.`,
      });

      // 사용자 목록 새로고침
      fetchData();
    } catch (error: any) {
      console.error('Error unbanning user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to unban user.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateVerification = async (userId: string, isVerified: boolean, verificationType: string | null) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_verified: isVerified,
          verification_type: verificationType 
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: isVerified 
          ? `User verified as ${verificationType}` 
          : "User verification removed",
      });

      // Refresh user data
      fetchData();
    } catch (error) {
      console.error('Error updating verification:', error);
      toast({
        title: "Error",
        description: "Failed to update verification status.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSitemap = async () => {
    setIsUpdatingSitemap(true);
    try {
      const { data, error } = await supabase.functions.invoke('sitemap');
      
      if (error) throw error;

      toast({
        title: "Success",
        description: "Sitemap has been updated successfully! It may take a few minutes for changes to propagate.",
      });
    } catch (error) {
      console.error('Error updating sitemap:', error);
      toast({
        title: "Error",
        description: "Failed to update sitemap.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingSitemap(false);
    }
  };

  const handleCleanupLegacyTokens = async () => {
    if (!confirm('Are you sure you want to delete all legacy Fanz Tokens? This action cannot be undone. Creators will need to re-issue tokens on-chain.')) {
      return;
    }

    setIsCleaningLegacyTokens(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-legacy-tokens');
      
      if (error) throw error;

      toast({
        title: "Success",
        description: `Successfully deleted ${data.deletedCount} legacy tokens. Creators can now issue new on-chain tokens.`,
      });

      // Refresh data if needed
      fetchData();
    } catch (error) {
      console.error('Error cleaning up legacy tokens:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cleanup legacy tokens.",
        variant: "destructive",
      });
    } finally {
      setIsCleaningLegacyTokens(false);
    }
  };

  const handleDeleteAllTokens = async () => {
    if (!confirm('⚠️ WARNING: This will delete ALL Fanz Tokens (including on-chain tokens) from the database. This action is IRREVERSIBLE. All balances and transactions will also be deleted. Are you absolutely sure?')) {
      return;
    }

    setIsDeletingAllTokens(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-fanz-tokens');

      if (error) throw error;

      toast({
        title: "Success",
        description: `Successfully deleted ${data?.deletedCount || 0} Fanz Tokens and all associated data.`,
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting all tokens:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete all tokens.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingAllTokens(false);
    }
  };

  const handleCheckLegacyContract = async () => {
    setIsCheckingLegacyContract(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-legacy-contract');
      
      if (error) throw error;

      setLegacyContractBalance(data);
      toast({
        title: "Legacy Contract Info",
        description: `Balance: ${data.balanceEth} ETH (~$${data.balanceUsd})`,
      });
    } catch (error) {
      console.error('Error checking legacy contract:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to check legacy contract.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingLegacyContract(false);
    }
  };

  const handleToggleVerified = async (communityId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('communities')
        .update({ is_verified: !currentStatus })
        .eq('id', communityId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Community ${!currentStatus ? 'verified' : 'unverified'} successfully.`,
      });
      fetchData();
    } catch (error) {
      console.error('Error updating community verification:', error);
      toast({
        title: "Error",
        description: "Failed to update community verification.",
        variant: "destructive",
      });
    }
  };

  // Wiki Data Calibration handlers
  const handleFillWikiContent = async (missingOnly: boolean = false) => {
    try {
      wikiContentStopRef.current = false;
      setWikiContentProgress({ current: 0, total: 0, isProcessing: true, shouldStop: false, currentEntry: '' });
      
      // 마지막 처리된 ID 가져오기
      const lastProcessedId = localStorage.getItem('wiki_content_last_id') || null;
      const batchSize = 1000; // 1000개씩 처리
      
      toast({
        title: "Starting",
        description: lastProcessedId 
          ? `Resuming from last checkpoint (1000 entries per batch)...`
          : `Processing 1000 entries from the beginning...`,
      });

      // 총 엔트리 수 계산
      const { count: totalCount, error: totalError } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .in('schema_type', ['actor', 'artist', 'member']);

      if (totalError) throw totalError;
      const totalEntries = totalCount || 0;

      // 현재 배치 가져오기 (created_at 기준 정렬, lastProcessedId 이후부터)
      let query = supabase
        .from('wiki_entries')
        .select('id, title, schema_type, content, created_at')
        .in('schema_type', ['actor', 'artist', 'member'])
        .order('created_at', { ascending: true })
        .limit(batchSize);

      if (lastProcessedId) {
        // 마지막 처리된 ID의 created_at을 가져와서 그 이후부터 시작
        const { data: lastEntry } = await supabase
          .from('wiki_entries')
          .select('created_at')
          .eq('id', lastProcessedId)
          .single();
        
        if (lastEntry) {
          query = query.gt('created_at', lastEntry.created_at);
        }
      }

      const { data: batch, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      
      if (!batch || batch.length === 0) {
        toast({
          title: "Complete",
          description: "All entries have been processed! Resetting checkpoint.",
        });
        localStorage.removeItem('wiki_content_last_id');
        setWikiContentProgress({ current: 0, total: 0, isProcessing: false, shouldStop: false, currentEntry: '' });
        return;
      }

      // 필터링
      const entriesToProcess = missingOnly 
        ? batch.filter(entry => 
            !entry.content || 
            entry.content.trim().length === 0 || 
            entry.content.includes('Pending AI content generation') ||
            !entry.content.trim().startsWith('#')
          )
        : batch;

      setWikiContentProgress({ 
        current: 0, 
        total: entriesToProcess.length, 
        isProcessing: true, 
        shouldStop: false,
        currentEntry: ''
      });

      toast({
        title: "Processing",
        description: `Processing ${entriesToProcess.length} entries in this batch (Total in DB: ${totalEntries})`,
      });

      let processedCount = 0;
      let lastProcessedEntryId = null;

      // 하나씩 순차 처리
      for (const entry of entriesToProcess) {
        if (wikiContentStopRef.current) {
          // 중단시 마지막 처리된 ID 저장
          if (lastProcessedEntryId) {
            localStorage.setItem('wiki_content_last_id', lastProcessedEntryId);
          }
          toast({
            title: "Stopped",
            description: `Process stopped. ${processedCount} entries processed in this batch. Checkpoint saved.`,
          });
          setWikiContentProgress({ 
            current: processedCount, 
            total: entriesToProcess.length, 
            isProcessing: false, 
            shouldStop: false, 
            currentEntry: '' 
          });
          wikiContentStopRef.current = false;
          return;
        }

        try {
          // 현재 처리 중인 엔트리 표시
          setWikiContentProgress(prev => ({ 
            ...prev, 
            currentEntry: entry.title,
            current: processedCount
          }));

          const { data, error } = await supabase.functions.invoke('generate-wiki-content', {
            body: { title: entry.title, schemaType: entry.schema_type }
          });

          if (error) {
            console.error(`Error generating content for ${entry.title}:`, error);
          } else if (data?.error) {
            console.error(`API error for ${entry.title}:`, data.error);
          } else if (data?.content) {
            // metadata도 함께 업데이트 (edge function에서 이미 group_id 포함)
            const updateData: any = { content: data.content };
            if (data.metadata) {
              updateData.metadata = data.metadata;
              
              // artist 타입의 경우 metadata.members 제거 (실제 member 엔트리만 사용)
              if (entry.schema_type === 'artist' && updateData.metadata.members) {
                delete updateData.metadata.members;
                console.log(`[ADMIN] Removed metadata.members from ${entry.title} (using actual member entries)`);
              }
            }
            
            await supabase
              .from('wiki_entries')
              .update(updateData)
              .eq('id', entry.id);
            
            processedCount++;
            lastProcessedEntryId = entry.id;
            
            setWikiContentProgress(prev => ({ 
              ...prev, 
              current: processedCount, 
              total: entriesToProcess.length, 
              isProcessing: true,
              currentEntry: entry.title
            }));
          }

          // 각 엔트리 사이 2초 대기
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
          console.error(`Failed to update ${entry.title}:`, err);
        }
      }

      // 배치 완료시 마지막 ID 저장
      if (lastProcessedEntryId) {
        localStorage.setItem('wiki_content_last_id', lastProcessedEntryId);
      }

      setLastUpdated(prev => ({ ...prev, content: processedCount }));
      
      toast({
        title: "Batch Complete",
        description: `Processed ${processedCount} entries. Checkpoint saved. Run again to continue with next 1000.`,
      });
      setWikiContentProgress({ 
        current: processedCount, 
        total: entriesToProcess.length, 
        isProcessing: false, 
        shouldStop: false, 
        currentEntry: '' 
      });
      wikiContentStopRef.current = false;
      await fetchData();
    } catch (error) {
      console.error('Error filling wiki content:', error);
      toast({
        title: "Error",
        description: "Failed to fill wiki content",
        variant: "destructive",
      });
      setWikiContentProgress({ current: 0, total: 0, isProcessing: false, shouldStop: false, currentEntry: '' });
      wikiContentStopRef.current = false;
    }
  };

  const handleFetchSocialLinks = async (missingOnly: boolean = false) => {
    try {
      socialLinksStopRef.current = false;
      setSocialLinksProgress({ current: 0, total: 0, isProcessing: true, shouldStop: false });
      
      toast({
        title: "Starting",
        description: "Initializing social links fetch...",
      });

      // Edge function을 호출하여 백그라운드 작업 시작
      const { data, error } = await supabase.functions.invoke('fetch-social-links', {
        body: { missingOnly }
      });

      if (error) throw error;

      // 즉시 응답 받음
      toast({
        title: "Processing",
        description: data.message || "Background task started",
      });

      // 진행상황 모니터링 시작 (5초마다 체크)
      const monitorInterval = setInterval(async () => {
        if (socialLinksStopRef.current) {
          clearInterval(monitorInterval);
          setSocialLinksProgress({ current: 0, total: 0, isProcessing: false, shouldStop: false });
          return;
        }

        try {
          // wiki stats를 다시 가져와서 진행상황 업데이트
          const { data: stats } = await supabase
            .from('wiki_entries')
            .select('metadata')
            .in('schema_type', ['artist', 'member', 'actor']);

          if (stats) {
            const withSocialLinks = stats.filter(e => {
              const metadata = e.metadata as any;
              return metadata?.social_links && Object.keys(metadata.social_links).length > 0;
            }).length;

            setSocialLinksProgress(prev => ({
              ...prev,
              current: withSocialLinks,
              total: stats.length,
            }));
          }
        } catch (err) {
          console.error('Error monitoring progress:', err);
        }
      }, 5000);

      // 30분 후 자동으로 모니터링 중지
      setTimeout(() => {
        clearInterval(monitorInterval);
        setSocialLinksProgress(prev => ({ ...prev, isProcessing: false }));
        toast({
          title: "Completed",
          description: "Social links fetch has been processed in the background",
        });
        fetchData();
      }, 30 * 60 * 1000);

    } catch (error) {
      console.error('Error fetching social links:', error);
      toast({
        title: "Error",
        description: "Failed to start social links fetch",
        variant: "destructive",
      });
      setSocialLinksProgress({ current: 0, total: 0, isProcessing: false, shouldStop: false });
      socialLinksStopRef.current = false;
    }
  };

  const handleFetchMusicCharts = async (missingOnly: boolean = false) => {
    try {
      musicChartsStopRef.current = false;
      setMusicChartsProgress({ current: 0, total: 0, isProcessing: true, shouldStop: false });
      
      toast({
        title: "Calculating",
        description: "Counting entries...",
      });

      // 전체 엔트리 수 (artist와 member만)
      const { count: totalCount, error: totalError } = await supabase
        .from('wiki_entries')
        .select('*', { count: 'exact', head: true })
        .in('schema_type', ['artist', 'member']);

      if (totalError) throw totalError;

      // 배치로 가져와서 music_charts 있는 것 카운트
      let validEntries = 0;
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data: batch, error: fetchError } = await supabase
          .from('wiki_entries')
          .select('metadata')
          .in('schema_type', ['artist', 'member'])
          .range(offset, offset + batchSize - 1);
        
        if (fetchError) throw fetchError;
        if (!batch || batch.length === 0) break;
        
        validEntries += batch.filter(e => {
          const metadata = e.metadata as any;
          const musicCharts = metadata?.music_charts;
          if (Array.isArray(musicCharts)) {
            return musicCharts.length > 0;
          }
          return musicCharts && typeof musicCharts === 'object' && Object.keys(musicCharts).length > 0;
        }).length;
        
        offset += batchSize;
        
        if (musicChartsStopRef.current) {
          toast({ title: "Stopped", description: "Process stopped while counting" });
          setMusicChartsProgress({ current: 0, total: 0, isProcessing: false, shouldStop: false });
          return;
        }
      }
      
      const totalEntries = totalCount || 0;
      const invalidEntries = totalEntries - validEntries;

      console.log(`Music Charts - Total: ${totalEntries}, Valid: ${validEntries}, Invalid: ${invalidEntries}`);

      if (missingOnly && invalidEntries === 0) {
        toast({
          title: "Info",
          description: "All entries have music charts data!",
        });
        setMusicChartsProgress({ current: validEntries, total: totalEntries, isProcessing: false, shouldStop: false });
        return;
      }

      setMusicChartsProgress({ current: validEntries, total: totalEntries, isProcessing: true, shouldStop: false });
      toast({
        title: "Starting",
        description: missingOnly 
          ? `Processing ${invalidEntries} missing entries...` 
          : `Processing all ${totalEntries} entries...`,
      });

      let currentValidCount = validEntries;
      offset = 0;

      // 1000개씩 가져오되, 이미 처리된 것은 스킵
      while (true) {
        if (musicChartsStopRef.current) {
          toast({
            title: "Stopped",
            description: `Process stopped. ${currentValidCount}/${totalEntries} entries have music charts`,
          });
          setMusicChartsProgress({ current: currentValidCount, total: totalEntries, isProcessing: false, shouldStop: false });
          musicChartsStopRef.current = false;
          return;
        }

        const { data: batch, error: fetchError } = await supabase
          .from('wiki_entries')
          .select('id, title, metadata')
          .in('schema_type', ['artist', 'member'])
          .order('created_at', { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (fetchError) throw fetchError;
        if (!batch || batch.length === 0) break;

        // 이미 처리된 것 필터링
        const entriesToProcess = batch.filter(entry => {
          const metadata = entry.metadata as any;
          const musicCharts = metadata?.music_charts;
          const hasMusicCharts = Array.isArray(musicCharts) 
            ? musicCharts.length > 0 
            : musicCharts && typeof musicCharts === 'object' && Object.keys(musicCharts).length > 0;
          
          if (missingOnly) {
            return !hasMusicCharts; // missing만 처리
          } else {
            return true; // 전체 처리
          }
        });

        if (entriesToProcess.length === 0) {
          offset += batchSize;
          continue;
        }

        // 10개씩 처리
        const processBatchSize = 10;
        for (let i = 0; i < entriesToProcess.length; i += processBatchSize) {
          if (musicChartsStopRef.current) break;

          const processBatch = entriesToProcess.slice(i, i + processBatchSize);
          const batchIds = processBatch.map(e => e.id);
          
          try {
            const { data, error } = await supabase.functions.invoke('fetch-music-charts', {
              body: { 
                missingOnly: false,
                entryIds: batchIds 
              }
            });

            if (error) {
              console.error(`Error fetching music charts:`, error);
            } else if (data?.updated) {
              currentValidCount += data.updated;
              setMusicChartsProgress(prev => ({ 
                ...prev, 
                current: currentValidCount, 
                total: totalEntries, 
                isProcessing: true 
              }));
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (err) {
            console.error(`Failed to fetch music charts:`, err);
          }
        }

        offset += batchSize;
      }

      const entriesProcessed = currentValidCount - validEntries;
      setLastUpdated(prev => ({ ...prev, musicCharts: entriesProcessed }));
      
      toast({
        title: "Success",
        description: `Completed! Updated ${entriesProcessed} entries. Total with music charts: ${currentValidCount}/${totalEntries}`,
      });
      setMusicChartsProgress({ current: currentValidCount, total: totalEntries, isProcessing: false, shouldStop: false });
      musicChartsStopRef.current = false;
      await fetchData();
    } catch (error) {
      console.error('Error fetching music charts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch music charts",
        variant: "destructive",
      });
      setMusicChartsProgress({ current: 0, total: 0, isProcessing: false, shouldStop: false });
      musicChartsStopRef.current = false;
    }
  };

  const handleAutoFillEntries = async (type: 'artist' | 'member' | 'actor') => {
    try {
      autoFillStopRef.current = false;
      const targetCount = autoFillTargets[type];
      setAutoFillProgress({ current: 0, total: targetCount, isProcessing: true, type, shouldStop: false });
      
      toast({
        title: "Starting",
        description: `AI will fill up to ${targetCount} ${type}s in batches...`,
      });

      let totalCreated = 0;
      let totalAlreadyExists = 0;
      const batchSize = 50;
      const maxBatches = Math.ceil(targetCount / batchSize);

      for (let batch = 0; batch < maxBatches; batch++) {
        // Check if should stop using ref
        if (autoFillStopRef.current) {
          toast({
            title: "Stopped",
            description: `Process stopped. Created ${totalCreated} ${type}s`,
          });
          setAutoFillProgress({ current: 0, total: 0, isProcessing: false, type: '', shouldStop: false });
          autoFillStopRef.current = false;
          await fetchData();
          return;
        }

        console.log(`Processing batch ${batch + 1}/${maxBatches} for ${type}s`);
        
        const { data, error } = await supabase.functions.invoke('auto-fill-entries', {
          body: { type, count: batchSize }
        });
        
        if (error) {
          console.error('Batch error:', error);
          continue;
        }

        totalCreated += data?.created || 0;
        totalAlreadyExists += data?.already_exists || 0;
        
        setAutoFillProgress(prev => ({ 
          ...prev,
          current: Math.min(totalCreated + totalAlreadyExists, targetCount), 
          total: targetCount, 
          isProcessing: true
        }));

        // If no new entries were created in this batch, we've likely exhausted suggestions
        if ((data?.created || 0) === 0) {
          console.log('No new entries created, stopping batches');
          break;
        }

        // If we've reached the target, stop
        if (totalCreated >= targetCount) {
          break;
        }

        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      toast({
        title: "Success",
        description: `Auto-fill completed! Created ${totalCreated} new ${type}s, ${totalAlreadyExists} already existed.`,
      });
      setAutoFillProgress({ current: 0, total: 0, isProcessing: false, type: '', shouldStop: false });
      autoFillStopRef.current = false;
      await fetchData();
    } catch (error) {
      console.error('Error auto-filling entries:', error);
      toast({
        title: "Error",
        description: "Failed to auto-fill entries",
        variant: "destructive",
      });
      setAutoFillProgress({ current: 0, total: 0, isProcessing: false, type: '', shouldStop: false });
      autoFillStopRef.current = false;
    }
  };

  const handleApprovePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({
          is_approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post approved and is now visible to users.",
      });
      fetchData();
    } catch (error) {
      console.error('Error approving post:', error);
      toast({
        title: "Error",
        description: "Failed to approve post.",
        variant: "destructive",
      });
    }
  };

  const handleRejectPost = async (postId: string) => {
    if (!confirm("Are you sure you want to reject and delete this post?")) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post rejected and deleted.",
      });
      fetchData();
    } catch (error) {
      console.error('Error rejecting post:', error);
      toast({
        title: "Error",
        description: "Failed to reject post.",
        variant: "destructive",
      });
    }
  };

  const handleBulkCreateArtists = async () => {
    const groups = bulkGroupNames
      .split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (groups.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one group name",
        variant: "destructive",
      });
      return;
    }

    if (groups.length > 100) {
      toast({
        title: "Error",
        description: "Maximum 100 groups at a time",
        variant: "destructive",
      });
      return;
    }

    setIsBulkCreating(true);
    setCreationProgress({
      total: groups.length,
      processed: 0,
      created: 0,
      skipped: 0,
      currentGroup: "",
      createdGroups: [],
    });
    
    try {
      // 먼저 이미 존재하는 그룹을 데이터베이스에서 체크
      const { data: existingGroups } = await supabase
        .from('wiki_entries')
        .select('title')
        .eq('schema_type', 'artist')
        .in('title', groups)
        .limit(10000);
      
      const existingGroupNames = new Set(existingGroups?.map(g => g.title) || []);
      const newGroups = groups.filter(g => !existingGroupNames.has(g));
      const alreadyExistCount = groups.length - newGroups.length;

      if (alreadyExistCount > 0) {
        toast({
          title: "Filtered",
          description: `${alreadyExistCount} groups already exist and will be skipped`,
        });
      }

      if (newGroups.length === 0) {
        toast({
          title: "Info",
          description: "All groups already exist in the database",
        });
        setIsBulkCreating(false);
        return;
      }

      // 5개씩 배치 처리 (타임아웃 방지)
      const batchSize = 5;
      const totalResults = {
        total: newGroups.length,
        created: 0,
        skipped: 0,
        errors: [] as string[],
        skipped_groups: [] as string[],
        createdGroups: [] as string[]
      };

      for (let i = 0; i < newGroups.length; i += batchSize) {
        const batch = newGroups.slice(i, i + batchSize);
        const batchNum = Math.floor(i/batchSize) + 1;
        const totalBatches = Math.ceil(newGroups.length/batchSize);
        
        setCreationProgress(prev => ({
          ...prev,
          currentGroup: batch.join(', '),
          processed: i,
        }));

        const { data, error } = await supabase.functions.invoke('bulk-create-artists', {
          body: { groupNames: batch }
        });

        if (error) {
          console.error(`Batch ${batchNum} error:`, error);
          totalResults.errors.push(`Batch ${batchNum}: ${error.message}`);
          setCreationProgress(prev => ({
            ...prev,
            processed: Math.min(i + batchSize, newGroups.length),
          }));
          continue;
        }

        if (data) {
          totalResults.created += data.created || 0;
          totalResults.skipped += data.skipped || 0;
          if (data.errors) totalResults.errors.push(...data.errors);
          if (data.skipped_groups) totalResults.skipped_groups.push(...data.skipped_groups);
          if (data.groups) {
            const createdNames = data.groups.map((g: any) => g.name);
            totalResults.createdGroups.push(...createdNames);
            setCreationProgress(prev => ({
              ...prev,
              created: totalResults.created,
              skipped: totalResults.skipped,
              processed: Math.min(i + batchSize, newGroups.length),
              createdGroups: totalResults.createdGroups,
            }));
          }
        }

        // 배치 간 1초 대기
        if (i + batchSize < newGroups.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const successMsg = [
        `Created: ${totalResults.created} groups`,
        totalResults.skipped > 0 ? `Skipped: ${totalResults.skipped}` : null,
        totalResults.errors.length > 0 ? `Errors: ${totalResults.errors.length}` : null
      ].filter(Boolean).join(' | ');

      toast({
        title: "Completed",
        description: successMsg,
      });

      if (totalResults.skipped_groups.length > 0) {
        console.log('Skipped groups (already exist):', totalResults.skipped_groups);
      }

      if (totalResults.errors.length > 0) {
        console.log('Errors:', totalResults.errors);
      }

      setBulkGroupNames("");
    } catch (error) {
      console.error('Error bulk creating artists:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create artists",
        variant: "destructive",
      });
    } finally {
      setIsBulkCreating(false);
      // Refresh wiki statistics
      fetchData();
    }
  };

  const handleSuggestGroups = async () => {
    setIsSuggestingGroups(true);
    try {
      toast({
        title: "Requesting AI Suggestions",
        description: `Getting 100 K-pop group recommendations...`,
      });

      // Get more suggestions from AI (100 groups)
      const { data, error } = await supabase.functions.invoke('suggest-kpop-groups', {
        body: { 
          count: 100
        }
      });

      if (error) throw error;

      if (data?.groups && Array.isArray(data.groups)) {
        // Fetch existing artists from database
        const { data: existingArtists } = await supabase
          .from('wiki_entries')
          .select('title')
          .eq('schema_type', 'artist' as any)
          .limit(10000);
        
        const existingGroupNames = new Set(
          existingArtists?.map(a => a.title.toLowerCase().trim()) || []
        );
        
        // Filter out groups that already exist in database
        const newGroups = data.groups.filter(
          (group: string) => !existingGroupNames.has(group.toLowerCase().trim())
        );
        
        setBulkGroupNames(newGroups.join('\n'));
        toast({
          title: "Success",
          description: `Found ${newGroups.length} new K-pop groups (filtered ${data.groups.length - newGroups.length} existing)`,
        });
      }
    } catch (error) {
      console.error('Error suggesting groups:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to suggest groups",
        variant: "destructive",
      });
    } finally {
      setIsSuggestingGroups(false);
    }
  };

  const handleSuggestActors = async () => {
    setIsSuggestingActors(true);
    try {
      toast({
        title: "Requesting AI Suggestions",
        description: `Getting 100 Korean actor recommendations...`,
      });

      // Get suggestions from AI (100 actors)
      const { data, error } = await supabase.functions.invoke('suggest-actors', {
        body: { 
          count: 100
        }
      });

      if (error) throw error;

      if (data?.actors && Array.isArray(data.actors)) {
        // Fetch existing actors from database
        const { data: existingActors } = await supabase
          .from('wiki_entries')
          .select('title')
          .eq('schema_type', 'actor' as any)
          .limit(10000);
        
        const existingActorNames = new Set(
          existingActors?.map(a => a.title.toLowerCase().trim()) || []
        );
        
        // Filter out actors that already exist in database
        const newActors = data.actors.filter(
          (actor: string) => !existingActorNames.has(actor.toLowerCase().trim())
        );
        
        setBulkActorNames(newActors.join('\n'));
        toast({
          title: "Success",
          description: `Found ${newActors.length} new actors (filtered ${data.actors.length - newActors.length} existing)`,
        });
      }
    } catch (error) {
      console.error('Error suggesting actors:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to suggest actors",
        variant: "destructive",
      });
    } finally {
      setIsSuggestingActors(false);
    }
  };

  const handleBulkCreateActors = async () => {
    const actorList = bulkActorNames
      .split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (actorList.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one actor name",
        variant: "destructive",
      });
      return;
    }

    if (actorList.length > 100) {
      toast({
        title: "Error",
        description: "Maximum 100 actors allowed per request",
        variant: "destructive",
      });
      return;
    }

    setIsBulkCreatingActors(true);
    setActorCreationProgress({
      total: actorList.length,
      processed: 0,
      created: 0,
      skipped: 0,
      currentActor: "",
      createdActors: [],
    });

    try {
      toast({
        title: "Creating Actors",
        description: `Processing ${actorList.length} actors...`,
      });

      const batchSize = 10;
      const totalResults = {
        created: 0,
        skipped: 0,
        errors: [] as any[],
        createdActors: [] as string[],
      };

      for (let i = 0; i < actorList.length; i += batchSize) {
        const batch = actorList.slice(i, Math.min(i + batchSize, actorList.length));
        
        setActorCreationProgress(prev => ({
          ...prev,
          currentActor: batch[0],
        }));

        const { data, error } = await supabase.functions.invoke('bulk-create-actors', {
          body: { actorNames: batch }
        });

        if (error) {
          console.error('Batch error:', error);
          setActorCreationProgress(prev => ({
            ...prev,
            processed: Math.min(i + batchSize, actorList.length),
          }));
          continue;
        }

        if (data) {
          totalResults.created += data.created?.length || 0;
          totalResults.skipped += data.skipped?.length || 0;
          if (data.errors) totalResults.errors.push(...data.errors);
          if (data.created) {
            totalResults.createdActors.push(...data.created);
            setActorCreationProgress(prev => ({
              ...prev,
              created: totalResults.created,
              skipped: totalResults.skipped,
              processed: Math.min(i + batchSize, actorList.length),
              createdActors: totalResults.createdActors,
            }));
          }
        }

        if (i + batchSize < actorList.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const successMsg = [
        `Created: ${totalResults.created} actors`,
        totalResults.skipped > 0 ? `Skipped: ${totalResults.skipped}` : null,
        totalResults.errors.length > 0 ? `Errors: ${totalResults.errors.length}` : null
      ].filter(Boolean).join(' | ');

      toast({
        title: "Completed",
        description: successMsg,
      });

      if (totalResults.errors.length > 0) {
        console.log('Errors:', totalResults.errors);
      }

      setBulkActorNames("");
    } catch (error) {
      console.error('Error bulk creating actors:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create actors",
        variant: "destructive",
      });
    } finally {
      setIsBulkCreatingActors(false);
      fetchData();
    }
  };

  const handleMigrateBirthdays = async () => {
    if (!confirm("Migrate birthday information from content to metadata for actor entries? This will process 10 entries at a time.")) {
      return;
    }

    setIsMigratingBirthdays(true);
    setMigrationProgress({
      processed: 0,
      updated: 0,
    });

    try {
      toast({
        title: "Migrating Birthdays",
        description: "Starting batch processing...",
      });

      const { data, error } = await supabase.functions.invoke('migrate-actor-birthdays');

      if (error) {
        console.error('Migration error:', error);
        throw error;
      }

      if (data) {
        setMigrationProgress({
          processed: data.processed || 0,
          updated: data.updated || 0,
        });

        if (data.processed === 0) {
          toast({
            title: "Complete",
            description: "No more actors to process!",
          });
        } else {
          toast({
            title: "Success",
            description: `Processed ${data.processed} actors, updated ${data.updated} birthdays`,
          });
        }

        // Refresh wiki stats
        fetchData();
      }
    } catch (error: any) {
      console.error('Error migrating birthdays:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to migrate birthdays",
        variant: "destructive",
      });
    } finally {
      setIsMigratingBirthdays(false);
    }
  };

  const handleFetchMissingImages = async () => {
    if (!confirm("Fetch images for all wiki entries without images? This will process in batches of 10.")) {
      return;
    }

    setIsFetchingImages(true);
    setImageFetchProgress({
      total: 0,
      updated: 0,
      failed: 0,
    });

    try {
      toast({
        title: "Fetching Images",
        description: "Starting batch processing...",
      });

      let totalUpdated = 0;
      let totalFailed = 0;
      let batchCount = 0;
      let hasMore = true;

      // Process in batches until no more entries
      while (hasMore) {
        batchCount++;
        
        const { data, error } = await supabase.functions.invoke('fetch-missing-images');

        if (error) {
          console.error(`Batch ${batchCount} error:`, error);
          throw error;
        }

        if (data) {
          totalUpdated += data.updated || 0;
          totalFailed += data.failed || 0;
          
          setImageFetchProgress({
            total: totalUpdated + totalFailed,
            updated: totalUpdated,
            failed: totalFailed,
          });

          // If processed less than 10, we're done
          if (data.total < 10) {
            hasMore = false;
          }

          // Wait 2 seconds between batches to avoid rate limits
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } else {
          hasMore = false;
        }
      }

      const successMsg = [
        `Batches: ${batchCount}`,
        `Updated: ${totalUpdated}`,
        totalFailed > 0 ? `Failed: ${totalFailed}` : null
      ].filter(Boolean).join(' | ');

      toast({
        title: "Images Fetched",
        description: successMsg,
      });

      fetchData();
    } catch (error) {
      console.error('Error fetching missing images:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch images",
        variant: "destructive",
      });
    } finally {
      setIsFetchingImages(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!productForm.name || productForm.points <= 0 || productForm.price_usd <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please fill in all required fields with valid values.",
        variant: "destructive",
      });
      return;
    }

    if (productForm.product_type === 'subscription' && !productForm.billing_interval) {
      toast({
        title: "Invalid Input",
        description: "Subscription products require a billing interval.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('point_products')
        .insert([productForm]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product created successfully.",
      });

      setProductForm({
        name: '',
        description: '',
        points: 0,
        price_usd: 0,
        product_type: 'one_time',
        billing_interval: '',
        badge_text: '',
        stripe_price_id: '',
        display_order: 0,
      });

      fetchData();
    } catch (error) {
      console.error('Error creating product:', error);
      toast({
        title: "Error",
        description: "Failed to create product.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateProduct = async (productId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('point_products')
        .update(updates)
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product updated successfully.",
      });

      setEditingProduct(null);
      fetchData();
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "Error",
        description: "Failed to update product.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const { error } = await supabase
        .from('point_products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product deleted successfully.",
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Error",
        description: "Failed to delete product.",
        variant: "destructive",
      });
    }
  };

  const handleToggleProductActive = async (productId: string, currentStatus: boolean) => {
    await handleUpdateProduct(productId, { is_active: !currentStatus });
  };

  // Badge management handlers
  const handleCreateBadge = async () => {
    if (!badgeForm.name || !badgeForm.icon || badgeForm.usd_price <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('gift_badges')
        .insert([badgeForm]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Badge created successfully.",
      });

      setBadgeForm({
        name: '',
        icon: '',
        description: '',
        usd_price: 10,
        point_price: 50,
        color: '#FF4500',
        display_order: 0,
        stripe_price_id: '',
      });

      fetchData();
    } catch (error) {
      console.error('Error creating badge:', error);
      toast({
        title: "Error",
        description: "Failed to create badge.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateBadge = async (badgeId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('gift_badges')
        .update(updates)
        .eq('id', badgeId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Badge updated successfully.",
      });

      setEditingBadge(null);
      fetchData();
    } catch (error) {
      console.error('Error updating badge:', error);
      toast({
        title: "Error",
        description: "Failed to update badge.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteBadge = async (badgeId: string) => {
    if (!confirm("Are you sure you want to delete this badge?")) return;

    try {
      const { error } = await supabase
        .from('gift_badges')
        .delete()
        .eq('id', badgeId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Badge deleted successfully.",
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting badge:', error);
      toast({
        title: "Error",
        description: "Failed to delete badge.",
        variant: "destructive",
      });
    }
  };

  const handleToggleBadgeActive = async (badgeId: string, currentStatus: boolean) => {
    await handleUpdateBadge(badgeId, { is_active: !currentStatus });
  };

  const fetchDuplicates = async () => {
    setLoadingDuplicates(true);
    try {
      const { data: entries, error } = await supabase
        .from('wiki_entries')
        .select('id, title, schema_type, created_at, metadata, image_url')
        .in('schema_type', ['artist', 'member', 'actor'])
        .order('title', { ascending: true });

      if (error) throw error;

      // Group by title (case-insensitive) and schema_type
      const grouped = new Map<string, any[]>();
      
      entries?.forEach(entry => {
        const key = `${entry.schema_type}:${entry.title.toLowerCase().trim()}`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(entry);
      });

      // Filter only groups with more than 1 entry
      const duplicateGroups: Record<string, any[]> = {};
      grouped.forEach((group, key) => {
        if (group.length > 1) {
          duplicateGroups[key] = group.sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        }
      });

      setDuplicates(duplicateGroups);
    } catch (error) {
      console.error('Error fetching duplicates:', error);
      toast({
        title: "Error",
        description: "Failed to fetch duplicate entries",
        variant: "destructive",
      });
    } finally {
      setLoadingDuplicates(false);
    }
  };

  const handleDeleteDuplicateEntry = async (entryId: string, title: string) => {
    if (!confirm(`Delete this entry: "${title}"?`)) return;

    try {
      const { error } = await supabase
        .from('wiki_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Entry deleted successfully",
      });

      // Refresh duplicates list
      fetchDuplicates();
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: "Error",
        description: "Failed to delete entry",
        variant: "destructive",
      });
    }
  };

  const handleDeduplicateWikiEntries = async (type: 'artist' | 'member' | 'actor') => {
    if (!confirm(`Remove duplicate ${type} entries? This will keep the oldest entry for each duplicate name.`)) {
      return;
    }

    setDeduplicateProgress({
      type,
      isProcessing: true,
      total: 0,
      removed: 0,
    });
    deduplicateStopRef.current = false;

    try {
      // Fetch all entries of this type
      const { data: entries, error: fetchError } = await supabase
        .from('wiki_entries')
        .select('id, title, created_at')
        .eq('schema_type', type)
        .order('title', { ascending: true });

      if (fetchError) throw fetchError;

      // Group by title (case-insensitive)
      const groupedByTitle = new Map<string, typeof entries>();
      entries?.forEach(entry => {
        const normalizedTitle = entry.title.toLowerCase().trim();
        if (!groupedByTitle.has(normalizedTitle)) {
          groupedByTitle.set(normalizedTitle, []);
        }
        groupedByTitle.get(normalizedTitle)!.push(entry);
      });

      // Find duplicates (groups with more than 1 entry)
      const duplicateGroups = Array.from(groupedByTitle.values())
        .filter(group => group.length > 1);

      if (duplicateGroups.length === 0) {
        toast({
          title: "No Duplicates Found",
          description: `No duplicate ${type} entries found.`,
        });
        setDeduplicateProgress({
          type: '',
          isProcessing: false,
          total: 0,
          removed: 0,
        });
        return;
      }

      const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0);
      setDeduplicateProgress(prev => ({ ...prev, total: totalDuplicates }));

      let removed = 0;

      // For each duplicate group, keep the oldest (earliest created_at), delete the rest
      for (const group of duplicateGroups) {
        if (deduplicateStopRef.current) break;

        // Sort by created_at ascending (oldest first)
        const sorted = group.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        // Keep the first (oldest), delete the rest
        const toDelete = sorted.slice(1);

        for (const entry of toDelete) {
          if (deduplicateStopRef.current) break;

          const { error: deleteError } = await supabase
            .from('wiki_entries')
            .delete()
            .eq('id', entry.id);

          if (!deleteError) {
            removed++;
            setDeduplicateProgress(prev => ({ ...prev, removed }));
          }
        }
      }

      toast({
        title: "Duplicates Removed",
        description: `Removed ${removed} duplicate ${type} entries.`,
      });

      fetchData();
    } catch (error) {
      console.error('Error removing duplicates:', error);
      toast({
        title: "Error",
        description: `Failed to remove duplicate ${type} entries.`,
        variant: "destructive",
      });
    } finally {
      setDeduplicateProgress({
        type: '',
        isProcessing: false,
        total: 0,
        removed: 0,
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-6">
          <div className="text-center py-12">Checking permissions...</div>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-6">
          <div className="text-center py-12">Loading admin data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-7xl">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">Admin Panel</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          {/* Mobile: Dropdown Menu */}
          <div className="md:hidden">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dashboard">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Dashboard
                  </div>
                </SelectItem>
                <SelectItem value="wiki-entries">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Wiki Entries
                  </div>
                </SelectItem>
                <SelectItem value="wiki-data">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Wiki Data
                  </div>
                </SelectItem>
                <SelectItem value="auto-generate">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Auto Generate
                  </div>
                </SelectItem>
                <SelectItem value="bulk-artists">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Bulk Artists
                  </div>
                </SelectItem>
                <SelectItem value="pending">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Pending ({pendingPosts.length})
                  </div>
                </SelectItem>
                <SelectItem value="posts">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Posts
                  </div>
                </SelectItem>
                <SelectItem value="communities">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4" />
                    Communities
                  </div>
                </SelectItem>
                <SelectItem value="users">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Users
                  </div>
                </SelectItem>
                <SelectItem value="user-verification">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4" />
                    Verification
                  </div>
                </SelectItem>
                <SelectItem value="points">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    Stars
                  </div>
                </SelectItem>
                <SelectItem value="products">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Products
                  </div>
                </SelectItem>
                <SelectItem value="badges">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    Badges
                  </div>
                </SelectItem>
                <SelectItem value="duplicates">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Duplicates
                  </div>
                </SelectItem>
                <SelectItem value="withdrawals">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Withdrawals
                  </div>
                </SelectItem>
                <SelectItem value="blocked-emails">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Blocked Emails
                  </div>
                </SelectItem>
                <SelectItem value="farcaster">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Farcaster Frame
                  </div>
                </SelectItem>
                <SelectItem value="email-templates">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Templates
                  </div>
                </SelectItem>
                <SelectItem value="entry-scores">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Entry Scores
                  </div>
                </SelectItem>
                <SelectItem value="master-applications">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    Master Apps {masterApplications.filter(a => a.status === 'pending').length > 0 && `(${masterApplications.filter(a => a.status === 'pending').length})`}
                  </div>
                </SelectItem>
                <SelectItem value="challenges">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Challenges
                  </div>
                </SelectItem>
                <SelectItem value="vesting">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    KTNZ Vesting
                  </div>
                </SelectItem>
                <SelectItem value="onchain-transactions">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Onchain Tx
                  </div>
                </SelectItem>
                <SelectItem value="banners">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Banners
                  </div>
                </SelectItem>
                <SelectItem value="ui-settings">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    UI Settings
                  </div>
                </SelectItem>
                <SelectItem value="bot-detector">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    Bot Detector
                  </div>
                </SelectItem>
                <SelectItem value="agent-verification">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Agents V2
                  </div>
                </SelectItem>
                <SelectItem value="agent-chat-settings">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Agent Chat
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Desktop: Tabs */}
          <TabsList className="hidden md:flex md:flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="dashboard" className="gap-2">
              <Activity className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="wiki-entries" className="gap-2">
              <FileText className="w-4 h-4" />
              Wiki Entries
            </TabsTrigger>
            <TabsTrigger value="wiki-data" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Wiki Data
            </TabsTrigger>
            <TabsTrigger value="auto-generate" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Auto Generate
            </TabsTrigger>
            <TabsTrigger value="bulk-artists" className="gap-2">
              <Users className="w-4 h-4" />
              Bulk Artists
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" />
              Pending ({pendingPosts.length})
            </TabsTrigger>
            <TabsTrigger value="posts" className="gap-2">
              <FileText className="w-4 h-4" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="communities" className="gap-2">
              <BadgeCheck className="w-4 h-4" />
              Communities
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="owner-applications" className="gap-2 relative">
              <User className="w-4 h-4" />
              Owner Apps
              {ownerApplications.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1">
                  {ownerApplications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="user-verification" className="gap-2">
              <BadgeCheck className="w-4 h-4" />
              Verification
            </TabsTrigger>
            <TabsTrigger value="points" className="gap-2">
              <Coins className="w-4 h-4" />
              Stars
            </TabsTrigger>
            <TabsTrigger value="wiki-roles" className="gap-2">
              <Shield className="w-4 h-4" />
              Wiki Roles
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <Package className="w-4 h-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="badges" className="gap-2">
              <Gift className="w-4 h-4" />
              Badges
            </TabsTrigger>
            <TabsTrigger value="schema-relationships" className="gap-2">
              <Activity className="w-4 h-4" />
              Schema Relations
            </TabsTrigger>
            <TabsTrigger value="duplicates" className="gap-2">
              <Trash2 className="w-4 h-4" />
              Duplicates
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Withdrawals ({withdrawalRequests.filter(r => r.status === 'pending').length})
            </TabsTrigger>
            <TabsTrigger value="blocked-emails" className="gap-2">
              <Shield className="w-4 h-4" />
              Blocked Emails
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Tag className="w-4 h-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="farcaster" className="gap-2">
              <Zap className="w-4 h-4" />
              Farcaster Frame
            </TabsTrigger>
            <TabsTrigger value="email-templates" className="gap-2">
              <Mail className="w-4 h-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="entry-scores" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Entry Scores
            </TabsTrigger>
            <TabsTrigger value="vesting" className="gap-2">
              <Lock className="w-4 h-4" />
              KTNZ Vesting
            </TabsTrigger>
            <TabsTrigger value="master-applications" className="gap-2 relative">
              <Star className="w-4 h-4" />
              Master Apps
              {masterApplications.filter(a => a.status === 'pending').length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1">
                  {masterApplications.filter(a => a.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="challenges" className="gap-2">
              <Trophy className="w-4 h-4" />
              Challenges
            </TabsTrigger>
            <TabsTrigger value="onchain-transactions" className="gap-2">
              <Zap className="w-4 h-4" />
              Onchain Tx
            </TabsTrigger>
            <TabsTrigger value="banners" className="gap-2">
              <FileText className="w-4 h-4" />
              Banners
            </TabsTrigger>
            <TabsTrigger value="ui-settings" className="gap-2">
              <Settings className="w-4 h-4" />
              UI Settings
            </TabsTrigger>
            <TabsTrigger value="bot-detector" className="gap-2">
              <Bot className="w-4 h-4" />
              Bot Detector
            </TabsTrigger>
            <TabsTrigger value="agent-verification" className="gap-2">
              <Shield className="w-4 h-4" />
              Agents V2
            </TabsTrigger>
            <TabsTrigger value="agent-chat-settings" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Agent Chat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            {/* User Activity & Withdrawals */}
            <AdminUserActivity />

            {/* Wiki Entries Statistics */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">Artists</CardTitle>
                  <Music className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">{wikiStats.totalArtists}</div>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                    K-pop groups in database
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Members</CardTitle>
                  <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{wikiStats.totalMembers}</div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Individual idols tracked
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">Actors</CardTitle>
                  <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">{wikiStats.totalActors}</div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Korean actors/actresses
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* General Statistics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card 
                className="cursor-pointer hover:bg-accent/5 transition-colors"
                onClick={() => setActiveTab('users')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                  <p className="text-xs text-muted-foreground">
                    +{stats.recentUsers} in last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalPosts}</div>
                  <p className="text-xs text-muted-foreground">
                    All time posts
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalVotes}</div>
                  <p className="text-xs text-muted-foreground">
                    Community engagement
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Posts/User</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalUsers > 0 ? (stats.totalPosts / stats.totalUsers).toFixed(1) : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    User activity metric
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* On-chain Statistics */}
            <div className="grid gap-4 md:grid-cols-2 mt-6">
              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-100">On-chain DAU</CardTitle>
                  <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">{stats.onchainDau}</div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                    Today's active users (tx_hash recorded)
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 border-cyan-200 dark:border-cyan-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-cyan-900 dark:text-cyan-100">On-chain MAU</CardTitle>
                  <BarChart3 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-cyan-900 dark:text-cyan-100">{stats.onchainMau}</div>
                  <p className="text-xs text-cyan-700 dark:text-cyan-300 mt-1">
                    30-day active users (tx_hash recorded)
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">SEO Management</h2>
                <Button 
                  onClick={handleUpdateSitemap}
                  disabled={isUpdatingSitemap}
                  className="gap-2"
                >
                  {isUpdatingSitemap ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Update Sitemap
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Generate the latest sitemap for search engines. The sitemap includes all posts and static pages.
              </p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Fanz Token Management</h2>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCleanupLegacyTokens}
                    disabled={isCleaningLegacyTokens || isDeletingAllTokens}
                    variant="destructive"
                    className="gap-2"
                  >
                    {isCleaningLegacyTokens ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cleaning...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Cleanup Legacy Tokens
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={handleDeleteAllTokens}
                    disabled={isCleaningLegacyTokens || isDeletingAllTokens}
                    variant="destructive"
                    className="gap-2"
                  >
                    {isDeletingAllTokens ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete All Tokens
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2 mb-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Legacy ETH Contract (0x8B6d...346E)</span>
                  <Button 
                    onClick={handleCheckLegacyContract}
                    disabled={isCheckingLegacyContract}
                    variant="outline"
                    size="sm"
                  >
                    {isCheckingLegacyContract ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                </div>
                {legacyContractBalance && (
                  <div className="text-sm space-y-1">
                    <p>Balance: <strong>{legacyContractBalance.balanceEth} ETH</strong> (~${legacyContractBalance.balanceUsd})</p>
                    <p className="text-destructive text-xs">{legacyContractBalance.withdrawMessage}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Cleanup Legacy Tokens:</strong> Remove only legacy tokens (contract_address = null). Safe for keeping on-chain tokens.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Delete All Tokens:</strong> ⚠️ Remove ALL tokens including on-chain tokens. Use this to reset the entire token system.
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Users</h2>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>XP / Points</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(users) && users.slice(0, 5).map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.display_name || '-'}</TableCell>
                        <TableCell>{user.current_level}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span className="font-bold text-primary">{user.total_points} XP</span>
                            <span className="text-muted-foreground">{user.available_points} pts</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* Wiki Entries Tab */}
          <TabsContent value="wiki-entries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Wiki Entries Management</CardTitle>
                <CardDescription>
                  View and manage wiki entry basic information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Metadata Migration Tool */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3">
                  <div className="flex items-start gap-3">
                    <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                        Migrate Metadata to Structured Fields
                      </h3>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Copy existing metadata (birthday, real_name, gender, etc.) to new structured columns for better search and filtering.
                      </p>
                      {isMigratingMetadata && (
                        <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                              Batch #{metadataMigrationProgress.currentBatch} - Processing {metadataMigrationProgress.processed} / {metadataMigrationProgress.total}
                            </span>
                          </div>
                          {metadataMigrationProgress.currentTitle && (
                            <p className="text-xs text-muted-foreground">
                              Current: <span className="font-medium">{metadataMigrationProgress.currentTitle}</span>
                            </p>
                          )}
                          <div className="flex gap-4 text-xs">
                            <p className="text-blue-600 dark:text-blue-400 font-medium">
                              Updated: {metadataMigrationProgress.updated}
                            </p>
                            <p className="text-orange-600 dark:text-orange-400 font-medium">
                              Remaining: {metadataMigrationProgress.remaining}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Migration Results */}
                      {migrationResults && (
                        <div className="space-y-4 p-4 bg-white dark:bg-black/30 rounded-lg border">
                          <div className="grid gap-4 md:grid-cols-2">
                            {/* Filled Data */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-green-600 dark:text-green-400 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Filled ({migrationResults.filled.length})
                              </h4>
                              <div className="max-h-60 overflow-y-auto space-y-1 text-xs">
                                {migrationResults.filled.map((item, idx) => (
                                  <div key={idx} className="p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                                    <div className="font-medium">{item.title}</div>
                                    <div className="text-muted-foreground">{item.fields.join(', ')}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Empty Data */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Empty ({migrationResults.empty.length})
                              </h4>
                              <div className="max-h-60 overflow-y-auto space-y-1 text-xs">
                                {migrationResults.empty.map((item, idx) => (
                                  <div key={idx} className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
                                    <div className="font-medium">{item.title}</div>
                                    <div className="text-muted-foreground">No metadata found</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => setMigrationResults(null)}
                            variant="outline"
                            className="w-full rounded-full"
                          >
                            Close Results
                          </Button>
                        </div>
                      )}
                      <Button
                        onClick={async () => {
                          setIsMigratingMetadata(true);
                          setMetadataMigrationProgress({ processed: 0, updated: 0, total: 0, remaining: 0, currentTitle: '', currentBatch: 0 });
                          setMigrationResults(null);
                          
                          try {
                            // First, check total entries to process
                            const { count: totalCount } = await supabase
                              .from('wiki_entries')
                              .select('*', { count: 'exact', head: true })
                              .in('schema_type', ['member', 'actor']);
                            
                            if (!totalCount || totalCount === 0) {
                              toast({
                                title: "No Entries",
                                description: "No entries found to process.",
                              });
                              setIsMigratingMetadata(false);
                              return;
                            }
                            
                            console.log(`Starting migration: ${totalCount} total entries to process`);
                            
                            let totalUpdated = 0;
                            let totalProcessed = 0;
                            const allFilledEntries: Array<{ title: string; fields: string[] }> = [];
                            const allEmptyEntries: Array<{ title: string }> = [];
                            let batchNumber = 0;
                            let lastProcessedId: string | null = null;
                            let hasMore = true;
                            
                            // Continue processing batches until no more entries
                            while (hasMore) {
                              batchNumber++;
                              
                              // Build query: fetch next 1000 entries by ID order
                              let query = supabase
                                .from('wiki_entries')
                                .select('id, title, metadata, real_name, birth_date, gender, nationality, blood_type, height, weight')
                                .in('schema_type', ['member', 'actor'])
                                .order('id', { ascending: true })
                                .limit(1000);
                              
                              // If we have a last processed ID, start from there
                              if (lastProcessedId) {
                                query = query.gt('id', lastProcessedId);
                              }
                              
                              const { data: entries, error } = await query;
                              
                              if (error) throw error;
                              
                              if (!entries || entries.length === 0) {
                                hasMore = false;
                                console.log('No more entries to process');
                                break;
                              }
                              
                              console.log(`Batch #${batchNumber}: Processing ${entries.length} entries (from ID: ${entries[0].id})`);
                              
                              setMetadataMigrationProgress(prev => ({
                                ...prev,
                                currentBatch: batchNumber,
                                remaining: totalCount - totalProcessed
                              }));
                              
                              let batchUpdated = 0;
                              
                              for (const entry of entries) {
                                // metadata가 없으면 스킵
                                if (!entry.metadata || Object.keys(entry.metadata).length === 0) {
                                  allEmptyEntries.push({ title: entry.title });
                                  lastProcessedId = entry.id;
                                  totalProcessed++;
                                  continue;
                                }
                                
                                // 모든 필드가 이미 채워져 있으면 스킵
                                const hasAllFields = 
                                  entry.real_name !== null &&
                                  entry.birth_date !== null &&
                                  entry.gender !== null &&
                                  entry.nationality !== null &&
                                  entry.blood_type !== null &&
                                  entry.height !== null &&
                                  entry.weight !== null;
                                
                                if (hasAllFields) {
                                  lastProcessedId = entry.id;
                                  totalProcessed++;
                                  continue;
                                }
                                
                                setMetadataMigrationProgress(prev => ({ 
                                  ...prev, 
                                  currentTitle: entry.title,
                                  processed: totalProcessed + 1,
                                  total: entries.length,
                                  currentBatch: batchNumber,
                                  remaining: totalCount - totalProcessed
                                }));
                                
                                const metadata = entry.metadata as any;
                                const updates: any = {};
                                const updatedFields: string[] = [];
                                
                                // Parse birthday
                                if (metadata?.birthday) {
                                  try {
                                    updates.birth_date = metadata.birthday;
                                    updatedFields.push('birth_date');
                                  } catch (e) {
                                    console.error(`Invalid birthday for ${entry.title}:`, metadata.birthday);
                                  }
                                }
                                
                                // Parse other fields
                                if (metadata?.real_name) {
                                  updates.real_name = metadata.real_name;
                                  updatedFields.push('real_name');
                                }
                                if (metadata?.gender) {
                                  updates.gender = metadata.gender;
                                  updatedFields.push('gender');
                                }
                                if (metadata?.nationality) {
                                  updates.nationality = metadata.nationality;
                                  updatedFields.push('nationality');
                                }
                                if (metadata?.blood_type) {
                                  updates.blood_type = metadata.blood_type;
                                  updatedFields.push('blood_type');
                                }
                                
                                // Parse numeric fields
                                if (metadata?.height && !isNaN(parseInt(metadata.height))) {
                                  updates.height = parseInt(metadata.height);
                                  updatedFields.push('height');
                                }
                                if (metadata?.weight && !isNaN(parseInt(metadata.weight))) {
                                  updates.weight = parseInt(metadata.weight);
                                  updatedFields.push('weight');
                                }
                                
                                // IMPORTANT: 처리 시도한 항목은 다음 실행에서 제외되도록
                                // nationality가 없으면 'Unknown'으로 설정하여 다음 쿼리에서 제외
                                const isEmpty = updatedFields.length === 0;
                                if (isEmpty) {
                                  allEmptyEntries.push({ title: entry.title });
                                } else {
                                  allFilledEntries.push({ title: entry.title, fields: updatedFields });
                                }
                                
                                // 모든 처리된 항목의 nationality를 설정 (이미 있으면 유지, 없으면 Unknown)
                                if (!updates.nationality && !entry.nationality) {
                                  updates.nationality = 'Unknown';
                                }
                                
                                // Update entry
                                await supabase
                                  .from('wiki_entries')
                                  .update(updates)
                                  .eq('id', entry.id);
                                batchUpdated++;
                                totalProcessed++;
                                lastProcessedId = entry.id;
                                
                                setMetadataMigrationProgress(prev => ({ 
                                  ...prev, 
                                  processed: totalProcessed,
                                  updated: totalUpdated + batchUpdated,
                                  currentTitle: entry.title,
                                  currentBatch: batchNumber,
                                  remaining: totalCount - totalProcessed
                                }));
                              }
                              
                              totalUpdated += batchUpdated;
                              
                              console.log(`Batch #${batchNumber} complete: ${batchUpdated} updated, ${totalProcessed} total processed, lastId: ${lastProcessedId}`);
                              
                              // If we processed less than 1000, we're done
                              if (entries.length < 1000) {
                                hasMore = false;
                                console.log('Migration complete: last batch had less than 1000 entries');
                              }
                            }
                            
                            console.log(`Migration finished: ${totalUpdated} total updated, ${allFilledEntries.length} filled, ${allEmptyEntries.length} empty`);
                            
                            setMigrationResults({
                              filled: allFilledEntries,
                              empty: allEmptyEntries
                            });
                            
                            // Auto-refresh statistics after migration
                            await fetchDbStats();
                            
                            toast({
                              title: "Migration Complete",
                              description: `Updated ${totalUpdated} entries. Filled: ${allFilledEntries.length}, Empty: ${allEmptyEntries.length}. Statistics refreshed.`,
                            });
                          } catch (error) {
                            console.error('Migration error:', error);
                            toast({
                              title: "Migration Error",
                              description: "Failed to migrate metadata.",
                              variant: "destructive",
                            });
                          } finally {
                            setIsMigratingMetadata(false);
                          }
                        }}
                        disabled={isMigratingMetadata}
                        className="w-full rounded-full gap-2"
                        variant="outline"
                      >
                        {isMigratingMetadata ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Migrating Data...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            Migrate Metadata to Columns
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Database Statistics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Entries
                      </CardTitle>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dbStats.totalEntries}</div>
                      <p className="text-xs text-muted-foreground">
                        Member, Actor, Artist entries
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Migrated
                      </CardTitle>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dbStats.migratedEntries}</div>
                      <p className="text-xs text-muted-foreground">
                        {dbStats.totalEntries > 0 ? Math.round((dbStats.migratedEntries / dbStats.totalEntries) * 100) : 0}% complete
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Pending
                      </CardTitle>
                      <Clock className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dbStats.pendingEntries}</div>
                      <p className="text-xs text-muted-foreground">
                        Awaiting migration
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        By Type
                      </CardTitle>
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {Object.entries(dbStats.byType).map(([type, stats]) => (
                          <div key={type} className="flex justify-between text-xs">
                            <span className="font-medium capitalize">{type}:</span>
                            <span className="text-muted-foreground">
                              {stats.migrated}/{stats.total}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Field-by-Field Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Field Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(dbStats.byField).map(([field, stats]) => (
                        <div key={field} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                          <span className="text-sm font-medium capitalize">{field.replace('_', ' ')}:</span>
                          <span className="text-sm text-muted-foreground">
                            {stats.filled} / {stats.total}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <Button
                    onClick={async () => {
                      setIsAutoFillingDetails(true);
                      setShowPersonDetailsDialog(true);
                      personDetailsStopRef.current = false;
                      
                      try {
                        // 전체 항목 수 먼저 가져오기
                        const { count: totalCount } = await supabase
                          .from('wiki_entries')
                          .select('*', { count: 'exact', head: true })
                          .in('schema_type', ['member', 'actor', 'artist'])
                          .or('real_name.is.null,birth_date.is.null,gender.is.null,nationality.is.null,blood_type.is.null,height.is.null,weight.is.null');

                        const totalEntries = totalCount || 0;
                        console.log('[Person Details] Initial count:', totalEntries);
                        setPersonDetailsProgress({ 
                          total: totalEntries, 
                          processed: 0, 
                          updated: 0, 
                          failed: 0, 
                          batches: 0, 
                          currentEntry: '',
                          details: [] 
                        });
                        
                        toast({
                          title: "Starting Auto Fill",
                          description: `Found ${totalEntries} entries to process. Processing in batches of 20...`,
                        });

                        const { data: session } = await supabase.auth.getSession();
                        if (!session.session) {
                          throw new Error('Not authenticated');
                        }

                        // 배치별 처리 함수
                        let totalProcessed = 0;
                        let totalUpdated = 0;
                        let totalFailed = 0;
                        
                        const processBatch = async () => {
                          try {
                            console.log('[Person Details] Starting batch #', totalProcessed / 20 + 1);
                            
                            const { data, error } = await supabase.functions.invoke(
                              'auto-fill-person-details',
                              {
                                headers: {
                                  Authorization: `Bearer ${session.session.access_token}`,
                                },
                              }
                            );

                            if (error) {
                              console.error('[Person Details] Edge function error:', error);
                              throw error;
                            }

                            console.log('[Person Details] Batch response:', data);
                            
                            const { processed, updated, failed, hasMore, details } = data;
                            
                            totalProcessed += processed;
                            totalUpdated += updated;
                            totalFailed += failed;
                            
                            console.log('[Person Details] Updating state:', {
                              totalProcessed,
                              totalUpdated,
                              totalFailed,
                              hasMore,
                              detailsCount: details?.length || 0
                            });
                            
                            setPersonDetailsProgress(prev => {
                              const allDetails = [...(prev.details || []), ...(details || [])];
                              const lastEntry = allDetails[allDetails.length - 1];
                              
                              const newState = {
                                ...prev,
                                processed: totalProcessed,
                                updated: totalUpdated,
                                failed: totalFailed,
                                batches: prev.batches + 1,
                                currentEntry: lastEntry?.title || '',
                                details: allDetails
                              };
                              console.log('[Person Details] New progress state:', newState);
                              return newState;
                            });

                            console.log(`[Person Details] Batch complete: processed=${processed}, updated=${updated}, failed=${failed}, hasMore=${hasMore}`);

                            // 계속 처리할 항목이 있고 중지되지 않았으면 다음 배치 실행
                            if (hasMore && !personDetailsStopRef.current) {
                              // 1초 대기 후 다음 배치
                              setTimeout(processBatch, 1000);
                            } else {
                              // 완료
                              setIsAutoFillingDetails(false);
                              fetchDbStats();
                              
                              if (personDetailsStopRef.current) {
                                toast({
                                  title: "Process Stopped",
                                  description: `Stopped at batch ${totalProcessed}. Updated ${totalUpdated} entries.`,
                                });
                              } else {
                                toast({
                                  title: "Auto Fill Completed",
                                  description: `Processed ${totalProcessed} entries. Updated ${totalUpdated}.`,
                                });
                              }
                            }
                          } catch (error) {
                            console.error('Batch error:', error);
                            toast({
                              title: "Batch Error",
                              description: error instanceof Error ? error.message : "Failed to process batch.",
                              variant: "destructive",
                            });
                            setIsAutoFillingDetails(false);
                          }
                        };

                        // 첫 배치 시작
                        processBatch();

                      } catch (error) {
                        console.error('Auto fill error:', error);
                        toast({
                          title: "Auto Fill Error",
                          description: error instanceof Error ? error.message : "Failed to start auto fill.",
                          variant: "destructive",
                        });
                        setIsAutoFillingDetails(false);
                      }
                    }}
                    disabled={isAutoFillingDetails}
                    className="w-full rounded-full gap-2"
                    variant="default"
                  >
                    {isAutoFillingDetails ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing Batch {personDetailsProgress.batches}...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Auto Fill All Person Details (Batch)
                      </>
                    )}
                  </Button>

                  {isAutoFillingDetails && (
                    <Button
                      onClick={() => {
                        personDetailsStopRef.current = true;
                        setIsAutoFillingDetails(false);
                        
                        toast({
                          title: "Stopping Process",
                          description: "Current batch will complete, then stop.",
                        });
                      }}
                      variant="destructive"
                      className="w-full rounded-full gap-2"
                    >
                      <Loader2 className="w-4 h-4" />
                      Stop Processing
                    </Button>
                  )}

                  <Button
                    onClick={fetchDbStats}
                    variant="outline"
                    className="w-full rounded-full gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Statistics
                  </Button>
                </div>

                {/* Filter and View Entries */}
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Select value={wikiEntryFilter} onValueChange={setWikiEntryFilter}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Entries</SelectItem>
                        <SelectItem value="member">Members</SelectItem>
                        <SelectItem value="actor">Actors</SelectItem>
                        <SelectItem value="artist">Artists</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={async () => {
                        setWikiEntriesLoading(true);
                        try {
                          let query = supabase
                            .from('wiki_entries')
                            .select('id, title, slug, schema_type, birth_date, real_name, gender, nationality, blood_type, height, weight, metadata, image_url')
                            .order('created_at', { ascending: false })
                            .limit(50);
                          
                          if (wikiEntryFilter !== 'all') {
                            query = query.eq('schema_type', wikiEntryFilter as any);
                          } else {
                            query = query.in('schema_type', ['member', 'actor', 'artist'] as any);
                          }
                          
                          const { data } = await query;
                          setWikiEntries(data || []);
                        } catch (error) {
                          console.error('Error fetching entries:', error);
                        } finally {
                          setWikiEntriesLoading(false);
                        }
                      }}
                      className="rounded-full"
                    >
                      Load Entries
                    </Button>
                  </div>

                  {wikiEntriesLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : wikiEntries.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Image</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Real Name</TableHead>
                            <TableHead>Birthday</TableHead>
                            <TableHead>Gender</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {wikiEntries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell>
                                <div className="relative w-12 h-12 group">
                                  {entry.image_url ? (
                                    <>
                                      <img
                                        src={entry.image_url}
                                        alt={entry.title}
                                        className="w-12 h-12 rounded-lg object-cover"
                                      />
                                      <button
                                        onClick={async () => {
                                          if (!confirm(`Remove image from "${entry.title}"?`)) return;
                                          
                                          const { error } = await supabase
                                            .from('wiki_entries')
                                            .update({ image_url: null })
                                            .eq('id', entry.id);
                                          
                                          if (error) {
                                            toast({
                                              title: "Error",
                                              description: "Failed to remove image.",
                                              variant: "destructive",
                                            });
                                          } else {
                                            setWikiEntries(prev => 
                                              prev.map(e => e.id === entry.id ? { ...e, image_url: null } : e)
                                            );
                                            toast({
                                              title: "Image Removed",
                                              description: `Image removed from "${entry.title}".`,
                                            });
                                          }
                                        }}
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </>
                                  ) : (
                                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                      <User className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                <button 
                                  onClick={() => navigate(`/k/${entry.slug}`)}
                                  className="text-primary hover:underline"
                                >
                                  {entry.title}
                                </button>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {entry.schema_type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {entry.real_name || (entry.metadata as any)?.real_name || '-'}
                              </TableCell>
                              <TableCell>
                                {entry.birth_date 
                                  ? new Date(entry.birth_date).toLocaleDateString()
                                  : (entry.metadata as any)?.birthday 
                                    ? new Date((entry.metadata as any).birthday).toLocaleDateString()
                                    : '-'
                                }
                              </TableCell>
                              <TableCell>
                                {entry.gender || (entry.metadata as any)?.gender || '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-full"
                                    onClick={() => navigate(`/k/${entry.slug}/edit`)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-full text-destructive hover:text-destructive"
                                    onClick={async () => {
                                      if (!confirm(`Delete "${entry.title}" permanently? This cannot be undone.`)) return;
                                      
                                      const { error } = await supabase
                                        .from('wiki_entries')
                                        .delete()
                                        .eq('id', entry.id);
                                      
                                      if (error) {
                                        toast({
                                          title: "Error",
                                          description: "Failed to delete entry.",
                                          variant: "destructive",
                                        });
                                      } else {
                                        setWikiEntries(prev => prev.filter(e => e.id !== entry.id));
                                        toast({
                                          title: "Entry Deleted",
                                          description: `"${entry.title}" has been deleted.`,
                                        });
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center p-8 text-muted-foreground">
                      Click "Load Entries" to view wiki entries
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="points" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">Star Rules Management</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Configure how users earn and spend stars
                  </p>
                </div>
              </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3 text-green-600">Earn Stars</h3>
                    <div className="space-y-2">
                      {pointRules.filter(rule => rule.category === 'earn').map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{rule.description}</p>
                            <p className="text-xs text-muted-foreground">{rule.action_type}</p>
                          </div>
                          {editingRule === rule.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={editPoints[rule.id] ?? rule.points}
                                onChange={(e) => setEditPoints({...editPoints, [rule.id]: parseInt(e.target.value)})}
                                className="w-20"
                              />
                              <Button size="sm" onClick={() => handleUpdatePointRule(rule.id)}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingRule(null)}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-green-600">+{rule.points}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingRule(rule.id);
                                  setEditPoints({...editPoints, [rule.id]: rule.points});
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3 text-red-600">Spend Stars</h3>
                    <div className="space-y-2">
                      {pointRules.filter(rule => rule.category === 'spend' || rule.category === 'spend_stars' || rule.category === 'content' || rule.category === 'wiki' || rule.action_type === 'boost_post_per_hour').map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{rule.description}</p>
                            <p className="text-xs text-muted-foreground">{rule.action_type}</p>
                          </div>
                          {editingRule === rule.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={Math.abs(editPoints[rule.id] ?? rule.points)}
                                onChange={(e) => setEditPoints({...editPoints, [rule.id]: -Math.abs(parseInt(e.target.value))})}
                                className="w-20"
                              />
                              <Button size="sm" onClick={() => handleUpdatePointRule(rule.id)}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingRule(null)}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-red-600">{rule.points}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingRule(rule.id);
                                  setEditPoints({...editPoints, [rule.id]: rule.points});
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3 text-orange-600">Voting Costs</h3>
                    <div className="space-y-2">
                      {pointRules.filter(rule => rule.category === 'Voting').map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{rule.description}</p>
                            <p className="text-xs text-muted-foreground">{rule.action_type}</p>
                          </div>
                          {editingRule === rule.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={Math.abs(editPoints[rule.id] ?? rule.points)}
                                onChange={(e) => setEditPoints({...editPoints, [rule.id]: -Math.abs(parseInt(e.target.value))})}
                                className="w-20"
                              />
                              <Button size="sm" onClick={() => handleUpdatePointRule(rule.id)} className="rounded-full">
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingRule(null)} className="rounded-full">
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-orange-600">{rule.points}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingRule(rule.id);
                                  setEditPoints({...editPoints, [rule.id]: rule.points});
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3 text-blue-600">Activity Rewards</h3>
                    <div className="space-y-2">
                      {pointRules.filter(rule => rule.category === 'activity').map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{rule.description}</p>
                            <p className="text-xs text-muted-foreground">{rule.action_type}</p>
                          </div>
                          {editingRule === rule.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={editPoints[rule.id] ?? rule.points}
                                onChange={(e) => setEditPoints({...editPoints, [rule.id]: parseInt(e.target.value)})}
                                className="w-20"
                              />
                              <Button size="sm" onClick={() => handleUpdatePointRule(rule.id)} className="rounded-full">
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingRule(null)} className="rounded-full">
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-blue-600">+{rule.points}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingRule(rule.id);
                                  setEditPoints({...editPoints, [rule.id]: rule.points});
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  {/* KTNZ to Stars Exchange Rate */}
                  <div>
                    <h3 className="font-semibold mb-3 text-purple-600">KTNZ → Stars Exchange Rate</h3>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">KTNZ to Stars Conversion</p>
                        <p className="text-xs text-muted-foreground">1 KTNZ = X Stars when users exchange tokens</p>
                      </div>
                      {editingKtnzRate ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">1 KTNZ =</span>
                          <Input
                            type="number"
                            value={tempKtnzRate}
                            onChange={(e) => setTempKtnzRate(parseInt(e.target.value) || 0)}
                            className="w-20"
                            min={1}
                          />
                          <span className="text-sm text-muted-foreground">Stars</span>
                          <Button 
                            size="sm" 
                            onClick={handleSaveKtnzToStarsRate}
                            disabled={isSavingKtnzRate}
                            className="rounded-full"
                          >
                            {isSavingKtnzRate ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              setEditingKtnzRate(false);
                              setTempKtnzRate(ktnzToStarsRate);
                            }}
                            className="rounded-full"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-purple-600">1 KTNZ = {ktnzToStarsRate} Stars</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingKtnzRate(true);
                              setTempKtnzRate(ktnzToStarsRate);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Daily Token Rewards by Level */}
              <Card className="p-4 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold">Daily Token Rewards by Level</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Configure KTNZ token rewards for daily vote completion by user level
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {levels.map((level) => (
                    <div key={level.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1 flex items-center gap-3">
                        <Badge 
                          variant="outline" 
                          style={{ 
                            backgroundColor: level.color ? `${level.color}20` : undefined,
                            borderColor: level.color || undefined,
                            color: level.color || undefined
                          }}
                        >
                          Lv.{level.id}
                        </Badge>
                        <div>
                          <p className="font-medium">{level.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Required XP: {level.required_points?.toLocaleString() || 0}
                          </p>
                        </div>
                      </div>
                      {editingLevel === level.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            value={editTokenReward[level.id] ?? level.token_reward ?? 0}
                            onChange={(e) => setEditTokenReward({...editTokenReward, [level.id]: parseInt(e.target.value) || 0})}
                            className="w-24"
                          />
                          <span className="text-xs text-muted-foreground">KTNZ</span>
                          <Button size="sm" onClick={() => handleUpdateLevelTokenReward(level.id)} className="rounded-full">
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingLevel(null)} className="rounded-full">
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-yellow-600">{level.token_reward ?? 0} KTNZ</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingLevel(level.id);
                              setEditTokenReward({...editTokenReward, [level.id]: level.token_reward ?? 0});
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm mt-4">
                  <p className="font-semibold">Token Reward System:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Users receive KTNZ tokens when they complete 13 daily votes</li>
                    <li>Higher level users earn more tokens per day</li>
                    <li>Tokens are minted on Base network to user's embedded wallet</li>
                  </ul>
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold">Manual Star Adjustment</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Manually add or subtract stars from users
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-select">Select User</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger id="user-select">
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.username} (XP: {user.total_points}, Points: {user.available_points || 0})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="points-amount">Points Amount</Label>
                    <Input
                      id="points-amount"
                      type="number"
                      min="1"
                      value={manualPoints}
                      onChange={(e) => setManualPoints(e.target.value)}
                      placeholder="Enter points amount"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleManualPointAdjustment('add')}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={!selectedUserId || !manualPoints}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Points
                    </Button>
                    <Button
                      onClick={() => handleManualPointAdjustment('subtract')}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      disabled={!selectedUserId || !manualPoints}
                    >
                      <Minus className="w-4 h-4 mr-2" />
                      Subtract Points
                    </Button>
                  </div>

                  <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                    <p className="font-semibold">Points System:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li><strong>XP (total_points)</strong>: Accumulated for leveling up (cannot be spent)</li>
                      <li><strong>Points (available_points)</strong>: Can be spent on features</li>
                      <li>Both values change together when adjusted here</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="auto-generate" className="space-y-4">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">Auto Generate News Posts</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Automatically search news and generate posts using AI
                  </p>
                </div>
              </div>

              <div className="space-y-4 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="count">Number of Posts (1-10)</Label>
                  <Input
                    id="count"
                    type="number"
                    min="1"
                    max="10"
                    value={autoGenCount}
                    onChange={(e) => setAutoGenCount(e.target.value)}
                    placeholder="Enter number of posts"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={autoGenCategory} onValueChange={setAutoGenCategory}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Entertainment-News">Entertainment (연예)</SelectItem>
                      <SelectItem value="Culture-News">Culture (문화)</SelectItem>
                      <SelectItem value="Culture-Travel">Travel (여행)</SelectItem>
                      <SelectItem value="Culture-Food">Food (음식)</SelectItem>
                      <SelectItem value="Culture-Fashion/Beauty">Fashion (패션)</SelectItem>
                      <SelectItem value="Culture-Events">Events (축제)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keyword">Search Keyword (Optional)</Label>
                  <Input
                    id="keyword"
                    value={autoGenKeyword}
                    onChange={(e) => setAutoGenKeyword(e.target.value)}
                    placeholder="e.g., BTS, 뉴진스, 한식, 부산여행..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use category default search (연예, 여행, 음식, etc.)
                  </p>
                </div>

                <Button
                  onClick={handleAutoGenerate}
                  disabled={isGenerating}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Posts...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Posts
                    </>
                  )}
                </Button>

                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                  <p className="font-semibold">How it works:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Searches Naver News with category keywords (연예, 여행, 음식, etc.)</li>
                    <li>Extracts images from original article sources</li>
                    <li>AI translates Korean news to English</li>
                    <li>Posts are pending approval in the Pending Posts tab</li>
                  </ul>
                  <p className="text-xs font-medium mt-3">💡 Tip: Leave keyword empty to use category default, or specify custom keywords</p>
                </div>
              </div>
            </Card>

            {/* AI Data Contribution - Auto-Registered */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <Database className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">AI Learning Data - Auto Registration</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    High-quality content is automatically registered for AI training in real-time
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <p className="font-semibold text-green-900 dark:text-green-100">
                      ✨ Real-Time Auto Registration Active
                    </p>
                  </div>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Content is automatically evaluated and registered when it meets quality criteria. 
                    Users receive points instantly upon registration.
                  </p>
                </div>

                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                  <p className="font-semibold">Automatic Registration Criteria:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li><strong>Posts:</strong> 10+ votes, 50+ views, 100+ characters → Auto-registered when criteria met</li>
                    <li><strong>Wiki Entries:</strong> 5+ votes, 100+ views, 200+ characters → Auto-registered when criteria met</li>
                    <li><strong>Quality Score:</strong> Calculated from votes, views, and content length (0-100)</li>
                    <li><strong>Registration Threshold:</strong> Only content with 60+ quality score</li>
                    <li><strong>Rewards:</strong> 50 points for accepted + 100 bonus for high quality (80+ score)</li>
                    <li><strong>Trigger:</strong> Automatic on vote or view count update</li>
                  </ul>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>💡 Note:</strong> Manual evaluation is no longer needed. The system automatically 
                    monitors all posts and wiki entries in real-time and registers qualifying content instantly.
                  </p>
                </div>
              </div>
            </Card>

            {/* Registered AI Contributions List */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Star className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold">Registered AI Contributions</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Recently auto-registered high-quality content (Latest 50)
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchAiContributions}
                  disabled={aiContributionsLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${aiContributionsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {aiContributionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : aiContributions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No contributions registered yet</p>
                  <p className="text-sm mt-2">High-quality content will be automatically registered here</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Content</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Quality</TableHead>
                        <TableHead>Reward</TableHead>
                        <TableHead>Training</TableHead>
                        <TableHead>Registered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiContributions.map((contribution) => (
                        <TableRow key={contribution.id}>
                          <TableCell>
                            <div className="max-w-xs truncate">
                              <code className="text-xs">{contribution.content_id.slice(0, 8)}...</code>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={contribution.content_type === 'post' ? 'default' : 'secondary'}>
                              {contribution.content_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="text-xs">
                                  {(contribution.profiles as any)?.username?.[0]?.toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">
                                {(contribution.profiles as any)?.display_name || (contribution.profiles as any)?.username || 'Unknown'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={contribution.contribution_quality_score} className="w-16 h-2" />
                              <span className="text-sm font-medium">{contribution.contribution_quality_score}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <Coins className="w-3 h-3" />
                              {contribution.reward_amount || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {contribution.used_in_training ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Used
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(contribution.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">Pending Approval ({pendingPosts.length})</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Review and approve auto-generated news posts before they appear to users
                  </p>
                </div>
              </div>

              {pendingPosts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No posts pending approval</p>
                  <p className="text-sm mt-2">Auto-generated posts will appear here for review</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Generated</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingPosts.map((post) => (
                        <TableRow key={post.id}>
                          <TableCell className="max-w-md">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">{post.title}</span>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {(() => {
                                  try {
                                    const parser = new DOMParser();
                                    const doc = parser.parseFromString(post.content || '', 'text/html');
                                    return doc.body.textContent || doc.body.innerText || '';
                                  } catch {
                                    return post.content || '';
                                  }
                                })()}
                              </div>
                              {post.source_url && (
                                <a 
                                  href={post.source_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  View Source
                                  <span className="text-[10px]">↗</span>
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{post.category || 'Uncategorized'}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(post.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApprovePost(post.id)}
                                className="bg-green-600 hover:bg-green-700 text-xs w-full sm:w-auto"
                              >
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRejectPost(post.id)}
                                className="text-xs w-full sm:w-auto"
                              >
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            {/* IP Signup Limit Toggle */}
            <IpSignupLimitToggle />

            {/* Wiki Creation Level Setting */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">Wiki Entry Creation Level</h3>
                  <p className="text-sm text-muted-foreground">
                    Minimum user level required to create new wiki entries
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={wikiCreationMinLevel.toString()}
                    onValueChange={(value) => updateWikiCreationMinLevel(parseInt(value))}
                    disabled={isUpdatingMinLevel}
                  >
                    <SelectTrigger className="w-32 bg-background rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {[1,2,3,4,5,6,7,8,9,10].map(level => (
                        <SelectItem key={level} value={level.toString()}>
                          Level {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isUpdatingMinLevel && <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h2 className="text-lg sm:text-xl font-semibold">All Users ({usersWithRoles.filter(u => !u.is_banned).length} / {usersWithRoles.length})</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={showLightstickHoldersOnly ? "default" : "outline"}
                    size="sm"
                    onClick={async () => {
                      if (!showLightstickHoldersOnly && lightstickHolderIds.size === 0) {
                        // 처음 필터 활성화 시 데이터 로드
                        setLoadingLightstickHolders(true);
                        try {
                          const { data, error } = await supabase
                            .from('fanz_balances')
                            .select('user_id')
                            .gt('balance', 0);
                          
                          if (error) throw error;
                          
                          const holderIds = new Set<string>(data?.map(d => d.user_id) || []);
                          setLightstickHolderIds(holderIds);
                        } catch (err) {
                          console.error('Error fetching lightstick holders:', err);
                          toast({
                            title: "Error",
                            description: "Failed to load lightstick holders",
                            variant: "destructive",
                          });
                        } finally {
                          setLoadingLightstickHolders(false);
                        }
                      }
                      setShowLightstickHoldersOnly(!showLightstickHoldersOnly);
                    }}
                    disabled={loadingLightstickHolders}
                    className="rounded-full gap-1.5"
                  >
                    {loadingLightstickHolders ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Lightstick Holders
                    {showLightstickHoldersOnly && lightstickHolderIds.size > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {lightstickHolderIds.size}
                      </Badge>
                    )}
                  </Button>
                  <div className="relative w-full sm:w-80">
                    <Input
                      placeholder="Search by username, email, or wallet..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="pl-10 rounded-full"
                    />
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
              
              {usersWithRoles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Ban</TableHead>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Lightsticks</TableHead>
                        <TableHead>Last IP</TableHead>
                        <TableHead>Wallet</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>XP / Points</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>VIP</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersWithRoles
                        .filter((user) => {
                          // 응원봉 보유자 필터
                          if (showLightstickHoldersOnly && !lightstickHolderIds.has(user.id)) {
                            return false;
                          }
                          // 검색어 필터
                          if (!userSearchQuery.trim()) return true;
                          const query = userSearchQuery.toLowerCase();
                          return (
                            user.username?.toLowerCase().includes(query) ||
                            user.email?.toLowerCase().includes(query) ||
                            user.display_name?.toLowerCase().includes(query) ||
                            user.wallet_address?.toLowerCase().includes(query)
                          );
                        })
                        .map((user) => {
                        const currentRole = user.roles?.includes('admin') 
                          ? 'admin' 
                          : user.roles?.includes('moderator') 
                          ? 'moderator' 
                          : 'user';
                        
                        return (
                          <TableRow key={user.id} className={user.is_banned ? "bg-red-50 dark:bg-red-950/20" : ""}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1.5">
                                <span className={user.is_suspicious ? "text-red-600 font-bold" : ""}>
                                  {user.username}
                                </span>
                                {user.is_suspicious && (
                                  <span title="Suspicious: Same device fingerprint as another user">
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{user.email || '-'}</TableCell>
                            <TableCell>
                              {user.is_banned ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnbanUser(user.id, user.username)}
                                  title="Unban User"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <Shield className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleBanUser(user.id, user.username)}
                                  title="Ban User"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Ban className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className={user.is_suspicious ? "text-red-600 font-medium" : ""}>{user.display_name || '-'}</TableCell>
                            <TableCell>
                              {user.is_banned ? (
                                <Badge variant="destructive" className="text-xs">
                                  <Ban className="w-3 h-3 mr-1" />
                                  Banned
                                </Badge>
                              ) : user.is_suspicious ? (
                                <Badge variant="outline" className="text-xs border-red-500 text-red-600">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Suspicious
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">Active</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {user.lightsticks && user.lightsticks.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-48">
                                  {user.lightsticks.slice(0, 3).map((ls: any, idx: number) => (
                                    <a
                                      key={idx}
                                      href={`/wiki/${ls.slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 rounded-full text-xs hover:bg-primary/20 transition-colors"
                                      title={`${ls.title}: ${ls.balance}`}
                                    >
                                      {ls.imageUrl ? (
                                        <img 
                                          src={ls.imageUrl} 
                                          alt={ls.title} 
                                          className="w-4 h-4 rounded-full object-cover"
                                        />
                                      ) : (
                                        <Sparkles className="w-3 h-3 text-primary" />
                                      )}
                                      <span className="max-w-16 truncate">{ls.title}</span>
                                      <span className="text-muted-foreground">×{ls.balance}</span>
                                    </a>
                                  ))}
                                  {user.lightsticks.length > 3 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{user.lightsticks.length - 3} more
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {user.last_ip ? (
                                <IpLocationPopover 
                                  ip={user.last_ip} 
                                  lastSeenAt={user.last_seen_at} 
                                />
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {user.wallet_address ? (
                                <a 
                                  href={`https://basescan.org/address/${user.wallet_address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={user.wallet_address}
                                  className="hover:text-primary hover:underline cursor-pointer"
                                >
                                  {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                                </a>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {isAdmin ? (
                                <Select
                                  value={user.current_level.toString()}
                                  onValueChange={(value) => handleUserLevelUpdate(user.id, parseInt(value))}
                                >
                                  <SelectTrigger className="w-20 bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background z-50">
                                    {[1,2,3,4,5,6,7,8,9,10].map(level => (
                                      <SelectItem key={level} value={level.toString()}>
                                        {level}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                user.current_level
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="font-semibold text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => {
                                  setSelectedUserForPoints(user);
                                  setShowQuickPointDialog(true);
                                }}
                              >
                                <div className="flex flex-col items-start text-xs">
                                  <span className="text-primary font-bold">{user.total_points} XP</span>
                                  <span className="text-muted-foreground">{user.available_points} pts</span>
                                </div>
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={currentRole}
                                onValueChange={(value) => handleUserRoleUpdate(user.id, user.roles || [], value)}
                              >
                                <SelectTrigger className="w-32 bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background z-50">
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="moderator">Moderator</SelectItem>
                                  <SelectItem value="user">User</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant={user.is_vip ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleVipToggle(user.id, !user.is_vip)}
                                className={user.is_vip ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
                              >
                                {user.is_vip ? (
                                  <>
                                    <Star className="w-3 h-3 mr-1 fill-current" />
                                    VIP
                                  </>
                                ) : (
                                  "Set VIP"
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant={user.invitation_verified ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleInvitationVerifiedToggle(user.id, !user.invitation_verified)}
                                className={user.invitation_verified ? "bg-green-500 hover:bg-green-600 text-white" : ""}
                              >
                                {user.invitation_verified ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Verified
                                  </>
                                ) : (
                                  "Verify"
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>
                              {new Date(user.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {user.email && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedUserForPassword(user);
                                      setShowPasswordResetDialog(true);
                                    }}
                                    title="Reset Password"
                                  >
                                    <Lock className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Owner Applications Tab */}
          <TabsContent value="owner-applications" className="space-y-4">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">Owner Applications</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Review and approve Fanz page ownership applications
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchOwnerApplications}
                  className="ml-auto"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              {/* Pending Applications */}
              <div className="mb-6">
                <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  Pending Applications
                  {ownerApplications.length > 0 && (
                    <Badge variant="secondary">{ownerApplications.length}</Badge>
                  )}
                </h3>
                {loadingApplications ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : ownerApplications.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No pending applications.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ownerApplications.map((app) => (
                      <Card key={app.id} className="p-4 border">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={app.user?.avatar_url} />
                              <AvatarFallback>
                                {app.user?.username?.charAt(0)?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{app.user?.display_name || app.user?.username}</div>
                              <div className="text-sm text-muted-foreground truncate">
                                Entry: {app.wiki_entry?.title}
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">Twitter:</span>
                              <a
                                href={`https://twitter.com/${app.twitter_handle.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                @{app.twitter_handle.replace('@', '')}
                              </a>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Reason:</span>
                              <p className="mt-1 text-foreground">{app.reason}</p>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Applied: {new Date(app.created_at).toLocaleDateString()}
                            </div>
                          </div>

                          <div className="flex gap-2 sm:flex-col">
                            <Button
                              size="sm"
                              onClick={() => handleApproveApplication(app)}
                              className="flex-1 sm:flex-none"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectApplication(app)}
                              className="flex-1 sm:flex-none"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <Separator className="my-6" />

              {/* Approved Applications */}
              <div>
                <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Approved Applications
                  {approvedApplications.length > 0 && (
                    <Badge variant="secondary">{approvedApplications.length}</Badge>
                  )}
                </h3>
                {loadingApplications ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : approvedApplications.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No approved applications yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {approvedApplications.map((app) => (
                      <Card key={app.id} className="p-3 border bg-green-50 dark:bg-green-950/20">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={app.user?.avatar_url} />
                            <AvatarFallback className="text-xs">
                              {app.user?.username?.charAt(0)?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{app.user?.display_name || app.user?.username}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              Entry: {app.wiki_entry?.title}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {app.reviewed_at && new Date(app.reviewed_at).toLocaleDateString()}
                          </div>
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRevokeApplication(app)}
                            className="text-orange-600 border-orange-300 hover:bg-orange-50"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Revoke
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="user-verification" className="space-y-4">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <BadgeCheck className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">User Verification</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Verify official accounts (artists, staff, partners)
                  </p>
                </div>
              </div>
              
              {usersWithRoles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersWithRoles.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{user.email || '-'}</TableCell>
                          <TableCell>{user.display_name || '-'}</TableCell>
                          <TableCell>
                            {user.is_verified ? (
                              <Badge className="bg-primary text-primary-foreground">
                                <BadgeCheck className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Not Verified</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.is_verified ? (
                              <Select
                                value={user.verification_type || 'official'}
                                onValueChange={(value) => handleUpdateVerification(user.id, true, value)}
                              >
                                <SelectTrigger className="w-32 bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background z-50">
                                  <SelectItem value="official">Official</SelectItem>
                                  <SelectItem value="artist">Artist</SelectItem>
                                  <SelectItem value="staff">Staff</SelectItem>
                                  <SelectItem value="partner">Partner</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {user.is_verified ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateVerification(user.id, false, null)}
                                className="text-xs"
                              >
                                Remove
                              </Button>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleUpdateVerification(user.id, true, 'official')}
                                className="text-xs"
                              >
                                Verify
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="posts" className="space-y-4">
            <Card className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">All Posts ({posts.length})</h2>
              
              {posts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No posts found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Votes</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {posts.map((post) => (
                        <TableRow key={post.id}>
                          <TableCell className="font-medium max-w-xs truncate">
                            {post.title}
                          </TableCell>
                          <TableCell>{post.profiles?.username || 'Unknown'}</TableCell>
                          <TableCell>{post.category}</TableCell>
                          <TableCell>{post.votes}</TableCell>
                          <TableCell>
                            {new Date(post.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeletePost(post.id)}
                              className="text-xs w-8 h-8 p-0"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="communities" className="space-y-4">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <BadgeCheck className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">Community Management</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Manage community verification status
                  </p>
                </div>
              </div>

              {communities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No communities found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Posts</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {communities.map((community) => (
                        <TableRow key={community.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {community.icon_url && (
                                <img 
                                  src={community.icon_url} 
                                  alt={community.name}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                              )}
                              {community.name}
                              {community.is_verified && (
                                <BadgeCheck className="w-4 h-4 text-primary" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>/c/{community.slug}</TableCell>
                          <TableCell>{community.member_count}</TableCell>
                          <TableCell>{community.post_count}</TableCell>
                          <TableCell>
                            {new Date(community.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              community.is_verified 
                                ? 'bg-primary/10 text-primary' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {community.is_verified ? 'Verified' : 'Not Verified'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant={community.is_verified ? "outline" : "default"}
                              size="sm"
                              onClick={() => handleToggleVerified(community.id, community.is_verified)}
                              className="text-xs w-full sm:w-auto"
                            >
                              {community.is_verified ? 'Unverify' : 'Verify'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Bulk Artists Tab */}
          <TabsContent value="bulk-artists" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Create K-pop Artists & Members</CardTitle>
                <CardDescription>
                  Create up to 100 K-pop groups and their members automatically using AI. Each group and its members will be added to the wiki.
                </CardDescription>
                
                {/* Wiki Statistics */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Music className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Artists</p>
                      <p className="text-2xl font-bold">{wikiStats.totalArtists}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Members</p>
                      <p className="text-2xl font-bold">{wikiStats.totalMembers}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Actors</p>
                      <p className="text-2xl font-bold">{wikiStats.totalActors}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button
                    onClick={handleSuggestGroups}
                    disabled={isSuggestingGroups}
                    variant="outline"
                    className="rounded-full gap-2 text-xs sm:text-sm"
                    size="sm"
                  >
                    {isSuggestingGroups ? (
                      <>
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                        <span className="hidden sm:inline">AI Suggesting...</span>
                        <span className="sm:hidden">Suggesting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">AI Suggest Groups</span>
                        <span className="sm:hidden">Groups</span>
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleSuggestActors}
                    disabled={isSuggestingActors}
                    variant="outline"
                    className="rounded-full gap-2 text-xs sm:text-sm"
                    size="sm"
                  >
                    {isSuggestingActors ? (
                      <>
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                        <span className="hidden sm:inline">AI Suggesting...</span>
                        <span className="sm:hidden">Suggesting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">AI Suggest Actors</span>
                        <span className="sm:hidden">Actors</span>
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleMigrateBirthdays}
                    disabled={isMigratingBirthdays}
                    variant="outline"
                    className="rounded-full gap-2 text-xs sm:text-sm"
                    size="sm"
                  >
                    {isMigratingBirthdays ? (
                      <>
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                        <span className="hidden sm:inline">Migrating...</span>
                        <span className="sm:hidden">Migrate</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Migrate Birthdays</span>
                        <span className="sm:hidden">Birthdays</span>
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setBulkGroupNames("");
                      setBulkActorNames("");
                    }}
                    variant="ghost"
                    className="rounded-full text-xs sm:text-sm"
                    size="sm"
                  >
                    Clear
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-groups">
                    Group Names (one per line, max 100)
                  </Label>
                  <div className="text-sm text-muted-foreground mb-2">
                    Enter K-pop group names. AI will automatically create detailed wiki entries for each group and all their members.
                  </div>
                  <Textarea
                    id="bulk-groups"
                    value={bulkGroupNames}
                    onChange={(e) => setBulkGroupNames(e.target.value)}
                    placeholder={`BTS\nBLACKPINK\nTWICE\nStray Kids\nNewJeans`}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <div className="text-sm text-muted-foreground">
                    Lines: {bulkGroupNames.split('\n').filter(l => l.trim()).length} / 100
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-actors">
                    Actor Names (one per line, max 100)
                  </Label>
                  <div className="text-sm text-muted-foreground mb-2">
                    Enter Korean actor/actress names. These will be added to the wiki database.
                  </div>
                  <Textarea
                    id="bulk-actors"
                    value={bulkActorNames}
                    onChange={(e) => setBulkActorNames(e.target.value)}
                    placeholder={`Lee Byung-hun\nSong Hye-kyo\nPark Seo-joon\nJun Ji-hyun\nLee Min-ho`}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <div className="text-sm text-muted-foreground">
                    Lines: {bulkActorNames.split('\n').filter(l => l.trim()).length} / 100
                  </div>
                </div>

                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                  <p className="font-semibold">What will be created for Groups:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Wiki entry for each group with detailed information and debut year</li>
                    <li>Wiki entries for all members of each group</li>
                    <li>Member profiles including real names, stage names, positions, and birth dates</li>
                    <li>Automatic linking between groups and members</li>
                  </ul>
                  <p className="text-amber-600 dark:text-amber-500 font-medium mt-3">
                    ⚠️ This process may take several minutes. AI will fetch accurate birth dates and member information.
                  </p>
                </div>

                {isBulkCreating && (
                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Progress</span>
                        <span className="text-muted-foreground">
                          {creationProgress.processed} / {creationProgress.total}
                        </span>
                      </div>
                      <Progress 
                        value={(creationProgress.processed / creationProgress.total) * 100} 
                        className="h-2"
                      />
                    </div>
                    
                    {creationProgress.currentGroup && (
                      <div className="text-sm">
                        <span className="font-medium">Processing:</span> {creationProgress.currentGroup}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded">
                        <div className="font-medium text-green-700 dark:text-green-400">Created</div>
                        <div className="text-lg font-bold text-green-800 dark:text-green-300">{creationProgress.created}</div>
                      </div>
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded">
                        <div className="font-medium text-amber-700 dark:text-amber-400">Skipped</div>
                        <div className="text-lg font-bold text-amber-800 dark:text-amber-300">{creationProgress.skipped}</div>
                      </div>
                    </div>

                    {creationProgress.createdGroups.length > 0 && (
                      <div className="space-y-2">
                        <div className="font-medium text-sm">Recently Created:</div>
                        <div className="flex flex-wrap gap-2">
                          {creationProgress.createdGroups.slice(-10).map((group, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                              <CheckCircle2 className="w-3 h-3" />
                              {group}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleBulkCreateArtists}
                  disabled={isBulkCreating || !bulkGroupNames.trim()}
                  className="w-full rounded-full gap-2"
                  size="lg"
                >
                  {isBulkCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Groups...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Groups & Members
                    </>
                  )}
                </Button>

                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm mt-6">
                  <p className="font-semibold">What will be created for Actors:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Wiki entry for each actor with detailed biography</li>
                    <li>Profile including real name, birth date, and nationality</li>
                    <li>Notable works and filmography</li>
                    <li>Awards and achievements</li>
                  </ul>
                  <p className="text-amber-600 dark:text-amber-500 font-medium mt-3">
                    ⚠️ This process may take several minutes. AI will fetch accurate information for each actor.
                  </p>
                </div>

                {isBulkCreatingActors && (
                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Progress</span>
                        <span className="text-muted-foreground">
                          {actorCreationProgress.processed} / {actorCreationProgress.total}
                        </span>
                      </div>
                      <Progress 
                        value={(actorCreationProgress.processed / actorCreationProgress.total) * 100} 
                        className="h-2"
                      />
                    </div>
                    
                    {actorCreationProgress.currentActor && (
                      <div className="text-sm">
                        <span className="font-medium">Processing:</span> {actorCreationProgress.currentActor}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded">
                        <div className="font-medium text-green-700 dark:text-green-400">Created</div>
                        <div className="text-lg font-bold text-green-800 dark:text-green-300">{actorCreationProgress.created}</div>
                      </div>
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded">
                        <div className="font-medium text-amber-700 dark:text-amber-400">Skipped</div>
                        <div className="text-lg font-bold text-amber-800 dark:text-amber-300">{actorCreationProgress.skipped}</div>
                      </div>
                    </div>

                    {actorCreationProgress.createdActors.length > 0 && (
                      <div className="space-y-2">
                        <div className="font-medium text-sm">Recently Created:</div>
                        <div className="flex flex-wrap gap-2">
                          {actorCreationProgress.createdActors.slice(-10).map((actor, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                              <CheckCircle2 className="w-3 h-3" />
                              {actor}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleBulkCreateActors}
                  disabled={isBulkCreatingActors || !bulkActorNames.trim()}
                  className="w-full rounded-full gap-2"
                  size="lg"
                >
                  {isBulkCreatingActors ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Actors...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Actors
                    </>
                  )}
                </Button>

                <div className="pt-8 border-t">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-3">
                    <div className="flex items-start gap-3">
                      <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                          Fetch Missing Images
                        </h3>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          Automatically search and add images for all wiki entries (actors, members, groups) that don't have images yet.
                        </p>
                        {isFetchingImages && (
                          <div className="space-y-3 p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            {imageFetchProgress.total > 0 ? (
                              <>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span className="font-medium">Processing Images</span>
                                    <span className="text-muted-foreground">
                                      {imageFetchProgress.updated + imageFetchProgress.failed} / {imageFetchProgress.total}
                                    </span>
                                  </div>
                                  <Progress 
                                    value={((imageFetchProgress.updated + imageFetchProgress.failed) / imageFetchProgress.total) * 100} 
                                    className="h-2"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded">
                                    <div className="font-medium text-green-700 dark:text-green-400">Updated</div>
                                    <div className="text-lg font-bold text-green-800 dark:text-green-300">{imageFetchProgress.updated}</div>
                                  </div>
                                  <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded">
                                    <div className="font-medium text-red-700 dark:text-red-400">Failed</div>
                                    <div className="text-lg font-bold text-red-800 dark:text-red-300">{imageFetchProgress.failed}</div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                                  <span>Searching for images...</span>
                                </div>
                                <Progress className="h-2" />
                                <p className="text-xs text-muted-foreground">
                                  This may take several minutes depending on the number of entries.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        <Button
                          onClick={handleFetchMissingImages}
                          disabled={isFetchingImages}
                          className="w-full rounded-full gap-2"
                          variant="outline"
                        >
                          {isFetchingImages ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Fetching Images...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              Fetch All Missing Images
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wiki Data Calibration Tab */}
          <TabsContent value="wiki-data">
            {/* Wiki Entries Statistics */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">Artists</CardTitle>
                  <Music className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">{wikiStats.totalArtists}</div>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                    K-pop groups in database
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Members</CardTitle>
                  <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{wikiStats.totalMembers}</div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Individual idols tracked
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">Actors</CardTitle>
                  <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">{wikiStats.totalActors}</div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Korean actors/actresses
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Wiki Data Calibration</CardTitle>
                <CardDescription>
                  Batch process wiki entries to enhance data quality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Pending AI Content Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-600" />
                        Pending AI Content
                        <Badge variant="secondary" className="text-base px-3 py-1">
                          Total: {totalPendingAiCount}
                        </Badge>
                        {selectedPendingEntries.size > 0 && (
                          <Badge variant="default" className="text-base px-3 py-1 bg-primary">
                            Selected: {selectedPendingEntries.size}
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Wiki entries waiting for AI content generation
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedPendingEntries.size > 0 && (
                        <Button
                          onClick={handleDeleteSelectedEntries}
                          variant="destructive"
                          size="sm"
                          className="rounded-full"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Selected ({selectedPendingEntries.size})
                        </Button>
                      )}
                      <Button
                        onClick={fetchPendingAiEntries}
                        disabled={loadingPendingAi}
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                      >
                        {loadingPendingAi ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {loadingPendingAi ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : pendingAiEntries.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox
                                checked={pendingAiEntries.length > 0 && selectedPendingEntries.size === pendingAiEntries.length}
                                onCheckedChange={toggleSelectAll}
                              />
                            </TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Creator</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingAiEntries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedPendingEntries.has(entry.id)}
                                  onCheckedChange={() => toggleSelectEntry(entry.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{entry.title}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{entry.schema_type}</Badge>
                              </TableCell>
                              <TableCell>
                                {entry.profiles?.display_name || entry.profiles?.username || 'Unknown'}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {new Date(entry.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full"
                                  onClick={() => navigate(`/wiki/${entry.slug}/edit`)}
                                >
                                  <Edit className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No pending AI content found
                    </div>
                  )}
                </div>

                <Separator />

                {/* K-pop Title Entries Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Music className="w-5 h-5 text-orange-600" />
                        K-pop Title Entries
                        <Badge variant="secondary" className="text-base px-3 py-1">
                          Total: {totalKpopTitleCount}
                        </Badge>
                        {selectedKpopEntries.size > 0 && (
                          <Badge variant="default" className="text-base px-3 py-1 bg-primary">
                            Selected: {selectedKpopEntries.size}
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Wiki entries with "k-pop" in the title
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedKpopEntries.size > 0 && (
                        <Button
                          onClick={handleDeleteSelectedKpopEntries}
                          variant="destructive"
                          size="sm"
                          className="rounded-full"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Selected ({selectedKpopEntries.size})
                        </Button>
                      )}
                      <Button
                        onClick={fetchKpopTitleEntries}
                        disabled={loadingKpopTitles}
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                      >
                        {loadingKpopTitles ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {loadingKpopTitles ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : kpopTitleEntries.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox
                                checked={kpopTitleEntries.length > 0 && selectedKpopEntries.size === kpopTitleEntries.length}
                                onCheckedChange={toggleSelectAllKpop}
                              />
                            </TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Creator</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {kpopTitleEntries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedKpopEntries.has(entry.id)}
                                  onCheckedChange={() => toggleSelectKpopEntry(entry.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{entry.title}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{entry.schema_type}</Badge>
                              </TableCell>
                              <TableCell>
                                {entry.profiles?.display_name || entry.profiles?.username || 'Unknown'}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {new Date(entry.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full"
                                  onClick={() => navigate(`/wiki/${entry.slug}/edit`)}
                                >
                                  <Edit className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No k-pop title entries found
                    </div>
                  )}
                </div>

                <Separator />
                
                {/* 0. AI Auto-Fill Missing Entries */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">0. AI Auto-Fill Missing Entries</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Let AI discover and add popular Korean artists, members, and actors that are missing from the database.
                      Target: <strong>3,500 total entries</strong> (1,000 Artists + 2,000 Members + 500 Actors)
                    </p>
                  </div>

                  {/* Target Count Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-muted rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="artist-target" className="text-sm font-medium">Artists Target</Label>
                      <Input
                        id="artist-target"
                        type="number"
                        value={autoFillTargets.artist}
                        onChange={(e) => setAutoFillTargets({...autoFillTargets, artist: parseInt(e.target.value) || 0})}
                        disabled={autoFillProgress.isProcessing}
                        min="0"
                      />
                      <p className="text-xs text-muted-foreground">Current: {wikiStats.totalArtists}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="member-target" className="text-sm font-medium">Members Target</Label>
                      <Input
                        id="member-target"
                        type="number"
                        value={autoFillTargets.member}
                        onChange={(e) => setAutoFillTargets({...autoFillTargets, member: parseInt(e.target.value) || 0})}
                        disabled={autoFillProgress.isProcessing}
                        min="0"
                      />
                      <p className="text-xs text-muted-foreground">Current: {wikiStats.totalMembers}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="actor-target" className="text-sm font-medium">Actors Target</Label>
                      <Input
                        id="actor-target"
                        type="number"
                        value={autoFillTargets.actor}
                        onChange={(e) => setAutoFillTargets({...autoFillTargets, actor: parseInt(e.target.value) || 0})}
                        disabled={autoFillProgress.isProcessing}
                        min="0"
                      />
                      <p className="text-xs text-muted-foreground">Current: {wikiStats.totalActors}</p>
                    </div>
                  </div>
                  
                  {autoFillProgress.isProcessing && (
                    <div className="space-y-2 p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>AI is creating {autoFillProgress.type}s...</span>
                        </div>
                        <span className="text-muted-foreground">
                          {autoFillProgress.current} / {autoFillProgress.total}
                        </span>
                      </div>
                      <Progress 
                        value={(autoFillProgress.current / autoFillProgress.total) * 100} 
                      />
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-muted-foreground">
                          Processing in batches of 50. This may take several minutes...
                        </p>
                        <Button
                          onClick={() => {
                            autoFillStopRef.current = true;
                            setAutoFillProgress(prev => ({ ...prev, shouldStop: true }));
                          }}
                          variant="destructive"
                          size="sm"
                          className="rounded-full"
                        >
                          Stop
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button
                      onClick={() => handleAutoFillEntries('artist')}
                      disabled={autoFillProgress.isProcessing}
                      className="rounded-full gap-2"
                      variant="outline"
                    >
                      {autoFillProgress.isProcessing && autoFillProgress.type === 'artist' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Music className="w-4 h-4" />
                          Fill {autoFillTargets.artist} Artists
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleAutoFillEntries('member')}
                      disabled={autoFillProgress.isProcessing}
                      className="rounded-full gap-2"
                      variant="outline"
                    >
                      {autoFillProgress.isProcessing && autoFillProgress.type === 'member' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <User className="w-4 h-4" />
                          Fill {autoFillTargets.member} Members
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleAutoFillEntries('actor')}
                      disabled={autoFillProgress.isProcessing}
                      className="rounded-full gap-2"
                      variant="outline"
                    >
                      {autoFillProgress.isProcessing && autoFillProgress.type === 'actor' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4" />
                          Fill {autoFillTargets.actor} Actors
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="border-t" />

                {/* Remove Duplicates */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Remove Duplicate Entries</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Identify and remove duplicate entries for Artists, Members, and Actors. 
                      Keeps the oldest entry for each duplicate name.
                    </p>
                  </div>

                  {deduplicateProgress.isProcessing && (
                    <div className="space-y-2 p-4 bg-muted rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Removing {deduplicateProgress.type} duplicates...</span>
                        <span>{deduplicateProgress.removed} / {deduplicateProgress.total}</span>
                      </div>
                      <Progress 
                        value={(deduplicateProgress.removed / deduplicateProgress.total) * 100} 
                      />
                      <div className="flex justify-end mt-2">
                        <Button
                          onClick={() => {
                            deduplicateStopRef.current = true;
                          }}
                          variant="destructive"
                          size="sm"
                          className="rounded-full"
                        >
                          Stop
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button
                      onClick={() => handleDeduplicateWikiEntries('artist')}
                      disabled={deduplicateProgress.isProcessing}
                      className="rounded-full gap-2"
                      variant="outline"
                    >
                      {deduplicateProgress.isProcessing && deduplicateProgress.type === 'artist' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Remove Artist Duplicates
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleDeduplicateWikiEntries('member')}
                      disabled={deduplicateProgress.isProcessing}
                      className="rounded-full gap-2"
                      variant="outline"
                    >
                      {deduplicateProgress.isProcessing && deduplicateProgress.type === 'member' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Remove Member Duplicates
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleDeduplicateWikiEntries('actor')}
                      disabled={deduplicateProgress.isProcessing}
                      className="rounded-full gap-2"
                      variant="outline"
                    >
                      {deduplicateProgress.isProcessing && deduplicateProgress.type === 'actor' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Remove Actor Duplicates
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="border-t" />

                {/* Load Detailed Statistics Button */}
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <Button
                    onClick={loadDetailedWikiStats}
                    disabled={isLoadingDetailedStats}
                    className="rounded-full gap-2"
                    variant="secondary"
                  >
                    {isLoadingDetailedStats ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading Statistics...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4" />
                        Load Detailed Statistics
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Click to calculate filled content, social links, and music chart statistics (may take a moment)
                  </p>
                </div>

                <div className="border-t" />

                {/* Fill Wiki Content */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                      1. Fill Wiki Content with AI
                      {lastUpdated.content > 0 && (
                        <Badge variant="default" className="text-xs">
                          +{lastUpdated.content} updated
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {wikiStats.filledArtists + wikiStats.filledMembers + wikiStats.filledActors} / {wikiStats.totalArtists + wikiStats.totalMembers + wikiStats.totalActors}
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Generate detailed content for actor, artist, and member entries using OpenAI. 
                      Processes 10 entries at a time.
                    </p>
                  </div>
                  
                  {wikiContentProgress.isProcessing && (
                    <div className="space-y-2 p-4 bg-muted rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Processing entries...</span>
                        <span>{wikiContentProgress.current} / {wikiContentProgress.total}</span>
                      </div>
                      {wikiContentProgress.currentEntry && (
                        <div className="text-sm text-muted-foreground">
                          Current: <span className="font-medium text-foreground">{wikiContentProgress.currentEntry}</span>
                        </div>
                      )}
                      <Progress 
                        value={(wikiContentProgress.current / wikiContentProgress.total) * 100} 
                      />
                      <div className="flex justify-end mt-2">
                        <Button
                          onClick={() => {
                            wikiContentStopRef.current = true;
                            setWikiContentProgress(prev => ({ ...prev, shouldStop: true }));
                          }}
                          variant="destructive"
                          size="sm"
                          className="rounded-full"
                        >
                          Stop
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Button
                        onClick={() => handleFillWikiContent(true)}
                        disabled={wikiContentProgress.isProcessing}
                        className="rounded-full gap-2"
                        variant="default"
                      >
                        {wikiContentProgress.isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Fill Missing Content Only
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={() => handleFillWikiContent(false)}
                        disabled={wikiContentProgress.isProcessing}
                        className="rounded-full gap-2"
                        variant="outline"
                      >
                        {wikiContentProgress.isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            Re-generate All Content
                          </>
                        )}
                      </Button>
                    </div>

                    {localStorage.getItem('wiki_content_last_id') && (
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="text-sm text-muted-foreground">
                          Checkpoint saved - Will resume from last position
                        </span>
                        <Button
                          onClick={() => {
                            localStorage.removeItem('wiki_content_last_id');
                            toast({
                              title: "Checkpoint Reset",
                              description: "Next run will start from the beginning",
                            });
                          }}
                          variant="ghost"
                          size="sm"
                          className="rounded-full"
                        >
                          Reset Checkpoint
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t" />

                {/* Fetch Social Links */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                      2. Fetch Social Media Information
                      {lastUpdated.socialLinks > 0 && (
                        <Badge variant="default" className="text-xs">
                          +{lastUpdated.socialLinks} updated
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {wikiStats.withSocialLinks} / {wikiStats.totalArtists + wikiStats.totalMembers + wikiStats.totalActors}
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add social media links and subscriber counts to entry metadata. 
                      Includes Instagram, YouTube, Twitter, etc.
                    </p>
                  </div>
                  
                  {socialLinksProgress.isProcessing && (
                    <div className="space-y-2 p-4 bg-muted rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Fetching social data...</span>
                        <span>{socialLinksProgress.current} / {socialLinksProgress.total}</span>
                      </div>
                      <Progress 
                        value={socialLinksProgress.total > 0 ? (socialLinksProgress.current / socialLinksProgress.total) * 100 : 0} 
                      />
                      <div className="flex justify-end mt-2">
                        <Button
                          onClick={() => {
                            socialLinksStopRef.current = true;
                            setSocialLinksProgress(prev => ({ ...prev, shouldStop: true }));
                          }}
                          variant="destructive"
                          size="sm"
                          className="rounded-full"
                        >
                          Stop
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button
                      onClick={() => handleFetchSocialLinks(true)}
                      disabled={socialLinksProgress.isProcessing}
                      className="rounded-full gap-2"
                      variant="default"
                    >
                      {socialLinksProgress.isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Fetch Missing Social Links
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={() => handleFetchSocialLinks(false)}
                      disabled={socialLinksProgress.isProcessing}
                      className="rounded-full gap-2"
                      variant="outline"
                    >
                      {socialLinksProgress.isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Re-fetch All Social Links
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="border-t" />

                {/* Fetch Music Charts */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                      3. Fetch Music Chart Data
                      {lastUpdated.musicCharts > 0 && (
                        <Badge variant="default" className="text-xs">
                          +{lastUpdated.musicCharts} updated
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {wikiStats.withMusicCharts} / {wikiStats.totalArtists + wikiStats.totalMembers}
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Aggregate song rankings and data from Spotify and Melon. 
                      Updates discography and chart performance.
                    </p>
                  </div>
                  
                  {musicChartsProgress.isProcessing && (
                    <div className="space-y-2 p-4 bg-muted rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Fetching music data...</span>
                        <span>{musicChartsProgress.current} / {musicChartsProgress.total}</span>
                      </div>
                      <Progress 
                        value={musicChartsProgress.total > 0 ? (musicChartsProgress.current / musicChartsProgress.total) * 100 : 0} 
                      />
                      <div className="flex justify-end mt-2">
                        <Button
                          onClick={() => {
                            musicChartsStopRef.current = true;
                            setMusicChartsProgress(prev => ({ ...prev, shouldStop: true }));
                          }}
                          variant="destructive"
                          size="sm"
                          className="rounded-full"
                        >
                          Stop
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button
                      onClick={() => handleFetchMusicCharts(true)}
                      disabled={musicChartsProgress.isProcessing}
                      className="rounded-full gap-2"
                      variant="default"
                    >
                      {musicChartsProgress.isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Fetch Missing Music Charts
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={() => handleFetchMusicCharts(false)}
                      disabled={musicChartsProgress.isProcessing}
                      className="rounded-full gap-2"
                      variant="outline"
                    >
                      {musicChartsProgress.isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Re-fetch All Music Charts
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wiki Roles Tab */}
          <TabsContent value="wiki-roles" className="space-y-6">
            <WikiEntryRoleManager />
          </TabsContent>

          {/* Point Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Point Products Management
                </CardTitle>
                <CardDescription>
                  Create and manage point packages and subscription products
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Create New Product Form */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
                  <h3 className="font-semibold">Create New Product</h3>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="product-name">Product Name *</Label>
                      <Input
                        id="product-name"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        placeholder="e.g., Starter Pack"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product-type">Product Type *</Label>
                      <Select
                        value={productForm.product_type}
                        onValueChange={(value) => setProductForm({ ...productForm, product_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="one_time">One-Time Purchase</SelectItem>
                          <SelectItem value="subscription">Subscription</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product-points">Stars *</Label>
                      <Input
                        id="product-points"
                        type="number"
                        min="1"
                        value={productForm.points || ''}
                        onChange={(e) => setProductForm({ ...productForm, points: parseInt(e.target.value) || 0 })}
                        placeholder="e.g., 100"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product-price">Price (USD) *</Label>
                      <Input
                        id="product-price"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={productForm.price_usd || ''}
                        onChange={(e) => setProductForm({ ...productForm, price_usd: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g., 4.99"
                      />
                    </div>

                    {productForm.product_type === 'subscription' && (
                      <div className="space-y-2">
                        <Label htmlFor="billing-interval">Billing Interval *</Label>
                        <Select
                          value={productForm.billing_interval}
                          onValueChange={(value) => setProductForm({ ...productForm, billing_interval: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select interval" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="month">Monthly</SelectItem>
                            <SelectItem value="year">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="stripe-price-id">Stripe Price ID</Label>
                      <Input
                        id="stripe-price-id"
                        value={productForm.stripe_price_id}
                        onChange={(e) => setProductForm({ ...productForm, stripe_price_id: e.target.value })}
                        placeholder="price_..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="badge-text">Badge Text (Optional)</Label>
                      <Input
                        id="badge-text"
                        value={productForm.badge_text}
                        onChange={(e) => setProductForm({ ...productForm, badge_text: e.target.value })}
                        placeholder="e.g., Best Value"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="display-order">Display Order</Label>
                      <Input
                        id="display-order"
                        type="number"
                        min="0"
                        value={productForm.display_order}
                        onChange={(e) => setProductForm({ ...productForm, display_order: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product-description">Description</Label>
                    <Textarea
                      id="product-description"
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      placeholder="Product description..."
                      rows={2}
                    />
                  </div>

                  <Button onClick={handleCreateProduct} className="rounded-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Product
                  </Button>
                </div>

                {/* Products List */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Existing Products ({pointProducts.length})</h3>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Points</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Stripe ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Order</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pointProducts.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">
                              <div>
                                {product.name}
                                {product.badge_text && (
                                  <Badge className="ml-2" variant="secondary">
                                    {product.badge_text}
                                  </Badge>
                                )}
                              </div>
                              {product.description && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {product.description}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={product.product_type === 'subscription' ? 'default' : 'outline'}>
                                {product.product_type === 'subscription' 
                                  ? `Subscription (${product.billing_interval})`
                                  : 'One-Time'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {editingProduct === product.id ? (
                                <Input
                                  type="number"
                                  value={editProductValues[product.id]?.points ?? product.points}
                                  onChange={(e) => setEditProductValues({
                                    ...editProductValues,
                                    [product.id]: {
                                      ...editProductValues[product.id],
                                      points: parseInt(e.target.value) || 0
                                    }
                                  })}
                                  className="w-24"
                                />
                              ) : (
                                product.points.toLocaleString()
                              )}
                            </TableCell>
                            <TableCell>
                              {editingProduct === product.id ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editProductValues[product.id]?.price_usd ?? product.price_usd}
                                  onChange={(e) => setEditProductValues({
                                    ...editProductValues,
                                    [product.id]: {
                                      ...editProductValues[product.id],
                                      price_usd: parseFloat(e.target.value) || 0
                                    }
                                  })}
                                  className="w-24"
                                />
                              ) : (
                                `$${product.price_usd}`
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <code className="text-xs">{product.stripe_price_id || '-'}</code>
                                {!product.stripe_price_id && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      try {
                                        toast({
                                          title: "Creating Stripe Product",
                                          description: `Creating product for ${product.name}...`,
                                        });

                                        const { data, error } = await supabase.functions.invoke(
                                          'create-stripe-point-product',
                                          {
                                            body: {
                                              productId: product.id,
                                              name: product.name,
                                              description: product.description,
                                              price: product.price_usd,
                                              points: product.points,
                                              productType: product.product_type,
                                              billingInterval: product.billing_interval,
                                            }
                                          }
                                        );

                                        if (error) throw error;

                                        toast({
                                          title: "Success",
                                          description: `Stripe product created for ${product.name}`,
                                        });

                                        // Refresh products list
                                        fetchData();
                                      } catch (error) {
                                        console.error('Error creating Stripe product:', error);
                                        toast({
                                          title: "Error",
                                          description: error instanceof Error ? error.message : "Failed to create Stripe product",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    className="rounded-full text-xs"
                                  >
                                    Create Stripe Product
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={product.is_active ? 'default' : 'secondary'}>
                                {product.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>{product.display_order}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {editingProduct === product.id ? (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={async () => {
                                        const updatedPoints = editProductValues[product.id]?.points ?? product.points;
                                        const updatedPrice = editProductValues[product.id]?.price_usd ?? product.price_usd;
                                        
                                        // DB 업데이트
                                        await handleUpdateProduct(product.id, {
                                          points: updatedPoints,
                                          price_usd: updatedPrice,
                                        });
                                        
                                        // Stripe Price 자동 재생성
                                        toast({
                                          title: "Creating New Stripe Price",
                                          description: "Updating Stripe product with new pricing...",
                                        });
                                        
                                        try {
                                          const { data, error } = await supabase.functions.invoke(
                                            'create-stripe-point-product',
                                            {
                                              body: {
                                                productId: product.id,
                                                name: product.name,
                                                description: product.description,
                                                price: updatedPrice,
                                                points: updatedPoints,
                                                productType: product.product_type,
                                                billingInterval: product.billing_interval,
                                              }
                                            }
                                          );
                                          
                                          if (error) throw error;
                                          
                                          toast({
                                            title: "Success",
                                            description: "Product updated and new Stripe price created!",
                                          });
                                          
                                          fetchData();
                                        } catch (error) {
                                          console.error('Error creating new Stripe price:', error);
                                          toast({
                                            title: "Warning",
                                            description: "Product updated in DB, but failed to create new Stripe price. Please click 'Create Stripe Product' manually.",
                                            variant: "destructive",
                                          });
                                        }
                                        
                                        setEditingProduct(null);
                                        setEditProductValues({});
                                      }}
                                      className="rounded-full"
                                    >
                                      Save & Update Stripe
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingProduct(null);
                                        setEditProductValues({});
                                      }}
                                      className="rounded-full"
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingProduct(product.id);
                                        setEditProductValues({
                                          [product.id]: {
                                            points: product.points,
                                            price_usd: product.price_usd,
                                          }
                                        });
                                      }}
                                      className="rounded-full"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleToggleProductActive(product.id, product.is_active)}
                                      className="rounded-full"
                                    >
                                      {product.is_active ? 'Deactivate' : 'Activate'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleDeleteProduct(product.id)}
                                      className="rounded-full"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {pointProducts.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                              No products created yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Purchase History */}
                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Recent Purchases
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    View purchase history in the database directly or create a dedicated purchases management tab.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gift Badges Tab */}
          <TabsContent value="badges" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Gift Badges Management
                </CardTitle>
                <CardDescription>
                  Manage gift badges that users can purchase and give to artists
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Create New Badge Form */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
                  <h3 className="font-semibold">Create New Badge</h3>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="badge-name">Badge Name *</Label>
                      <Input
                        id="badge-name"
                        value={badgeForm.name}
                        onChange={(e) => setBadgeForm({ ...badgeForm, name: e.target.value })}
                        placeholder="e.g., Heart"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="badge-icon">Icon (Emoji) *</Label>
                      <Input
                        id="badge-icon"
                        value={badgeForm.icon}
                        onChange={(e) => setBadgeForm({ ...badgeForm, icon: e.target.value })}
                        placeholder="e.g., ❤️"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="badge-price">Price (USD) *</Label>
                      <Input
                        id="badge-price"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={badgeForm.usd_price || ''}
                        onChange={(e) => setBadgeForm({ ...badgeForm, usd_price: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g., 10.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="badge-point-price">Price (Stars) *</Label>
                      <Input
                        id="badge-point-price"
                        type="number"
                        min="1"
                        step="1"
                        value={badgeForm.point_price || ''}
                        onChange={(e) => setBadgeForm({ ...badgeForm, point_price: parseInt(e.target.value) || 0 })}
                        placeholder="e.g., 50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="badge-color">Color</Label>
                      <Input
                        id="badge-color"
                        value={badgeForm.color}
                        onChange={(e) => setBadgeForm({ ...badgeForm, color: e.target.value })}
                        placeholder="#FF4500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="badge-stripe-id">Stripe Price ID</Label>
                      <Input
                        id="badge-stripe-id"
                        value={badgeForm.stripe_price_id}
                        onChange={(e) => setBadgeForm({ ...badgeForm, stripe_price_id: e.target.value })}
                        placeholder="price_..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="badge-order">Display Order</Label>
                      <Input
                        id="badge-order"
                        type="number"
                        min="0"
                        value={badgeForm.display_order}
                        onChange={(e) => setBadgeForm({ ...badgeForm, display_order: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="badge-description">Description</Label>
                    <Textarea
                      id="badge-description"
                      value={badgeForm.description}
                      onChange={(e) => setBadgeForm({ ...badgeForm, description: e.target.value })}
                      placeholder="Badge description..."
                      rows={2}
                    />
                  </div>

                  <Button onClick={handleCreateBadge} className="rounded-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Badge
                  </Button>
                </div>

                {/* Badges List */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Existing Badges ({giftBadges.length})</h3>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Badge</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>USD Price</TableHead>
                          <TableHead>Stars Price</TableHead>
                          <TableHead>Stripe ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Order</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {giftBadges.map((badge) => (
                          <TableRow key={badge.id}>
                            <TableCell>
                              <div className="text-2xl">{badge.icon}</div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {editingBadge === badge.id ? (
                                <Input
                                  value={editBadgeValues[badge.id]?.name || badge.name}
                                  onChange={(e) => setEditBadgeValues({
                                    ...editBadgeValues,
                                    [badge.id]: { ...editBadgeValues[badge.id], name: e.target.value }
                                  })}
                                  className="w-full"
                                />
                              ) : (
                                <div>
                                  {badge.name}
                                </div>
                              )}
                              {badge.description && !editingBadge && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {badge.description}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingBadge === badge.id ? (
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={editBadgeValues[badge.id]?.usd_price ?? ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setEditBadgeValues({
                                      ...editBadgeValues,
                                      [badge.id]: { 
                                        ...editBadgeValues[badge.id], 
                                        usd_price: value === '' ? '' : parseFloat(value)
                                      }
                                    });
                                  }}
                                  className="w-24"
                                />
                              ) : (
                                `$${badge.usd_price}`
                              )}
                            </TableCell>
                            <TableCell>
                              {editingBadge === badge.id ? (
                                <Input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={editBadgeValues[badge.id]?.point_price ?? ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setEditBadgeValues({
                                      ...editBadgeValues,
                                      [badge.id]: { 
                                        ...editBadgeValues[badge.id], 
                                        point_price: value === '' ? '' : parseInt(value)
                                      }
                                    });
                                  }}
                                  className="w-24"
                                />
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                  {badge.point_price || 0}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingBadge === badge.id ? (
                                <Input
                                  value={editBadgeValues[badge.id]?.stripe_price_id ?? ''}
                                  onChange={(e) => setEditBadgeValues({
                                    ...editBadgeValues,
                                    [badge.id]: { ...editBadgeValues[badge.id], stripe_price_id: e.target.value }
                                  })}
                                  placeholder="price_..."
                                  className="font-mono text-xs"
                                />
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <code className="text-xs">{badge.stripe_price_id || '-'}</code>
                                  {!badge.stripe_price_id && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        try {
                                          toast({
                                            title: "Creating Stripe Product",
                                            description: `Creating product for ${badge.name}...`,
                                          });

                                          const { data, error } = await supabase.functions.invoke(
                                            'create-stripe-badge-product',
                                            {
                                              body: {
                                                badgeId: badge.id,
                                                name: badge.name,
                                                description: badge.description,
                                                price: badge.usd_price,
                                              }
                                            }
                                          );

                                          if (error) throw error;

                                          toast({
                                            title: "Success",
                                            description: `Stripe product created for ${badge.name}`,
                                          });

                                          // Refresh badges list
                                          fetchData();
                                        } catch (error) {
                                          console.error('Error creating Stripe product:', error);
                                          toast({
                                            title: "Error",
                                            description: error instanceof Error ? error.message : "Failed to create Stripe product",
                                            variant: "destructive",
                                          });
                                        }
                                      }}
                                      className="rounded-full text-xs"
                                    >
                                      Create Stripe Product
                                    </Button>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={badge.is_active ? 'default' : 'secondary'}>
                                {badge.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>{badge.display_order}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {editingBadge === badge.id ? (
                                  <>
                                     <Button
                                      size="sm"
                                      variant="default"
                                      onClick={async () => {
                                        const updates = editBadgeValues[badge.id] || {};
                                        
                                        // 가격 값 검증
                                        if (updates.usd_price !== undefined) {
                                          const price = typeof updates.usd_price === 'string' 
                                            ? parseFloat(updates.usd_price) 
                                            : updates.usd_price;
                                          
                                          if (isNaN(price) || price <= 0) {
                                            toast({
                                              title: "Invalid Price",
                                              description: "Please enter a valid price greater than 0",
                                              variant: "destructive",
                                            });
                                            return;
                                          }
                                          updates.usd_price = price;
                                        }
                                        
                                        await handleUpdateBadge(badge.id, updates);
                                        setEditingBadge(null);
                                        setEditBadgeValues({});
                                      }}
                                      className="rounded-full"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingBadge(null);
                                        setEditBadgeValues({});
                                      }}
                                      className="rounded-full"
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                     <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingBadge(badge.id);
                                        setEditBadgeValues({
                                          [badge.id]: {
                                            name: badge.name,
                                            usd_price: badge.usd_price,
                                            stripe_price_id: badge.stripe_price_id || '',
                                            icon: badge.icon,
                                            description: badge.description || '',
                                            color: badge.color,
                                            display_order: badge.display_order,
                                          }
                                        });
                                      }}
                                      className="rounded-full"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleToggleBadgeActive(badge.id, badge.is_active)}
                                      className="rounded-full"
                                    >
                                      {badge.is_active ? 'Deactivate' : 'Activate'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleDeleteBadge(badge.id)}
                                      className="rounded-full"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {giftBadges.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              No badges created yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schema Type Relationships Tab */}
          <TabsContent value="schema-relationships" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Schema Type Relationships</CardTitle>
                <CardDescription>
                  Define which schema types can be parents/children of other types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Add New Relationship Form */}
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h3 className="font-semibold mb-4">Add New Relationship</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Parent Schema Type</Label>
                        <Select
                          value={newRelationship.parent_schema_type}
                          onValueChange={(value) => setNewRelationship(prev => ({ ...prev, parent_schema_type: value }))}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select parent type" />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="artist">Artist</SelectItem>
                            <SelectItem value="group">Group</SelectItem>
                            <SelectItem value="actor">Actor</SelectItem>
                            <SelectItem value="food">Food</SelectItem>
                            <SelectItem value="food_brand">Food Brand</SelectItem>
                            <SelectItem value="brand">Brand</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Child Schema Type</Label>
                        <Select
                          value={newRelationship.child_schema_type}
                          onValueChange={(value) => setNewRelationship(prev => ({ ...prev, child_schema_type: value }))}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select child type" />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="album">Album</SelectItem>
                            <SelectItem value="song">Song</SelectItem>
                            <SelectItem value="food_product">Food Product</SelectItem>
                            <SelectItem value="product">Product</SelectItem>
                            <SelectItem value="movie">Movie</SelectItem>
                            <SelectItem value="drama">Drama</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={async () => {
                            if (!newRelationship.parent_schema_type || !newRelationship.child_schema_type) {
                              toast({ title: "Please select both parent and child types", variant: "destructive" });
                              return;
                            }
                            
                            const { error } = await supabase
                              .from('schema_type_relationships' as any)
                              .insert([newRelationship] as any);
                            
                            if (error) {
                              toast({ title: "Error", description: error.message, variant: "destructive" });
                            } else {
                              toast({ title: "Relationship added successfully" });
                              setNewRelationship({ parent_schema_type: '', child_schema_type: '' });
                              // Refresh list
                              const { data } = await supabase
                                .from('schema_type_relationships' as any)
                                .select('*')
                                .order('parent_schema_type');
                              if (data) setSchemaRelationships(data);
                            }
                          }}
                          className="w-full rounded-full"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Existing Relationships Table */}
                  <div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parent Type</TableHead>
                          <TableHead>Child Type</TableHead>
                          <TableHead>Created At</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schemaRelationships.map((rel) => (
                          <TableRow key={rel.id}>
                            <TableCell className="font-medium">{rel.parent_schema_type}</TableCell>
                            <TableCell>{rel.child_schema_type}</TableCell>
                            <TableCell>{new Date(rel.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={async () => {
                                  const { error } = await supabase
                                    .from('schema_type_relationships' as any)
                                    .delete()
                                    .eq('id', rel.id);
                                  
                                  if (error) {
                                    toast({ title: "Error", description: error.message, variant: "destructive" });
                                  } else {
                                    toast({ title: "Relationship deleted" });
                                    // Refresh list
                                    const { data } = await supabase
                                      .from('schema_type_relationships' as any)
                                      .select('*')
                                      .order('parent_schema_type');
                                    if (data) setSchemaRelationships(data);
                                  }
                                }}
                                className="rounded-full"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {schemaRelationships.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              No schema type relationships defined yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="duplicates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Duplicate Wiki Entries
                </CardTitle>
                <CardDescription>
                  Review and manually delete duplicate entries. Entries with the same title are grouped together.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    onClick={fetchDuplicates}
                    disabled={loadingDuplicates}
                    className="rounded-full"
                  >
                    {loadingDuplicates ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Find Duplicates
                      </>
                    )}
                  </Button>
                </div>

                {Object.keys(duplicates).length > 0 ? (
                  <div className="space-y-6">
                    <div className="text-sm text-muted-foreground">
                      Found {Object.keys(duplicates).length} duplicate groups
                    </div>
                    
                    {Object.entries(duplicates).map(([key, entries]) => {
                      const [schemaType, title] = key.split(':');
                      return (
                        <div key={key} className="border rounded-lg p-4 bg-muted/30">
                          <div className="flex items-center gap-2 mb-3">
                            <Badge variant="secondary">{schemaType}</Badge>
                            <h3 className="font-semibold">{entries[0].title}</h3>
                            <span className="text-sm text-muted-foreground">
                              ({entries.length} duplicates)
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            {entries.map((entry, index) => (
                              <div
                                key={entry.id}
                                className="flex items-center gap-3 p-3 bg-background rounded border"
                              >
                                {entry.image_url && (
                                  <img
                                    src={entry.image_url}
                                    alt={entry.title}
                                    className="w-12 h-12 object-cover rounded"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium truncate">{entry.title}</p>
                                    {index === 0 && (
                                      <Badge variant="outline" className="text-xs">
                                        Oldest
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Created: {new Date(entry.created_at).toLocaleString()}
                                  </p>
                                  {entry.metadata?.group_name && (
                                    <p className="text-xs text-muted-foreground">
                                      Group: {entry.metadata.group_name}
                                    </p>
                                  )}
                                  {entry.metadata?.birthday && (
                                    <p className="text-xs text-muted-foreground">
                                      Birthday: {entry.metadata.birthday}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteDuplicateEntry(entry.id, entry.title)}
                                  className="rounded-full shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : loadingDuplicates ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    Searching for duplicates...
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Click "Find Duplicates" to search for duplicate entries
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawal Requests Tab */}
          <TabsContent value="withdrawals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Withdrawal Requests</CardTitle>
                <CardDescription>
                  Manage user withdrawal requests for creator earnings
                </CardDescription>
              </CardHeader>
              <CardContent>
                {withdrawalRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No withdrawal requests found
                  </div>
                ) : (
                  <div className="space-y-4">
                    {withdrawalRequests.map((request) => (
                      <Card key={request.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Avatar>
                              <AvatarImage src={request.profiles?.avatar_url} />
                              <AvatarFallback>{request.profiles?.username?.[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <div className="font-medium">{request.profiles?.display_name || request.profiles?.username}</div>
                                  <div className="text-sm text-muted-foreground">@{request.profiles?.username}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold">${request.amount}</div>
                                  <div className={`text-xs px-2 py-1 rounded-full ${
                                    request.status === 'approved' ? 'bg-green-100 text-green-700' :
                                    request.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {request.status}
                                  </div>
                                </div>
                              </div>

                              <div className="text-sm text-muted-foreground space-y-1">
                                <div>Requested: {new Date(request.created_at).toLocaleString()}</div>
                                {request.processed_at && (
                                  <div>Processed: {new Date(request.processed_at).toLocaleString()}</div>
                                )}
                                {request.stripe_account_id && (
                                  <div className="mt-2 p-2 bg-muted rounded text-xs">
                                    <div className="font-medium mb-1">Stripe Account:</div>
                                    <div className="font-mono">{request.stripe_account_id}</div>
                                  </div>
                                )}
                                {request.notes && (
                                  <div className="mt-2 p-2 bg-muted rounded text-xs">
                                    <div className="font-medium mb-1">Notes:</div>
                                    <div>{request.notes}</div>
                                  </div>
                                )}
                              </div>

                              {request.status === 'pending' && (
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    onClick={() => handleWithdrawalAction(request.id, 'approved')}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleWithdrawalAction(request.id, 'rejected')}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blocked Email Domains Tab */}
          <TabsContent value="blocked-emails" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Blocked Email Domains</CardTitle>
                <CardDescription>
                  Manage temporary/disposable email domains to prevent signups
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add new domain */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Domain (e.g., tempmail.com)"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                  />
                  <Input
                    placeholder="Reason (optional)"
                    value={newDomainReason}
                    onChange={(e) => setNewDomainReason(e.target.value)}
                  />
                  <Button
                    onClick={async () => {
                      if (!newDomain) return;
                      setIsAddingDomain(true);
                      try {
                        const { error } = await supabase
                          .from('blocked_email_domains')
                          .insert([{
                            domain: newDomain,
                            reason: newDomainReason || null,
                            created_by: user?.id
                          }]);
                        
                        if (error) throw error;
                        
                        toast({
                          title: "Domain Blocked",
                          description: `${newDomain} has been added to the blocklist`,
                        });
                        
                        setNewDomain('');
                        setNewDomainReason('');
                        fetchData();
                      } catch (error: any) {
                        toast({
                          title: "Error",
                          description: error.message,
                          variant: "destructive",
                        });
                      } finally {
                        setIsAddingDomain(false);
                      }
                    }}
                    disabled={!newDomain || isAddingDomain}
                  >
                    {isAddingDomain ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add
                  </Button>
                </div>

                {/* List of blocked domains */}
                {blockedDomains.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No blocked domains configured
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blockedDomains.map((domain) => (
                        <TableRow key={domain.id}>
                          <TableCell className="font-mono">{domain.domain}</TableCell>
                          <TableCell className="text-muted-foreground">{domain.reason || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(domain.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                if (!confirm(`Remove ${domain.domain} from blocklist?`)) return;
                                try {
                                  const { error } = await supabase
                                    .from('blocked_email_domains')
                                    .delete()
                                    .eq('id', domain.id);
                                  
                                  if (error) throw error;
                                  
                                  toast({
                                    title: "Domain Unblocked",
                                    description: `${domain.domain} has been removed from the blocklist`,
                                  });
                                  
                                  fetchData();
                                } catch (error: any) {
                                  toast({
                                    title: "Error",
                                    description: error.message,
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wiki Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Entry Categories
                </CardTitle>
                <CardDescription>
                  Manage categories shown in the Create Fanz dropdown
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add new category */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Value (e.g., k_drama)"
                    value={newCategory.value}
                    onChange={(e) => setNewCategory({
                      ...newCategory,
                      value: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                    })}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Label (e.g., K-Drama)"
                    value={newCategory.label}
                    onChange={(e) => setNewCategory({ ...newCategory, label: e.target.value })}
                    className="flex-1"
                  />
                  <Button
                    onClick={async () => {
                      if (!newCategory.value || !newCategory.label) return;
                      try {
                        // 먼저 enum에 값 추가
                        const { error: enumError } = await supabase.rpc('add_wiki_schema_type_if_not_exists', {
                          new_value: newCategory.value
                        });
                        
                        if (enumError) {
                          console.error('Error adding enum value:', enumError);
                          // enum 추가 실패해도 계속 진행 (이미 존재할 수 있음)
                        }
                        
                        const maxOrder = Math.max(...wikiCategories.map(c => c.display_order), 0);
                        const { error } = await supabase
                          .from('wiki_categories')
                          .insert([{
                            value: newCategory.value,
                            label: newCategory.label,
                            display_order: maxOrder + 1
                          }]);
                        
                        if (error) throw error;
                        
                        toast({
                          title: "Category Added",
                          description: `${newCategory.label} has been added`,
                        });
                        
                        setNewCategory({ value: '', label: '' });
                        fetchWikiCategories();
                      } catch (error: any) {
                        toast({
                          title: "Error",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={!newCategory.value || !newCategory.label}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>

                {/* Categories list */}
                {wikiCategories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No categories configured
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Order</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wikiCategories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <GripVertical className="w-4 h-4 text-muted-foreground" />
                              {category.display_order}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {editingCategory === category.id ? (
                              <Input
                                value={editCategoryValues[category.id]?.value ?? category.value}
                                onChange={(e) => setEditCategoryValues({
                                  ...editCategoryValues,
                                  [category.id]: {
                                    ...editCategoryValues[category.id],
                                    value: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                                  }
                                })}
                                className="h-8"
                              />
                            ) : (
                              category.value
                            )}
                          </TableCell>
                          <TableCell>
                            {editingCategory === category.id ? (
                              <Input
                                value={editCategoryValues[category.id]?.label ?? category.label}
                                onChange={(e) => setEditCategoryValues({
                                  ...editCategoryValues,
                                  [category.id]: {
                                    ...editCategoryValues[category.id],
                                    label: e.target.value
                                  }
                                })}
                                className="h-8"
                              />
                            ) : (
                              category.label
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={category.is_active ? "default" : "secondary"}>
                              {category.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {editingCategory === category.id ? (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        const updates = editCategoryValues[category.id] || {};
                                        const { error } = await supabase
                                          .from('wiki_categories')
                                          .update({
                                            value: updates.value ?? category.value,
                                            label: updates.label ?? category.label,
                                            updated_at: new Date().toISOString()
                                          })
                                          .eq('id', category.id);
                                        
                                        if (error) throw error;
                                        
                                        toast({ title: "Category updated" });
                                        setEditingCategory(null);
                                        setEditCategoryValues({});
                                        fetchWikiCategories();
                                      } catch (error: any) {
                                        toast({
                                          title: "Error",
                                          description: error.message,
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingCategory(null);
                                      setEditCategoryValues({});
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingCategory(category.id);
                                      setEditCategoryValues({
                                        [category.id]: { value: category.value, label: category.label }
                                      });
                                    }}
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        const { error } = await supabase
                                          .from('wiki_categories')
                                          .update({ is_active: !category.is_active })
                                          .eq('id', category.id);
                                        
                                        if (error) throw error;
                                        fetchWikiCategories();
                                      } catch (error: any) {
                                        toast({
                                          title: "Error",
                                          description: error.message,
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                  >
                                    {category.is_active ? "Disable" : "Enable"}
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={async () => {
                                      if (!confirm(`Delete category "${category.label}"?`)) return;
                                      try {
                                        const { error } = await supabase
                                          .from('wiki_categories')
                                          .delete()
                                          .eq('id', category.id);
                                        
                                        if (error) throw error;
                                        
                                        toast({
                                          title: "Category Deleted",
                                          description: `${category.label} has been removed`,
                                        });
                                        
                                        fetchWikiCategories();
                                      } catch (error: any) {
                                        toast({
                                          title: "Error",
                                          description: error.message,
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Farcaster Frame Tab */}
          <TabsContent value="farcaster" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Farcaster Frame - K-TRENDZ Pioneer
                </CardTitle>
                <CardDescription>
                  Manage the Pioneer Reward Frame for Farcaster users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Day 1 Launch Content */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Day 1: Brand Introduction
                  </h3>
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-lg space-y-4 border border-primary/20">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase">Launch Copy (Option 3)</div>
                      <div className="bg-background p-4 rounded-md border">
                        <p className="text-sm whitespace-pre-line">
                          GM Farcaster 👋{'\n\n'}
                          KTRENDZ just landed on Base.{'\n\n'}
                          We're building the home for K-Culture fans worldwide.{'\n'}
                          Whether you stan BTS, love Korean food, or planning your Seoul trip – this is your space.{'\n\n'}
                          Welcome to the K-Wave 🌊{'\n\n'}
                          @base #KPop #KCulture #Base
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase">Hero Image</div>
                      <div className="border-2 border-primary/30 rounded-lg overflow-hidden bg-background">
                        <img 
                          src="/farcaster-day1-hero.jpg" 
                          alt="KTRENDZ Day 1 Hero" 
                          className="w-full h-auto"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>📥 Download:</span>
                        <a 
                          href="/farcaster-day1-hero.jpg" 
                          download 
                          className="text-primary hover:underline font-medium"
                        >
                          farcaster-day1-hero.jpg
                        </a>
                      </div>
                    </div>

                    <div className="bg-background/50 p-3 rounded-md space-y-2">
                      <div className="text-xs font-semibold">📋 Posting Checklist</div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div>✅ Attach hero image</div>
                        <div>✅ Include @base mention</div>
                        <div>✅ Add hashtags: #KPop #KCulture #Base</div>
                        <div>❌ NO minting frames on Day 1</div>
                        <div>⏰ Post at 9-10am or 6-7pm PT for best engagement</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="bg-primary/10">Day 1</Badge>
                      <span className="text-muted-foreground">Trust building phase - no NFT minting</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Frame Metadata */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Frame Configuration</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Title</div>
                      <div className="text-sm">K-TRENDZ Pioneer Rewards</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
                      <div className="text-sm">Claim your Pioneer rewards: 500 Stars + Exclusive Pioneer Badge</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Button Text</div>
                      <div className="text-sm">Claim Pioneer Rewards</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Success Link</div>
                      <div className="text-sm">https://k-trendz.com</div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Frame Preview */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Frame Image Preview</h3>
                  <div className="border-2 border-primary/20 rounded-lg overflow-hidden">
                    <img 
                      src="/images/pioneer-frame.jpg" 
                      alt="K-TRENDZ Pioneer Frame" 
                      className="w-full h-auto"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This image will be displayed on Farcaster when users interact with the Pioneer Reward campaign
                  </p>
                </div>

                <Separator />

                {/* Frame URL & Usage */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">How to Share on Farcaster</h3>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      1. Copy the frame URL below
                    </p>
                    <div className="bg-muted p-3 rounded-md">
                      <code className="text-xs break-all">
                        https://k-trendz.com/api/farcaster-pioneer-frame
                      </code>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      2. Create a new cast on Farcaster and paste the URL
                    </p>
                    <p className="text-sm text-muted-foreground">
                      3. Farcaster will automatically render it as an interactive frame
                    </p>
                    <p className="text-sm text-muted-foreground">
                      4. Users can click "Claim Pioneer Rewards" button to receive 500 Stars + Pioneer Badge
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Pioneer Claims Stats */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Pioneer Claims Statistics</h3>
                    <Button 
                      onClick={async () => {
                        const { count } = await supabase
                          .from('pioneer_claims')
                          .select('*', { count: 'exact', head: true });
                        toast({
                          title: "Total Claims",
                          description: `${count || 0} users have claimed Pioneer Rewards`,
                        });
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Refresh
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold">-</div>
                          <div className="text-xs text-muted-foreground">Total Claims</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold">500</div>
                          <div className="text-xs text-muted-foreground">Stars per Claim</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">1x</div>
                          <div className="text-xs text-muted-foreground">Pioneer Badge</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Separator />

                {/* Implementation Status */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Implementation Status</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Database table: <code className="text-xs bg-muted px-1 py-0.5 rounded">pioneer_claims</code></span>
                      <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">Active</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Edge Function: <code className="text-xs bg-muted px-1 py-0.5 rounded">farcaster-pioneer-frame</code></span>
                      <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">Active</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Frame is ready to use. Share the URL on Farcaster to start collecting Pioneer claims!
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Mini App Home Preview */}
            <MiniAppHomePreview />

            {/* Mini App Shop Preview */}
            <MiniAppShopPreview />

            {/* Challenge Frames Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Challenge Frames
                </CardTitle>
                <CardDescription>
                  Frame URLs for challenges - share on Farcaster for quiz participation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChallengeFramesList />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Templates Tab */}
          <TabsContent value="email-templates" className="space-y-6">
            <EmailTemplateSettings />
          </TabsContent>

          {/* Entry Scores Tab */}
          <TabsContent value="entry-scores" className="space-y-6">
            <EntryScoreManager />
          </TabsContent>

          {/* KTNZ Vesting Tab */}
          <TabsContent value="vesting" className="space-y-6">
            <VestingManager />
          </TabsContent>

          {/* Master Applications Tab */}
          <TabsContent value="master-applications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Master Applications
                </CardTitle>
                <CardDescription>
                  팬페이지 마스터 지원 현황 (/pitch-master 페이지에서 접수)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {masterApplications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No master applications yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Artist</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {masterApplications.map((app: any) => (
                        <TableRow key={app.id}>
                          <TableCell className="font-medium">{app.artist_name}</TableCell>
                          <TableCell>{app.email}</TableCell>
                          <TableCell>{app.phone || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={app.status === 'pending' ? 'secondary' : app.status === 'approved' ? 'default' : 'destructive'}>
                              {app.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(app.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            {app.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-green-500/10 hover:bg-green-500/20 text-green-600"
                                  onClick={async () => {
                                    const { error } = await supabase
                                      .from('master_applications' as any)
                                      .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
                                      .eq('id', app.id);
                                    if (!error) {
                                      toast({ title: "Approved", description: `${app.artist_name} application approved` });
                                      fetchData();
                                    }
                                  }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-red-500/10 hover:bg-red-500/20 text-red-600"
                                  onClick={async () => {
                                    const { error } = await supabase
                                      .from('master_applications' as any)
                                      .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
                                      .eq('id', app.id);
                                    if (!error) {
                                      toast({ title: "Rejected", description: `${app.artist_name} application rejected` });
                                      fetchData();
                                    }
                                  }}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                if (!confirm('Delete this application?')) return;
                                const { error } = await supabase
                                  .from('master_applications' as any)
                                  .delete()
                                  .eq('id', app.id);
                                if (!error) {
                                  toast({ title: "Deleted" });
                                  fetchData();
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Challenges Tab */}
          <TabsContent value="challenges" className="space-y-6">
            <ChallengeManager />
          </TabsContent>

          {/* Onchain Transactions Tab */}
          <TabsContent value="onchain-transactions" className="space-y-6">
            <OnchainTransactionsManager />
            <FundIntegrityValidator />
          </TabsContent>

          {/* Bot Detector Tab */}
          <TabsContent value="bot-detector" className="space-y-6">
            <BotDetector onBanComplete={fetchData} />
          </TabsContent>

          {/* Agent Verification (Paymaster V2) Tab */}
          <TabsContent value="agent-verification" className="space-y-6">
            <AgentVerificationManager />
          </TabsContent>

          {/* Agent Chat Settings Tab */}
          <TabsContent value="agent-chat-settings" className="space-y-6">
            <AgentChatSettingsPanel />
          </TabsContent>

          {/* Banners Tab */}
          <TabsContent value="banners" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Rankings Page Banner</CardTitle>
                <CardDescription>
                  Manage the hero banner displayed at the top of the Rankings page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload Banner Image</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="banner-file"
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      disabled={isUploadingBanner}
                      className="hidden"
                    />
                    <Label
                      htmlFor="banner-file"
                      className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 bg-background text-primary border border-input rounded-full hover:bg-primary/10 transition-colors text-sm"
                    >
                      {isUploadingBanner ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Choose Image
                        </>
                      )}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload a banner image. Recommended size: 1920x400px or similar wide format.
                  </p>
                </div>

                {rankingsBannerUrl && (
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <img 
                        src={rankingsBannerUrl} 
                        alt="Banner preview" 
                        className="w-full max-h-44 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground break-all">{rankingsBannerUrl}</p>
                  </div>
                )}

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Banner Link</Label>
                      <p className="text-xs text-muted-foreground">
                        When enabled, clicking the banner will navigate to the specified URL
                      </p>
                    </div>
                    <Switch
                      checked={rankingsBannerLinkEnabled}
                      onCheckedChange={setRankingsBannerLinkEnabled}
                    />
                  </div>

                  {rankingsBannerLinkEnabled && (
                    <div className="space-y-2">
                      <Label>Banner Link URL</Label>
                      <Input
                        value={rankingsBannerLink}
                        onChange={(e) => setRankingsBannerLink(e.target.value)}
                        placeholder="/challenges or https://..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter a relative path (e.g., /challenges) or full URL
                      </p>
                    </div>
                  )}
                </div>

                <Button 
                  onClick={saveRankingsBanner} 
                  disabled={isSavingBanner || !rankingsBannerUrl}
                  className="w-full sm:w-auto"
                >
                  {isSavingBanner ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Banner'
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* UI Settings Tab */}
          <TabsContent value="ui-settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  UI Settings
                </CardTitle>
                <CardDescription>
                  Control visibility of menu items and UI elements for users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* K-Trendz Wallet Menu Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">K-Trendz Wallet Menu</p>
                      <p className="text-sm text-muted-foreground">
                        Show/hide the K-Trendz Wallet menu item in user navigation
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isSavingWalletMenu && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                    <Switch
                      checked={showWalletMenu}
                      onCheckedChange={async (checked) => {
                        setIsSavingWalletMenu(true);
                        try {
                          const { error } = await supabase
                            .from('system_settings')
                            .update({
                              setting_value: { enabled: checked },
                              updated_at: new Date().toISOString()
                            })
                            .eq('setting_key', 'show_wallet_menu');

                          if (error) throw error;

                          setShowWalletMenu(checked);
                          toast({
                            title: "Success",
                            description: `K-Trendz Wallet menu is now ${checked ? 'visible' : 'hidden'}.`,
                          });
                        } catch (error) {
                          console.error('Error updating wallet menu setting:', error);
                          toast({
                            title: "Error",
                            description: "Failed to update setting.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsSavingWalletMenu(false);
                        }
                      }}
                      disabled={isSavingWalletMenu}
                    />
                  </div>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2 text-sm">About UI Settings</h4>
                  <p className="text-sm text-muted-foreground">
                    These settings control which menu items are visible to users in the navigation.
                    Changes take effect immediately for all users when they refresh the page.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Point Adjustment Dialog */}
        <Dialog open={showQuickPointDialog} onOpenChange={setShowQuickPointDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Adjust Points for {selectedUserForPoints?.username}</DialogTitle>
              <DialogDescription>
                Current Points: {selectedUserForPoints?.total_points || 0} XP, {selectedUserForPoints?.available_points || 0} Available
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="quick-points">Stars Amount</Label>
                <Input
                  id="quick-points"
                  type="number"
                  min="1"
                  value={quickPointAmount}
                  onChange={(e) => setQuickPointAmount(e.target.value)}
                  placeholder="Enter stars amount"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleQuickPointAdjustment('add')}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!quickPointAmount}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
                <Button
                  onClick={() => handleQuickPointAdjustment('subtract')}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  disabled={!quickPointAmount}
                >
                  <Minus className="w-4 h-4 mr-2" />
                  Subtract
                </Button>
              </div>

              <div className="bg-muted p-3 rounded-lg text-xs space-y-1">
                <p className="font-medium">Note:</p>
                <p className="text-muted-foreground">Both XP and Available Points will be adjusted together</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Password Reset Dialog */}
        <Dialog open={showPasswordResetDialog} onOpenChange={(open) => {
          setShowPasswordResetDialog(open);
          if (!open) {
            setNewPassword('');
            setSelectedUserForPassword(null);
          }
        }}>
          <DialogContent className="sm:max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Reset Password
              </DialogTitle>
              <DialogDescription>
                {selectedUserForPassword?.email || selectedUserForPassword?.username}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  minLength={6}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handlePasswordReset}
                  className="flex-1 bg-primary hover:bg-primary/90"
                  disabled={isResettingPassword || newPassword.length < 6}
                >
                  {isResettingPassword ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4 mr-2" />
                  )}
                  Reset Password
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPasswordResetDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Person Details Auto Fill Progress Dialog */}
        <Dialog open={showPersonDetailsDialog} onOpenChange={setShowPersonDetailsDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Auto Fill Person Details Progress</DialogTitle>
              <DialogDescription>
                Automatically filling person information using Naver Search API and OpenAI
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 pt-4">
              {/* Current Status */}
              {isAutoFillingDetails && (
                <div className="bg-primary/10 border-2 border-primary p-4 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-bold">Processing Batch #{personDetailsProgress.batches + 1}</p>
                      <p className="text-xs text-muted-foreground">Processing 20 entries per batch...</p>
                      
                      {/* 현재 처리 중인 엔트리 표시 */}
                      {personDetailsProgress.currentEntry && (
                        <div className="mt-2 flex items-center gap-2">
                          <User className="w-3 h-3 text-primary" />
                          <span className="text-xs font-medium text-primary">
                            Currently: {personDetailsProgress.currentEntry}
                          </span>
                        </div>
                      )}
                      
                      {/* 최근 처리 항목 표시 */}
                      {personDetailsProgress.details.length > 0 && (
                        <div className="mt-2 p-2 bg-background/50 rounded border border-border">
                          <p className="text-xs font-medium mb-1">Recently Processed:</p>
                          <div className="space-y-1">
                            {personDetailsProgress.details.slice(-5).reverse().map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                {item.status === 'success' && <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />}
                                {item.status === 'no_update_needed' && <Minus className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                                {(item.status === 'error' || item.status === 'update_failed' || item.status === 'extraction_failed') && 
                                  <span className="w-3 h-3 text-red-600 flex-shrink-0">✕</span>}
                                <span className="truncate flex-1">{item.title}</span>
                                {item.status === 'success' && <span className="text-green-600 flex-shrink-0">✓</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {personDetailsProgress.total > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Progress</span>
                        <span className="font-medium">
                          {personDetailsProgress.processed} / {personDetailsProgress.total}
                        </span>
                      </div>
                      <Progress 
                        value={(personDetailsProgress.processed / personDetailsProgress.total) * 100} 
                        className="h-2"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Summary Stats - Always show */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold">{personDetailsProgress.batches}</div>
                      <div className="text-xs text-muted-foreground">Batches</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold">{personDetailsProgress.processed}</div>
                      <div className="text-xs text-muted-foreground">Processed</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-green-600">{personDetailsProgress.updated}</div>
                      <div className="text-xs text-muted-foreground">Updated</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-red-600">{personDetailsProgress.failed}</div>
                      <div className="text-xs text-muted-foreground">Failed</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {!isAutoFillingDetails && personDetailsProgress.processed > 0 && (
                <>
                  {/* Detailed Results */}
                  {personDetailsProgress.details.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">Detailed Results:</h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {personDetailsProgress.details.map((item, index) => (
                          <div key={index} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{item.title}</span>
                              <Badge variant={
                                item.status === 'success' ? 'default' : 
                                item.status === 'no_empty_fields' ? 'secondary' :
                                'destructive'
                              }>
                                {item.status}
                              </Badge>
                            </div>
                            {item.status === 'success' && item.details && (
                              <div className="text-xs text-muted-foreground space-y-1 mt-2">
                                {item.details.real_name && <div>• Real Name: {item.details.real_name}</div>}
                                {item.details.birth_date && <div>• Birth Date: {item.details.birth_date}</div>}
                                {item.details.gender && <div>• Gender: {item.details.gender}</div>}
                                {item.details.nationality && <div>• Nationality: {item.details.nationality}</div>}
                                {item.details.blood_type && <div>• Blood Type: {item.details.blood_type}</div>}
                                {item.details.height && <div>• Height: {item.details.height}cm</div>}
                                {item.details.weight && <div>• Weight: {item.details.weight}kg</div>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Admin;
