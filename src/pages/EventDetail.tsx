import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, ArrowLeft, ExternalLink } from "lucide-react";
import { format } from "date-fns";

// 이벤트 타입별 색상 정의
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

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // 이벤트 데이터 가져오기
  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      // birthday 이벤트 처리 (birthday-{wiki_id} 형식)
      if (id?.startsWith('birthday-')) {
        const wikiId = id.replace('birthday-', '');
        const { data: wikiEntry, error } = await supabase
          .from('wiki_entries')
          .select('id, title, slug, schema_type, image_url, metadata')
          .eq('id', wikiId)
          .single();

        if (error) throw error;

        const metadata = wikiEntry.metadata as Record<string, any> | null;
        const birthday = metadata?.birthday;
        
        if (!birthday) throw new Error('Birthday not found');

        const birthDate = new Date(birthday);
        const currentYear = new Date().getFullYear();
        const month = birthDate.getMonth() + 1;
        const day = birthDate.getDate();

        return {
          id,
          title: `${wikiEntry.title}'s Birthday`,
          description: `Birthday of ${wikiEntry.title}`,
          event_date: `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          event_type: 'birthday' as const,
          wiki_entry_id: wikiEntry.id,
          is_recurring: true,
          metadata: { birth_date: birthday },
          wiki_entries: {
            id: wikiEntry.id,
            title: wikiEntry.title,
            slug: wikiEntry.slug,
            schema_type: wikiEntry.schema_type,
            image_url: wikiEntry.image_url
          }
        };
      }

      // 일반 calendar_events에서 가져오기
      const { data, error } = await supabase
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
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id
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

  // Event Schema JSON-LD 생성
  const generateEventSchema = () => {
    if (!event) return null;

    const metadata = event.metadata as Record<string, any> | null;
    const eventDate = new Date(event.event_date);

    return {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": event.title,
      "description": event.description || `${EVENT_TYPE_LABELS[event.event_type]} event`,
      "startDate": event.event_date,
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": metadata?.location ? "https://schema.org/OfflineEventAttendanceMode" : "https://schema.org/OnlineEventAttendanceMode",
      ...(metadata?.location && {
        "location": {
          "@type": "Place",
          "name": metadata.location,
          "address": metadata.location
        }
      }),
      ...(metadata?.time && {
        "startDate": `${event.event_date}T${metadata.time}:00`
      }),
      ...(event.wiki_entries && {
        "performer": {
          "@type": "Person",
          "name": event.wiki_entries.title,
          ...(event.wiki_entries.image_url && {
            "image": event.wiki_entries.image_url
          })
        }
      }),
      "image": event.wiki_entries?.image_url || "https://k-trendz.com/placeholder.svg",
      "url": `https://k-trendz.com/event/${event.id}`
    };
  };

  if (isLoading) {
    return (
      <V2Layout pcHeaderTitle="Event" showBackButton={true}>
        <div className={`${isMobile ? 'pt-16' : ''} min-h-screen flex items-center justify-center`}>
          <p className="text-muted-foreground">Loading event...</p>
        </div>
      </V2Layout>
    );
  }

  if (!event) {
    return (
      <V2Layout pcHeaderTitle="Event" showBackButton={true}>
        <div className={`${isMobile ? 'pt-16' : ''} min-h-screen flex flex-col items-center justify-center`}>
          <h1 className="text-2xl font-bold mb-4">Event Not Found</h1>
          <Button onClick={() => navigate('/calendar')} className="rounded-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Calendar
          </Button>
        </div>
      </V2Layout>
    );
  }

  const metadata = event.metadata as Record<string, any> | null;
  const eventSchema = generateEventSchema();

  return (
    <>
      <Helmet>
        <title>{event.title} - KTRENDZ Calendar</title>
        <meta name="description" content={event.description || `${EVENT_TYPE_LABELS[event.event_type]} event on ${format(new Date(event.event_date), 'MMMM dd, yyyy')}`} />
        <meta property="og:title" content={event.title} />
        <meta property="og:description" content={event.description || `${EVENT_TYPE_LABELS[event.event_type]} event`} />
        {event.wiki_entries?.image_url && (
          <meta property="og:image" content={event.wiki_entries.image_url} />
        )}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://k-trendz.com/event/${event.id}`} />
        
        {/* Event Schema JSON-LD */}
        {eventSchema && (
          <script type="application/ld+json">
            {JSON.stringify(eventSchema)}
          </script>
        )}
      </Helmet>

      <V2Layout pcHeaderTitle={event.title} showBackButton={true}>
        <div className={`${isMobile ? 'pt-16 px-3' : ''} py-4`}>

          <Card className="overflow-hidden">
            {/* 이벤트 헤더 */}
            <div className="relative h-64 bg-gradient-to-br from-primary/20 to-primary/5">
              {event.wiki_entries?.image_url && (
                <img 
                  src={event.wiki_entries.image_url}
                  alt={event.wiki_entries.title}
                  className="w-full h-full object-cover opacity-30"
                />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <Badge 
                  variant="outline" 
                  className={`mb-4 rounded-full ${EVENT_TYPE_COLORS[event.event_type]} text-white border-none text-sm px-4 py-1`}
                >
                  {EVENT_TYPE_LABELS[event.event_type]}
                </Badge>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">{event.title}</h1>
                <div className="flex items-center gap-2 text-lg">
                  <Calendar className="w-5 h-5" />
                  <span>{format(new Date(event.event_date), 'MMMM dd, yyyy')}</span>
                  <Badge variant="secondary" className="rounded-full ml-2">
                    {calculateDDay(event.event_date)}
                  </Badge>
                </div>
              </div>
            </div>

            <CardContent className="p-6 md:p-8 space-y-6">
              {/* 이벤트 상세 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 날짜/시간 정보 */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-muted-foreground">Date</p>
                      <p className="font-semibold">{format(new Date(event.event_date), 'EEEE, MMMM dd, yyyy')}</p>
                    </div>
                  </div>

                  {metadata?.time && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm text-muted-foreground">Time</p>
                        <p className="font-semibold">{metadata.time}</p>
                      </div>
                    </div>
                  )}

                  {metadata?.location && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm text-muted-foreground">Location</p>
                        <p className="font-semibold">{metadata.location}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 관련 위키 항목 */}
                {event.wiki_entries && (
                  <Card className="bg-muted/30 border-primary/20">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground mb-3">Related Artist</p>
                      <div 
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => navigate(`/k/${event.wiki_entries.slug}`)}
                      >
                        {event.wiki_entries.image_url && (
                          <img 
                            src={event.wiki_entries.image_url}
                            alt={event.wiki_entries.title}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-semibold">{event.wiki_entries.title}</p>
                          <Button 
                            variant="link" 
                            className="h-auto p-0 text-primary text-sm rounded-full"
                          >
                            View Profile
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* 설명 */}
              {event.description && (
                <div className="pt-6 border-t">
                  <h2 className="text-lg font-semibold mb-3">About This Event</h2>
                  <p className="text-muted-foreground leading-relaxed">{event.description}</p>
                </div>
              )}

              {/* 관련 포스트 링크 */}
              {metadata?.post_id && (
                <div className="pt-6 border-t">
                  <Button 
                    onClick={() => navigate(`/post/${metadata.post_id}`)}
                    className="rounded-full gap-2 w-full md:w-auto"
                  >
                    View Related Post
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </V2Layout>
    </>
  );
};

export default EventDetail;
