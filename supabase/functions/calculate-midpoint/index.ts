const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');

// Map our transport mode to Google Distance Matrix mode
const MODE_MAP: Record<string, string> = {
  driving: 'driving',
  walking: 'walking',
  cycling: 'bicycling',
  transit: 'transit',
};

// Google Places type -> our category
const TYPE_TO_CATEGORY: Record<string, string> = {
  restaurant: 'Food',
  cafe: 'Coffee',
  bar: 'Drinks',
  park: 'Park',
};
const CATEGORY_TO_TYPE: Record<string, string> = {
  Food: 'restaurant',
  Coffee: 'cafe',
  Drinks: 'bar',
  Park: 'park',
};

interface Preferences {
  categories?: string[];
  min_rating?: number;
  max_travel_minutes?: number;
  price_levels?: number[];
  keyword?: string;
}

interface Participant {
  user_id: string;
  location: { lat: number; lng: number };
  transport_mode?: string;
}

interface Candidate {
  place_id: string;
  name: string;
  category: string;
  rating: number;
  address: string;
  location: { lat: number; lng: number };
  photo_reference: string | null;
  price_level: number | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { participants, preferences } = (await req.json()) as {
      participants: Participant[];
      preferences?: Preferences;
    };

    if (!Array.isArray(participants)) {
      return new Response(JSON.stringify({ error: 'participants must be an array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const located = participants.filter(
      (p) =>
        p?.location &&
        typeof p.location.lat === 'number' &&
        typeof p.location.lng === 'number',
    );

    if (located.length === 0) {
      return new Response(JSON.stringify({ error: 'No participant locations' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== Apply preferences =====
    const prefCategories =
      preferences?.categories?.length ? preferences.categories : Object.values(TYPE_TO_CATEGORY);
    const types = prefCategories
      .map((c) => CATEGORY_TO_TYPE[c])
      .filter(Boolean);
    const minRating = preferences?.min_rating ?? 0;
    const maxTravelMin = preferences?.max_travel_minutes ?? 120;
    const priceLevels = preferences?.price_levels ?? [0, 1, 2, 3, 4];
    const keyword = (preferences?.keyword || '').trim();
    const minprice = Math.min(...priceLevels);
    const maxprice = Math.max(...priceLevels);

    // ===== Step 1: Generate candidate venues by searching outward from EACH participant =====
    const SEARCH_RADIUS_M = 2500;
    const candidatesById = new Map<string, Candidate>();

    await Promise.all(
      located.flatMap((p) =>
        types.map(async (type) => {
          let url =
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
            `?location=${p.location.lat},${p.location.lng}` +
            `&radius=${SEARCH_RADIUS_M}&type=${type}` +
            `&minprice=${minprice}&maxprice=${maxprice}` +
            `&key=${GOOGLE_MAPS_API_KEY}`;
          if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
          try {
            const res = await fetch(url);
            const data = await res.json();
            for (const place of (data.results || []).slice(0, 8)) {
              if (!place.place_id || candidatesById.has(place.place_id)) continue;
              const rating = place.rating || 0;
              if (rating < minRating) continue;
              candidatesById.set(place.place_id, {
                place_id: place.place_id,
                name: place.name,
                category: TYPE_TO_CATEGORY[type],
                rating: rating || 4.0,
                address: place.vicinity || '',
                location: {
                  lat: place.geometry.location.lat,
                  lng: place.geometry.location.lng,
                },
                photo_reference: place.photos?.[0]?.photo_reference ?? null,
                price_level: typeof place.price_level === 'number' ? place.price_level : null,
              });
            }
          } catch (_e) {
            // skip failed search
          }
        })
      )
    );

    const candidates = Array.from(candidatesById.values());
    if (candidates.length === 0) {
      return new Response(JSON.stringify({ venues: [], note: 'No candidates from Places API' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== Step 2: Distance Matrix from each participant to all candidates =====
    // One request per participant (origin), all candidates as destinations.
    // Distance Matrix supports up to 25 destinations per request — chunk if needed.
    const DEST_CHUNK = 25;
    // travelMatrix[userId][place_id] = seconds
    const travelMatrix: Record<string, Record<string, number>> = {};

    await Promise.all(
      located.map(async (p) => {
        travelMatrix[p.user_id] = {};
        const mode = MODE_MAP[p.transport_mode || 'driving'] || 'driving';

        for (let i = 0; i < candidates.length; i += DEST_CHUNK) {
          const chunk = candidates.slice(i, i + DEST_CHUNK);
          const dests = chunk.map((c) => `${c.location.lat},${c.location.lng}`).join('|');
          const url =
            `https://maps.googleapis.com/maps/api/distancematrix/json` +
            `?origins=${p.location.lat},${p.location.lng}` +
            `&destinations=${encodeURIComponent(dests)}` +
            `&mode=${mode}&key=${GOOGLE_MAPS_API_KEY}`;
          try {
            const res = await fetch(url);
            const data = await res.json();
            const elements = data.rows?.[0]?.elements || [];
            chunk.forEach((c, idx) => {
              const el = elements[idx];
              if (el?.status === 'OK' && el.duration?.value != null) {
                travelMatrix[p.user_id][c.place_id] = el.duration.value;
              }
            });
          } catch (_e) {
            // skip failed chunk
          }
        }
      })
    );

    // ===== Step 3: Score each candidate by fairness =====
    // Primary: minimize the WORST (max) travel time across the group.
    // Tiebreaker: minimize variance (everyone roughly equal).
    const scored = candidates
      .map((c) => {
        const times: number[] = [];
        const travel_times: Record<string, number> = {};
        for (const p of located) {
          const t = travelMatrix[p.user_id]?.[c.place_id];
          if (t == null) return null;
          times.push(t);
          travel_times[p.user_id] = Math.round(t / 60); // store minutes
        }
        const maxT = Math.max(...times);
        const meanT = times.reduce((s, v) => s + v, 0) / times.length;
        const variance = times.reduce((s, v) => s + (v - meanT) ** 2, 0) / times.length;
        return { c, maxT, variance, travel_times };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter((x) => x.maxT / 60 <= maxTravelMin)
      .sort((a, b) => a.maxT - b.maxT || a.variance - b.variance);

    // ===== Step 4: Take top venues, balanced across categories =====
    const PER_CATEGORY = 3;
    const byCategory: Record<string, typeof scored> = {};
    for (const item of scored) {
      (byCategory[item.c.category] ||= []).push(item);
    }
    const topItems = Object.values(byCategory).flatMap((arr) => arr.slice(0, PER_CATEGORY));

    // ===== Step 4b: Place Details pass for the trimmed set (website, phone, hours) =====
    const detailsById: Record<string, { website: string | null; phone: string | null; opening_hours: unknown }> = {};
    await Promise.all(
      topItems.map(async ({ c }) => {
        const url =
          `https://maps.googleapis.com/maps/api/place/details/json` +
          `?place_id=${c.place_id}` +
          `&fields=website,formatted_phone_number,opening_hours` +
          `&key=${GOOGLE_MAPS_API_KEY}`;
        try {
          const res = await fetch(url);
          const data = await res.json();
          const r = data.result || {};
          detailsById[c.place_id] = {
            website: r.website ?? null,
            phone: r.formatted_phone_number ?? null,
            opening_hours: r.opening_hours
              ? { open_now: r.opening_hours.open_now, weekday_text: r.opening_hours.weekday_text }
              : null,
          };
        } catch (_e) {
          // skip failed details lookup
        }
      })
    );

    const venues = topItems.map(({ c, travel_times, maxT }) => {
      const details = detailsById[c.place_id];
      return {
        name: c.name,
        category: c.category,
        rating: c.rating,
        address: c.address,
        location: c.location,
        travel_times,
        ai_theme: null,
        in_poll: false,
        worst_minutes: Math.round(maxT / 60),
        photo_reference: c.photo_reference,
        price_level: c.price_level,
        google_place_id: c.place_id,
        website: details?.website ?? null,
        phone: details?.phone ?? null,
        opening_hours: details?.opening_hours ?? null,
      };
    });

    // Reference midpoint just for map centering / circle (not used for selection)
    const midpoint = {
      lat: located.reduce((s, p) => s + p.location.lat, 0) / located.length,
      lng: located.reduce((s, p) => s + p.location.lng, 0) / located.length,
    };

    return new Response(JSON.stringify({ midpoint, venues }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
