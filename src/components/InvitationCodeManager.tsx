import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Copy, Loader2, Plus, Ticket, Users, Download, Crown, Eye, Link } from 'lucide-react';
import { format } from 'date-fns';

interface InvitationCode {
  id: string;
  code: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
  max_uses: number;
  current_uses: number;
  wiki_entry_id: string | null;
  used_by_profile?: {
    username: string;
  };
}

interface CodeUse {
  id: string;
  user_id: string;
  used_at: string;
  profiles?: {
    username: string;
  };
}

export const InvitationCodeManager = () => {
  const { user, isAdmin } = useAuth();
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [remaining, setRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [showMultiUseDialog, setShowMultiUseDialog] = useState(false);
  const [multiUseCount, setMultiUseCount] = useState(100);
  const [generatingMulti, setGeneratingMulti] = useState(false);
  const [selectedCodeUses, setSelectedCodeUses] = useState<CodeUse[]>([]);
  const [showUsesDialog, setShowUsesDialog] = useState(false);
  const [loadingUses, setLoadingUses] = useState(false);

  // 페이지 마스터 여부 확인 (wiki_entries에서 owner_id가 user.id인 엔트리가 있는지)
  const [isPageMaster, setIsPageMaster] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchData();
      checkPageMasterStatus();
    }
  }, [user?.id]);

  const checkPageMasterStatus = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('wiki_entries')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);
    
    if (!error && data && data.length > 0) {
      setIsPageMaster(true);
    }
  };

  const fetchData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // 남은 초대 코드 수 조회
      const { data: remainingData, error: remainingError } = await supabase.rpc(
        'get_remaining_invitation_codes',
        { user_id_param: user.id }
      );
      
      if (remainingError) throw remainingError;
      setRemaining(remainingData || 0);
      setIsVip(remainingData === 999);

      // 내 초대 코드 목록 조회
      const { data: codesData, error: codesError } = await supabase
        .from('invitation_codes')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (codesError) throw codesError;

      // 사용자 정보 가져오기 (단일 사용 코드용)
      if (codesData && codesData.length > 0) {
        const usedByIds = codesData
          .filter(c => c.used_by)
          .map(c => c.used_by);
        
        if (usedByIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', usedByIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
          
          setCodes(codesData.map(code => ({
            ...code,
            used_by_profile: code.used_by ? profileMap.get(code.used_by) : undefined
          })));
        } else {
          setCodes(codesData);
        }
      } else {
        setCodes([]);
      }
    } catch (error) {
      console.error('Error fetching invitation codes:', error);
      toast.error('Failed to load invitation codes');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    setGenerating(true);
    const count = isVip ? 10 : 1;
    const generatedCodes: string[] = [];
    
    try {
      for (let i = 0; i < count; i++) {
        const { data, error } = await supabase.rpc('generate_invitation_code');
        
        if (error) {
          if (error.message.includes('No remaining invitation codes')) {
            if (generatedCodes.length === 0) {
              toast.error('No invitation codes remaining');
            }
            break;
          } else {
            throw error;
          }
        }
        
        if (data) {
          generatedCodes.push(data);
        }
      }

      if (generatedCodes.length > 0) {
        toast.success(`${generatedCodes.length} invitation code(s) generated!`);
      }
      
      await fetchData();
    } catch (error) {
      console.error('Error generating invitation code:', error);
      toast.error('Failed to generate invitation code');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateMultiUseCode = async () => {
    if (!user?.id) return;
    
    setGeneratingMulti(true);
    try {
      // 랜덤 코드 생성
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const { error } = await supabase
        .from('invitation_codes')
        .insert({
          code,
          creator_id: user.id,
          max_uses: multiUseCount,
          current_uses: 0
        });
      
      if (error) throw error;
      
      toast.success(`Multi-use code generated! (${multiUseCount} uses)`);
      setShowMultiUseDialog(false);
      await fetchData();
    } catch (error) {
      console.error('Error generating multi-use code:', error);
      toast.error('Failed to generate multi-use code');
    } finally {
      setGeneratingMulti(false);
    }
  };

  const handleViewCodeUses = async (codeId: string) => {
    setLoadingUses(true);
    setShowUsesDialog(true);
    
    try {
      const { data, error } = await supabase
        .from('invitation_code_uses')
        .select('id, user_id, used_at')
        .eq('invitation_code_id', codeId)
        .order('used_at', { ascending: false });
      
      if (error) throw error;
      
      // 사용자 프로필 정보 별도 조회
      if (data && data.length > 0) {
        const userIds = data.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        setSelectedCodeUses(data.map(use => ({
          ...use,
          profiles: profileMap.get(use.user_id)
        })));
      } else {
        setSelectedCodeUses([]);
      }
    } catch (error) {
      console.error('Error fetching code uses:', error);
      toast.error('Failed to load code uses');
    } finally {
      setLoadingUses(false);
    }
  };

  const handleExportExcel = () => {
    const exportableCodes = codes.filter(c => c.max_uses === 1 && !c.used_by);
    if (exportableCodes.length === 0) {
      toast.error('No available codes to export');
      return;
    }

    // CSV 형식으로 생성 (Excel 호환)
    const csvContent = [
      ['Code', 'Created At'].join(','),
      ...exportableCodes.map(code => [
        code.code,
        format(new Date(code.created_at), 'yyyy-MM-dd HH:mm:ss')
      ].join(','))
    ].join('\n');

    // BOM 추가 (Excel에서 한글 깨짐 방지)
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invitation_codes_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Codes exported to CSV!');
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const copyInvitationLink = (code: string) => {
    const link = `https://k-trendz.com?ref=${code}`;
    navigator.clipboard.writeText(link);
    toast.success('Invitation link copied!');
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

  // 단일 사용 코드와 다회용 코드 분리
  const singleUseCodes = codes.filter(c => c.max_uses === 1);
  const multiUseCodes = codes.filter(c => c.max_uses > 1);
  const unusedSingleCodes = singleUseCodes.filter(c => !c.used_by);
  const usedSingleCodes = singleUseCodes.filter(c => c.used_by);

  const canCreateMultiUseCode = isAdmin || isPageMaster;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          Invitation Codes
          {isVip && <Badge variant="secondary" className="ml-2">VIP</Badge>}
        </CardTitle>
        <CardDescription>
          Invite friends to KTRENDZ. You earn 50 Stars for each friend who joins!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 남은 초대 코드 및 생성 버튼 */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {isVip ? 'Unlimited codes available' : `${remaining} codes remaining`}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              onClick={handleGenerateCode} 
              disabled={generating || (!isVip && remaining <= 0)}
              size="sm"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  {isVip ? 'Generate 10 Codes' : 'Generate Code'}
                </>
              )}
            </Button>
            
            {/* 다회용 코드 생성 버튼 - 관리자 또는 페이지 마스터만 */}
            {canCreateMultiUseCode && (
              <Dialog open={showMultiUseDialog} onOpenChange={setShowMultiUseDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Crown className="h-4 w-4 mr-1" />
                    Multi-Use Code
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Multi-Use Code</DialogTitle>
                    <DialogDescription>
                      Create an invitation code that can be used multiple times.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxUses">Maximum Uses</Label>
                      <Input
                        id="maxUses"
                        type="number"
                        min={2}
                        max={1000}
                        value={multiUseCount}
                        onChange={(e) => setMultiUseCount(Math.max(2, Math.min(1000, parseInt(e.target.value) || 2)))}
                      />
                      <p className="text-xs text-muted-foreground">
                        This code can be used up to {multiUseCount} times.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowMultiUseDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleGenerateMultiUseCode} disabled={generatingMulti}>
                      {generatingMulti ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : null}
                      Create Code
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            
            {isVip && unusedSingleCodes.length > 0 && (
              <Button 
                onClick={handleExportExcel}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            )}
          </div>
        </div>

        {/* 다회용 코드 섹션 */}
        {multiUseCodes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Multi-Use Codes
            </h4>
            <div className="space-y-2">
              {multiUseCodes.map(code => (
                <div 
                  key={code.id} 
                  className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-500/10 to-primary/10 rounded-lg border border-amber-500/20"
                >
                  <div className="flex flex-col">
                    <code className="font-mono text-lg tracking-widest">{code.code}</code>
                    <span className="text-xs text-muted-foreground">
                      {code.current_uses} / {code.max_uses} uses
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={code.current_uses >= code.max_uses ? "secondary" : "default"}
                    >
                      {code.current_uses >= code.max_uses ? 'Exhausted' : 'Active'}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleViewCodeUses(code.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => copyInvitationLink(code.code)}
                      title="Copy invitation link"
                    >
                      <Link className="h-4 w-4" />
                    </Button>
                    {/* 코드만 복사하는 버튼은 당분간 숨김
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => copyToClipboard(code.code)}
                      title="Copy code"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    */}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 미사용 단일 코드 */}
        {unusedSingleCodes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Available Codes (Single Use)</h4>
            <div className="space-y-2">
              {unusedSingleCodes.map(code => (
                <div 
                  key={code.id} 
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <code className="font-mono text-lg tracking-widest">{code.code}</code>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => copyInvitationLink(code.code)}
                      title="Copy invitation link"
                    >
                      <Link className="h-4 w-4" />
                    </Button>
                    {/* 코드만 복사하는 버튼은 당분간 숨김
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => copyToClipboard(code.code)}
                      title="Copy code"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    */}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 사용된 단일 코드 */}
        {usedSingleCodes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Used Codes</h4>
            <div className="space-y-2">
              {usedSingleCodes.map(code => (
                <div 
                  key={code.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-muted-foreground"
                >
                  <div className="flex flex-col">
                    <code className="font-mono tracking-widest line-through">{code.code}</code>
                    <span className="text-xs">
                      Used by @{code.used_by_profile?.username || 'unknown'} on{' '}
                      {code.used_at ? format(new Date(code.used_at), 'MMM d, yyyy') : 'N/A'}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-green-600">+50 Stars</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {codes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Generate your first invitation code to invite friends!
          </p>
        )}

        {/* 코드 사용 기록 다이얼로그 */}
        <Dialog open={showUsesDialog} onOpenChange={setShowUsesDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Code Usage History</DialogTitle>
              <DialogDescription>
                Users who have used this invitation code
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {loadingUses ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : selectedCodeUses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No one has used this code yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {selectedCodeUses.map((use, index) => (
                    <div 
                      key={use.id}
                      className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm"
                    >
                      <span>
                        #{index + 1} @{(use.profiles as any)?.username || 'unknown'}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {format(new Date(use.used_at), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
