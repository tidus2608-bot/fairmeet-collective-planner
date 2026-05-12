const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You generate creative meetup ideas for groups in Hanoi, Vietnam. Return a JSON array of exactly 4 ideas, each with title, description, and emoji fields. Be creative and specific to Hanoi.',
          },
          {
            role: 'user',
            content: 'Generate 4 fun and unique meetup ideas for a group of friends in Hanoi. Return JSON only.',
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const ideas = parsed.ideas || parsed;

    return new Response(JSON.stringify({ ideas }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
