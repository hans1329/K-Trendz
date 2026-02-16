import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface YouTubeVideoResponse {
  items?: Array<{
    id: string;
    statistics: {
      viewCount: string;
      likeCount?: string;
      commentCount?: string;
    };
    snippet?: {
      title: string;
      channelTitle: string;
      publishedAt: string;
      thumbnails?: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
    };
  }>;
  error?: {
    code: number;
    message: string;
  };
}

// YouTube URL에서 video ID 추출
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // video ID만 전달된 경우
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    if (!YOUTUBE_API_KEY) {
      console.error('YOUTUBE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'YouTube API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { videoUrl, videoId: directVideoId } = await req.json();
    
    // URL 또는 직접 전달된 videoId에서 ID 추출
    const videoId = directVideoId || extractVideoId(videoUrl || '');
    
    if (!videoId) {
      console.error('Invalid video URL or ID:', videoUrl || directVideoId);
      return new Response(
        JSON.stringify({ error: 'Invalid YouTube video URL or ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching YouTube data for video: ${videoId}`);

    // YouTube Data API v3 호출
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
    
    const response = await fetch(apiUrl);
    const data: YouTubeVideoResponse = await response.json();

    if (data.error) {
      console.error('YouTube API error:', data.error);
      return new Response(
        JSON.stringify({ error: data.error.message }),
        { status: data.error.code, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data.items || data.items.length === 0) {
      console.error('Video not found:', videoId);
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const video = data.items[0];
    const result = {
      videoId: video.id,
      viewCount: parseInt(video.statistics.viewCount, 10),
      likeCount: video.statistics.likeCount ? parseInt(video.statistics.likeCount, 10) : null,
      commentCount: video.statistics.commentCount ? parseInt(video.statistics.commentCount, 10) : null,
      title: video.snippet?.title || null,
      channelTitle: video.snippet?.channelTitle || null,
      publishedAt: video.snippet?.publishedAt || null,
      thumbnail: video.snippet?.thumbnails?.high?.url || 
                 video.snippet?.thumbnails?.medium?.url || 
                 video.snippet?.thumbnails?.default?.url || null,
      fetchedAt: new Date().toISOString(),
    };

    console.log(`Successfully fetched: ${result.title} - ${result.viewCount.toLocaleString()} views`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching YouTube data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch YouTube data';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
