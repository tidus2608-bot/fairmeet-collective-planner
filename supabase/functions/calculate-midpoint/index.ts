import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');

// Our transport mode -> Google Routes API travelMode
const MODE_MAP: Record<string, string> = {
  driving: 'DRIVE',
  walking: 'WALK',
  cycling: 'BICYCLE',
  transit: 'TRANSIT',
};

// Our category -> Places API (New) text-query term (used for searching)
const CATEGORY_QUERY: Record<string, string> = {
  Food: 'restaurant',
  Coffee: 'coffee shop',
  Drinks: 'bar',
};

// Cuisine/sub-type label -> Google Places v1 includedType value
const CUISINE_TO_PLACE_TYPE: Record<string, string> = {
  'Italian': 'italian_restaurant',
  'Japanese': 'japanese_restaurant',
  'Korean': 'korean_restaurant',
  'Chinese': 'chinese_restaurant',
  'Thai': 'thai_restaurant',
  'Indian': 'indian_restaurant',
  'Mexican': 'mexican_restaurant',
  'Vietnamese': 'vietnamese_restaurant',
  'American': 'american_restaurant',
  'Mediterranean': 'mediterranean_restaurant',
  'French': 'french_restaurant',
  'Wine Bar': 'wine_bar',
  'Cocktail Bar': 'cocktail_bar',
  'Pub': 'pub',
  'Night Club': 'night_club',
};

// Which top-level category does each cuisine place type belong to?
const CUISINE_PARENT: Record<string, string> = {
  italian_restaurant: 'Food', japanese_restaurant: 'Food',
  korean_restaurant: 'Food',  chinese_restaurant: 'Food',
  thai_restaurant: 'Food',    indian_restaurant: 'Food',
  mexican_restaurant: 'Food', vietnamese_restaurant: 'Food',
  american_restaurant: 'Food', mediterranean_restaurant: 'Food',
  french_restaurant: 'Food',
  wine_bar: 'Drinks', cocktail_bar: 'Drinks', pub: 'Drinks', night_club: 'Drinks',
};

// Google place type -> our display category (used to label results from the API)
const GOOGLE_TYPE_TO_CATEGORY: Record<string, string> = {
  // Food (generic)
  restaurant: 'Food',
  meal_takeaway: 'Food',
  meal_delivery: 'Food',
  bakery: 'Food',
  fast_food_restaurant: 'Food',
  food: 'Food',
  // Food (cuisine-specific)
  italian_restaurant: 'Food',
  japanese_restaurant: 'Food',
  korean_restaurant: 'Food',
  chinese_restaurant: 'Food',
  thai_restaurant: 'Food',
  indian_restaurant: 'Food',
  mexican_restaurant: 'Food',
  vietnamese_restaurant: 'Food',
  american_restaurant: 'Food',
  mediterranean_restaurant: 'Food',
  french_restaurant: 'Food',
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
// Reverse map: Places API (New) price enum -> our stored integer.
const PRICE_ENUM_TO_NUM: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// Fairness scoring weights (lower score = better). Equal travel time across the
// group dominates; rating / average / worst-case act as minor refinements.
const W_FAIR = 0.6;   // spread of travel times (everyone the same time)
const W_RATING = 0.15; // venue quality
const W_AVG = 0.15;   // average travel time
const W_WORST = 0.1;  // worst single trip

interface Prefs {
  categories: string[];
  min_rating: number;
  max_travel_minutes: number;
  price_levels: number[];
  keyword: string;
  open_now: boolean;
  cuisine: string;
}

const DEFAULT_PREFS: Prefs = {
  categories: ['Food', 'Coffee', 'Drinks'],
  min_rating: 0,
  max_travel_minutes: 60,
  price_levels: [1, 2, 3, 4],
  keyword: '',
  open_now: false,
  cuisine: '',
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
  photo_reference: string | null;
  price_level: number | null;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Great-circle distance in metres.
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { participants, departureTime: rawDeparture } = (await req.json()) as {
      participants: Participant[];
      departureTime?: string;
    };
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
        .select('user_id, categories, min_rating, max_travel_minutes, price_levels, keyword, open_now, cuisine')
        .in('user_id', located.map((p) => p.user_id));
      for (const r of prefRows || []) {
        prefsByUser.set(r.user_id, {
          categories: r.categories?.length ? r.categories : DEFAULT_PREFS.categories,
          min_rating: Number(r.min_rating ?? 0),
          max_travel_minutes: r.max_travel_minutes ?? DEFAULT_PREFS.max_travel_minutes,
          price_levels: r.price_levels?.length ? r.price_levels : DEFAULT_PREFS.price_levels,
          keyword: (r.keyword ?? '').trim(),
          open_now: r.open_now ?? false,
          cuisine: (r.cuisine ?? '').trim(),
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
    // Open now: if any participant wants currently-open venues only, apply it.
    const openNow = allPrefs.some((pr) => pr.open_now);

    // Hard constraints: AND of every distinct keyword across the group
    // (e.g. "Vegan AND Gluten-Free"), folded into the Places text query.
    const hardKeywords = [...new Set(allPrefs.map((pr) => pr.keyword).filter(Boolean))];
    const hardQuery = hardKeywords.join(' AND ');

    // Search centre = rough centroid of the participants.
    const center = {
      lat: located.reduce((s, p) => s + p.location.lat, 0) / located.length,
      lng: located.reduce((s, p) => s + p.location.lng, 0) / located.length,
    };

    // The search radius scales with how spread out the group is: it always covers
    // every participant plus a small buffer, bounded so it never balloons. Both
    // the Places search (as a HARD restriction) and a post-filter use this radius,
    // and the client draws the same circle, so a venue can never land outside it.
    const spreadRadius = located.reduce((m, p) => Math.max(m, haversine(center, p.location)), 0);
    const searchRadius = clamp(spreadRadius + 2000, 3000, 12000);

    // Rectangle bounds for locationRestriction (Text Search supports rectangle only).
    const latDelta = searchRadius / 111320;
    const lngDelta = searchRadius / (111320 * Math.cos((center.lat * Math.PI) / 180));
    const locationRestriction = {
      rectangle: {
        low: { latitude: center.lat - latDelta, longitude: center.lng - lngDelta },
        high: { latitude: center.lat + latDelta, longitude: center.lng + lngDelta },
      },
    };

    // Optional departure time for traffic-aware estimates; must be in the future.
    let departureTime: string | undefined;
    if (rawDeparture) {
      const t = new Date(rawDeparture).getTime();
      if (Number.isFinite(t) && t > Date.now()) departureTime = new Date(t).toISOString();
    }

    // ===== Step 1: Candidate discovery via Places API (New) searchText =====
    // Search EACH participant's own preferred categories so every member's taste
    // is represented, then pool unique places. The Routes API handles a large
    // destination set, so we keep the full deduped pool (no tournament cap).
    const MAX_RESULTS = 15;
    const candidatesById = new Map<string, Candidate>();

    await Promise.all(
      located.map(async (p) => {
        const prefs = prefsFor(p.user_id);
        const cats = prefs.categories.length ? prefs.categories : DEFAULT_PREFS.categories;

        for (const cat of cats) {
          const term = CATEGORY_QUERY[cat];
          if (!term) continue;
          const cuisinePlaceType = prefs.cuisine ? CUISINE_TO_PLACE_TYPE[prefs.cuisine] : undefined;
          const cuisineParent = cuisinePlaceType ? CUISINE_PARENT[cuisinePlaceType] : undefined;
          const useCuisineType = !!cuisinePlaceType && cuisineParent === cat;
          const body: Record<string, unknown> = {
            textQuery: useCuisineType
              ? (hardQuery || cat)
              : [hardQuery, term].filter(Boolean).join(' '),
            locationRestriction,
            maxResultCount: MAX_RESULTS,
          };
          if (useCuisineType) body.includedType = cuisinePlaceType;
          if (priceLevels.length) body.priceLevels = priceLevels;
          if (minRating > 0) body.minRating = minRating;
          if (openNow) body.openNow = true;

          try {
            const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask':
                  'places.id,places.displayName,places.formattedAddress,places.location,' +
                  'places.rating,places.priceLevel,places.photos,places.primaryType,places.types',
              },
              body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
              console.error(`Places API error (${res.status}) cat=${cat}:`, JSON.stringify(data));
              continue;
            }
            for (const place of data.places || []) {
              if (!place.id || candidatesById.has(place.id)) continue;
              const lat = place.location?.latitude;
              const lng = place.location?.longitude;
              if (lat == null || lng == null) continue;
              // Trim the rectangle's corners back to a true circle so nothing
              // sits outside the radius the client draws.
              if (haversine(center, { lat, lng }) > searchRadius) continue;
              candidatesById.set(place.id, {
                place_id: place.id,
                name: place.displayName?.text || 'Unknown venue',
                category: categoryFromTypes(place.primaryType, place.types, cat),
                rating: place.rating || 4.0,
                address: place.formattedAddress || '',
                location: { lat, lng },
                photo_reference: place.photos?.[0]?.name ?? null,
                price_level:
                  typeof place.priceLevel === 'string'
                    ? PRICE_ENUM_TO_NUM[place.priceLevel] ?? null
                    : null,
              });
            }
          } catch (e) {
            console.error(`Places fetch exception for cat=${cat}:`, e);
          }
        }
      })
    );

    const candidates = Array.from(candidatesById.values());
    if (candidates.length === 0) {
      return json({ midpoint: center, radius: searchRadius, venues: [], note: 'No candidates from Places API' });
    }

    // ===== Step 2: Travel times via Routes API computeRouteMatrix =====
    // One request per participant (single origin), all candidates as destinations.
    // computeRouteMatrix allows up to 625 elements (origins×destinations) per
    // request; with one origin we chunk destinations defensively at 600.
    const DEST_CHUNK = 600;
    // travelMatrix[userId][place_id] = seconds
    const travelMatrix: Record<string, Record<string, number>> = {};

    await Promise.all(
      located.map(async (p) => {
        travelMatrix[p.user_id] = {};
        const travelMode = MODE_MAP[p.transport_mode || 'driving'] || 'DRIVE';
        const origins = [{
          waypoint: { location: { latLng: { latitude: p.location.lat, longitude: p.location.lng } } },
        }];

        for (let i = 0; i < candidates.length; i += DEST_CHUNK) {
          const chunk = candidates.slice(i, i + DEST_CHUNK);
          const destinations = chunk.map((c) => ({
            waypoint: { location: { latLng: { latitude: c.location.lat, longitude: c.location.lng } } },
          }));
          const body: Record<string, unknown> = { origins, destinations, travelMode };
          // Traffic-aware routing is valid only for driving; otherwise it is rejected.
          if (travelMode === 'DRIVE') {
            body.routingPreference = 'TRAFFIC_AWARE';
            if (departureTime) body.departureTime = departureTime;
          } else if (travelMode === 'TRANSIT' && departureTime) {
            body.departureTime = departureTime;
          }
          try {
            const res = await fetch(
              'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                  'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,condition',
                },
                body: JSON.stringify(body),
              },
            );
            const data = await res.json();
            // Response is a flat array of { originIndex, destinationIndex, duration, condition }.
            for (const el of Array.isArray(data) ? data : []) {
              if (el?.condition !== 'ROUTE_EXISTS' || typeof el.duration !== 'string') continue;
              const seconds = Math.round(parseFloat(el.duration));
              const c = chunk[el.destinationIndex];
              if (c && Number.isFinite(seconds)) {
                travelMatrix[p.user_id][c.place_id] = seconds;
              }
            }
          } catch (_e) {
            // skip failed chunk
          }
        }
      })
    );

    // ===== Step 3: Score each candidate (composite, equal-time dominant) =====
    // Fairness = everyone gets the same travel time (minimize spread). Average and
    // worst-case travel and venue rating act as minor refinements. Travel times
    // are best-effort — if a leg can't be routed we omit that participant rather
    // than discarding the whole venue.
    const metrics = candidates
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
        if (times.length === 0) return null;
        const maxT = Math.max(...times);
        const minT = Math.min(...times);
        const meanT = times.reduce((s, v) => s + v, 0) / times.length;
        const spread = maxT - minT; // equal travel time for everyone
        return { c, maxT, meanT, spread, rating: c.rating, travel_times };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter((x) => x.maxT / 60 <= maxTravelMin);

    // Normalize each metric to 0..1 across the candidate set, then combine.
    const range = (vals: number[]) => {
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      return { lo, span: hi - lo };
    };
    const norm = (v: number, r: { lo: number; span: number }) =>
      r.span > 0 ? (v - r.lo) / r.span : 0;

    const spreadR = range(metrics.map((m) => m.spread));
    const meanR = range(metrics.map((m) => m.meanT));
    const maxR = range(metrics.map((m) => m.maxT));
    const ratingR = range(metrics.map((m) => m.rating));

    const scored = metrics
      .map((m) => ({
        ...m,
        score:
          W_FAIR * norm(m.spread, spreadR) +
          W_AVG * norm(m.meanT, meanR) +
          W_WORST * norm(m.maxT, maxR) +
          W_RATING * (1 - norm(m.rating, ratingR)),
      }))
      .sort((a, b) => a.score - b.score);

    // ===== Step 4: Take top venues, balanced across categories =====
    const PER_CATEGORY = 5;
    const byCategory: Record<string, typeof scored> = {};
    for (const item of scored) {
      (byCategory[item.c.category] ||= []).push(item);
    }
    const topItems = Object.values(byCategory).flatMap((arr) => arr.slice(0, PER_CATEGORY));

    // ===== Step 4b: Place Details (New) pass for the trimmed set =====
    const detailsById: Record<string, { website: string | null; phone: string | null; opening_hours: unknown }> = {};
    await Promise.all(
      topItems.map(async ({ c }) => {
        try {
          const res = await fetch(`https://places.googleapis.com/v1/places/${c.place_id}`, {
            headers: {
              'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY as string,
              'X-Goog-FieldMask': 'websiteUri,nationalPhoneNumber,regularOpeningHours',
            },
          });
          if (!res.ok) return;
          const r = await res.json();
          detailsById[c.place_id] = {
            website: r.websiteUri ?? null,
            phone: r.nationalPhoneNumber ?? null,
            opening_hours: r.regularOpeningHours
              ? { open_now: r.regularOpeningHours.openNow, weekday_text: r.regularOpeningHours.weekdayDescriptions }
              : null,
          };
        } catch (_e) {
          // keep the venue without enriched details
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

    return json({ midpoint: center, radius: searchRadius, venues });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
