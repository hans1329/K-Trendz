import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Naver Image Search helper function
async function searchNaverImage(query: string, clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodedQuery}&display=1&sort=sim`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );

    if (!response.ok) {
      console.error(`Naver Image Search failed for "${query}":`, response.status);
      return null;
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].link;
    }
    return null;
  } catch (error) {
    console.error(`Error searching image for "${query}":`, error);
    return null;
  }
}

// This function has been removed - storing external URLs directly to avoid DNS issues

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const naverClientId = Deno.env.get('NAVER_CLIENT_ID');
    const naverClientSecret = Deno.env.get('NAVER_CLIENT_SECRET');
    
    if (!naverClientId || !naverClientSecret) {
      throw new Error('NAVER_CLIENT_ID or NAVER_CLIENT_SECRET is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all wiki entries without images (actors, members, artists)
    // Process in small batches to avoid timeouts
    const { data: entriesWithoutImages, error: fetchError } = await supabase
      .from('wiki_entries')
      .select('id, title, schema_type, metadata')
      .in('schema_type', ['actor', 'member', 'artist'])
      .is('image_url', null)
      .limit(10); // Process 10 entries per batch

    if (fetchError) {
      console.error('Error fetching entries:', fetchError);
      throw fetchError;
    }

    if (!entriesWithoutImages || entriesWithoutImages.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No entries without images found',
        total: 0,
        updated: 0,
        failed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${entriesWithoutImages.length} entries without images`);

    const results = {
      total: entriesWithoutImages.length,
      updated: 0,
      failed: 0,
      details: [] as any[]
    };

    for (const entry of entriesWithoutImages) {
      try {
        console.log(`Processing ${entry.schema_type}: ${entry.title}`);

        // Build search query based on schema type
        let searchQuery = entry.title;
        if (entry.schema_type === 'member') {
          const groupName = entry.metadata?.group_name;
          searchQuery = groupName 
            ? `${entry.title} ${groupName} kpop`
            : `${entry.title} kpop`;
        } else if (entry.schema_type === 'artist') {
          searchQuery = `${entry.title} kpop group`;
        } else if (entry.schema_type === 'actor') {
          searchQuery = `${entry.title} actor`;
        }

        // Search for image
        const externalImageUrl = await searchNaverImage(
          searchQuery,
          naverClientId,
          naverClientSecret
        );

        if (externalImageUrl) {
          console.log(`Found image for ${entry.title}: ${externalImageUrl}`);
          
          // Update wiki entry with external URL directly (no download to avoid DNS issues)
          const { error: updateError } = await supabase
            .from('wiki_entries')
            .update({ image_url: externalImageUrl })
            .eq('id', entry.id);

          if (updateError) {
            console.error(`Failed to update ${entry.title}:`, updateError);
            results.failed++;
            results.details.push({
              title: entry.title,
              status: 'failed',
              error: updateError.message
            });
          } else {
            console.log(`Successfully updated ${entry.title} with external image URL`);
            results.updated++;
            results.details.push({
              title: entry.title,
              status: 'updated',
              imageUrl: externalImageUrl
            });
          }
        } else {
          console.log(`No image found for ${entry.title}`);
          results.failed++;
          results.details.push({
            title: entry.title,
            status: 'no_image_found'
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Error processing ${entry.title}:`, error);
        results.failed++;
        results.details.push({
          title: entry.title,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('Fetch missing images completed:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-missing-images function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
