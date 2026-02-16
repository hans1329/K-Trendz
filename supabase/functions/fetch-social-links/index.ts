import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Background task to fetch social links
async function fetchSocialLinksInBackground(
  supabaseUrl: string,
  supabaseKey: string,
  missingOnly: boolean = false,
  entryIds: string[] = []
) {
  const supabaseClient = createClient(supabaseUrl, supabaseKey);
  
  console.log(`[BACKGROUND] Starting fetch-social-links processing (missingOnly: ${missingOnly}, specific IDs: ${entryIds.length})`);

  let updatedCount = 0;
  let totalProcessed = 0;
  const BATCH_SIZE = 5;
  const DB_CHUNK_SIZE = 500;
  let lastId: string | null = null;
  let hasMore = true;

  // Process in chunks using cursor-based pagination
  while (hasMore) {
    // Get entries - either specific IDs or chunks based on filters
    let query = supabaseClient
      .from('wiki_entries')
      .select('id, title, schema_type, metadata')
      .in('schema_type', ['artist', 'member', 'actor'])
      .order('id', { ascending: true })
      .limit(DB_CHUNK_SIZE);

    // If specific entry IDs provided, use them (no pagination)
    if (entryIds.length > 0) {
      query = query.in('id', entryIds);
      hasMore = false;
    } else {
      // Use cursor-based pagination
      if (lastId) {
        query = query.gt('id', lastId);
      }
      
      // If missingOnly, filter out entries that already have social_links
      if (missingOnly) {
        query = query.is('metadata->social_links', null);
      }
    }

    const { data: entries, error: fetchError } = await query;

    if (fetchError) {
      console.error('[BACKGROUND] Failed to fetch entries:', fetchError);
      hasMore = false;
      continue;
    }

    // If no entries returned, we're done
    if (!entries || entries.length === 0) {
      hasMore = false;
      break;
    }

    const entriesToProcess = entryIds.length > 0 ? entries : entries;

    // Update lastId for cursor-based pagination
    if (entries.length > 0) {
      lastId = entries[entries.length - 1].id;
    }

    console.log(`[BACKGROUND] Processing chunk: ${entriesToProcess.length} entries (lastId: ${lastId?.substring(0, 8)}...)`);

    // Process entries in batches
    for (let i = 0; i < entriesToProcess.length; i += BATCH_SIZE) {
      const batch = entriesToProcess.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (entry) => {
        try {
          console.log(`[BACKGROUND] Fetching social links for: ${entry.title}`);
            
            // Use Namuwiki Mirror API to get raw text
            const namuwikiApiUrl = `https://namu.wiki/api/raw/${encodeURIComponent(entry.title)}`;
            let socialLinks: any = {};
            
            try {
              console.log(`[BACKGROUND] Fetching from Namuwiki API: ${namuwikiApiUrl}`);
              const namuwikiResponse = await fetch(namuwikiApiUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              });
              
              console.log(`[BACKGROUND] Namuwiki API response status: ${namuwikiResponse.status} for ${entry.title}`);
              
              if (namuwikiResponse.ok) {
                const rawText = await namuwikiResponse.text();
                console.log(`[BACKGROUND] Got raw text for ${entry.title}, length: ${rawText.length}, first 200 chars: ${rawText.substring(0, 200)}`);
                
                if (rawText && rawText.length > 0) {
                  // Namuwiki raw text contains markup - extract URLs from it
                  const bodyText = rawText;
                  
                  // Instagram - more flexible patterns
                  if (!socialLinks.instagram) {
                    const igPatterns = [
                      /instagram\.com\/([a-zA-Z0-9._]+)/gi,
                      /www\.instagram\.com\/([a-zA-Z0-9._]+)/gi,
                      /@([a-zA-Z0-9._]+).*instagram/gi
                    ];
                    
                    for (const pattern of igPatterns) {
                      const matches = bodyText.matchAll(pattern);
                      for (const match of matches) {
                        const username = match[1];
                        if (username && username.length > 0 && username !== 'p' && username !== 'reel' && username !== 'stories') {
                          socialLinks.instagram = {
                            url: `https://instagram.com/${username}`,
                            verified: true
                          };
                          break;
                        }
                      }
                      if (socialLinks.instagram) break;
                    }
                  }
                  
                  // Twitter/X - more flexible patterns
                  if (!socialLinks.twitter) {
                    const twitterPatterns = [
                      /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/gi,
                      /www\.(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/gi
                    ];
                    
                    for (const pattern of twitterPatterns) {
                      const matches = bodyText.matchAll(pattern);
                      for (const match of matches) {
                        const username = match[1];
                        if (username && username !== 'share' && username !== 'intent' && username !== 'i') {
                          socialLinks.twitter = {
                            url: `https://twitter.com/${username}`,
                            verified: true
                          };
                          break;
                        }
                      }
                      if (socialLinks.twitter) break;
                    }
                  }
                  
                  // YouTube - more flexible patterns
                  if (!socialLinks.youtube) {
                    const ytPatterns = [
                      /youtube\.com\/([@c]|channel\/)([^\/\?\s"'<>]+)/gi,
                      /www\.youtube\.com\/([@c]|channel\/)([^\/\?\s"'<>]+)/gi,
                      /youtu\.be\/([^\/\?\s"'<>]+)/gi
                    ];
                    
                    for (const pattern of ytPatterns) {
                      const matches = bodyText.matchAll(pattern);
                      for (const match of matches) {
                        if (match[2]) {
                          const channelId = `${match[1]}${match[2]}`;
                          socialLinks.youtube = {
                            url: `https://youtube.com/${channelId}`,
                            verified: true
                          };
                          break;
                        } else if (match[1]) {
                          socialLinks.youtube = {
                            url: `https://youtube.com/watch?v=${match[1]}`,
                            verified: true
                          };
                          break;
                        }
                      }
                      if (socialLinks.youtube) break;
                    }
                  }
                  
                  // TikTok - more flexible patterns
                  if (!socialLinks.tiktok) {
                    const ttPatterns = [
                      /tiktok\.com\/@([a-zA-Z0-9._]+)/gi,
                      /www\.tiktok\.com\/@([a-zA-Z0-9._]+)/gi
                    ];
                    
                    for (const pattern of ttPatterns) {
                      const matches = bodyText.matchAll(pattern);
                      for (const match of matches) {
                        const username = match[1];
                        if (username) {
                          socialLinks.tiktok = {
                            url: `https://tiktok.com/@${username}`,
                            verified: true
                          };
                          break;
                        }
                      }
                      if (socialLinks.tiktok) break;
                    }
                  }
                  
          console.log(`[BACKGROUND] Found social links from Namuwiki for ${entry.title}:`, Object.keys(socialLinks));
        }
      }
    } catch (namuwikiError) {
      console.log(`[BACKGROUND] Namuwiki fetch failed for ${entry.title}, skipping`);
    }
    
    // Only update if we found at least one social link
    if (Object.keys(socialLinks).length > 0) {
      const updatedMetadata = {
        ...(entry.metadata || {}),
        social_links: socialLinks
      };

      const { error: updateError } = await supabaseClient
        .from('wiki_entries')
        .update({ metadata: updatedMetadata })
        .eq('id', entry.id);

      if (updateError) {
        console.error(`[BACKGROUND] Failed to update ${entry.title}:`, updateError);
        return false;
      }

      console.log(`[BACKGROUND] Updated social links for: ${entry.title}`);
      return true;
    } else {
      console.log(`[BACKGROUND] No social links found for: ${entry.title}`);
      return false;
    }

  } catch (error) {
    console.error(`[BACKGROUND] Error processing ${entry.title}:`, error);
    return false;
  }
});

      // Wait for batch to complete
      const results = await Promise.allSettled(batchPromises);
      updatedCount += results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      
      console.log(`[BACKGROUND] Batch ${Math.floor(i / BATCH_SIZE) + 1} completed. Updated: ${updatedCount}`);

      // Rate limiting between batches
      if (i + BATCH_SIZE < entriesToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    totalProcessed += entriesToProcess.length;

    // If we got less than DB_CHUNK_SIZE entries and not using specific IDs, we're done
    if (entryIds.length === 0 && entries.length < DB_CHUNK_SIZE) {
      hasMore = false;
    }

    // Rate limiting between DB chunks
    if (hasMore) {
      console.log(`[BACKGROUND] Completed chunk. Moving to next ${DB_CHUNK_SIZE} entries...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`[BACKGROUND] Social links fetch completed: ${updatedCount} updated out of ${totalProcessed} total`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { missingOnly = false, entryIds = [] } = await req.json().catch(() => ({ missingOnly: false, entryIds: [] }));
    
    console.log(`fetch-social-links invoked with:`, { 
      missingOnly, 
      entryIds: entryIds.length > 0 ? `${entryIds.length} IDs` : 'none'
    });
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Count entries to process
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    
    let countQuery = supabaseClient
      .from('wiki_entries')
      .select('id', { count: 'exact', head: true })
      .in('schema_type', ['artist', 'member', 'actor']);

    if (entryIds.length > 0) {
      countQuery = countQuery.in('id', entryIds);
    } else if (missingOnly) {
      countQuery = countQuery.is('metadata->social_links', null);
    }

    const { count } = await countQuery;

    console.log(`Starting social links fetch for ${count || 0} entries`);

    // Start background task
    if (count && count > 0) {
      const backgroundTask = fetchSocialLinksInBackground(
        supabaseUrl,
        supabaseKey,
        missingOnly,
        entryIds
      );
      
      // Use waitUntil to keep function alive
      // @ts-ignore
      if (typeof globalThis.EdgeRuntime !== 'undefined') {
        // @ts-ignore
        globalThis.EdgeRuntime.waitUntil(backgroundTask);
      } else {
        backgroundTask.catch(err => console.error('[BACKGROUND] Task error:', err));
      }
    }

    // Return immediately
    return new Response(
      JSON.stringify({ 
        success: true, 
        pending_count: count || 0,
        message: count && count > 0 
          ? `Fetching social links for ${count} entries. This will take approximately ${Math.ceil(count / 5)} minutes.`
          : 'No entries to process.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-social-links function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
