import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');

// Our transport mode -> Google Distance Matrix mode
const MODE_MAP: Record<string, string> = {
  driving: 'driving',
  walking: 'walking',
  cycling: 'bicycling',
  transit: 'transit',
};

// Our category -> Places API (New) text-query term (used for searching)
const CATEGORY_QUERY: Record<string, string> = {
  Food: 'restaurant',
  Coffee: 'coffee shop',
  Drinks: 'bar',
};

// Google place type -> our display category (used to label results from the API)
const GOOGLE_TYPE_TO_CATEGORY: Record<string, string> = {
  // Food
  restaurant: 'Food',
  meal_takeaway: 'Food',
  meal_delivery: 'Food',
  bakery: 'Food',
  fast_food_restaurant: 'Food',
  food: 'Food',
  // Coffee
  cafe: 'Coffee',
  coffee_shop: 'Coffee',
  // Drinks
  bar: 'Drinks',
  night_club: 'Drinks',
  pub: 'Drinks',
  wine_bar: 'Drinks',
  cocktail_bar: 'Drinks',
};

/** Map a place's Google type fields to our display category.
 *  Checks primaryType first (most specific), then the types array.
 *  Falls back to `fallback` (the search bucket) if nothing matches. */
function categoryFromTypes(
  primaryType: string | undefined,
  types: string[] | undefined,
  fallback: string,
): string {
  if (primaryType) {
    const cat = GOOGLE_TYPE_TO_CATEGORY[primaryType];
    if (cat) return cat;
  }
  for (const t of types || []) {
    const cat = GOOGLE_TYPE_TO_CATEGORY[t];
    if (cat) return cat;
  }
  return fallback;
}

// Places API (New) price-level enum.
// Index matches the integer stored in user_preferences.price_levels (1–4).
// Level 0 ("Free") is not supported by the searchText endpoint and is omitted.
const PRICE_ENUM: Record<number, string> = {
  1: 'PRICE_LEVEL_INEXPENSIVE',
  2: 'PRICE_LEVEL_MODERATE',
  3: 'PRICE_LEVEL_EXPENSIVE',
  4: 'PRICE_LEVEL_VERY_EXPENSIVE',
};

interface Prefs {
  categories: string[];
  min_rating: number;
  max_travel_minutes: number;
  price_levels: number[];
  keyword: string;
}

const DEFAULT_PREFS: Prefs = {
  categories: ['Food', 'Coffee', 'Drinks'],
  min_rating: 0,
  max_travel_minutes: 60,
  price_levels: [1, 2, 3, 4],
  keyword: '',
};

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
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { participants } = (await req.json()) as { participants: Participant[] };
    const located = (participants || []).filter((p) => p?.location && p?.user_id);

    if (located.length === 0) {
      return json({ error: 'No participant locations' }, 400);
    }
    if (!GOOGLE_MAPS_API_KEY) {
      return json({ error: 'GOOGLE_MAPS_API_KEY not configured' }, 500);
    }

    // ===== Step 0: fetch EACH participant's stored preferences =====
    // RLS only lets a user read their own prefs, so use the service-role client.
    const prefsByUser = new Map<string, Prefs>();
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: prefRows } = await supabase
        .from('user_preferences')
        .select('user_id, categories, min_rating, max_travel_minutes, price_levels, keyword')
        .in('user_id', located.map((p) => p.user_id));
      for (const r of prefRows || []) {
        prefsByUser.set(r.user_id, {
          categories: r.categories?.length ? r.categories : DEFAULT_PREFS.categories,
          min_rating: Number(r.min_rating ?? 0),
          max_travel_minutes: r.max_travel_minutes ?? DEFAULT_PREFS.max_travel_minutes,
          price_levels: r.price_levels?.length ? r.price_levels : DEFAULT_PREFS.price_levels,
          keyword: (r.keyword ?? '').trim(),
        });
      }
    }
    const prefsFor = (userId: string): Prefs => prefsByUser.get(userId) ?? DEFAULT_PREFS;
    const allPrefs = located.map((p) => prefsFor(p.user_id));

    // ===== Group conflict resolution =====
    // Price conflict: mathematical average of each user's mean price tier,
    // widened by +/-1 into a band.
    const userPriceMeans = allPrefs.map((pr) => {
      const pl = pr.price_levels.length ? pr.price_levels : DEFAULT_PREFS.price_levels;
      return pl.reduce((s, v) => s + v, 0) / pl.length;
    });
    const groupPriceMean = userPriceMeans.reduce((s, v) => s + v, 0) / userPriceMeans.length;
    const minPriceIdx = Math.max(1, Math.round(groupPriceMean) - 1);
    const maxPriceIdx = Math.min(4, Math.round(groupPriceMean) + 1);
    const priceLevels: string[] = [];
    for (let i = minPriceIdx; i <= maxPriceIdx; i++) {
      if (PRICE_ENUM[i]) priceLevels.push(PRICE_ENUM[i]);
    }

    // Rating: strictest member wins (highest min_rating).
    const minRating = Math.max(0, ...allPrefs.map((pr) => pr.min_rating));
    // Travel cap: strictest member wins (lowest max_travel_minutes).
    const maxTravelMin = Math.min(...allPrefs.map((pr) => pr.max_travel_minutes));

    // Hard constraints: AND of every distinct keyword across the group
    // (e.g. "Vegan AND Gluten-Free"), folded into the Places text query.
    const hardKeywords = [...new Set(allPrefs.map((pr) => pr.keyword).filter(Boolean))];
    const hardQuery = hardKeywords.join(' AND ');

    // Location bias = rough centroid of the participants.
    const center = {
      lat: located.reduce((s, p) => s + p.location.lat, 0) / located.length,
      lng: located.reduce((s, p) => s + p.location.lng, 0) / located.length,
    };

    // ===== Step 1: Multi-batch tournament =====
    // Fetch up to 3 candidate venues for EACH participant's own preferences,
    // then combine — every member's taste is represented in the pool.
    const TOURNAMENT_PER_USER = 3;
    const candidatesById = new Map<string, Candidate>();
    const _debugResults: Record<string, unknown> = {};

    await Promise.all(
      located.map(async (p) => {
        const prefs = prefsFor(p.user_id);
        const cats = prefs.categories.length ? prefs.categories : DEFAULT_PREFS.categories;
        const userPool: Candidate[] = [];

        for (const cat of cats) {
          const term = CATEGORY_QUERY[cat];
          if (!term) continue;
          const textQuery = [hardQuery, term].filter(Boolean).join(' ');
          const body: Record<string, unknown> = {
            textQuery,
            locationBias: {
              circle: {
                center: { latitude: center.lat, longitude: center.lng },
                radius: 5000,
              },
            },
            maxResultCount: 5,
          };
          if (priceLevels.length) body.priceLevels = priceLevels;
          if (minRating > 0) body.minRating = minRating;

          try {
            const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask':
                  'places.id,places.displayName,places.formattedAddress,places.location,places.rating',
              },
              body: JSON.stringify(body),
            });
            const data = await res.json();
            _debugResults[cat] = { status: res.status, ok: res.ok, placeCount: data.places?.length ?? 0, error: data.error };
            if (!res.ok) {
              console.error(`Places API error (${res.status}) cat=${cat}:`, JSON.stringify(data));
            }
            for (const place of data.places || []) {
              if (!place.id) continue;
              userPool.push({
                place_id: place.id,
                name: place.displayName?.text || 'Unknown venue',
                category: cat, // will be enriched via Place Details after scoring
                rating: place.rating || 4.0,
                address: place.formattedAddress || '',
                location: {
                  lat: place.location?.latitude,
                  lng: place.location?.longitude,
                },
              });
            }
          } catch (e) {
            console.error(`Places fetch exception for cat=${cat}:`, e);
          }
        }

        // This participant's top-3 entrants for the tournament.
        userPool
          .filter((c) => c.location.lat != null && c.location.lng != null)
          .sort((a, b) => b.rating - a.rating)
          .slice(0, TOURNAMENT_PER_USER)
          .forEach((c) => {
            if (!candidatesById.has(c.place_id)) candidatesById.set(c.place_id, c);
          });
      })
    );

    const candidates = Array.from(candidatesById.values());
    if (candidates.length === 0) {
      return json({ midpoint: center, venues: [], note: 'No candidates from Places API', _debug: { priceLevels, minRating, center, placesResults: _debugResults } });
    }

    // ===== Step 2: Distance Matrix from each participant to all candidates =====
    // The combined tournament pool stays small (<= 25), so a single batch suffices.
    const DEST_CHUNK = 25;
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
    // Travel times are best-effort — if Distance Matrix can't route a leg we
    // omit that participant from scoring rather than discarding the whole venue.
    const scored = candidates
      .map((c) => {
        const times: number[] = [];
        const travel_times: Record<string, number> = {};
        for (const p of located) {
          const t = travelMatrix[p.user_id]?.[c.place_id];
          if (t != null) {
            times.push(t);
            travel_times[p.user_id] = Math.round(t / 60); // store minutes
          }
        }
        // Need at least one travel time to rank by fairness
        if (times.length === 0) return null;
        const maxT = Math.max(...times);
        const meanT = times.reduce((s, v) => s + v, 0) / times.length;
        const variance = times.reduce((s, v) => s + (v - meanT) ** 2, 0) / times.length;
        return { c, maxT, variance, travel_times };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter((x) => x.maxT / 60 <= maxTravelMin)
      .sort((a, b) => a.maxT - b.maxT || a.variance - b.variance);

    // ===== Step 4: Enrich top 5 venues with Google primaryType via Place Details =====
    // searchText FieldMask doesn't support type fields reliably; Place Details does.
    const RESULT_CAP = 5;
    const top5 = scored.slice(0, RESULT_CAP);

    await Promise.all(
      top5.map(async ({ c }) => {
        try {
          const res = await fetch(
            `https://places.googleapis.com/v1/places/${c.place_id}`,
            {
              headers: {
                'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY as string,
                'X-Goog-FieldMask': 'primaryType',
              },
            },
          );
          if (res.ok) {
            const data = await res.json();
            console.log(`Place Details ${c.place_id}: primaryType=${data.primaryType}`);
            if (data.primaryType) {
              c.category = categoryFromTypes(data.primaryType, undefined, c.category);
            }
          }
        } catch (_e) {
          // keep the search-bucket category as fallback
        }
      }),
    );

    // ===== Step 5: Build venue response =====
    const venues = top5.map(({ c, travel_times }) => ({
      name: c.name,
      category: c.category,
      rating: c.rating,
      address: c.address,
      location: c.location,
      travel_times,
      ai_theme: null,
      in_poll: false,
    }));

    return json({ midpoint: center, venues });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
