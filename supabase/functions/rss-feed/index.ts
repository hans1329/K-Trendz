import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const feedType = url.searchParams.get("type") || "all"; // all, wiki, posts, artist
    const artistId = url.searchParams.get("artist"); // artist ID for artist-specific feed
    const artistName = url.searchParams.get("name"); // artist name for filtering

    let items: any[] = [];
    let artistInfo: any = null;

    // Artist-specific feed
    if (feedType === "artist" || artistId || artistName) {
      let artistQuery = supabase
        .from("wiki_entries")
        .select("id, title, content, created_at, updated_at, schema_type, image_url");

      if (artistId) {
        artistQuery = artistQuery.eq("id", artistId);
      } else if (artistName) {
        artistQuery = artistQuery.ilike("title", `%${artistName}%`);
      }

      const { data: artistEntries } = await artistQuery
        .in("schema_type", ["artist", "member", "group"])
        .limit(1);

      if (artistEntries && artistEntries.length > 0) {
        artistInfo = artistEntries[0];
        
        // Get posts mentioning this artist
        const { data: posts } = await supabase
          .from("posts")
          .select("id, title, content, created_at, category, image_url")
          .eq("is_approved", true)
          .or(`title.ilike.%${artistInfo.title}%,content.ilike.%${artistInfo.title}%`)
          .order("created_at", { ascending: false })
          .limit(50);

        if (posts) {
          items.push(...posts.map(post => ({
            type: "post",
            id: post.id,
            title: post.title,
            description: post.content.substring(0, 300) + "...",
            link: `https://ktrendz.xyz/posts/${post.id}`,
            pubDate: new Date(post.created_at),
            category: post.category || "News",
            image: post.image_url,
          })));
        }

        // Include the artist wiki entry itself
        items.push({
          type: "wiki",
          id: artistInfo.id,
          title: artistInfo.title,
          description: artistInfo.content.substring(0, 300) + "...",
          link: `https://k-trendz.com/w/${artistInfo.id}`,
          pubDate: new Date(artistInfo.updated_at || artistInfo.created_at),
          category: artistInfo.schema_type,
          image: artistInfo.image_url,
        });
      }
    } else {
      // Wiki entries
      if (feedType === "all" || feedType === "wiki") {
        const { data: wikiEntries } = await supabase
          .from("wiki_entries")
          .select("id, title, content, created_at, updated_at, schema_type, image_url")
          .order("created_at", { ascending: false })
          .limit(50);

        if (wikiEntries) {
          items.push(...wikiEntries.map(entry => ({
            type: "wiki",
            id: entry.id,
            title: entry.title,
            description: entry.content.substring(0, 300) + "...",
            link: `https://k-trendz.com/w/${entry.id}`,
            pubDate: new Date(entry.updated_at || entry.created_at),
            category: entry.schema_type,
            image: entry.image_url,
          })));
        }
      }

      // Posts
      if (feedType === "all" || feedType === "posts") {
        const { data: posts } = await supabase
          .from("posts")
          .select("id, title, content, created_at, category, image_url")
          .eq("is_approved", true)
          .order("created_at", { ascending: false })
          .limit(50);

        if (posts) {
          items.push(...posts.map(post => ({
            type: "post",
            id: post.id,
            title: post.title,
            description: post.content.substring(0, 300) + "...",
            link: `https://ktrendz.xyz/posts/${post.id}`,
            pubDate: new Date(post.created_at),
            category: post.category || "News",
            image: post.image_url,
          })));
        }
      }
    }

    // Sort by date
    items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

    // Generate RSS XML
    const rssXml = generateRSS(items, feedType, artistInfo);

    return new Response(rssXml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/rss+xml; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("Error generating RSS feed:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

function generateRSS(items: any[], feedType: string, artistInfo?: any): string {
  const now = new Date().toUTCString();
  
  let feedTitle: string;
  let feedDescription: string;

  if (artistInfo) {
    feedTitle = `${artistInfo.title} - KTrendz Updates`;
    feedDescription = `Latest news and updates about ${artistInfo.title} on KTrendz`;
  } else {
    feedTitle = feedType === "wiki" 
      ? "KTrendz Wiki Updates"
      : feedType === "posts"
      ? "KTrendz News"
      : "KTrendz - All Updates";
    
    feedDescription = feedType === "wiki"
      ? "Latest updates to KTrendz Wiki - Your source for K-pop, K-drama, and Korean entertainment"
      : feedType === "posts"
      ? "Latest K-pop and Korean entertainment news from KTrendz"
      : "Latest content from KTrendz - Wiki updates and news";
  }

  const itemsXml = items.map(item => {
    const cleanDescription = escapeXml(item.description);
    const cleanTitle = escapeXml(item.title);
    const imageTag = item.image 
      ? `<media:content url="${escapeXml(item.image)}" medium="image" />`
      : "";

    return `
    <item>
      <title>${cleanTitle}</title>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.link}</guid>
      <description>${cleanDescription}</description>
      <pubDate>${item.pubDate.toUTCString()}</pubDate>
      <category>${escapeXml(item.category)}</category>
      ${imageTag}
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${feedTitle}</title>
    <link>https://ktrendz.xyz</link>
    <description>${feedDescription}</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="https://ktrendz.xyz/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>https://ktrendz.xyz/logo.png</url>
      <title>${feedTitle}</title>
      <link>https://ktrendz.xyz</link>
    </image>
    ${itemsXml}
  </channel>
</rss>`;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
