import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bot, Ban, RefreshCw, AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface BotAccount {
  id: string;
  display_name: string;
  email: string;
  created_at: string;
  pattern_type: string;
  evidence: string[];
  lightsticks?: { title: string; balance: number; image_url: string | null }[];
}

interface BotPattern {
  type: string;
  label: string;
  description: string;
  accounts: BotAccount[];
}

interface BotDetectorProps {
  onBanComplete?: () => void;
}

export function BotDetector({ onBanComplete }: BotDetectorProps) {
  const [patterns, setPatterns] = useState<BotPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [banning, setBanning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const detectBots = async () => {
    setLoading(true);
    setPatterns([]);
    setSelectedIds(new Set());

    try {
      // Edge function을 통해 봇 탐지
      const { data: botAnalysis, error } = await supabase.functions.invoke('admin-get-users', {
        body: { 
          action: 'detect_bots'
        }
      });

      if (error) throw error;

      const detectedPatterns: BotPattern[] = [];

      // 동일 이름 패턴
      if (botAnalysis?.duplicateNames?.length > 0) {
        detectedPatterns.push({
          type: 'duplicate_name',
          label: 'Duplicate Names',
          description: 'Multiple accounts with identical display names',
          accounts: botAnalysis.duplicateNames
        });
      }

      // 이름+숫자@gmail.com 패턴
      if (botAnalysis?.nameEmailPattern?.length > 0) {
        detectedPatterns.push({
          type: 'name_email_pattern',
          label: 'Generated Email Pattern',
          description: 'Email = firstname+lastname+numbers@gmail.com with auto-generated username',
          accounts: botAnalysis.nameEmailPattern
        });
      }

      // 동시 가입 + 동일 fingerprint 패턴
      if (botAnalysis?.simultaneousSignup?.length > 0) {
        detectedPatterns.push({
          type: 'simultaneous_signup',
          label: 'Same Fingerprint',
          description: '2+ accounts with same device fingerprint in same minute',
          accounts: botAnalysis.simultaneousSignup
        });
      }

      // 동일 IP 서브넷 패턴
      if (botAnalysis?.sameIpSubnet?.length > 0) {
        detectedPatterns.push({
          type: 'same_ip_subnet',
          label: 'Same IP Subnet',
          description: '3+ accounts from same /24 IP subnet (VPN/proxy farm)',
          accounts: botAnalysis.sameIpSubnet
        });
      }


      setPatterns(detectedPatterns);
      
      const totalBots = detectedPatterns.reduce((sum, p) => sum + p.accounts.length, 0);
      toast({
        title: "Bot Detection Complete",
        description: `Found ${totalBots} suspected bot accounts`,
      });
    } catch (error: any) {
      console.error('Bot detection error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to detect bots",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAllInPattern = (accounts: BotAccount[]) => {
    const newSelected = new Set(selectedIds);
    accounts.forEach(a => newSelected.add(a.id));
    setSelectedIds(newSelected);
  };

  const deselectAllInPattern = (accounts: BotAccount[]) => {
    const newSelected = new Set(selectedIds);
    accounts.forEach(a => newSelected.delete(a.id));
    setSelectedIds(newSelected);
  };

  const isAllSelectedInPattern = (accounts: BotAccount[]) => {
    return accounts.length > 0 && accounts.every(a => selectedIds.has(a.id));
  };

  // 90% 이상 신뢰도 패턴의 모든 계정 선택
  const selectAllHighConfidence = () => {
    const highConfidenceTypes = ['simultaneous_signup', 'same_ip_subnet', 'name_email_pattern', 'duplicate_name'];
    const newSelected = new Set(selectedIds);
    patterns
      .filter(p => highConfidenceTypes.includes(p.type))
      .forEach(p => p.accounts.forEach(a => newSelected.add(a.id)));
    setSelectedIds(newSelected);
  };

  const getHighConfidenceCount = () => {
    const highConfidenceTypes = ['simultaneous_signup', 'same_ip_subnet', 'name_email_pattern', 'duplicate_name'];
    return patterns
      .filter(p => highConfidenceTypes.includes(p.type))
      .reduce((sum, p) => sum + p.accounts.length, 0);
  };

  // banPatternAccounts 제거 - 체크박스 선택 기반 밴만 사용 (오밴 방지)

  // 100% 확실한 봇 패턴을 상위에 정렬
  const sortedPatterns = [...patterns].sort((a, b) => {
    const priority: Record<string, number> = {
      'simultaneous_signup': 1,
      'same_ip_subnet': 2,
      'name_email_pattern': 3,
      'duplicate_name': 4,
      'time_based_signup': 5,
    };
    return (priority[a.type] || 99) - (priority[b.type] || 99);
  });

  const banSelectedAccounts = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "No accounts selected",
        description: "Please select accounts to ban",
        variant: "destructive",
      });
      return;
    }

    setBanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-get-users', {
        body: {
          action: 'ban_users',
          userIds: Array.from(selectedIds),
          reason: 'Bot account detected by automated pattern matching'
        }
      });

      if (error) throw error;

      toast({
        title: "Accounts Banned",
        description: `Successfully banned ${data?.banned || selectedIds.size} accounts`,
      });

      onBanComplete?.();
      // 봇 목록 새로고침
      await detectBots();
    } catch (error: any) {
      console.error('Ban error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to ban accounts",
        variant: "destructive",
      });
    } finally {
      setBanning(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getPatternBadgeColor = (type: string) => {
    switch (type) {
      case 'simultaneous_signup':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'same_ip_subnet':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'name_email_pattern':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'duplicate_name':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'time_based_signup':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceLabel = (type: string) => {
    switch (type) {
      case 'simultaneous_signup':
        return { text: '100% Bot', color: 'bg-red-500 text-white' };
      case 'same_ip_subnet':
        return { text: '95% Bot', color: 'bg-red-500 text-white' };
      case 'name_email_pattern':
        return { text: '98% Bot', color: 'bg-orange-500 text-white' };
      case 'duplicate_name':
        return { text: '90% Bot', color: 'bg-yellow-500 text-white' };
      case 'time_based_signup':
        return { text: '70% Review', color: 'bg-blue-500 text-white' };
      default:
        return { text: 'Suspicious', color: 'bg-gray-500 text-white' };
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Bot Detector
              </CardTitle>
              <CardDescription>
                Detect and ban bot accounts using pattern matching
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {patterns.length > 0 && getHighConfidenceCount() > 0 && (
                <Button
                  onClick={selectAllHighConfidence}
                  variant="outline"
                  className="gap-2 rounded-full"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Select All 90%+ ({getHighConfidenceCount()})
                </Button>
              )}
              {selectedIds.size > 0 && (
                <Button
                  onClick={banSelectedAccounts}
                  disabled={banning}
                  variant="destructive"
                  className="gap-2 rounded-full"
                >
                  {banning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  Ban {selectedIds.size} Selected
                </Button>
              )}
              <Button
                onClick={detectBots}
                disabled={loading}
                className="gap-2 rounded-full"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Scan for Bots
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Detection Criteria */}
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              Detection Criteria
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Same Fingerprint (100%):</strong> 2+ accounts with identical device fingerprint</li>
              <li>• <strong>Same IP Subnet (95%):</strong> 3+ accounts from same /24 IP range (VPN/proxy farm)</li>
              <li>• <strong>Generated Email (98%):</strong> name+numbers@gmail.com with Firstname Lastname format</li>
              <li>• <strong>Duplicate Names (90%):</strong> Multiple accounts with identical display_name</li>
            </ul>
          </div>

          {/* Results */}
          {patterns.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Click "Scan for Bots" to detect suspicious accounts</p>
            </div>
          )}

          {sortedPatterns.map((pattern) => {
            const confidence = getConfidenceLabel(pattern.type);
            const allSelected = isAllSelectedInPattern(pattern.accounts);
            
            return (
            <div key={pattern.type} className="mb-6 border rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={confidence.color}>
                    {confidence.text}
                  </Badge>
                  <Badge className={getPatternBadgeColor(pattern.type)}>
                    {pattern.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {pattern.accounts.length} accounts
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => allSelected 
                      ? deselectAllInPattern(pattern.accounts) 
                      : selectAllInPattern(pattern.accounts)
                    }
                    className="rounded-full"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{pattern.description}</p>
              
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Lightsticks</TableHead>
                      <TableHead>Signup Time</TableHead>
                      <TableHead>Evidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pattern.accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(account.id)}
                            onCheckedChange={() => toggleSelect(account.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback>
                                {account.display_name?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{account.display_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {account.email}
                        </TableCell>
                        <TableCell>
                          {account.lightsticks && account.lightsticks.length > 0 ? (
                            <div className="flex items-center gap-1">
                              {account.lightsticks.slice(0, 3).map((ls, idx) => (
                                <div key={idx} className="flex items-center gap-1" title={`${ls.title} x${ls.balance}`}>
                                  {ls.image_url ? (
                                    <img src={ls.image_url} alt={ls.title} className="w-5 h-5 rounded-full object-cover" />
                                  ) : (
                                    <span className="text-xs">🎤</span>
                                  )}
                                  <span className="text-xs text-muted-foreground">x{ls.balance}</span>
                                </div>
                              ))}
                              {account.lightsticks.length > 3 && (
                                <span className="text-xs text-muted-foreground">+{account.lightsticks.length - 3}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(account.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {account.evidence?.map((ev, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {ev}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
