import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Plus, Search, UserCog } from "lucide-react";

export const WikiEntryRoleManager = ({ preSelectedEntryId }: { preSelectedEntryId?: string }) => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<string>(preSelectedEntryId || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("entry_moderator");
  const [isLoading, setIsLoading] = useState(false);
  const [canAssignAgent, setCanAssignAgent] = useState(false);
  const [currentCreator, setCurrentCreator] = useState<any>(null);
  const [transferTargetUser, setTransferTargetUser] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    if (user) {
      fetchEntries();
    }
  }, [user]);

  useEffect(() => {
    if (selectedEntry) {
      fetchRoles();
      checkAssignPermission();
      fetchUsers(); // 엔트리가 선택되면 해당 엔트리의 팔로워들 가져오기
      fetchCurrentCreator();
    }
  }, [selectedEntry]);

  // preSelectedEntryId가 변경되면 selectedEntry 업데이트
  useEffect(() => {
    if (preSelectedEntryId) {
      setSelectedEntry(preSelectedEntryId);
    }
  }, [preSelectedEntryId]);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('wiki_entries')
        .select('id, title, slug, schema_type')
        .order('title');
      
      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching entries:', error);
    }
  };

  const fetchUsers = async () => {
    if (!selectedEntry) {
      setUsers([]);
      return;
    }
    
    try {
      // 선택된 엔트리의 팔로워들의 user_id 가져오기
      const { data: followers, error: followersError } = await supabase
        .from('wiki_entry_followers')
        .select('user_id')
        .eq('wiki_entry_id', selectedEntry);
      
      if (followersError) throw followersError;
      
      if (!followers || followers.length === 0) {
        setUsers([]);
        return;
      }
      
      // user_id 목록 추출
      const userIds = followers.map(f => f.user_id);
      
      // 프로필 정보 가져오기
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', userIds)
        .order('username');
      
      if (profilesError) throw profilesError;
      
      setUsers(profiles || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    }
  };

  const fetchRoles = async () => {
    if (!selectedEntry) return;
    
    try {
      const { data, error } = await supabase
        .from('wiki_entry_roles')
        .select('*')
        .eq('wiki_entry_id', selectedEntry);
      
      if (error) {
        console.error('Error fetching roles:', error);
        setRoles([]);
        return;
      }
      
      if (data && data.length > 0) {
        const rolesWithProfiles = await Promise.all(
          data.map(async (role) => {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('username, display_name, avatar_url')
                .eq('id', role.user_id)
                .maybeSingle();
              
              const { data: assignedByProfile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', role.assigned_by)
                .maybeSingle();
              
              return {
                ...role,
                profiles: profile || null,
                assigned_by_profile: assignedByProfile || null,
              };
            } catch (profileError) {
              console.error('Error fetching role profiles:', profileError);
              return {
                ...role,
                profiles: null,
                assigned_by_profile: null,
              };
            }
          })
        );
        
        console.log('Roles with profiles:', rolesWithProfiles);
        setRoles(rolesWithProfiles as any[]);
      } else {
        setRoles([]);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      setRoles([]);
    }
  };
  const fetchCurrentCreator = async () => {
    if (!selectedEntry) return;
    
    try {
      const { data: entry, error } = await supabase
        .from('wiki_entries')
        .select('creator_id')
        .eq('id', selectedEntry)
        .single();
      
      if (error) throw error;
      
      if (entry) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .eq('id', entry.creator_id)
          .single();
        
        if (profileError) throw profileError;
        setCurrentCreator(profile);
      }
    } catch (error) {
      console.error('Error fetching current creator:', error);
      setCurrentCreator(null);
    }
  };

  const checkAssignPermission = async () => {
    if (!user || !selectedEntry) return;
    
    try {
      // 엔트리의 creator 확인
      const { data: entry, error: entryError } = await supabase
        .from('wiki_entries')
        .select('creator_id')
        .eq('id', selectedEntry)
        .single();
      
      if (entryError) throw entryError;
      
      // creator이거나 관리자이거나 엔트리 에이전트인 경우 권한 부여
      const isCreator = entry?.creator_id === user.id;
      
      if (isCreator || isAdmin) {
        setCanAssignAgent(true);
        return;
      }
      
      // 엔트리 에이전트인지 확인
      const { data: isAgent, error } = await supabase
        .from('wiki_entry_roles')
        .select('id')
        .eq('wiki_entry_id', selectedEntry)
        .eq('user_id', user.id)
        .eq('role', 'entry_agent')
        .maybeSingle();
      
      setCanAssignAgent(!!isAgent);
    } catch (error) {
      console.error('Error checking permission:', error);
      setCanAssignAgent(false);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedEntry || !selectedUser || !selectedRole) {
      toast({
        title: "Error",
        description: "Please select an entry, user, and role",
        variant: "destructive",
      });
      return;
    }

    // 엔트리 에이전트는 모더레이터만 할당 가능
    if (!isAdmin && selectedRole === 'entry_agent') {
      toast({
        title: "Error",
        description: "Only admins can assign entry agents",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('wiki_entry_roles')
        .insert({
          wiki_entry_id: selectedEntry,
          user_id: selectedUser,
          role: selectedRole,
          assigned_by: user?.id,
        } as any);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role assigned successfully",
      });

      setSelectedUser("");
      fetchRoles();
    } catch (error: any) {
      console.error('Error assigning role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign role",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('wiki_entry_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role removed successfully",
      });

      fetchRoles();
    } catch (error: any) {
      console.error('Error removing role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove role",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedEntry || !transferTargetUser) {
      toast({
        title: "Error",
        description: "Please select a user to transfer ownership to",
        variant: "destructive",
      });
      return;
    }

    // 현재 creator만 양도 가능
    if (currentCreator?.id !== user?.id) {
      toast({
        title: "Error",
        description: "Only the current owner can transfer ownership",
        variant: "destructive",
      });
      return;
    }

    setIsTransferring(true);
    try {
      const { error } = await supabase
        .from('wiki_entries')
        .update({ creator_id: transferTargetUser })
        .eq('id', selectedEntry);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Page ownership transferred successfully",
      });

      setTransferTargetUser("");
      fetchCurrentCreator();
    } catch (error: any) {
      console.error('Error transferring ownership:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to transfer ownership",
        variant: "destructive",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const filteredEntries = entries.filter(entry =>
    entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Entry Selection - preSelectedEntryId가 없을 때만 표시 */}
      {!preSelectedEntryId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Select Wiki Entry</CardTitle>
            <CardDescription className="text-sm">
              Choose a wiki entry to manage its agents and moderators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Search Entry</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title or slug..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm">Wiki Entry</Label>
              <Select value={selectedEntry} onValueChange={setSelectedEntry}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select an entry" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {filteredEntries.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id} className="text-sm">
                      {entry.title} ({entry.schema_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedEntry && (
        <>
          {/* Assign New Role */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Assign Role</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                {isAdmin 
                  ? "Admins can assign entry agents and moderators" 
                  : currentCreator?.id === user?.id
                  ? "Page owners can assign entry agents and moderators"
                  : canAssignAgent 
                  ? "Entry agents can assign entry moderators" 
                  : "You don't have permission to assign roles for this entry"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(isAdmin || canAssignAgent) ? (
                <div className="grid gap-3 md:gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-sm">User</Label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id} className="text-sm">
                            {u.display_name || u.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Role</Label>
                    <Select 
                      value={selectedRole} 
                      onValueChange={setSelectedRole}
                      disabled={!isAdmin && !canAssignAgent}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {isAdmin && (
                          <SelectItem value="entry_agent" className="text-sm">Entry Agent</SelectItem>
                        )}
                        <SelectItem value="entry_moderator" className="text-sm">Entry Moderator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button 
                      onClick={handleAssignRole} 
                      disabled={isLoading}
                      className="w-full gap-2 text-sm h-10"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Assign
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs md:text-sm text-muted-foreground">
                  You need to be an admin or entry agent to assign roles.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Transfer Ownership */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <UserCog className="w-4 h-4 md:w-5 md:h-5" />
                Transfer Page Ownership
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Transfer this page to another user. Only the current owner can perform this action.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentCreator && (
                <div className="space-y-3 md:space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 p-3 bg-muted rounded-lg">
                    <span className="text-xs md:text-sm text-muted-foreground">Current Owner:</span>
                    <span className="font-medium text-sm md:text-base">{currentCreator.display_name || currentCreator.username}</span>
                  </div>
                  
                  {currentCreator.id === user?.id ? (
                    <div className="grid gap-3 md:gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm">Transfer to User</Label>
                        <Select value={transferTargetUser} onValueChange={setTransferTargetUser}>
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Select new owner" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.filter(u => u.id !== user?.id).map((u) => (
                              <SelectItem key={u.id} value={u.id} className="text-sm">
                                {u.display_name || u.username}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-end">
                        <Button 
                          onClick={handleTransferOwnership} 
                          disabled={isTransferring || !transferTargetUser}
                          className="w-full gap-2 text-sm h-10"
                          variant="destructive"
                        >
                          {isTransferring ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserCog className="w-4 h-4" />
                          )}
                          Transfer Ownership
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Only the current owner can transfer this page.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Roles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Current Roles</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Users with special permissions for this entry
              </CardDescription>
            </CardHeader>
            <CardContent>
              {roles.length === 0 ? (
                <p className="text-xs md:text-sm text-muted-foreground text-center py-4">
                  No roles assigned yet
                </p>
              ) : (
                <>
                  {/* Desktop table view */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-sm">User</TableHead>
                          <TableHead className="text-sm">Role</TableHead>
                          <TableHead className="text-sm">Assigned By</TableHead>
                          <TableHead className="text-sm">Date</TableHead>
                          <TableHead className="text-sm">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roles.map((role) => (
                          <TableRow key={role.id}>
                            <TableCell className="font-medium text-sm">
                              {(role.profiles as any)?.display_name || (role.profiles as any)?.username}
                            </TableCell>
                            <TableCell>
                              <Badge variant={role.role === 'entry_agent' ? 'default' : 'secondary'} className="text-xs">
                                {role.role === 'entry_agent' ? 'Agent' : 'Moderator'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {(role.assigned_by_profile as any)?.username || 'System'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(role.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {(isAdmin || role.assigned_by === user?.id) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveRole(role.id)}
                                  disabled={isLoading}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Mobile card view */}
                  <div className="md:hidden space-y-3">
                    {roles.map((role) => (
                      <div key={role.id} className="p-3 bg-muted rounded-lg space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {(role.profiles as any)?.display_name || (role.profiles as any)?.username}
                            </p>
                            <Badge variant={role.role === 'entry_agent' ? 'default' : 'secondary'} className="text-xs mt-1">
                              {role.role === 'entry_agent' ? 'Agent' : 'Moderator'}
                            </Badge>
                          </div>
                          {(isAdmin || role.assigned_by === user?.id) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRole(role.id)}
                              disabled={isLoading}
                              className="shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Assigned by: {(role.assigned_by_profile as any)?.username || 'System'}</p>
                          <p>Date: {new Date(role.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
