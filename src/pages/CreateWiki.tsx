import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Sparkles, Loader2, X, Tag, Languages, HelpCircle, Search, Check, CalendarIcon, ArrowLeft } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Helmet } from "react-helmet-async";
import { useToast } from "@/hooks/use-toast";
import { WikiRelationshipManager } from "@/components/WikiRelationshipManager";
import RichTextEditor from "@/components/RichTextEditor";
// SCHEMA_TYPES will be loaded from database - fallback for initial render
const DEFAULT_SCHEMA_TYPES = [
  { value: 'actor', label: 'Actor' },
  { value: 'artist', label: 'Artist (Group)' },
  { value: 'member', label: 'Member' },
];

const CreateWiki = () => {
  const {
    user,
    isAdmin,
    loading
  } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    toast
  } = useToast();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [schemaType, setSchemaType] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");
  const [birthday, setBirthday] = useState("");
  const [members, setMembers] = useState<Array<{ id: string; title: string }>>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [searchedMembers, setSearchedMembers] = useState<Array<{ id: string; title: string; image_url: string | null }>>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [relationships, setRelationships] = useState<Array<{
    parent_entry_id: string;
    parent_entry_title: string;
    relationship_type: string;
  }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFindingBirthday, setIsFindingBirthday] = useState(false);
  const [isFindingMembers, setIsFindingMembers] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [duplicateEntry, setDuplicateEntry] = useState<any>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateSlug, setDuplicateSlug] = useState<any>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [userLevel, setUserLevel] = useState<number>(1);
  const [minLevelRequired, setMinLevelRequired] = useState<number>(1);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [createCost, setCreateCost] = useState<number | null>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [schemaTypes, setSchemaTypes] = useState<Array<{ value: string; label: string }>>(DEFAULT_SCHEMA_TYPES);

  // Load categories from database
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('wiki_categories')
          .select('value, label')
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        
        if (error) throw error;
        if (data && data.length > 0) {
          setSchemaTypes(data);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  // slug 중복 체크
  useEffect(() => {
    const checkSlug = async () => {
      if (!slug.trim()) {
        setDuplicateSlug(null);
        return;
      }
      setIsCheckingSlug(true);
      try {
        const {
          data,
          error
        } = await supabase.from('wiki_entries').select('id, title, slug').eq('slug', slug.trim()).limit(1).maybeSingle();
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
  }, [slug]);

  // 중복 체크 (모든 타입에서 동일 타이틀 금지)
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!title.trim()) {
        setDuplicateEntry(null);
        return;
      }
      setIsCheckingDuplicate(true);
      try {
        const {
          data,
          error
        } = await supabase.from('wiki_entries').select('id, title, slug, content, schema_type').ilike('title', title.trim()).limit(1).maybeSingle();
        if (error) throw error;
        setDuplicateEntry(data);
      } catch (error) {
        console.error('Error checking duplicate:', error);
        setDuplicateEntry(null);
      } finally {
        setIsCheckingDuplicate(false);
      }
    };
    const timeoutId = setTimeout(checkDuplicate, 500);
    return () => clearTimeout(timeoutId);
  }, [title]);

  // URL 파라미터에서 title과 type 가져오기
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const titleParam = urlParams.get('title');
    const typeParam = urlParams.get('type');
    if (titleParam) {
      setTitle(titleParam);
    }
    if (typeParam) {
      setSchemaType(typeParam);
    }
  }, []);

  // 사용자 레벨 및 권한 확인
  useEffect(() => {
    const checkPermission = async () => {
      // 로딩 중이면 대기
      if (loading) return;
      if (!user) {
        navigate('/auth');
        return;
      }
      try {
        // 사용자 레벨 가져오기
        const {
          data: profileData,
          error: profileError
        } = await supabase.from('profiles').select('current_level').eq('id', user.id).single();
        if (profileError) throw profileError;
        const level = profileData?.current_level || 1;
        setUserLevel(level);

        // 최소 레벨 설정 가져오기
        const {
          data: settingData,
          error: settingError
        } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'wiki_creation_min_level').single();
        if (settingError) throw settingError;
        const minLevel = (settingData?.setting_value as any)?.min_level || 1;
        setMinLevelRequired(minLevel);

        // 관리자가 아니고 레벨이 부족한 경우
        if (!isAdmin && level < minLevel) {
          toast({
            title: "Insufficient Level",
            description: `You need to be level ${minLevel} or higher to create wiki entries. Your current level is ${level}.`,
            variant: "destructive"
          });
          navigate('/rankings');
          return;
        }
      } catch (error) {
        console.error('Error checking permission:', error);
      } finally {
        setIsCheckingPermission(false);
      }
    };
    checkPermission();
  }, [user, isAdmin, loading, navigate, toast]);

  // 엔트리 생성 시 소모되는 Stars 비용 및 사용자 포인트 로드
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        // Stars 비용 가져오기
        const {
          data: pointRule
        } = await supabase.from('point_rules').select('points').eq('action_type', 'create_wiki_entry').eq('is_active', true).single();
        if (pointRule) {
          setCreateCost(Math.abs(pointRule.points));
        }

        // 사용자 포인트 가져오기
        const {
          data: profile
        } = await supabase.from('profiles').select('available_points').eq('id', user.id).single();
        if (profile) {
          setUserPoints(profile.available_points || 0);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    fetchData();
  }, [user]);

  // 인증 확인
  if (loading || !user || isCheckingPermission) {
    return null;
  }

  // AI 콘텐츠 생성 (관리자 전용)
  const generateContent = async () => {
    if (!title.trim() || !schemaType) {
      toast({
        title: "Info",
        description: "Please enter a title and select a type first"
      });
      return;
    }
    setIsGenerating(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-wiki-content', {
        body: {
          title: title.trim(),
          schemaType
        }
      });
      if (error) throw error;
      if (data?.content) {
        setContent(data.content);

        // actor나 member 타입인 경우 자동으로 생일 정보도 찾기
        if (schemaType === 'actor' || schemaType === 'member') {
          setIsFindingBirthday(true);
          try {
            const birthdayResult = await supabase.functions.invoke('find-birthday', {
              body: {
                name: title.trim()
              }
            });
            if (birthdayResult.data?.birthday) {
              setBirthday(birthdayResult.data.birthday);
            }
          } catch (birthdayError) {
            console.error('Error finding birthday:', birthdayError);
          } finally {
            setIsFindingBirthday(false);
          }
        }
        toast({
          title: "AI Generated",
          description: "Content has been generated successfully!"
        });
      }
    } catch (error: any) {
      console.error('Error generating content:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI content",
        variant: "destructive"
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
        description: "Please enter a name first"
      });
      return;
    }
    setIsFindingBirthday(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('find-birthday', {
        body: {
          name: title.trim()
        }
      });
      if (error) throw error;
      if (data?.birthday) {
        setBirthday(data.birthday);
        toast({
          title: "Birthday Found",
          description: `Found birthday: ${data.birthday}`
        });
      } else {
        toast({
          title: "Not Found",
          description: data?.message || "Could not find birthday information",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Error finding birthday:', error);
      toast({
        title: "Error",
        description: "Failed to find birthday information",
        variant: "destructive"
      });
    } finally {
      setIsFindingBirthday(false);
    }
  };

  // AI 멤버 찾기 (관리자 전용) - 멤버 이름으로 wiki_entries 검색하여 매칭
  const findMembers = async () => {
    if (!title.trim()) {
      toast({
        title: "Info",
        description: "Please enter a group name first"
      });
      return;
    }
    setIsFindingMembers(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('suggest-artists', {
        body: {
          groupName: title.trim()
        }
      });
      if (error) throw error;
      if (data?.members && data.members.length > 0) {
        // AI가 반환한 멤버 이름으로 wiki_entries에서 member 타입 검색
        const memberNames = data.members as string[];
        const foundMembers: Array<{ id: string; title: string }> = [];
        
        for (const name of memberNames) {
          const { data: memberEntry } = await supabase
            .from('wiki_entries')
            .select('id, title')
            .eq('schema_type', 'member')
            .ilike('title', name)
            .limit(1)
            .maybeSingle();
          
          if (memberEntry) {
            foundMembers.push({ id: memberEntry.id, title: memberEntry.title });
          }
        }
        
        if (foundMembers.length > 0) {
          setMembers(foundMembers);
          toast({
            title: "Members Found",
            description: `Found ${foundMembers.length} members in database`
          });
        } else {
          toast({
            title: "Not Found",
            description: "No member entries found in database. Please create them first.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Not Found",
          description: "Could not find member information",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Error finding members:', error);
      toast({
        title: "Error",
        description: "Failed to find member information",
        variant: "destructive"
      });
    } finally {
      setIsFindingMembers(false);
    }
  };
  const addMember = (member: { id: string; title: string }) => {
    if (!members.find(m => m.id === member.id)) {
      setMembers([...members, member]);
      setMemberSearch("");
      setMemberSearchOpen(false);
    }
  };
  const removeMember = (memberId: string) => {
    setMembers(members.filter(m => m.id !== memberId));
  };
  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput("");
    }
  };
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // slug 자동 생성 (영문만)
  const generateSlugFromTitle = () => {
    const englishOnly = title.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    setSlug(englishOnly || '');
  };

  // slug 입력 핸들러 (영문/숫자/하이픈만)
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(value);
  };

  // 영어로 번역
  const translateToEnglish = async () => {
    if (!title.trim() && !content.trim()) {
      toast({
        title: "Info",
        description: "Please enter title or content first"
      });
      return;
    }
    setIsTranslating(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('translate-to-english', {
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
        description: "Content has been translated to English"
      });
    } catch (error: any) {
      console.error('Error translating:', error);
      toast({
        title: "Error",
        description: "Failed to translate to English",
        variant: "destructive"
      });
    } finally {
      setIsTranslating(false);
    }
  };

  // 이미지 업로드
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일 검증
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    // 파일 크기 검증 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 5MB",
        variant: "destructive"
      });
      return;
    }
    setIsUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      const {
        error: uploadError
      } = await supabase.storage.from('wiki-images').upload(filePath, file);
      if (uploadError) throw uploadError;
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('wiki-images').getPublicUrl(filePath);
      setImageUrl(publicUrl);
      toast({
        title: "Success",
        description: "Image uploaded successfully"
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setIsUploadingImage(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title",
        variant: "destructive"
      });
      return;
    }
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Please enter content",
        variant: "destructive"
      });
      return;
    }
    if (!schemaType) {
      toast({
        title: "Error",
        description: "Please select a type",
        variant: "destructive"
      });
      return;
    }

    // 중복 타이틀 체크
    if (duplicateEntry) {
      toast({
        title: "Duplicate Title",
        description: "An entry with this title already exists. Please choose a different title.",
        variant: "destructive"
      });
      return;
    }

    // Stars 부족 체크
    const cost = createCost || 100;
    if (userPoints < cost) {
      toast({
        title: "Insufficient Stars",
        description: `You need ${cost} Stars to create an entry. You have ${userPoints} Stars.`,
        variant: "destructive"
      });
      return;
    }

    // 확인 다이얼로그 표시
    setShowConfirmDialog(true);
  };

  const handleConfirmCreate = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);
    try {
      // metadata 객체 생성
      const metadata: any = {};
      if ((schemaType === 'actor' || schemaType === 'member') && birthday) {
        metadata.birthday = birthday;
      }
      if (schemaType === 'artist' && members.length > 0) {
        metadata.members = members.map(m => m.title);
        metadata.member_ids = members.map(m => m.id);
      }
      const {
        data: newEntry,
        error
      } = await supabase.from('wiki_entries').insert([{
        title: title.trim(),
        content: content.trim(),
        schema_type: schemaType as any,
        image_url: imageUrl.trim() || null,
        creator_id: user.id,
        metadata,
        slug
      }]).select().single();
      if (error) throw error;

      // 관계 생성
      if (newEntry && relationships.length > 0) {
        for (const rel of relationships) {
          const {
            error: relError
          } = await supabase.from('wiki_entry_relationships').insert({
            parent_entry_id: rel.parent_entry_id,
            child_entry_id: newEntry.id,
            relationship_type: rel.relationship_type,
            created_by: user.id
          });
          if (relError) {
            console.error('Error creating relationship:', relError);
          }
        }
      }

      // 태그 처리
      if (newEntry && tags.length > 0) {
        for (const tagName of tags) {
          // 태그가 이미 존재하는지 확인
          let {
            data: existingTag
          } = await supabase.from('wiki_tags').select('id').eq('slug', tagName).single();
          let tagId: string;
          if (existingTag) {
            tagId = existingTag.id;
          } else {
            // 새 태그 생성
            const {
              data: newTag,
              error: tagError
            } = await supabase.from('wiki_tags').insert([{
              name: tagName,
              slug: tagName
            }]).select().single();
            if (tagError) throw tagError;
            tagId = newTag.id;
          }

          // 위키 엔트리와 태그 연결
          const {
            error: linkError
          } = await supabase.from('wiki_entry_tags').insert([{
            wiki_entry_id: newEntry.id,
            tag_id: tagId
          }]);
          if (linkError) throw linkError;
        }
      }
      toast({
        title: "Success",
        description: `Fanz entry created successfully. ${createCost || 100} Stars deducted.`
      });
      
      // 프로필 캐시 무효화 (Stars 업데이트 반영)
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      
      navigate('/rankings');
    } catch (error: any) {
      console.error('Error creating Fanz entry:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create Fanz entry",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isMobile = useIsMobile();
  
  return (
    <>
      <Helmet>
        <title>Create Fanz - KTRENDZ</title>
        <meta name="description" content="Create a new Fanz entry" />
      </Helmet>
      
      <V2Layout pcHeaderTitle="Create Fanz" showBackButton>
        <div className={`${isMobile ? 'pt-16 px-4' : ''} py-6`}>
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </div>
            <div className="mb-4 sm:mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold">Create Fanz</h1>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        type="button"
                        className="text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Revenue information"
                      >
                        <HelpCircle className="w-5 h-5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-4 sm:p-6" align="start">
                      <div className="space-y-3">
                        <h3 className="font-semibold text-base sm:text-lg">Lightstick Revenue Structure</h3>
                        <div className="space-y-2 text-sm">
                          <p className="text-muted-foreground">
                            After issuing a Lightstick (Fanz Token), creators can earn revenue through fan support.
                          </p>
                          <div className="space-y-2">
                            <p className="font-medium">Purchase Fees:</p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                              <li>6% goes to the creator</li>
                              <li>4% platform fee</li>
                            </ul>
                          </div>
                          <div className="space-y-2">
                            <p className="font-medium">Sale Fees:</p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                              <li>3% fee on token sales</li>
                            </ul>
                          </div>
                          <div className="mt-3 p-3 bg-primary/5 rounded-lg">
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              💡 Token prices increase as more fans purchase, creating continuous price appreciation with supply growth.
                            </p>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {createCost !== null && (
                    <span className="text-xs text-muted-foreground">Cost: {createCost} Stars</span>
                  )}
                </div>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Add a new entry to the K-pop knowledge base
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title" className="pl-1">
                      Title <span className="text-destructive">*</span>
                    </Label>
                    <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., BTS, NewJeans, IU" required className={duplicateEntry ? "border-destructive" : ""} />
                    {isCheckingDuplicate && <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Checking for duplicates...
                      </p>}
                    {duplicateEntry && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive font-medium mb-1">
                          ⚠️ Duplicate Entry Found
                        </p>
                        <p className="text-sm text-muted-foreground">
                          An entry with the same title "{duplicateEntry.title}" already exists.
                        </p>
                        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-primary" onClick={() => navigate(`/k/${duplicateEntry.slug}`)}>
                          View existing entry →
                        </Button>
                      </div>}
                  </div>

                  {/* URL Slug */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="slug" className="pl-1">
                        URL Slug <span className="text-destructive">*</span>
                      </Label>
                      <Button type="button" variant="ghost" size="sm" onClick={generateSlugFromTitle} disabled={!title.trim()} className="h-auto p-0 text-xs text-primary hover:bg-transparent">
                        Generate from title
                      </Button>
                    </div>
                    <Input id="slug" value={slug} onChange={handleSlugChange} placeholder="example-slug (English, numbers, hyphens only)" required />
                    <p className="text-xs text-muted-foreground">
                      This will be used in the URL: /k/your-slug
                    </p>
                    {isCheckingSlug && <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Checking availability...
                      </p>}
                    {duplicateSlug && <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
                        <p className="text-sm text-destructive font-medium">
                          ⚠️ This slug is already taken
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Used by: {duplicateSlug.title}
                        </p>
                        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-primary" onClick={() => navigate(`/k/${duplicateSlug.slug}`)}>
                          View existing entry →
                        </Button>
                      </div>}
                  </div>

                  {/* Type */}
                  <div className="space-y-2">
                    <Label htmlFor="schemaType" className="pl-1">
                      Type <span className="text-destructive">*</span>
                    </Label>
                    <Select value={schemaType} onValueChange={setSchemaType}>
                      <SelectTrigger id="schemaType">
                        <SelectValue placeholder="Select entry type" />
                      </SelectTrigger>
                      <SelectContent>
                        {schemaTypes.map(type => <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <RichTextEditor value={content} onChange={setContent} placeholder="Write detailed information about this entry..." minHeight="400px" />
                  </div>

                  {/* Translate Button */}
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={translateToEnglish} disabled={isTranslating || !title.trim() && !content.trim()} className="rounded-full gap-2 border-primary hover:bg-primary hover:text-primary-foreground">
                      {isTranslating ? <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="hidden sm:inline">Translating...</span>
                        </> : <>
                          <Languages className="w-4 h-4" />
                          <span className="hidden sm:inline">Translate to English</span>
                        </>}
                    </Button>
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="imageUpload" className="pl-1">Image</Label>
                    
                    {imageUrl && <div className="relative w-full rounded-lg overflow-hidden border mb-2 bg-muted/30">
                        <img src={imageUrl} alt="Preview" className="w-full max-h-80 object-contain" />
                        <Button type="button" variant="destructive" size="sm" onClick={() => setImageUrl("")} className="absolute top-2 right-2 rounded-full">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>}
                    
                    <div className="relative">
                      <Input id="imageUpload" type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploadingImage} className="hidden" />
                      <Button type="button" variant="outline" onClick={() => document.getElementById('imageUpload')?.click()} disabled={isUploadingImage} className="w-full rounded-full">
                        {isUploadingImage ? <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Uploading...
                          </> : 'Upload Image (max 5MB)'}
                      </Button>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <Label htmlFor="tags" className="pl-1">Tags (Optional)</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input id="tags" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }} placeholder="Add tags (press Enter)" className="flex-1" />
                      <Button type="button" variant="outline" size="sm" onClick={addTag} disabled={!tagInput.trim()} className="w-full sm:w-auto">
                        <Tag className="w-4 h-4" />
                      </Button>
                    </div>
                    {tags.length > 0 && <div className="flex flex-wrap gap-2 mt-2">
                        {tags.map(tag => <div key={tag} className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                            <Tag className="w-3 h-3" />
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </div>)}
                      </div>}
                  </div>

                  {/* 관계 설정 */}
                  <div className="space-y-2">
                    <WikiRelationshipManager title={title} content={content} schemaType={schemaType} relationships={relationships} onChange={setRelationships} />
                  </div>

                  {/* Birthday for Actor/Member */}
                  {(schemaType === 'actor' || schemaType === 'member') && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="pl-1">Birthday (Optional)</Label>
                        {isAdmin && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={findBirthday} 
                            disabled={isFindingBirthday || !title.trim()} 
                            className="rounded-full gap-2"
                          >
                            {isFindingBirthday ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="hidden sm:inline">Finding...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4" />
                                <span className="hidden sm:inline">AI Find</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !birthday && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {birthday && birthday.match(/^\d{4}-\d{2}-\d{2}$/) 
                              ? format(new Date(birthday), 'PPP') 
                              : <span>Select birthday</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto min-w-[320px] p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={birthday && birthday.match(/^\d{4}-\d{2}-\d{2}$/) ? new Date(birthday) : undefined}
                            onSelect={(date) => setBirthday(date ? format(date, 'yyyy-MM-dd') : '')}
                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                            initialFocus
                            className="pointer-events-auto"
                            captionLayout="dropdown-buttons"
                            fromYear={1940}
                            toYear={new Date().getFullYear()}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* Members for Artist */}
                  {schemaType === 'artist' && (
                    <div className="space-y-2">
                      <Label className="pl-1">Members (Optional)</Label>
                      <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            role="combobox" 
                            aria-expanded={memberSearchOpen} 
                            className="w-full justify-between font-normal hover:bg-muted"
                          >
                            <span className="text-muted-foreground">Search members...</span>
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput 
                              placeholder="Search member entries..." 
                              value={memberSearch}
                              onValueChange={(value) => {
                                setMemberSearch(value);
                                if (value.trim().length >= 2) {
                                  setIsSearchingMembers(true);
                                  supabase
                                    .from('wiki_entries')
                                    .select('id, title, image_url')
                                    .eq('schema_type', 'member')
                                    .ilike('title', `%${value.trim()}%`)
                                    .limit(10)
                                    .then(({ data, error }) => {
                                      if (!error && data) {
                                        setSearchedMembers(data);
                                      }
                                      setIsSearchingMembers(false);
                                    });
                                } else {
                                  setSearchedMembers([]);
                                }
                              }}
                            />
                            <CommandList>
                              {isSearchingMembers && (
                                <div className="py-6 text-center text-sm">
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                </div>
                              )}
                              {!isSearchingMembers && memberSearch.length >= 2 && searchedMembers.length === 0 && (
                                <CommandEmpty>No members found.</CommandEmpty>
                              )}
                              {!isSearchingMembers && searchedMembers.length > 0 && (
                                <CommandGroup>
                                  {searchedMembers.map((member) => (
                                    <CommandItem
                                      key={member.id}
                                      value={member.id}
                                      onSelect={() => addMember({ id: member.id, title: member.title })}
                                      className="cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2">
                                        {member.image_url ? (
                                          <img src={member.image_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                                        ) : (
                                          <div className="w-6 h-6 rounded-full bg-muted" />
                                        )}
                                        <span>{member.title}</span>
                                      </div>
                                      {members.find(m => m.id === member.id) && (
                                        <Check className="ml-auto h-4 w-4 text-primary" />
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {members.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                          {members.map((member) => (
                            <div 
                              key={member.id} 
                              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-primary/10 text-primary rounded-full text-xs sm:text-sm"
                            >
                              <span className="truncate max-w-[100px] sm:max-w-[150px]">{member.title}</span>
                              <button 
                                type="button" 
                                onClick={() => removeMember(member.id)} 
                                className="hover:text-destructive ml-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 pb-8">
                    <Button type="button" variant="outline" onClick={() => navigate('/rankings')} className="w-full sm:flex-1 rounded-full order-2 sm:order-1" disabled={isSubmitting}>
                      Cancel
                    </Button>
                    <Button type="submit" className="w-full sm:flex-1 rounded-full order-1 sm:order-2" disabled={isSubmitting || !!duplicateEntry || isCheckingDuplicate}>
                      {isSubmitting ? "Creating..." : duplicateEntry ? "Duplicate Entry Exists" : "Create Fanz"}
                    </Button>
                  </div>
                 </form>
        </div>
      </V2Layout>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Create Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{createCost || 100} Stars</strong> will be deducted. (Balance: {userPoints} Stars)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmCreate}
              className="w-full sm:w-auto"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
export default CreateWiki;