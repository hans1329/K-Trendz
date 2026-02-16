import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, History, Sparkles, AlertCircle, ArrowLeft, Languages, Star, Megaphone, Send } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useToast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WikiRelationshipManager } from "@/components/WikiRelationshipManager";

const EditWiki = () => {
  const { id: slugOrId } = useParams<{ id: string }>();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [birthday, setBirthday] = useState("");
  const [members, setMembers] = useState<Array<{ real_name?: string; stage_name?: string } | string>>([]);
  const [memberInput, setMemberInput] = useState("");
  const [relationships, setRelationships] = useState<Array<{parent_entry_id: string; parent_entry_title: string; relationship_type: string}>>([]);
  const [originalRelationships, setOriginalRelationships] = useState<Array<{parent_entry_id: string; parent_entry_title: string; relationship_type: string}>>([]);
  const [editSummary, setEditSummary] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFindingBirthday, setIsFindingBirthday] = useState(false);
  const [isFindingMembers, setIsFindingMembers] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [editCost, setEditCost] = useState(0);
  const [userPoints, setUserPoints] = useState(0);
  const [entrySlug, setEntrySlug] = useState("");
  const [entryId, setEntryId] = useState<string | null>(null);
  const [canEditContent, setCanEditContent] = useState(false);
  const [canEditMembers, setCanEditMembers] = useState(false);
  const [userLevel, setUserLevel] = useState(1);
  const [isFollower, setIsFollower] = useState(false);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [duplicateSlug, setDuplicateSlug] = useState<any>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [minLevelRequired, setMinLevelRequired] = useState<number>(1);
  
  // 공지사항 작성 관련 상태
  const [announcementText, setAnnouncementText] = useState("");
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);
  const [currentAnnouncementId, setCurrentAnnouncementId] = useState<string | null>(null);
  
  // 마스터 여부 확인
  const isMaster = originalData?.owner_id === user?.id;

  // 인증 확인
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  // Birthday 필드 -> 마크다운 Profile 섹션 동기화
  useEffect(() => {
    if (isSyncingProfile || !originalData) return;
    
    setIsSyncingProfile(true);
    const profileRegex = /## Profile\s*\n([\s\S]*?)(?=\n## |$)/i;
    const profileMatch = content.match(profileRegex);
    
    if (profileMatch && profileMatch[1]) {
      const profileLines = profileMatch[1].split('\n');
      const updatedLines = profileLines.map(line => {
        if (line.trim().startsWith('-') && (line.includes('Birthday:') || line.includes('Birth Date:'))) {
          if (birthday) {
            return `- **Birthday**: ${birthday}`;
          }
        }
        return line;
      });
      
      const updatedProfile = updatedLines.join('\n');
      const updatedContent = content.replace(profileRegex, `## Profile\n${updatedProfile}`);
      
      if (updatedContent !== content) {
        setContent(updatedContent);
      }
    }
    
    setIsSyncingProfile(false);
  }, [birthday]);

  // 마크다운 Profile 섹션 -> Birthday 필드 동기화
  useEffect(() => {
    if (isSyncingProfile || !originalData) return;
    
    setIsSyncingProfile(true);
    const profileRegex = /## Profile\s*\n([\s\S]*?)(?=\n## |$)/i;
    const profileMatch = content.match(profileRegex);
    
    if (profileMatch && profileMatch[1]) {
      const profileLines = profileMatch[1].split('\n').filter(line => line.trim().startsWith('-'));
      
      profileLines.forEach(line => {
        const cleanLine = line.replace(/^-\s*\*\*/, '').replace(/\*\*:/, ':');
        
        if (cleanLine.includes('Birthday:') || cleanLine.includes('Birth Date:')) {
          const dateStr = cleanLine.split(/Birthday:|Birth Date:/)[1]?.trim();
          if (dateStr && dateStr !== birthday) {
            setBirthday(dateStr);
          }
        }
      });
    }
    
    setIsSyncingProfile(false);
  }, [content]);

  // 위키 엔트리 로드
  useEffect(() => {
    if (authLoading || !user) return;
    
    const loadWikiEntry = async () => {
      if (!slugOrId) return;

      try {
        // Try to fetch by slug first, then by ID if that fails
        let query = supabase
          .from('wiki_entries')
          .select('*');
        
        // Check if it's a UUID (has hyphens and correct length)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
        
        if (isUuid) {
          query = query.eq('id', slugOrId);
        } else {
          query = query.eq('slug', slugOrId);
        }

        const { data, error } = await query.single();

        if (error) throw error;

        if (data) {
          setEntryId(data.id);
          setOriginalData(data);
          setTitle(data.title);
          // 기존 slug에서 한글 제거 (영문/숫자/하이픈만 유지)
          const cleanedSlug = (data.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, '');
          setSlug(cleanedSlug);
          setContent(data.content);
          setImageUrl(data.image_url || "");
          setEntrySlug(data.slug || "");
          // metadata에서 birthday와 members 추출 (타입 안전하게)
          if (data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)) {
            setBirthday((data.metadata as any).birthday || "");
            if (Array.isArray((data.metadata as any).members)) {
              setMembers((data.metadata as any).members);
            }
          }
        }

        // Relationships 로드 - 실제 ID 사용
        const { data: relsData } = await supabase
          .from('wiki_entry_relationships')
          .select(`
            parent_entry_id,
            relationship_type,
            parent:wiki_entries!parent_entry_id(title)
          `)
          .eq('child_entry_id', data.id);

        if (relsData) {
          const formattedRels = relsData.map(rel => ({
            parent_entry_id: rel.parent_entry_id,
            parent_entry_title: (rel.parent as any)?.title || 'Unknown',
            relationship_type: rel.relationship_type
          }));
          setRelationships(formattedRels);
          setOriginalRelationships(formattedRels);
        }

        // 사용자 포인트 로드
        const { data: profile } = await supabase
          .from('profiles')
          .select('available_points, current_level')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUserPoints(profile.available_points);
          setUserLevel(profile.current_level || 1);
        }

        // 최소 레벨 설정 가져오기
        const { data: settingData } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'wiki_creation_min_level')
          .maybeSingle();

        if (settingData) {
          setMinLevelRequired((settingData.setting_value as any)?.min_level || 1);
        }

        // 팔로워 여부 체크
        if (data.id && user.id) {
          const { data: followerData } = await supabase
            .from('wiki_entry_followers')
            .select('id')
            .eq('wiki_entry_id', data.id)
            .eq('user_id', user.id)
            .maybeSingle();
          
          setIsFollower(!!followerData);
        }

        // 권한 체크
        if (data.id) {
          // Content 편집 권한 체크 (레벨3 이상, 엔트리 모더레이터, 엔트리 에이전트, 관리자)
          const { data: contentPermission } = await supabase
            .rpc('can_edit_wiki_entry', {
              _user_id: user.id,
              _wiki_entry_id: data.id,
              _edit_type: 'content'
            });
          
          setCanEditContent(contentPermission || isAdmin);

          // 멤버/관계 편집 권한 체크 (엔트리 에이전트, 관리자)
          const { data: membersPermission } = await supabase
            .rpc('can_edit_wiki_entry', {
              _user_id: user.id,
              _wiki_entry_id: data.id,
              _edit_type: 'members'
            });
          
          setCanEditMembers(membersPermission || isAdmin);
        }

        // 편집 비용 로드
        const { data: pointRule } = await supabase
          .from('point_rules')
          .select('points')
          .eq('action_type', 'edit_wiki_entry')
          .eq('is_active', true)
          .single();

        if (pointRule) {
          setEditCost(Math.abs(pointRule.points));
        }

        // 현재 공지사항 로드 (가장 최근 1개만)
        const { data: announcementData } = await supabase
          .from('posts')
          .select('id, title')
          .eq('wiki_entry_id', data.id)
          .eq('category', 'announcement')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (announcementData) {
          setCurrentAnnouncementId(announcementData.id);
          setAnnouncementText(announcementData.title || "");
        }
      } catch (error: any) {
        console.error('Error loading Fanz entry:', error);
        toast({
          title: "Error",
          description: "Failed to load Fanz entry",
          variant: "destructive",
        });
        navigate('/rankings');
      } finally {
        setIsLoading(false);
      }
    };

    loadWikiEntry();
  }, [slugOrId, user, authLoading, navigate, toast]);

  // AI 콘텐츠 생성 (관리자 전용)
  const generateContent = async () => {
    if (!title.trim() || !originalData?.schema_type) {
      toast({
        title: "Info",
        description: "Please ensure title and type are set",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-wiki-content', {
        body: {
          title: title.trim(),
          schemaType: originalData.schema_type
        }
      });

      if (error) throw error;

      if (data?.content) {
        setContent(data.content);
        
        toast({
          title: "AI Generated",
          description: "Content has been generated successfully from Wikipedia!",
        });
      }
    } catch (error: any) {
      console.error('Error generating content:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI content",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // AI 생일 찾기 (관리자 전용)
  const findBirthday = async () => {
    if (!title.trim()) {
      toast({
        title: "Info",
        description: "Please enter a name first",
      });
      return;
    }

    setIsFindingBirthday(true);
    try {
      const { data, error } = await supabase.functions.invoke('find-birthday', {
        body: { name: title.trim() }
      });

      if (error) throw error;

      if (data?.birthday) {
        setBirthday(data.birthday);
        toast({
          title: "Birthday Found",
          description: `Found birthday: ${data.birthday}`,
        });
      } else {
        toast({
          title: "Not Found",
          description: data?.message || "Could not find birthday information",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error finding birthday:', error);
      toast({
        title: "Error",
        description: "Failed to find birthday information",
        variant: "destructive",
      });
    } finally {
      setIsFindingBirthday(false);
    }
  };

  // AI 멤버 찾기 (관리자 전용)
  const findMembers = async () => {
    if (!title.trim()) {
      toast({
        title: "Info",
        description: "Please enter a group name first",
      });
      return;
    }

    setIsFindingMembers(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-artists', {
        body: { groupName: title.trim() }
      });

      if (error) throw error;

      if (data?.members && data.members.length > 0) {
        setMembers(data.members);
        toast({
          title: "Members Found",
          description: `Found ${data.members.length} members`,
        });
      } else {
        toast({
          title: "Not Found",
          description: "Could not find member information",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error finding members:', error);
      toast({
        title: "Error",
        description: "Failed to find member information",
        variant: "destructive",
      });
    } finally {
      setIsFindingMembers(false);
    }
  };

  // slug 중복 체크
  useEffect(() => {
    const checkSlug = async () => {
      if (!slug.trim() || slug === originalData?.slug) {
        setDuplicateSlug(null);
        return;
      }

      setIsCheckingSlug(true);
      try {
        const { data, error } = await supabase
          .from('wiki_entries')
          .select('id, title, slug')
          .eq('slug', slug.trim())
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        setDuplicateSlug(data);
      } catch (error) {
        console.error('Error checking slug:', error);
        setDuplicateSlug(null);
      } finally {
        setIsCheckingSlug(false);
      }
    };

    const timeoutId = setTimeout(checkSlug, 500);
    return () => clearTimeout(timeoutId);
  }, [slug, originalData]);

  // slug 자동 생성 (영문만)
  const generateSlugFromTitle = () => {
    const englishOnly = title.trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    setSlug(englishOnly || '');
  };

  // slug 입력 핸들러 (영문/숫자/하이픈만)
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toLowerCase();
    // 한글 및 허용되지 않는 문자 제거 (영문, 숫자, 하이픈만 허용)
    value = value.replace(/[^a-z0-9-]/g, '');
    setSlug(value);
  };

  // 영어로 번역
  const translateToEnglish = async () => {
    if (!title.trim() && !content.trim()) {
      toast({
        title: "Info",
        description: "Please enter title or content first",
      });
      return;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-to-english', {
        body: {
          title: title.trim(),
          content: content.trim()
        }
      });

      if (error) throw error;

      if (data?.title) {
        setTitle(data.title);
      }
      if (data?.content) {
        setContent(data.content);
      }
      
      toast({
        title: "Translated",
        description: "Content has been translated to English",
      });
    } catch (error: any) {
      console.error('Error translating:', error);
      toast({
        title: "Error",
        description: "Failed to translate to English",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const addMember = () => {
    if (memberInput.trim()) {
      const trimmed = memberInput.trim();
      const exists = members.some(m => 
        typeof m === 'string' ? m === trimmed : m.stage_name === trimmed || m.real_name === trimmed
      );
      if (!exists) {
        setMembers([...members, trimmed]);
        setMemberInput("");
      }
    }
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };
  
  // 공지사항 게시 (기존 공지 대체)
  const handlePostAnnouncement = async () => {
    if (!announcementText.trim()) {
      toast({
        title: "Required Field",
        description: "Please enter announcement text",
        variant: "destructive",
      });
      return;
    }
    
    if (!entryId || !user?.id) return;
    
    setIsPostingAnnouncement(true);
    try {
      // 기존 공지사항이 있으면 업데이트, 없으면 새로 생성
      if (currentAnnouncementId) {
        const { error } = await supabase
          .from('posts')
          .update({
            title: announcementText.trim(),
            content: announcementText.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentAnnouncementId);
        
        if (error) throw error;
      } else {
        const { data: newAnnouncement, error } = await supabase
          .from('posts')
          .insert({
            title: announcementText.trim(),
            content: announcementText.trim(),
            user_id: user.id,
            wiki_entry_id: entryId,
            category: 'announcement',
          })
          .select('id')
          .single();
        
        if (error) throw error;
        if (newAnnouncement) {
          setCurrentAnnouncementId(newAnnouncement.id);
        }
      }
      
      toast({
        title: "Success",
        description: "Announcement saved successfully!",
      });
      
      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['announcements', entryId] });
      queryClient.invalidateQueries({ queryKey: ['fan-posts', entryId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    } catch (error: any) {
      console.error('Error posting announcement:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to post announcement",
        variant: "destructive",
      });
    } finally {
      setIsPostingAnnouncement(false);
    }
  };
  
  const getMemberDisplayName = (member: { real_name?: string; stage_name?: string } | string): string => {
    if (typeof member === 'string') return member;
    return member.stage_name || member.real_name || 'Unknown';
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 이미지 파일만 허용
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      
      // 파일 크기 제한 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      
      setImageFile(file);
      
      // 미리보기 생성
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !entryId) return null;

    setIsUploading(true);
    try {
      // 기존 이미지 삭제 (있는 경우)
      if (originalData?.image_url) {
        const oldPath = originalData.image_url.split('/wiki-images/')[1];
        if (oldPath) {
          await supabase.storage
            .from('wiki-images')
            .remove([oldPath]);
        }
      }

      // 새 이미지 업로드
      const fileExt = imageFile.name.split('.').pop();
      const filePath = `${entryId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('wiki-images')
        .upload(filePath, imageFile, {
          upsert: true,
          contentType: imageFile.type,
        });

      if (uploadError) throw uploadError;

      // Public URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from('wiki-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 팔로워 체크 (관리자는 제외)
    if (!isFollower && !isAdmin) {
      toast({
        title: "Fan Up Required",
        description: "You must be a fan of this entry to edit it. Please fan up first!",
        variant: "destructive",
      });
      return;
    }
    
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title",
        variant: "destructive",
      });
      return;
    }

    if (!slug.trim()) {
      toast({
        title: "Error",
        description: "Please enter a slug for the URL",
        variant: "destructive",
      });
      return;
    }

    if (duplicateSlug) {
      toast({
        title: "Error",
        description: "This slug is already taken. Please choose a different one.",
        variant: "destructive",
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Please enter content",
        variant: "destructive",
      });
      return;
    }

    // 변경사항 확인
    const originalBirthday = (originalData.metadata && typeof originalData.metadata === 'object' && !Array.isArray(originalData.metadata)) 
      ? (originalData.metadata as any).birthday || "" 
      : "";
    const originalMembers = (originalData.metadata && typeof originalData.metadata === 'object' && !Array.isArray(originalData.metadata))
      ? (originalData.metadata as any).members || []
      : [];
    
    // members 배열 비교 (깊은 비교)
    const membersChanged = JSON.stringify(members) !== JSON.stringify(originalMembers);
    
    // relationships 배열 비교 (깊은 비교)
    const relationshipsChanged = JSON.stringify(relationships) !== JSON.stringify(originalRelationships);
    
    const hasTextChanges = title !== originalData.title || content !== originalData.content || birthday !== originalBirthday || slug !== originalData.slug || membersChanged || relationshipsChanged;
    const hasImageChanges = imageFile !== null || (imageUrl !== (originalData.image_url || ""));
    
    if (!hasTextChanges && !hasImageChanges) {
      toast({
        title: "Info",
        description: "No changes detected",
      });
      return;
    }

    // 포인트 확인 다이얼로그 표시
    if (userPoints < editCost) {
      toast({
        title: "Insufficient Stars",
        description: `You need ${editCost} stars to edit. Current: ${userPoints} stars`,
        variant: "destructive",
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmAndSaveChanges = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);

    try {
      // 이미지 파일이 선택된 경우 업로드
      let finalImageUrl = imageUrl;
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        } else {
          setIsSubmitting(false);
          return;
        }
      }

      // Profile 섹션 파싱
      const profileRegex = /## Profile\s*\n([\s\S]*?)(?=\n## |$)/i;
      const profileMatch = content.match(profileRegex);
      
      let parsedProfile: any = {};
      if (profileMatch && profileMatch[1]) {
        const profileLines = profileMatch[1].split('\n').filter(line => line.trim().startsWith('-'));
        
        profileLines.forEach(line => {
          const cleanLine = line.replace(/^-\s*\*\*/, '').replace(/\*\*:/, ':');
          
          if (cleanLine.includes('Real Name:')) {
            const value = cleanLine.split('Real Name:')[1]?.trim();
            if (value) parsedProfile.real_name = value;
          } else if (cleanLine.includes('Birthday:') || cleanLine.includes('Birth Date:')) {
            const dateStr = cleanLine.split(/Birthday:|Birth Date:/)[1]?.trim();
            if (dateStr) {
              try {
                const parsed = new Date(dateStr);
                if (!isNaN(parsed.getTime())) {
                  parsedProfile.birth_date = parsed.toISOString().split('T')[0];
                }
              } catch (e) {
                console.error('Failed to parse birth date:', e);
              }
            }
          } else if (cleanLine.includes('Gender:')) {
            const value = cleanLine.split('Gender:')[1]?.trim().toLowerCase();
            if (value) parsedProfile.gender = value;
          } else if (cleanLine.includes('Nationality:')) {
            const value = cleanLine.split('Nationality:')[1]?.trim();
            if (value) parsedProfile.nationality = value;
          } else if (cleanLine.includes('Blood Type:')) {
            const value = cleanLine.split('Blood Type:')[1]?.trim();
            if (value) parsedProfile.blood_type = value;
          } else if (cleanLine.includes('Height:')) {
            const value = cleanLine.split('Height:')[1]?.trim().replace(/[^\d]/g, '');
            if (value) parsedProfile.height = parseInt(value);
          } else if (cleanLine.includes('Weight:')) {
            const value = cleanLine.split('Weight:')[1]?.trim().replace(/[^\d]/g, '');
            if (value) parsedProfile.weight = parseInt(value);
          }
        });
      }

      // content에서 Profile 섹션 제거
      const cleanedContent = content.replace(profileRegex, '').trim();

      // metadata 업데이트
      const metadata: any = originalData.metadata && typeof originalData.metadata === 'object' && !Array.isArray(originalData.metadata)
        ? { ...originalData.metadata }
        : {};
      
      if (originalData.schema_type === 'actor' || originalData.schema_type === 'member') {
        if (birthday) {
          metadata.birthday = birthday;
        } else {
          delete metadata.birthday;
        }
      }

      if (originalData.schema_type === 'artist') {
        if (members.length > 0) {
          metadata.members = members;
        } else {
          delete metadata.members;
        }
      }

      // 업데이트할 데이터 준비
      const updateData: any = {
        title: title.trim(),
        slug: slug.trim(),
        content: cleanedContent,
        image_url: finalImageUrl.trim() || null,
        metadata,
        ...parsedProfile // 파싱된 Profile 필드 추가
      };

      const { error } = await supabase
        .from('wiki_entries')
        .update(updateData)
        .eq('id', entryId);

      if (error) throw error;

      // Stars 차감 (관리자가 아닌 경우만)
      if (!isAdmin && editCost > 0 && user) {
        // 포인트 차감
        const { error: pointsError } = await supabase
          .from('profiles')
          .update({ available_points: userPoints - editCost })
          .eq('id', user.id);

        if (pointsError) {
          console.error('Failed to deduct points:', pointsError);
        } else {
          // 거래 기록 추가
          await supabase
            .from('point_transactions')
            .insert({
              user_id: user.id,
              action_type: 'edit_wiki',
              points: -editCost,
              reference_id: entryId
            });
        }
      }

      // Relationships 업데이트
      if (entryId) {
        // 기존 relationships 삭제
        await supabase
          .from('wiki_entry_relationships')
          .delete()
          .eq('child_entry_id', entryId);

        // 새 relationships 추가
        if (relationships.length > 0) {
          const relationshipsToInsert = relationships.map(rel => ({
            child_entry_id: entryId,
            parent_entry_id: rel.parent_entry_id,
            relationship_type: rel.relationship_type,
            created_by: user?.id
          }));

          await supabase
            .from('wiki_entry_relationships')
            .insert(relationshipsToInsert);
        }
      }

      toast({
        title: "Success",
        description: "Fanz entry updated successfully",
      });

      // React Query 캐시 무효화 (즉시 업데이트 반영)
      await queryClient.invalidateQueries({ queryKey: ['wiki-entry'] });
      await queryClient.invalidateQueries({ queryKey: ['wiki-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['trending-wiki-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['latest-wiki-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });

      // 새로운 slug로 리다이렉트
      navigate(`/k/${slug || entryId}`);
    } catch (error: any) {
      console.error('Error updating Fanz entry:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update Fanz entry",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMobile = useIsMobile();
  
  if (authLoading || isLoading) {
    return (
      <V2Layout pcHeaderTitle="Edit Fanz" showBackButton>
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </V2Layout>
    );
  }

  return (
    <>
      <Helmet>
        <title>Edit Fanz - KTRENDZ</title>
        <meta name="description" content="Edit Fanz entry" />
      </Helmet>
      
      <V2Layout pcHeaderTitle="Edit Fanz" showBackButton>
        <div className={`${isMobile ? 'pt-16 px-4' : ''} py-6`}>
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/k/${entrySlug || entryId}`)}
                className="rounded-full mb-4"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold mb-2">Edit Fanz</h1>
                  <p className="text-sm md:text-base text-muted-foreground">
                    Update the information about this entry
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/k/${entryId}/history`)}
                  className="rounded-full gap-2 w-full md:w-auto"
                >
                  <History className="w-4 h-4" />
                  View History
                </Button>
              </div>
            </div>

            {!isFollower && !isAdmin ? (
              <Alert className="mb-6 border-destructive/50 bg-destructive/5">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription>
                  <strong>Fan Up Required</strong>
                  <p className="mt-2">
                    You must be a fan of this entry to edit it. Please fan up first by clicking the "Fan Up" button on the entry page.
                  </p>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold mb-2">Entry Details</h2>
                  <p className="text-sm text-muted-foreground">
                    Make your changes below. All edits are tracked and visible to everyone.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={translateToEnglish}
                  disabled={isTranslating || (!title.trim() && !content.trim()) || isSubmitting || isUploading}
                  className="rounded-full gap-2 w-full sm:w-auto"
                >
                  {isTranslating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Translating...
                    </>
                  ) : (
                    <>
                      <Languages className="w-4 h-4" />
                      Translate to English
                    </>
                  )}
                </Button>
              </div>
              <div>
                {/* Master Announcement Section */}
                {isMaster && (
                  <Card className="mb-6 border-primary/30 bg-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Megaphone className="w-5 h-5 text-primary" />
                        {currentAnnouncementId ? 'Edit Announcement' : 'Post Announcement'}
                      </CardTitle>
                      <CardDescription>
                        {currentAnnouncementId 
                          ? 'Update the current announcement for your fans' 
                          : 'Create an announcement for your fans'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="announcement-text">
                          {currentAnnouncementId ? 'Current Announcement' : 'Announcement'}
                        </Label>
                        <Input
                          id="announcement-text"
                          value={announcementText}
                          onChange={(e) => setAnnouncementText(e.target.value)}
                          placeholder="Write your announcement..."
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handlePostAnnouncement}
                        disabled={isPostingAnnouncement || !announcementText.trim()}
                        className="rounded-full gap-2"
                      >
                        {isPostingAnnouncement ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            {currentAnnouncementId ? 'Update Announcement' : 'Post Announcement'}
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}
                
                {/* Point Cost Alert */}
                {editCost > 0 && (
                  <Alert className="mb-6 border-primary/50 bg-primary/5">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <AlertDescription>
                      Editing this entry will cost <strong>{editCost} points</strong>. 
                      Your current balance: <strong>{userPoints} points</strong>
                    </AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* 팔로워 아닌 경우 모든 입력 필드 비활성화 */}
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">
                      Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Entry title"
                      required
                      disabled={!isFollower && !isAdmin}
                    />
                  </div>

                  {/* URL Slug */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="slug">
                        URL Slug <span className="text-destructive">*</span>
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={generateSlugFromTitle}
                        disabled={!title.trim()}
                        className="h-auto p-0 text-xs text-primary hover:bg-transparent"
                      >
                        Generate from title
                      </Button>
                    </div>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={handleSlugChange}
                      placeholder="example-slug (English, numbers, hyphens only)"
                      required
                      disabled={!isFollower && !isAdmin}
                    />
                    <p className="text-xs text-muted-foreground">
                      This will be used in the URL: /k/your-slug
                    </p>
                    {isCheckingSlug && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Checking availability...
                      </p>
                    )}
                    {duplicateSlug && (
                      <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
                        <p className="text-sm text-destructive font-medium">
                          ⚠️ This slug is already taken
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Used by: {duplicateSlug.title}
                        </p>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs text-primary"
                          onClick={() => navigate(`/k/${duplicateSlug.slug}`)}
                        >
                          View existing entry →
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <Label htmlFor="content">
                        Content <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        {isAdmin && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={generateContent}
                              disabled={isGenerating || !title.trim() || isSubmitting || isUploading}
                              className="rounded-full gap-2 w-full sm:w-auto"
                            >
                              {isGenerating ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  AI Generate from Wikipedia
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={translateToEnglish}
                              disabled={isTranslating || (!title.trim() && !content.trim()) || isSubmitting || isUploading}
                              className="rounded-full gap-2 w-full sm:w-auto"
                            >
                              {isTranslating ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Translating...
                                </>
                              ) : (
                                <>
                                  <Languages className="w-4 h-4" />
                                  Translate to English
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={(!canEditContent || (!isFollower && !isAdmin)) ? "opacity-60 pointer-events-none" : ""}>
                      <RichTextEditor
                        value={content}
                        onChange={setContent}
                        placeholder={
                          (!isFollower && !isAdmin)
                            ? "You must be a fan to edit this entry"
                            : !canEditContent 
                              ? `Level ${minLevelRequired}+ required to edit content (Current: Level ${userLevel})`
                              : "Write detailed information..."
                        }
                        minHeight="400px"
                      />
                    </div>
                    {!canEditContent && (
                      <Alert className="mt-2 border-amber-500/50 bg-amber-500/10">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-sm text-amber-900 dark:text-amber-200">
                          <strong>Level {minLevelRequired} or higher required to edit content.</strong> 
                          {userLevel < minLevelRequired && ` You are currently Level ${userLevel}.`}
                          {!isAdmin && " Only Entry Moderators, Entry Agents, or Admins can also edit."}
                        </AlertDescription>
                      </Alert>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Supports markdown formatting
                    </p>
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-2">
                    <Label>Choose Image (Optional)</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <input
                        id="imageFile"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        disabled={isSubmitting || isUploading}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        onClick={() => document.getElementById('imageFile')?.click()}
                        disabled={isSubmitting || isUploading}
                        className="rounded-full w-full sm:w-auto bg-[#ff4500] hover:bg-[#ff4500]/90 text-white"
                      >
                        {imageFile ? 'Change Image' : 'Select Image'}
                      </Button>
                      {imageFile && (
                        <span className="text-sm text-muted-foreground truncate max-w-full">
                          {imageFile.name}
                        </span>
                      )}
                    </div>
                    {imageFile && imagePreview && (
                      <div className="relative w-full max-w-md mt-2">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="w-full h-auto rounded-lg border"
                        />
                      </div>
                    )}
                  </div>

                  {/* Current Image Preview */}
                  {imageUrl && (
                    <div className="space-y-2">
                      <Label>Current Image</Label>
                      <div className="relative w-full max-w-md">
                        <img 
                          src={imageUrl} 
                          alt="Current Fanz entry" 
                          className="w-full h-auto rounded-lg border"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Or Image URL - 업로드된 이미지가 없을 때만 표시 */}
                  {!imageFile && !imagePreview && (
                    <div className="space-y-2">
                      <Label htmlFor="imageUrl">Or Enter Image URL</Label>
                      <Input
                        id="imageUrl"
                        value={imageUrl && !imageUrl.includes('supabase.co/storage') ? imageUrl : ''}
                        onChange={(e) => {
                          setImageUrl(e.target.value);
                          setImageFile(null);
                        }}
                        placeholder="https://example.com/image.jpg"
                        type="url"
                        disabled={isSubmitting || isUploading}
                      />
                      <p className="text-sm text-muted-foreground">
                        Upload a file above or enter an image URL
                      </p>
                    </div>
                  )}

                  {/* Birthday for Actor/Member */}
                  {(originalData?.schema_type === 'actor' || originalData?.schema_type === 'member') && (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <Label htmlFor="birthday">Birthday (Optional)</Label>
                        {isAdmin && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={findBirthday}
                            disabled={isFindingBirthday || !title.trim() || isSubmitting || isUploading}
                            className="rounded-full gap-2 w-full sm:w-auto"
                          >
                            {isFindingBirthday ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Finding...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4" />
                                AI Find
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      <Input
                        id="birthday"
                        value={birthday}
                        onChange={(e) => setBirthday(e.target.value)}
                        placeholder="YYYY-MM-DD"
                        type="text"
                        disabled={isSubmitting || isUploading}
                      />
                    </div>
                  )}

                  {/* Members for Artist */}
                  {originalData?.schema_type === 'artist' && (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <Label>Members (Optional)</Label>
                        {isAdmin && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={findMembers}
                            disabled={isFindingMembers || !title.trim() || isSubmitting || isUploading || !canEditMembers}
                            className="rounded-full gap-2 w-full sm:w-auto"
                          >
                            {isFindingMembers ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Finding...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4" />
                                AI Find Members
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          value={memberInput}
                          onChange={(e) => setMemberInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addMember();
                            }
                          }}
                          placeholder={!canEditMembers ? "Entry Agent required" : "Type member name"}
                          disabled={isSubmitting || isUploading || !canEditMembers}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          onClick={addMember}
                          variant="outline"
                          disabled={isSubmitting || isUploading || !canEditMembers}
                          className="rounded-full px-4 w-full sm:w-auto"
                        >
                          Add
                        </Button>
                      </div>
                      {!canEditMembers && (
                        <Alert className="border-amber-500/50 bg-amber-500/10">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-sm text-amber-900 dark:text-amber-200">
                            <strong>Entry Agent role required</strong> to edit members.
                          </AlertDescription>
                        </Alert>
                      )}
                      {members.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {members.map((member, index) => (
                            <div
                              key={index}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                            >
                              <span>{getMemberDisplayName(member)}</span>
                              <button
                                type="button"
                                onClick={() => removeMember(index)}
                                className="hover:text-destructive"
                                disabled={isSubmitting || isUploading || !canEditMembers}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Relationships */}
                  {originalData && (isFollower || isAdmin) && (
                    <div className="space-y-2">
                      <WikiRelationshipManager
                        title={title}
                        content={content}
                        schemaType={originalData.schema_type}
                        relationships={relationships}
                        onChange={setRelationships}
                        wikiEntryId={entryId ?? undefined}
                        onSchemaTypeChange={(newType) => {
                          setOriginalData({ ...originalData, schema_type: newType });
                          window.location.reload();
                        }}
                      />
                    </div>
                  )}

                  {/* Edit Summary */}
                  <div className="space-y-2">
                    <Label htmlFor="editSummary">Edit Summary (Optional)</Label>
                    <Input
                      id="editSummary"
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      placeholder="Briefly describe your changes..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Help others understand what you changed
                    </p>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(`/k/${entrySlug || entryId}`)}
                      className="rounded-full w-full sm:flex-1 order-2 sm:order-1"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="rounded-full w-full sm:flex-1 order-1 sm:order-2"
                      disabled={isSubmitting || isUploading || (!isFollower && !isAdmin)}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading Image...
                        </>
                      ) : isSubmitting ? (
                        "Saving..."
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Confirmation Dialog */}
          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader className="space-y-3">
                <AlertDialogTitle className="text-lg sm:text-xl">Confirm Edit</AlertDialogTitle>
                <AlertDialogDescription className="text-sm sm:text-base space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span>Cost:</span>
                    <strong className="inline-flex items-center gap-1 text-foreground">
                      <Star className="w-4 h-4 fill-primary text-primary" />
                      {editCost} Stars
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>Balance after:</span>
                    <strong className="inline-flex items-center gap-1 text-foreground">
                      <Star className="w-4 h-4 fill-primary text-primary" />
                      {userPoints - editCost} Stars
                    </strong>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-3">
                <AlertDialogAction 
                  onClick={confirmAndSaveChanges}
                  className="rounded-full w-full sm:w-auto order-1"
                >
                  Confirm & Save
                </AlertDialogAction>
                <AlertDialogCancel className="rounded-full w-full sm:w-auto order-2">
                  Cancel
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </V2Layout>
    </>
  );
};

export default EditWiki;
