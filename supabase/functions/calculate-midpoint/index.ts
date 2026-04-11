import { corsHeaders } from '@supabase/supabase-js/cors';

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { participants } = await req.json();

    // Calculate geographic centroid
    const locs = participants.filter((p: any) => p.location).map((p: any) => p.location);
    if (locs.length === 0) {
      return new Response(JSON.stringify({ error: 'No participant locations' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const midpoint = {
      lat: locs.reduce((s: number, l: any) => s + l.lat, 0) / locs.length,
      lng: locs.reduce((s: number, l: any) => s + l.lng, 0) / locs.length,
    };

    // Search nearby places using Google Places API
    const types = ['restaurant', 'cafe', 'bar', 'park'];
    const allVenues: any[] = [];

    for (const type of types) {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${midpoint.lat},${midpoint.lng}&radius=2000&type=${type}&key=${GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        const categoryMap: Record<string, string> = {
          restaurant: 'Food',
          cafe: 'Coffee',
          bar: 'Drinks',
          park: 'Park',
        };

        if (data.results) {
          const venues = data.results.slice(0, 3).map((place: any) => ({
            id: `v-${place.place_id}`,
            name: place.name,
            category: categoryMap[type] || 'Food',
            rating: place.rating || 4.0,
            address: place.vicinity || '',
            location: {
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng,
            },
            travelTimes: {},
          }));
          allVenues.push(...venues);
        }
      } catch {
        // Skip failed type
      }
    }

    return new Response(JSON.stringify({ midpoint, venues: allVenues }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
