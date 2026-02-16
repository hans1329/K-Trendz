import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Helmet } from "react-helmet-async";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from "date-fns";
const EVENT_TYPE_COLORS: Record<string, string> = {
  birthday: "bg-pink-500",
  comeback: "bg-orange-500",
  concert: "bg-purple-500",
  fanmeeting: "bg-blue-500",
  variety_appearance: "bg-green-500",
  award_show: "bg-yellow-500",
  other: "bg-gray-500"
};
const EVENT_TYPE_LABELS: Record<string, string> = {
  birthday: "Birthday",
  comeback: "Comeback",
  concert: "Concert",
  fanmeeting: "Fan Meeting",
  variety_appearance: "Variety Show",
  award_show: "Award Show",
  other: "Event"
};
const Calendar = () => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [activeShadowIndex, setActiveShadowIndex] = useState<number>(0);

  // 그림자 순환 효과
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveShadowIndex((prev) => (prev + 1) % 3);
    }, 2000); // 2초마다 변경

    return () => clearInterval(interval);
  }, []);

  // 캘린더 이벤트 가져오기 (calendar_events + wiki_entries 생일 정보)
  const {
    data: events = [],
    isLoading
  } = useQuery({
    queryKey: ['calendar-events', currentMonth],
    queryFn: async () => {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const currentYear = currentMonth.getFullYear();
      
      // 1. calendar_events에서 기존 이벤트 가져오기 (birthday 제외)
      const { data: calendarEvents, error: calendarError } = await supabase
        .from('calendar_events')
        .select(`
          *,
          wiki_entries:wiki_entry_id (
            id,
            title,
            slug,
            schema_type,
            image_url
          )
        `)
        .neq('event_type', 'birthday')
        .gte('event_date', format(start, 'yyyy-MM-dd'))
        .lte('event_date', format(end, 'yyyy-MM-dd'))
        .order('event_date', { ascending: true });
      
      if (calendarError) throw calendarError;
      
      // 2. wiki_entries에서 생일 정보 가져오기
      const { data: wikiEntries, error: wikiError } = await supabase
        .from('wiki_entries')
        .select('id, title, slug, schema_type, image_url, metadata')
        .in('schema_type', ['actor', 'member'])
        .not('metadata->birthday', 'is', null);
      
      if (wikiError) throw wikiError;
      
      // 3. wiki_entries의 생일을 이벤트 형식으로 변환 (현재 월의 생일만)
      const birthdayEvents = (wikiEntries || [])
        .filter(entry => {
          const metadata = entry.metadata as Record<string, any> | null;
          const birthday = metadata?.birthday;
          if (!birthday || typeof birthday !== 'string') return false;
          
          try {
            const birthDate = new Date(birthday);
            const birthMonth = birthDate.getMonth();
            const currentMonthNum = currentMonth.getMonth();
            return birthMonth === currentMonthNum;
          } catch {
            return false;
          }
        })
        .map(entry => {
          const metadata = entry.metadata as Record<string, any>;
          const birthday = metadata.birthday as string;
          const birthDate = new Date(birthday);
          const month = birthDate.getMonth() + 1;
          const day = birthDate.getDate();
          
          return {
            id: `birthday-${entry.id}`,
            title: `${entry.title}'s Birthday`,
            description: `Birthday of ${entry.title}`,
            event_date: `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            event_type: 'birthday' as const,
            wiki_entry_id: entry.id,
            creator_id: '',
            created_at: '',
            updated_at: '',
            is_recurring: true,
            metadata: { birth_date: birthday },
            wiki_entries: {
              id: entry.id,
              title: entry.title,
              slug: entry.slug,
              schema_type: entry.schema_type,
              image_url: entry.image_url
            }
          };
        });
      
      // 4. calendar_events와 생일 이벤트 합치기
      const allEvents = [...(calendarEvents || []), ...birthdayEvents];
      
      // 5. 날짜순 정렬
      allEvents.sort((a, b) => 
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
      );
      
      return allEvents;
    }
  });

  // 선택된 날짜의 이벤트
  const eventsOnSelectedDate = events.filter(event => isSameDay(new Date(event.event_date), selectedDate));

  // 오늘의 퀘스트 가져오기
  const {
    data: todayQuests = []
  } = useQuery({
    queryKey: ['today-quests'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const {
        data,
        error
      } = await supabase.from('quests').select('*').eq('is_active', true).or(`start_date.is.null,start_date.lte.${today}`).or(`end_date.is.null,end_date.gte.${today}`);
      if (error) throw error;
      return data || [];
    }
  });

  // D-Day 계산
  const calculateDDay = (eventDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const event = new Date(eventDate);
    event.setHours(0, 0, 0, 0);
    const diff = Math.ceil((event.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "D-DAY";
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  };

  // HTML 태그 제거 함수
  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };
  return <>
      <Helmet>
        <title>Fanz Calendar - KTRENDZ</title>
        <meta name="description" content="Track K-pop events, birthdays, comebacks, and more" />
      </Helmet>
      
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        
        <main className="flex-1 max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">Fanz Calendar</h1>
              
            </div>
            {user && <Button onClick={() => navigate('/calendar/create')} className="rounded-full gap-2">
                <Plus className="w-4 h-4" />
                Add Event
              </Button>}
          </div>

          {/* Featured Upcoming Events - Top 3 */}
          {events.filter(event => {
            const eventDate = new Date(event.event_date);
            const today = new Date();
            return eventDate >= today;
          }).slice(0, 3).length > 0 && (
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {events.filter(event => {
                  const eventDate = new Date(event.event_date);
                  const today = new Date();
                  return eventDate >= today;
                }).slice(0, 3).map((event, index) => (
                  <Card 
                    key={event.id} 
                    className={`group hover:shadow-xl transition-all duration-1000 cursor-pointer border-white/10 bg-transparent animate-fade-in ${
                      index === activeShadowIndex ? 'shadow-2xl shadow-gray-500/30' : ''
                    }`}
                    style={{ animationDelay: `${index * 200}ms` }}
                    onClick={() => navigate(`/event/${event.id}`)}
                  >
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      {/* Profile Image */}
                      <div className="relative mb-4">
                        {event.wiki_entries?.image_url ? (
                          <div className="relative">
                            <img 
                              src={event.wiki_entries.image_url} 
                              alt={event.wiki_entries.title}
                              className="w-32 h-32 rounded-full object-cover transition-all shadow-lg"
                            />
                            <div className={`absolute -top-2 -right-2 ${EVENT_TYPE_COLORS[event.event_type]} text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg`}>
                              {calculateDDay(event.event_date)}
                            </div>
                          </div>
                        ) : (
                          <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/30">
                            <CalendarIcon className="w-16 h-16 text-primary/50" />
                          </div>
                        )}
                      </div>

                      {/* Event Info */}
                      <Badge 
                        variant="outline" 
                        className={`mb-2 rounded-full ${EVENT_TYPE_COLORS[event.event_type]} text-white border-none`}
                      >
                        {EVENT_TYPE_LABELS[event.event_type]}
                      </Badge>
                      
                      <h3 className="text-lg font-bold mb-1 line-clamp-2">
                        {event.title}
                      </h3>
                      
                      {event.wiki_entries && (
                        <p className="text-sm text-primary font-medium mb-2">
                          {event.wiki_entries.title}
                        </p>
                      )}
                      
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(event.event_date), 'MMM dd, yyyy')}
                      </p>
                      
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {stripHtml(event.description)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Today's Quests */}
          {todayQuests.length > 0 && <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  Today's Quests
                </CardTitle>
                <CardDescription>
                  Complete these quests to earn points
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {todayQuests.map(quest => <div key={quest.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                    <div>
                      <p className="font-medium">{quest.title}</p>
                      <p className="text-sm text-muted-foreground">{quest.description}</p>
                    </div>
                    <Badge variant="secondary" className="rounded-full">
                      +{quest.points_reward} Points
                    </Badge>
                  </div>)}
              </CardContent>
            </Card>}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <Card className="lg:col-span-2 relative">
              <Button 
                variant="outline" 
                size="sm"
                className="absolute top-4 right-4 text-xs z-10"
                onClick={() => {
                  const today = new Date();
                  setCurrentMonth(today);
                  setSelectedDate(today);
                }}
              >
                Today
              </Button>
              <CardContent className="pt-16">
                <CalendarUI mode="single" selected={selectedDate} onSelect={date => date && setSelectedDate(date)} month={currentMonth} onMonthChange={setCurrentMonth} className="pointer-events-auto w-full" modifiers={{
                hasEvent: events.map(e => new Date(e.event_date))
              }} modifiersClassNames={{
                hasEvent: "bg-primary/10 font-bold"
              }} />
              </CardContent>
            </Card>

            {/* Events List */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {format(selectedDate, 'MMM dd, yyyy')}
                </CardTitle>
                <CardDescription>
                  {eventsOnSelectedDate.length} event(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-48 h-3 bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 rounded-full animate-rainbow-flow bg-[length:200%_100%]"></div>
                    <div className="text-center mt-3 text-xs text-muted-foreground">
                      Loading...
                    </div>
                  </div>
                ) : eventsOnSelectedDate.length === 0 ? <p className="text-sm text-muted-foreground">No events on this date</p> : eventsOnSelectedDate.map(event => <div key={event.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/event/${event.id}`)}>
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${EVENT_TYPE_COLORS[event.event_type]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium truncate">{event.title}</p>
                            <Badge variant="outline" className="rounded-full text-xs shrink-0">
                              {calculateDDay(event.event_date)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {EVENT_TYPE_LABELS[event.event_type]}
                          </p>
                          {event.description && <p className="text-sm text-muted-foreground line-clamp-2">
                              {stripHtml(event.description)}
                            </p>}
                          {event.wiki_entries && <div className="mt-2 flex items-center gap-2">
                              {event.wiki_entries.image_url && <img src={event.wiki_entries.image_url} alt={event.wiki_entries.title} className="w-8 h-8 rounded object-cover" />}
                              <span className="text-xs text-primary font-medium">
                                {event.wiki_entries.title}
                              </span>
                            </div>}
                        </div>
                      </div>
                    </div>)}
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Events */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
              <CardDescription>Events in the next 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.filter(event => {
                const eventDate = new Date(event.event_date);
                const today = new Date();
                const thirtyDaysLater = new Date(today);
                thirtyDaysLater.setDate(today.getDate() + 30);
                return eventDate >= today && eventDate <= thirtyDaysLater;
              }).slice(0, 6).map(event => <div key={event.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/event/${event.id}`)}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${EVENT_TYPE_COLORS[event.event_type]}`} />
                        <Badge variant="outline" className="rounded-full text-xs">
                          {calculateDDay(event.event_date)}
                        </Badge>
                      </div>
                      <h3 className="font-semibold mb-1">{event.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {format(new Date(event.event_date), 'MMM dd, yyyy')}
                      </p>
                      {event.wiki_entries && <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          {event.wiki_entries.image_url && <img src={event.wiki_entries.image_url} alt={event.wiki_entries.title} className="w-6 h-6 rounded object-cover" />}
                          <span className="text-xs text-primary font-medium">
                            {event.wiki_entries.title}
                          </span>
                        </div>}
                    </div>)}
              </div>
            </CardContent>
          </Card>
        </main>

        <Footer />
      </div>
    </>;
};
export default Calendar;