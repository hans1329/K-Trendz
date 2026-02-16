import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { count, category, keyword, userId } = await req.json();
    
    const NAVER_CLIENT_ID = Deno.env.get('NAVER_CLIENT_ID');
    const NAVER_CLIENT_SECRET = Deno.env.get('NAVER_CLIENT_SECRET');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET || !OPENAI_API_KEY) {
      throw new Error('Required API keys not configured');
    }

    console.log(`Generating ${count} news posts for category: ${category}, keyword: ${keyword}`);

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // 1. Fetch news from Naver News API
    let searchQuery;
    
    if (keyword) {
      // If keyword is provided, use it
      searchQuery = keyword;
    } else {
      // Generate search query based on category (broader search terms)
      if (category.startsWith('Entertainment')) {
        searchQuery = '연예'; // Entertainment (broad)
      } else if (category === 'Culture-Travel') {
        searchQuery = '여행'; // Travel (broad)
      } else if (category === 'Culture-Food') {
        searchQuery = '음식'; // Food (broad)
      } else if (category === 'Culture-Fashion/Beauty') {
        searchQuery = '패션'; // Fashion/Beauty (broad)
      } else if (category === 'Culture-Events') {
        searchQuery = '축제'; // Events (broad)
      } else {
        // Culture-News or default
        searchQuery = '문화'; // Culture (broad)
      }
    }
    
    console.log(`Searching Naver News API with query: ${searchQuery}`);
    
    // Naver News API endpoint
    const naverApiUrl = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(searchQuery)}&display=${Math.min(count * 3, 100)}&sort=date`;
    
    console.log('Naver API URL:', naverApiUrl);
    console.log('Using Client ID:', NAVER_CLIENT_ID ? 'Present' : 'Missing');
    console.log('Using Client Secret:', NAVER_CLIENT_SECRET ? 'Present' : 'Missing');
    
    const newsResponse = await fetch(naverApiUrl, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      }
    });
    
    console.log('Naver API Response Status:', newsResponse.status);
    
    const newsData = await newsResponse.json();
    
    console.log('Naver API Full Response:', JSON.stringify(newsData, null, 2));
    console.log(`Naver API Response - Total results: ${newsData.total || 0}`);
    console.log(`Articles received: ${newsData.items?.length || 0}`);
    
    // Check for API errors
    if (newsData.errorMessage) {
      console.error('Naver API Error:', newsData.errorMessage);
      throw new Error(`Naver API Error: ${newsData.errorMessage}`);
    }
    
    if (!newsData.items || newsData.items.length === 0) {
      console.error('No items in response. Full response:', JSON.stringify(newsData));
      throw new Error(`No articles found. Try different keywords.`);
    }

    console.log(`Found ${newsData.items.length} articles`);

    // 2. Process each article - Naver returns items with title, originallink, description, pubDate
    const validArticles = newsData.items.filter((article: any) => 
      article.title && 
      article.description
    );

    console.log(`${validArticles.length} valid articles after filtering`);

    if (validArticles.length === 0) {
      throw new Error('No valid articles found after filtering');
    }

    // Get existing post URLs to avoid duplicates
    const { data: existingPosts } = await supabase
      .from('posts')
      .select('source_url')
      .not('source_url', 'is', null);
    
    const existingUrls = new Set(existingPosts?.map(p => p.source_url) || []);
    console.log(`Found ${existingUrls.size} existing posts to check for duplicates`);
    
    // Filter out articles that have already been posted
    const newArticles = validArticles.filter((article: any) => {
      const articleUrl = article.originallink || article.link;
      return !existingUrls.has(articleUrl);
    });
    
    console.log(`${newArticles.length} new articles after removing duplicates`);
    
    if (newArticles.length === 0) {
      throw new Error('All articles have already been posted. Try a different keyword or wait for new articles.');
    }

    const generatedPosts = [];
    
    for (const article of newArticles.slice(0, count)) {
      try {
        // Remove HTML tags from Naver API response
        const cleanTitle = article.title.replace(/<[^>]*>/g, '');
        const cleanDescription = article.description.replace(/<[^>]*>/g, '');
        const originalUrl = article.originallink || article.link;
        
        console.log(`Processing article: ${cleanTitle}`);
        console.log(`Original URL: ${originalUrl}`);
        
        // Extract metadata (including image) from original article
        let articleImage = null;
        try {
          const metadataResponse = await fetch(`${SUPABASE_URL}/functions/v1/extract-url-metadata`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ url: originalUrl })
          });
          
          if (metadataResponse.ok) {
            const metadata = await metadataResponse.json();
            articleImage = metadata.image;
            console.log(`Extracted image: ${articleImage}`);
          }
        } catch (metaError) {
          console.error('Error extracting metadata:', metaError);
        }
        
        // Naver News is always in Korean
        const isKorean = true;
        
        // Translate Korean news to English and auto-classify category using OpenAI
        const prompt = `You are a professional translator and news writer specializing in Korean culture and entertainment news.

Korean Article Information:
Title: ${cleanTitle}
Description: ${cleanDescription}

Task 1: Translate and rewrite this Korean news article into engaging English content.
- Translate the title to English, keep it concise and catchy (under 100 characters)
- Translate and rewrite the content in English (200-400 words)
- Maintain the original meaning and facts
- Make it engaging and informative for English readers
- Keep the tone professional yet accessible

Task 2: Classify this article into the most appropriate category:

Entertainment Categories:
- Entertainment-News: General K-pop/entertainment news, announcements, releases
- Entertainment-Rumors: Gossip, unconfirmed reports, speculation
- Entertainment-Discussions: Opinion pieces, analysis, commentary
- Entertainment-Dramas: K-drama news and updates
- Entertainment-Videos: Music videos, performance clips
- Entertainment-Photos: Photo shoots, event photos

Culture Categories:
- Culture-News: General Korean culture news
- Culture-Travel: Travel destinations, tourism in Korea
- Culture-Food: Korean cuisine, restaurants, food trends
- Culture-Fashion/Beauty: Korean fashion, beauty products, trends
- Culture-Events: Festivals, cultural events, exhibitions

Format your response as JSON:
{
  "title": "Your English title here",
  "content": "Your English content here",
  "category": "Selected category from above list"
}`;

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a professional news content writer specializing in Korean culture and entertainment.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
          }),
        });

        if (!openaiResponse.ok) {
          const errorData = await openaiResponse.text();
          console.error(`OpenAI API error for article "${cleanTitle}":`, openaiResponse.status, errorData);
          throw new Error(`Translation failed: OpenAI API returned ${openaiResponse.status}`);
        }

        const aiData = await openaiResponse.json();
        const aiContent = aiData.choices[0].message.content;
        
        // Parse AI response
        let parsedContent;
        try {
          parsedContent = JSON.parse(aiContent);
          
          // Validate that we got translated content
          if (!parsedContent.title || !parsedContent.content || !parsedContent.category) {
            console.error(`Invalid AI response for article "${cleanTitle}":`, parsedContent);
            throw new Error('AI response missing required fields (title, content, or category)');
          }
          
          // Check if content is still in Korean (basic check)
          const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(parsedContent.title + parsedContent.content);
          if (hasKorean) {
            console.warn(`Translation incomplete for article "${cleanTitle}" - Korean characters detected`);
            throw new Error('Translation incomplete - Korean characters detected in result');
          }
          
        } catch (e) {
          console.error(`Failed to parse or validate AI response for article "${cleanTitle}":`, e);
          throw e; // Re-throw to skip this article
        }

        // Use AI-selected category
        const finalCategory = parsedContent.category;

        console.log(`AI selected category: ${finalCategory}`);

        // 3. Save to database (as auto-generated, pending approval)
        const { data: post, error: postError } = await supabase
          .from('posts')
          .insert({
            user_id: userId,
            title: parsedContent.title,
            content: parsedContent.content,
            category: finalCategory,
            image_url: articleImage, // Use extracted image from original article
            source_url: originalUrl,
            is_auto_generated: true,  // Mark as auto-generated
            is_approved: false,        // Pending approval
          })
          .select()
          .single();

        if (postError) {
          console.error('Error saving post:', postError);
          throw postError;
        }

        console.log(`Successfully created post: ${post.id}`);
        generatedPosts.push(post);

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error processing article:`, error);
        // Continue with next article
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        generated: generatedPosts.length,
        posts: generatedPosts 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in generate-news-posts function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
