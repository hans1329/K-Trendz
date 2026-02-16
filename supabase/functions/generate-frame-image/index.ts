import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { challengeId } = await req.json();

    if (!challengeId) {
      return new Response(JSON.stringify({ error: 'challengeId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch challenge data
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      console.error('Challenge fetch error:', challengeError);
      return new Response(JSON.stringify({ error: 'Challenge not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract options for multiple choice or youtube
    const options = challenge.options as any;
    let optionLabels: string[] = [];
    let challengeType = 'open';
    
    if (options?.type === 'multiple_choice' && options?.items) {
      challengeType = 'multiple_choice';
      optionLabels = options.items.slice(0, 4).map((item: any) => {
        const text = item.wiki_entry_title || item.text || `Option ${item.id}`;
        return `${item.label}: ${text.substring(0, 20)}`;
      });
    } else if (options?.type === 'youtube') {
      challengeType = 'youtube';
    }

    const prizeText = challenge.total_prize_usdc > 0 ? `$${challenge.total_prize_usdc} USDC` : 'TBD';
    const questionText = challenge.question.substring(0, 80);

    // Generate image using Lovable AI
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the prompt for Frame image based on challenge type
    let challengeTypeDescription = '';
    if (challengeType === 'multiple_choice') {
      challengeTypeDescription = `OPTIONS: ${optionLabels.join(' | ')}`;
    } else if (challengeType === 'youtube') {
      challengeTypeDescription = '(YouTube challenge - watch video and answer)';
    } else {
      challengeTypeDescription = '(Open-ended challenge - users will type their answer)';
    }
    
    let imagePrompt = `Create a professional, eye-catching social media card image for a K-pop quiz challenge. 

Design requirements:
- Aspect ratio: 1.91:1 (landscape, Farcaster Frame standard)
- Dark gradient background with subtle K-pop aesthetic (purple/pink/orange tones)
- Large, bold, readable white text for the question
- Prize pool prominently displayed
- Clean, modern design with slight glow effects
- No actual buttons (they will be added by the Frame)
${challengeType === 'youtube' ? '- Include a subtle YouTube/video icon indicator' : ''}

Content to include:
QUESTION: "${questionText}"
PRIZE POOL: ${prizeText}
${challengeTypeDescription}

Make the text clearly readable against the background. Use a professional quiz/game show aesthetic with K-pop flair.`;

    console.log('Generating Frame image with prompt:', imagePrompt.substring(0, 200) + '...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          { role: 'user', content: imagePrompt }
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI image generation failed:', aiResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'Image generation failed', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData || !imageData.startsWith('data:image')) {
      console.error('No image in AI response:', JSON.stringify(aiData).substring(0, 500));
      return new Response(JSON.stringify({ error: 'No image generated' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract base64 data
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      return new Response(JSON.stringify({ error: 'Invalid image format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const imageType = base64Match[1];
    const base64Data = base64Match[2];
    
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to Supabase Storage
    const fileName = `frame-images/${challengeId}-${Date.now()}.${imageType}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('challenge-images')
      .upload(fileName, bytes, {
        contentType: `image/${imageType}`,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to upload image', details: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('challenge-images')
      .getPublicUrl(fileName);

    const frameImageUrl = publicUrlData.publicUrl;

    // Update challenge with new frame image URL
    const { error: updateError } = await supabase
      .from('challenges')
      .update({ image_url: frameImageUrl })
      .eq('id', challengeId);

    if (updateError) {
      console.error('Update error:', updateError);
      // Still return success since image was generated
    }

    console.log('Frame image generated and saved:', frameImageUrl);

    return new Response(JSON.stringify({ 
      success: true, 
      frameImageUrl,
      challengeId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error generating frame image:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
