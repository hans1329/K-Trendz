import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { z } from 'zod';
import { Loader2, Mail, FileText, HelpCircle, ChevronDown, AlertCircle, ArrowLeft, Activity } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFingerprint } from '@/hooks/useFingerprint';
import WalletSignIn from '@/components/WalletSignIn';

const LOGO_DESKTOP_URL = "https://jguylowswwgjvotdcsfj.supabase.co/storage/v1/object/public/brand_assets/logo7.png";

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [emailLoginOpen, setEmailLoginOpen] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [onchainStats, setOnchainStats] = useState<{ total: number } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { fingerprint, checkFingerprint } = useFingerprint();

  useEffect(() => {
    // 세션 만료 플래그 확인
    try {
      const expired = sessionStorage.getItem('session_expired');
      if (expired === 'true') {
        setSessionExpired(true);
        sessionStorage.removeItem('session_expired');
      }
    } catch (e) {
      // sessionStorage 접근 실패 무시
    }

    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/');
      }
    });
  }, [navigate]);

  // 플랫폼 활동 통계 조회 (RPC로 정확한 카운트)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.rpc('get_platform_activity_count');
        if (!error && data) {
          setOnchainStats({ total: Number(data) });
        }
      } catch {
        // 실패 시 무시
      }
    };
    fetchStats();
  }, []);
  const validateInputs = () => {
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Input Error',
          description: error.errors[0].message,
          variant: 'destructive'
        });
      }
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Login Failed',
            description: 'Invalid email or password.',
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Login Failed',
            description: error.message,
            variant: 'destructive'
          });
        }
      } else {
        toast({
          title: 'Login Successful!',
          description: 'Welcome to K-TRENDZ.'
        });
        navigate('/');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred during login.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'discord' | 'twitter') => {
    setLoadingProvider(provider);
    try {
      // 모든 탭에서 fingerprint 체크 (OAuth는 신규 계정 자동 생성 가능하므로)
      if (fingerprint) {
        const checkResult = await checkFingerprint();
        if (!checkResult.allowed) {
          toast({
            title: 'Sign Up Blocked',
            description: checkResult.message || 'Multiple account creation is not allowed. Please use your existing account.',
            variant: 'destructive'
          });
          setLoadingProvider(null);
          return;
        }
      }

      // fingerprint를 localStorage에 임시 저장 (OAuth 콜백 후 검증용)
      if (fingerprint) {
        try {
          localStorage.setItem('pending_fingerprint', fingerprint);
          localStorage.setItem('pending_fingerprint_check', 'true');
        } catch (e) {
          // localStorage 접근 실패 무시
        }
      }

      // 커스텀 도메인 감지
      const isCustomDomain = !window.location.hostname.includes('lovable.app') && 
                             !window.location.hostname.includes('lovableproject.com');

      if (isCustomDomain) {
        // 커스텀 도메인에서는 skipBrowserRedirect 사용
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/`,
            skipBrowserRedirect: true
          }
        });

        if (error) throw error;
        if (data?.url) {
          // 커스텀 auth 도메인으로 변환
          const authUrl = data.url.replace(
            'https://jguylowswwgjvotdcsfj.supabase.co',
            'https://auth.k-trendz.com'
          );
          window.location.href = authUrl;
        }
      } else {
        // Lovable 도메인에서는 일반 플로우
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/`
          }
        });
        if (error) throw error;
      }
    } catch (error: any) {
      setLoadingProvider(null);
      const providerName = provider === 'google' ? 'Google' : provider === 'discord' ? 'Discord' : 'X';
      toast({
        title: `${providerName} Sign In Failed`,
        description: error.message || `An error occurred during ${providerName} sign in.`,
        variant: 'destructive'
      });
    }
  };

  const handleGoogleSignIn = () => handleOAuthSignIn('google');
  const handleDiscordSignIn = () => handleOAuthSignIn('discord');
  const handleTwitterSignIn = () => handleOAuthSignIn('twitter');

  const isAnyLoading = loading || !!loadingProvider;

  const GoogleButton = ({ text = "Continue with Google" }: { text?: string }) => (
    <Button 
      type="button" 
      className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground" 
      onClick={handleGoogleSignIn}
      disabled={isAnyLoading}
    >
      {loadingProvider === 'google' ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {text}
        </>
      )}
    </Button>
  );

  const XButton = ({ text = "Continue with X" }: { text?: string }) => (
    <Button 
      type="button" 
      variant="outline"
      className="w-full h-12 text-sm border-muted-foreground/50 text-muted-foreground hover:bg-muted hover:text-foreground" 
      onClick={handleTwitterSignIn}
      disabled={isAnyLoading}
    >
      {loadingProvider === 'twitter' ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          {text}
        </>
      )}
    </Button>
  );

  const DiscordButton = ({ text = "Continue with Discord" }: { text?: string }) => (
    <Button 
      type="button" 
      variant="outline"
      className="w-full h-12 text-sm border-muted-foreground/50 text-muted-foreground hover:bg-muted hover:text-foreground" 
      onClick={handleDiscordSignIn}
      disabled={isAnyLoading}
    >
      {loadingProvider === 'discord' ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          {text}
        </>
      )}
    </Button>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <img src={LOGO_DESKTOP_URL} alt="KTRENDZ" className="h-12 mb-4" />
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-center text-sm text-slate-600">Welcome to K-Trends</h1>
            <a 
              href="/about" 
              className="text-muted-foreground hover:text-primary transition-colors" 
              aria-label="About K-TRENDZ"
              title="Learn about K-TRENDZ"
            >
              <HelpCircle className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Session Expired Alert */}
        {sessionExpired && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your session has expired. Please sign in again to continue.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 px-4 sm:px-0">
          {/* Google Login */}
          <GoogleButton />

          {/* X Login */}
          <XButton />

          {/* Discord Login */}
          <DiscordButton />

          {/* Wallet Sign-in */}
          <WalletSignIn compact />

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Email Login - Collapsible */}
          <Collapsible open={emailLoginOpen} onOpenChange={setEmailLoginOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full justify-between text-muted-foreground hover:text-muted-foreground hover:bg-transparent"
              >
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Login with Email
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${emailLoginOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input 
                    id="login-email" 
                    type="email" 
                    placeholder="your@email.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                    disabled={loading} 
                    autoComplete="email" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input 
                    id="login-password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                    disabled={loading} 
                    autoComplete="current-password" 
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : 'Login'}
                </Button>
              </form>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Footer with company info and policies */}
        <footer className="mt-8 text-center space-y-4">
          {/* Social Icons */}
          <div className="flex justify-center gap-4">
            <a href="https://x.com/intent/follow?screen_name=KTRNZ2025" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-accent rounded-full" aria-label="Follow us on X">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="mailto:manager@k-trendz.com" className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-accent rounded-full" aria-label="Contact us via email">
              <Mail size={20} />
            </a>
            <a href="/whitepaper" className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-accent rounded-full" aria-label="View Whitepaper">
              <FileText size={20} />
            </a>
          </div>

          {/* Policy Links */}
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] font-semibold px-4">
            <a href="/rules" className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
              Community Rules
            </a>
            <span className="text-muted-foreground">•</span>
            <a href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
              Privacy Policy
            </a>
            <span className="text-muted-foreground">•</span>
            <a href="/terms" className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
              User Agreement
            </a>
          </div>

          {/* Company Info */}
          <div className="text-[10px] text-muted-foreground space-y-0.5 px-4">
            <p>Fantagram Inc. © 2025. All rights reserved.</p>
            <p>131 Continental Dr. Suite 305, City of Newark, DE 19713 U.S.A.</p>
          </div>
          {/* On-chain Activity Stats */}
          {onchainStats && onchainStats.total > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/60">
              <Activity className="h-3 w-3" />
              <span>{onchainStats.total.toLocaleString()} on-chain activities on Base</span>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};

export default Auth;
