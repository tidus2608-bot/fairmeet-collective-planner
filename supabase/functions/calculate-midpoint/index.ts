const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');

// Map our transport mode to Google Routes API travelMode
const MODE_MAP: Record<string, string> = {
  driving: 'DRIVE',
  walking: 'WALK',
  cycling: 'BICYCLE',
  transit: 'TRANSIT',
};

// Google Places type -> our category
const TYPE_TO_CATEGORY: Record<string, string> = {
  restaurant: 'Food',
  cafe: 'Coffee',
  bar: 'Drinks',
};
const CATEGORY_TO_TYPE: Record<string, string> = {
  Food: 'restaurant',
  Coffee: 'cafe',
  Drinks: 'bar',
};

// Fairness scoring weights (lower score = better). Equal travel time across the
// group dominates; rating / average / worst-case act as minor refinements.
const W_FAIR = 0.6;   // spread of travel times (everyone the same time)
const W_RATING = 0.15; // venue quality
const W_AVG = 0.15;   // average travel time
const W_WORST = 0.1;  // worst single trip

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
    const { participants, preferences, departureTime: rawDeparture } = (await req.json()) as {
      participants: Participant[];
      preferences?: Preferences;
      departureTime?: string;
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

    // Optional departure time for traffic-aware estimates; must be in the future.
    let departureTime: string | undefined;
    if (rawDeparture) {
      const t = new Date(rawDeparture).getTime();
      if (Number.isFinite(t) && t > Date.now()) departureTime = new Date(t).toISOString();
    }

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
            for (const place of (data.results || []).slice(0, 20)) {
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
    // worst-case travel and venue rating act as minor refinements.
    const metrics = candidates
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
