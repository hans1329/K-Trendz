import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Plus, Sparkles, Loader2, Check, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
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

type WikiSchemaType = Database['public']['Enums']['wiki_schema_type'];

const RELATIONSHIP_TYPES = [
  { value: 'member_of', label: 'Member of' },
  { value: 'product_of', label: 'Product of' },
  { value: 'belongs_to_category', label: 'Belongs to Category' },
  { value: 'sub_category_of', label: 'Sub-category of' },
  { value: 'album_of', label: 'Album of' },
  { value: 'song_of', label: 'Song of' },
  { value: 'actor_in', label: 'Actor in' }
];

interface Relationship {
  parent_entry_id: string;
  parent_entry_title: string;
  relationship_type: string;
}

interface SuggestedRelationship extends Relationship {
  confidence: number;
  reason: string;
}

interface WikiRelationshipManagerProps {
  title: string;
  content: string;
  schemaType: string;
  relationships: Relationship[];
  onChange: (relationships: Relationship[]) => void;
  onSchemaTypeChange?: (newSchemaType: string) => void;
  wikiEntryId?: string;
}

export const WikiRelationshipManager = ({
  title,
  content,
  schemaType,
  relationships,
  onChange,
  onSchemaTypeChange,
  wikiEntryId
}: WikiRelationshipManagerProps) => {
  const { toast } = useToast();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedParentCategory, setSelectedParentCategory] = useState("");
  const [parentCategories, setParentCategories] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedRelationship[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSchemaChangeDialog, setShowSchemaChangeDialog] = useState(false);
  const [newSchemaType, setNewSchemaType] = useState("");

  // 관리자 권한 확인
  useEffect(() => {
    const checkAdminRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!!data);
    };

    checkAdminRole();
  }, []);

  // 부모 카테고리 목록 가져오기
  useEffect(() => {
    const fetchParentCategories = async () => {
      if (!schemaType || !schemaType.trim()) {
        setParentCategories([]);
        return;
      }

      const { data, error } = await supabase
        .from('schema_type_relationships')
        .select('parent_schema_type')
        .eq('child_schema_type', schemaType);

      if (!error && data) {
        const validParents = data
          .map(r => r.parent_schema_type)
          .filter(t => VALID_SCHEMA_TYPES.includes(t));
        setParentCategories(validParents);
      }
    };

    fetchParentCategories();
  }, [schemaType]);

  // 부모 카테고리 변경 시 검색 결과 및 쿼리 초기화
  useEffect(() => {
    setSearchQuery("");
    setSearchResults([]);
  }, [selectedParentCategory]);

  // Schema type을 사용자 친화적인 이름으로 변환
  const getSchemaDisplayName = (schema: string) => {
    const displayNames: Record<string, string> = {
      artist: 'Artist',
      member: 'Member',
      album: 'Album',
      song: 'Song',
      food: 'Food',
      k_food: 'K-Food',
      k_beauty: 'K-Beauty',
      beauty_brand: 'Beauty Brand',
      beauty_product: 'Beauty Product',
      food_brand: 'Food Brand',
      food_product: 'Food Product',
      product: 'Product',
      drama: 'Drama',
      movie: 'Movie',
      category: 'Category',
      company: 'Company',
      brand: 'Brand',
      travel: 'Travel',
      restaurant: 'Restaurant',
      cafe: 'Cafe',
    };
    return displayNames[schema] || schema.charAt(0).toUpperCase() + schema.slice(1);
  };

  // Relationship 타입을 부모 schemaType과 함께 표시
  const getRelationshipLabel = (value: string) => {
    // 부모 스키마 타입 매핑
    const parentSchemaMap: Record<string, string> = {
      beauty_brand: 'k_beauty',
      beauty_product: 'beauty_brand',
      food_brand: 'k_food',
      food_product: 'food_brand',
      member: 'artist',
      song: 'album',
      album: 'artist',
    };

    const parentSchema = parentSchemaMap[schemaType] || schemaType;
    const parentName = getSchemaDisplayName(parentSchema);
    
    const labelMap: Record<string, string> = {
      'member_of': `Member of ${parentName}`,
      'product_of': `Product of ${parentName}`,
      'belongs_to_category': `Belongs to ${parentName}`,
      'sub_category_of': `Sub-category of ${parentName}`,
      'album_of': `Album of ${parentName}`,
      'song_of': `Song of ${parentName}`,
      'actor_in': `Actor in ${parentName}`,
    };
    return labelMap[value] || RELATIONSHIP_TYPES.find(t => t.value === value)?.label || value;
  };

  // 유효한 schema types (DB enum 기준)
  const VALID_SCHEMA_TYPES = [
    'artist', 'member', 'album', 'song', 'food', 'k_food', 'k_beauty',
    'beauty_brand', 'beauty_product', 'food_brand', 'food_product',
    'product', 'drama', 'movie', 'category', 'company', 'brand',
    'travel', 'restaurant', 'cafe', 'actor', 'youtuber'
  ];

  // 디바운스 타이머 ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 엔트리 검색 (전체 대상, 디바운스 적용)
  const searchEntries = useCallback((query: string) => {
    // 이전 타이머 취소
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // 300ms 디바운스
    searchTimeoutRef.current = setTimeout(async () => {
      console.log('Searching all entries for query:', query);

      const { data, error } = await supabase
        .from('wiki_entries')
        .select('id, title, schema_type')
        .ilike('title', `%${query}%`)
        .order('title', { ascending: true })
        .limit(50);

      console.log('Search results:', data, 'error:', error);

      if (!error && data) {
        // id 기준으로 중복 제거
        const uniqueResults = data.filter((entry, index, self) =>
          index === self.findIndex((e) => e.id === entry.id)
        );
        setSearchResults(uniqueResults);
      } else if (error) {
        console.error('Error searching entries:', error);
        setSearchResults([]);
      }
    }, 300);
  }, []);

  // 관계 추가
  const addRelationship = (entry: any) => {
    if (!selectedType) {
      toast({
        title: "Select relationship type",
        description: "Please select a relationship type first",
        variant: "destructive",
      });
      return;
    }

    const exists = relationships.some(
      r => r.parent_entry_id === entry.id && r.relationship_type === selectedType
    );

    if (exists) {
      toast({
        title: "Already exists",
        description: "This relationship already exists",
        variant: "destructive",
      });
      return;
    }

    onChange([
      ...relationships,
      {
        parent_entry_id: entry.id,
        parent_entry_title: entry.title,
        relationship_type: selectedType
      }
    ]);

    setSearchOpen(false);
    setSearchQuery("");
  };

  // 관계 제거
  const removeRelationship = (index: number) => {
    onChange(relationships.filter((_, i) => i !== index));
  };

  // AI 관계 제안
  const suggestRelationships = async () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Need content",
        description: "Please enter title and content first",
        variant: "destructive",
      });
      return;
    }

    setIsSuggesting(true);
    setSuggestions([]);

    try {
      const { data, error } = await supabase.functions.invoke('suggest-wiki-relationships', {
        body: { title, content, schemaType }
      });

      if (error) throw error;

      if (data?.relationships && data.relationships.length > 0) {
        setSuggestions(data.relationships);
        toast({
          title: "AI Suggestions",
          description: `Found ${data.relationships.length} suggested relationship(s)`,
        });
      } else {
        toast({
          title: "No suggestions",
          description: "AI couldn't find any relationships in the content",
        });
      }
    } catch (error: any) {
      console.error('Error suggesting relationships:', error);
      if (error.message?.includes('429')) {
        toast({
          title: "Rate limit",
          description: "Too many requests. Please try again later.",
          variant: "destructive",
        });
      } else if (error.message?.includes('402')) {
        toast({
          title: "Payment required",
          description: "Please add credits to continue using AI features.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to get AI suggestions",
          variant: "destructive",
        });
      }
    } finally {
      setIsSuggesting(false);
    }
  };

  // 제안 승인 (parent entry 존재 여부 검증)
  const approveSuggestion = async (suggestion: SuggestedRelationship) => {
    // 이미 존재하는 관계인지 확인
    const exists = relationships.some(
      r => r.parent_entry_id === suggestion.parent_entry_id && 
           r.relationship_type === suggestion.relationship_type
    );

    if (exists) {
      setSuggestions(suggestions.filter(s => s !== suggestion));
      return;
    }

    // parent entry가 실제로 존재하는지 확인
    const { data, error } = await supabase
      .from('wiki_entries')
      .select('id, title')
      .eq('id', suggestion.parent_entry_id)
      .single();

    if (error || !data) {
      toast({
        title: "Invalid entry",
        description: `The suggested parent entry "${suggestion.parent_entry_title}" no longer exists.`,
        variant: "destructive",
      });
      setSuggestions(suggestions.filter(s => s !== suggestion));
      return;
    }

    // 유효한 경우 관계 추가
    onChange([
      ...relationships,
      {
        parent_entry_id: suggestion.parent_entry_id,
        parent_entry_title: data.title, // DB에서 가져온 최신 타이틀 사용
        relationship_type: suggestion.relationship_type
      }
    ]);
    
    setSelectedType(suggestion.relationship_type);
    setSuggestions(suggestions.filter(s => s !== suggestion));
  };

  // 제안 거부
  const rejectSuggestion = (suggestion: SuggestedRelationship) => {
    setSuggestions(suggestions.filter(s => s !== suggestion));
  };

  // Schema Type 변경 요청
  const requestSchemaTypeChange = (targetType: string) => {
    setNewSchemaType(targetType);
    setShowSchemaChangeDialog(true);
  };

  // Schema Type 변경 확인
  const confirmSchemaTypeChange = async () => {
    if (!wikiEntryId || !newSchemaType) return;

    try {
      // Schema type 업데이트 (타입 캐스팅)
      const { error } = await supabase
        .from('wiki_entries')
        .update({ schema_type: newSchemaType as WikiSchemaType })
        .eq('id', wikiEntryId);

      if (error) throw error;

      toast({
        title: "Schema type changed",
        description: `Successfully changed from ${schemaType} to ${newSchemaType}`,
      });

      // 부모 컴포넌트에 변경 알림
      if (onSchemaTypeChange) {
        onSchemaTypeChange(newSchemaType);
      }
    } catch (error: any) {
      console.error('Error changing schema type:', error);
      toast({
        title: "Error",
        description: "Failed to change schema type",
        variant: "destructive",
      });
    } finally {
      setShowSchemaChangeDialog(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 관리자 Schema Type 변경 UI */}
      {isAdmin && wikiEntryId && (
        <Card className="p-4 space-y-3 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label className="text-sm font-semibold">Admin: Change Schema Type</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Current: <span className="font-medium text-[#ff4500]">{getSchemaDisplayName(schemaType)}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {schemaType !== 'artist' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => requestSchemaTypeChange('artist')}
                  className="gap-2 rounded-full"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Change to Artist</span>
                  <span className="sm:hidden">→ Artist</span>
                </Button>
              )}
              {schemaType !== 'member' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => requestSchemaTypeChange('member')}
                  className="gap-2 rounded-full"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Change to Member</span>
                  <span className="sm:hidden">→ Member</span>
                </Button>
              )}
              {schemaType !== 'actor' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => requestSchemaTypeChange('actor')}
                  className="gap-2 rounded-full"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Change to Actor</span>
                  <span className="sm:hidden">→ Actor</span>
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Label>
          Parent Entry <span className="text-destructive">*</span>
        </Label>
      </div>

      {/* AI 제안 목록 */}
      {suggestions.length > 0 && (
        <Card className="p-4 space-y-3 border-primary/20">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Suggestions
          </div>
          {suggestions.map((suggestion, index) => (
            <div key={index} className="flex flex-col sm:flex-row items-start gap-2 p-3 bg-muted rounded-lg">
              <div className="flex-1 min-w-0 w-full">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium text-sm break-words">{suggestion.parent_entry_title}</span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {getRelationshipLabel(suggestion.relationship_type)}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {Math.round(suggestion.confidence * 100)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground break-words">{suggestion.reason}</p>
              </div>
              <div className="flex gap-1 self-start sm:self-center">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => approveSuggestion(suggestion)}
                  className="h-8 w-8 p-0"
                >
                  <Check className="w-4 h-4 text-green-500" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => rejectSuggestion(suggestion)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* 수동 추가 UI */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 부모 카테고리 선택 */}
        <Select 
          value={selectedParentCategory} 
          onValueChange={(value) => {
            setSelectedParentCategory(value);
            setSelectedType('');
            setSearchQuery("");
            setSearchResults([]);
            onChange([]);
          }}
        >
          <SelectTrigger className="w-[140px] sm:w-[160px] rounded-full">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {parentCategories.length > 0 ? (
              parentCategories.map(category => (
                <SelectItem key={category} value={category}>
                  {getSchemaDisplayName(category)}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="_empty" disabled>No categories</SelectItem>
            )}
          </SelectContent>
        </Select>

        {/* 관계 타입 선택 */}
        {selectedParentCategory && (
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[140px] sm:w-[160px] rounded-full">
              <SelectValue placeholder="Relation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {RELATIONSHIP_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* 엔트리 검색 */}
        {selectedParentCategory && selectedType && selectedType !== 'none' && (
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button 
                type="button"
                variant="outline" 
                className="gap-2 rounded-full"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Search {getSchemaDisplayName(selectedParentCategory)}</span>
                <span className="sm:hidden">Search</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder={`Search ${getSchemaDisplayName(selectedParentCategory)}...`}
                  value={searchQuery}
                  onValueChange={(value) => {
                    setSearchQuery(value);
                    searchEntries(value);
                  }}
                />
                <CommandEmpty>No entries found.</CommandEmpty>
                <CommandGroup className="max-h-[200px] overflow-auto">
                  {searchResults.map(entry => (
                    <CommandItem
                      key={entry.id}
                      onSelect={() => addRelationship(entry)}
                    >
                      <div className="flex flex-col">
                        <span>{entry.title}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* 리셋 버튼 */}
        {selectedParentCategory && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedParentCategory('');
              setSelectedType('');
              setSearchQuery("");
              setSearchResults([]);
              onChange([]);
            }}
            className="h-8 w-8 p-0 rounded-full"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* 현재 관계 목록 */}
      {relationships.length > 0 && (
        <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
          {relationships.map((rel, index) => (
            <Badge 
              key={index} 
              variant="secondary" 
              className="gap-1 sm:gap-2 px-2 sm:px-3 py-1 text-xs sm:text-sm"
            >
              <span className="truncate max-w-[100px] sm:max-w-[150px]">{rel.parent_entry_title}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                ({getRelationshipLabel(rel.relationship_type)})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRelationship(index)}
                className="h-4 w-4 p-0 hover:bg-destructive/20 ml-0.5"
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Schema Type 변경 확인 다이얼로그 */}
      <AlertDialog open={showSchemaChangeDialog} onOpenChange={setShowSchemaChangeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Schema Type</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to change the schema type from{' '}
                <span className="font-semibold text-foreground">{getSchemaDisplayName(schemaType)}</span> to{' '}
                <span className="font-semibold text-foreground">{getSchemaDisplayName(newSchemaType)}</span>?
              </p>
              <p className="text-destructive">
                Warning: This will affect how this entry is displayed and linked with other entries.
                Make sure to review related relationships after this change.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full w-full sm:w-auto mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmSchemaTypeChange}
              className="bg-[#ff4500] hover:bg-[#ff4500]/90 text-white rounded-full w-full sm:w-auto"
            >
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
