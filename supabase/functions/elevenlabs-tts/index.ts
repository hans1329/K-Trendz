import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId } = await req.json();
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required');
    }

    // 한국어 웃음 표현 전처리 (TTS가 제대로 발음하도록)
    let processedText = text
      .replace(/ㅋㅋㅋㅋ+/g, '크크크크')
      .replace(/ㅋㅋㅋ/g, '크크크')
      .replace(/ㅋㅋ/g, '크크')
      .replace(/ㅎㅎㅎㅎ+/g, '하하하하')
      .replace(/ㅎㅎㅎ/g, '하하하')
      .replace(/ㅎㅎ/g, '하하')
      .replace(/ㅋ/g, '크')
      .replace(/ㅎ/g, '하');

    // 한국어 네이티브 음성
    const selectedVoiceId = voiceId || 'a52RveZOORPA9buQulXm';

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: processedText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.25, // 낮을수록 더 다이나믹하고 텐션 높음
            similarity_boost: 0.7,
            style: 0.8, // 높을수록 더 표현적
            use_speaker_boost: true,
            speed: 1.1, // 약간 빠르게
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error: unknown) {
    console.error('TTS error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
