import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import V2Layout from '@/components/home/V2Layout';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, ExternalLink, Mail, Lock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { InvitationCodeManager } from '@/components/InvitationCodeManager';
import ConnectExternalWallet from '@/components/ConnectExternalWallet';
import TransferToExternalWallet from '@/components/TransferToExternalWallet';
import GasVoucherCard from '@/components/GasVoucherCard';

const Profile = () => {
  const isMobile = useIsMobile();
  const { user, loading: authLoading, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [originalUsername, setOriginalUsername] = useState('');
  const [tebexWalletRef, setTebexWalletRef] = useState('');
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [searchParams] = useSearchParams();
  const invitationSectionRef = useRef<HTMLDivElement>(null);
  const [externalWallet, setExternalWallet] = useState<string | null>(null);

  // 이메일/비밀번호 변경 관련 상태
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // 이메일 회원인지 확인 (구글 로그인이 아닌 경우)
  const isEmailUser = useMemo(() => {
    if (!user) return false;
    const provider = user.app_metadata?.provider;
    return provider === 'email';
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchProfile();
      fetchExternalWallet();
    }
  }, [user, authLoading, navigate]);

  // Fetch external wallet
  const fetchExternalWallet = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('wallet_addresses')
      .select('wallet_address')
      .eq('user_id', user.id)
      .eq('wallet_type', 'external')
      .maybeSingle();
    setExternalWallet(data?.wallet_address || null);
  };

  // Scroll to invitations section if tab=invitations
  useEffect(() => {
    if (!fetching && searchParams.get('tab') === 'invitations' && invitationSectionRef.current) {
      setTimeout(() => {
        invitationSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [fetching, searchParams]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, bio, avatar_url, tebex_wallet_ref')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setUsername(data.username || '');
        setOriginalUsername(data.username || '');
        setDisplayName(data.display_name || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url || '');
        setTebexWalletRef(data.tebex_wallet_ref || '');
      }

      // Fetch total earnings
      const { data: earningsData, error: earningsError } = await supabase
        .from('creator_earnings')
        .select('amount')
        .eq('creator_id', user.id);

      if (!earningsError && earningsData) {
        const total = earningsData.reduce((sum, earning) => sum + Number(earning.amount), 0);
        setTotalEarnings(total);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    setUploading(true);

    try {
      // Delete old avatar if exists
      if (avatarUrl) {
        const oldPath = avatarUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setAvatarUrl(publicUrl);

      toast({
        title: 'Image Uploaded',
        description: 'Your profile image has been uploaded.'
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Upload Error',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  // Username 실시간 중복 체크
  useEffect(() => {
    const checkUsername = async () => {
      const trimmedUsername = username.trim();
      
      // 입력이 없거나 원래 username과 같으면 체크 안 함
      if (!trimmedUsername || trimmedUsername === originalUsername) {
        setUsernameAvailable(null);
        return;
      }

      // 최소 4자 미만이면 체크 안 함
      if (trimmedUsername.length < 4) {
        setUsernameAvailable(null);
        return;
      }

      setIsCheckingUsername(true);
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', trimmedUsername)
          .maybeSingle();

        if (error) {
          console.error('Error checking username:', error);
          setUsernameAvailable(null);
        } else {
          setUsernameAvailable(!data);
        }
      } catch (error) {
        console.error('Error checking username:', error);
        setUsernameAvailable(null);
      } finally {
        setIsCheckingUsername(false);
      }
    };

    // Debounce: 500ms 후에 체크
    const timer = setTimeout(checkUsername, 500);
    return () => clearTimeout(timer);
  }, [username, originalUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (username.trim().length < 4) {
      toast({
        title: 'Input Error',
        description: 'Username must be at least 4 characters',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
          display_name: displayName.trim(),
          bio: bio.trim(),
          avatar_url: avatarUrl,
          tebex_wallet_ref: tebexWalletRef.trim()
        })
        .eq('id', user.id);

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Username Taken',
            description: 'This username is already taken. Please choose another.',
            variant: 'destructive'
          });
        } else {
          throw error;
        }
        return;
      }

      setOriginalUsername(username.trim());

      // 프로필 캐시 즉시 무효화 (AppTabBar 등에 즉시 반영)
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.'
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Update Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 이메일 변경 핸들러
  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast({
        title: 'Input Error',
        description: 'Please enter a new email address.',
        variant: 'destructive'
      });
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive'
      });
      return;
    }

    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ 
        email: newEmail.trim() 
      });

      if (error) throw error;

      toast({
        title: 'Verification Email Sent',
        description: 'Please check your new email inbox and click the confirmation link to complete the change.',
      });
      setNewEmail('');
    } catch (error: any) {
      console.error('Error changing email:', error);
      toast({
        title: 'Email Change Failed',
        description: error.message || 'Failed to change email. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setEmailLoading(false);
    }
  };

  // 비밀번호 변경 핸들러
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      toast({
        title: 'Input Error',
        description: 'Please fill in all password fields.',
        variant: 'destructive'
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Password Too Short',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Password Mismatch',
        description: 'New password and confirm password do not match.',
        variant: 'destructive'
      });
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword 
      });

      if (error) throw error;

      toast({
        title: 'Password Changed',
        description: 'Your password has been updated successfully.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: 'Password Change Failed',
        description: error.message || 'Failed to change password. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (authLoading || fetching) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <V2Layout pcHeaderTitle="Edit Profile" showBackButton={true}>
      <div className={`${isMobile ? 'px-3' : ''} py-4 sm:py-6 max-w-2xl mx-auto`}>

        <Card className="shadow-sm">
          <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
            <CardTitle className="text-lg sm:text-xl">Edit Profile</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Set up your username and profile information
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div className="flex flex-col items-center space-y-3 sm:space-y-4">
                <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
                  <AvatarImage src={avatarUrl} alt={displayName || username} />
                  <AvatarFallback className="text-xl sm:text-2xl">
                    {(displayName || username).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="relative">
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploading || loading}
                    className="hidden"
                  />
                  <Label
                    htmlFor="avatar"
                    className="cursor-pointer inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="K-Pop Enthusiast"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Your display name (how others see you)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="username"
                    type="text"
                    placeholder="kpop_lover"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading}
                    className={`pl-8 ${
                      usernameAvailable === false ? 'border-destructive' : 
                      usernameAvailable === true ? 'border-green-500' : ''
                    }`}
                  />
                  {isCheckingUsername && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {usernameAvailable === false && (
                  <p className="text-xs text-destructive">
                    This username is already taken
                  </p>
                )}
                {usernameAvailable === true && (
                  <p className="text-xs text-green-600">
                    Username is available
                  </p>
                )}
                {usernameAvailable === null && (
                  <p className="text-xs text-muted-foreground">
                    Your unique handle (minimum 4 characters)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={loading}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Optional: A short bio about yourself
                </p>
              </div>

              {/* Tebex Wallet Section - Hidden for now */}
              {/* <div className="space-y-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Creator Earnings</Label>
                  <p className="text-sm text-muted-foreground">
                    Connect your Tebex wallet to receive 70% of lightstick earnings when fans support your wiki entries
                  </p>
                </div>

                {totalEarnings > 0 && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Earnings</p>
                    <p className="text-2xl font-bold text-primary">${totalEarnings.toFixed(2)}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tebexWalletRef">Tebex Wallet Reference</Label>
                  <Input
                    id="tebexWalletRef"
                    type="text"
                    placeholder="wallet_abc123xyz"
                    value={tebexWalletRef}
                    onChange={(e) => setTebexWalletRef(e.target.value)}
                    disabled={loading}
                  />
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      Enter your Tebex Creator Wallet Reference to receive earnings
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open('https://creator.tebex.io/', '_blank')}
                      className="w-full sm:w-auto"
                    >
                      Create Tebex Creator Account
                    </Button>
                  </div>
                </div>
              </div> */}

              <Button type="submit" className="w-full rounded-full h-10 sm:h-11" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Profile'
                )}
              </Button>
            </form>

            {/* Base Wallet 연결 섹션 */}
            <div className="mt-6 pt-6 border-t border-border space-y-4">
              <ConnectExternalWallet 
                showCard={false}
                onConnected={(addr) => setExternalWallet(addr)} 
              />
              
              {/* Transfer Lightsticks to External Wallet */}
              {externalWallet && (
                <TransferToExternalWallet 
                  externalWalletAddress={externalWallet}
                />
              )}
            </div>

            {/* 이메일/비밀번호 변경 섹션 - 이메일 회원만 표시 */}
            {isEmailUser && (
              <div className="mt-6 pt-6 border-t border-border space-y-6">
                {/* 이메일 변경 */}
                <form onSubmit={handleEmailChange} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold">Change Email</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current: {user?.email}
                  </p>
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="New email address"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      disabled={emailLoading}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="outline" 
                    className="w-full rounded-full h-10"
                    disabled={emailLoading || !newEmail.trim()}
                  >
                    {emailLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Change Email'
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    A verification link will be sent to your new email address.
                  </p>
                </form>

                {/* 비밀번호 변경 */}
                <form onSubmit={handlePasswordChange} className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold">Change Password</Label>
                  </div>
                  <div className="space-y-3">
                    <Input
                      type="password"
                      placeholder="New password (min 6 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={passwordLoading}
                    />
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={passwordLoading}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="outline" 
                    className="w-full rounded-full h-10"
                    disabled={passwordLoading || !newPassword || !confirmPassword}
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>

        {/* OpenClaw Gas Voucher Section */}
        <div className="mt-4 sm:mt-6">
          <GasVoucherCard />
        </div>

        <div className="mt-4 sm:mt-6" ref={invitationSectionRef} id="invitations">
          <InvitationCodeManager />
        </div>

        {/* Logout Button - 페이지 맨 아래 */}
        {user?.email && (
          <div className="mt-8 sm:mt-10 flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-destructive rounded-full h-10 px-6"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
            >
              Logout
            </Button>
            <p className="text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        )}
      </div>
    </V2Layout>
  );
};

export default Profile;
