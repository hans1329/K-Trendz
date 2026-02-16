import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { CalendarIcon } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const EVENT_TYPES = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'comeback', label: 'Comeback' },
  { value: 'concert', label: 'Concert' },
  { value: 'fanmeeting', label: 'Fan Meeting' },
  { value: 'variety_appearance', label: 'Variety Show Appearance' },
  { value: 'award_show', label: 'Award Show' },
  { value: 'other', label: 'Other' }
];

const CreateCalendarEvent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<string>("");
  const [eventDate, setEventDate] = useState<Date>();
  const [wikiEntryId, setWikiEntryId] = useState<string>("");
  const [suggestedWikiId, setSuggestedWikiId] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 위키 엔트리 목록 가져오기
  const { data: wikiEntries = [] } = useQuery({
    queryKey: ['wiki-entries-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wiki_entries')
        .select('id, title, schema_type')
        .order('title', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // AI 추천 함수
  const getSuggestion = async () => {
    if (!title.trim() || !eventType) {
      toast({
        title: "Info",
        description: "Please enter a title and select event type first",
      });
      return;
    }

    setIsLoadingSuggestion(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-wiki-entry', {
        body: {
          title: title.trim(),
          description: description.trim(),
          eventType
        }
      });

      if (error) throw error;

      if (data?.suggestedWikiId) {
        setSuggestedWikiId(data.suggestedWikiId);
        setWikiEntryId(data.suggestedWikiId);
        toast({
          title: "AI Suggestion",
          description: `Suggested: ${data.suggestedTitle}`,
        });
      } else {
        toast({
          title: "No Match Found",
          description: "AI couldn't find a matching Fanz entry",
        });
      }
    } catch (error: any) {
      console.error('Error getting suggestion:', error);
      toast({
        title: "Error",
        description: "Failed to get AI suggestion",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  // 인증 확인
  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter an event title",
        variant: "destructive",
      });
      return;
    }

    if (!eventType) {
      toast({
        title: "Error",
        description: "Please select an event type",
        variant: "destructive",
      });
      return;
    }

    if (!eventDate) {
      toast({
        title: "Error",
        description: "Please select an event date",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 0. 포인트 차감 (이벤트 생성 전에 체크)
      const { data: pointDeducted, error: pointError } = await supabase
        .rpc('deduct_points', {
          user_id_param: user.id,
          action_type_param: 'create_calendar_event',
          reference_id_param: null
        });

      if (pointError || !pointDeducted) {
        toast({
          title: "Insufficient Stars",
          description: "You don't have enough stars to create a calendar event",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // 1. calendar_events에 이벤트 추가
      const { error } = await supabase
        .from('calendar_events')
        .insert([{
          title: title.trim(),
          description: description.trim() || null,
          event_type: eventType as any,
          event_date: format(eventDate, 'yyyy-MM-dd'),
          wiki_entry_id: wikiEntryId || null,
          creator_id: user.id,
          is_recurring: isRecurring,
          metadata: {}
        }]);

      if (error) throw error;

      // 2. wiki_entry가 선택된 경우, wiki_entries 업데이트
      if (wikiEntryId) {
        // 기존 wiki_entry 가져오기
        const { data: wikiEntry, error: fetchError } = await supabase
          .from('wiki_entries')
          .select('metadata, content')
          .eq('id', wikiEntryId)
          .single();

        if (!fetchError && wikiEntry) {
          const currentMetadata = (wikiEntry.metadata as Record<string, any>) || {};
          const currentContent = wikiEntry.content || '';
          
          // 이벤트 타입에 따른 라벨
          const eventTypeLabel = EVENT_TYPES.find(t => t.value === eventType)?.label || eventType;
          
          // 본문에 추가할 이벤트 정보
          const eventInfo = `\n\n### ${eventTypeLabel}\n**Date:** ${format(eventDate, 'MMMM dd, yyyy')}${description.trim() ? `\n\n${description.trim()}` : ''}`;
          
          const updateData: any = {
            content: currentContent + eventInfo
          };

          // birthday 타입인 경우 metadata도 업데이트
          if (eventType === 'birthday') {
            updateData.metadata = {
              ...currentMetadata,
              birthday: format(eventDate, 'yyyy-MM-dd')
            };
          }

          const { error: updateError } = await supabase
            .from('wiki_entries')
            .update(updateData)
            .eq('id', wikiEntryId);

          if (updateError) {
            console.error('Warning: Failed to update Fanz entry:', updateError);
            // 경고만 하고 계속 진행
          }
        }
      }

      toast({
        title: "Success",
        description: "Event created successfully",
      });

      navigate('/calendar');
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Create Event - KTRENDZ</title>
        <meta name="description" content="Create a new calendar event" />
      </Helmet>
      
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        
        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2">Create Calendar Event</h1>
              <p className="text-muted-foreground">
                Add a new event to the fandom calendar
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">
                      Event Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Jungkook's Birthday"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add details about the event..."
                      rows={4}
                    />
                  </div>

                  {/* Event Type */}
                  <div className="space-y-2">
                    <Label htmlFor="eventType">
                      Event Type <span className="text-destructive">*</span>
                    </Label>
                    <Select value={eventType} onValueChange={setEventType}>
                      <SelectTrigger id="eventType">
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Event Date */}
                  <div className="space-y-2">
                    <Label>
                      Event Date <span className="text-destructive">*</span>
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !eventDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {eventDate ? format(eventDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={eventDate}
                          onSelect={setEventDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Wiki Entry Link with AI Suggestion */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="wikiEntry">Fanz (Optional)</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={getSuggestion}
                        disabled={isLoadingSuggestion || !title.trim() || !eventType}
                        className="rounded-full"
                      >
                        {isLoadingSuggestion ? "AI Suggesting..." : "AI Suggest"}
                      </Button>
                    </div>
                    <Select value={wikiEntryId} onValueChange={setWikiEntryId}>
                      <SelectTrigger id="wikiEntry">
                        <SelectValue placeholder="Select a Fanz entry (or leave blank)" />
                      </SelectTrigger>
                      <SelectContent>
                        {wikiEntries.map((entry) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {entry.title} ({entry.schema_type.replace('_', ' ')})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Link this event to an artist, member, or other Fanz entry. Use AI to auto-suggest!
                    </p>
                  </div>

                  {/* Recurring */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="recurring" className="text-base">
                        Recurring Event
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        This event repeats every year (e.g., birthdays)
                      </p>
                    </div>
                    <Switch
                      id="recurring"
                      checked={isRecurring}
                      onCheckedChange={setIsRecurring}
                    />
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate('/calendar')}
                      className="w-full sm:flex-1 rounded-full order-2 sm:order-1"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="w-full sm:flex-1 rounded-full order-1 sm:order-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Creating..." : "Create Event"}
                    </Button>
                  </div>
                </form>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default CreateCalendarEvent;
