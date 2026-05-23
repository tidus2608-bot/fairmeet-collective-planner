import { GOOGLE_MAPS_API_KEY } from '@/components/GoogleMapsProvider';
import type { VenueRow } from '@/hooks/useMeetups';

export function venuePhotoUrl(photoReference: string | null, maxwidth = 400): string | null {
  if (!photoReference) return null;
  // Places API (New) returns photo resource names like "places/X/photos/Y".
  if (photoReference.startsWith('places/')) {
    return (
      `https://places.googleapis.com/v1/${photoReference}/media` +
      `?maxWidthPx=${maxwidth}&key=${GOOGLE_MAPS_API_KEY}`
    );
  }
  // Legacy Places photo reference.
  return (
    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}` +
    `&photo_reference=${photoReference}&key=${GOOGLE_MAPS_API_KEY}`
  );
}

export function priceLevelLabel(level: number | null | undefined): string | null {
  if (level == null) return null;
  if (level <= 0) return 'Free';
  return '$'.repeat(Math.min(level, 4));
}

// Worst-case travel time across all participants, in minutes.
// Falls back to the persisted worst_minutes, then to derivation from travel_times.
export function venueWorstMinutes(v: VenueRow): number | null {
  if (v.worst_minutes != null) return v.worst_minutes;
  const times = v.travel_times ? Object.values(v.travel_times) : [];
  return times.length ? Math.max(...times) : null;
}

// Spread of travel times across participants, in minutes (max - min). Lower is
// fairer: everyone gets roughly the same travel time. Null without travel data.
export function venueTravelSpread(v: VenueRow): number | null {
  const times = v.travel_times ? Object.values(v.travel_times) : [];
  return times.length ? Math.max(...times) - Math.min(...times) : null;
}

// Radius (metres) of the map's "fair zone" circle. Covers every participant plus
// a buffer, bounded so it stays sensible. Mirrors the edge function's search
// radius so the circle matches the area venues are actually drawn from — venues
// never appear outside it.
export function fairZoneRadius(locations: { lat: number; lng: number }[]): number {
  if (locations.length === 0) return 2000;
  const center = {
    lat: locations.reduce((s, l) => s + l.lat, 0) / locations.length,
    lng: locations.reduce((s, l) => s + l.lng, 0) / locations.length,
  };
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dist = (b: { lat: number; lng: number }) => {
    const dLat = toRad(b.lat - center.lat);
    const dLng = toRad(b.lng - center.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(center.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const spread = locations.reduce((m, l) => Math.max(m, dist(l)), 0);
  return Math.max(3000, Math.min(12000, spread + 2000));
}

// Sort venues by the same criteria calculate-midpoint v19 uses to score them:
//
//   Primary key  — worst-case travel time across the group (smallest first).
//                  Protects the worst-served participant. A venue that is
//                  10/10/18 min beats a venue that is 20/20/20 min, because
//                  nobody has to travel more than 18 in the first.
//   Tiebreaker   — spread of travel times, max − min (smallest first). When
//                  the worst case ties, prefer the option where the group is
//                  closest to equal.
//
// Venues without travel-time data (e.g. manually added before any
// recalculation) sort to the end.
//
// Note: an earlier version of this function sorted by spread first, which
// inverted the priority — it would have surfaced 20/20/20 over 10/10/18.
// That mismatch with the edge function's scoring is what this rewrite fixes.
export function sortByFairness(venues: VenueRow[]): VenueRow[] {
  return [...venues].sort((a, b) => {
    const wa = venueWorstMinutes(a);
    const wb = venueWorstMinutes(b);
    if (wa == null && wb == null) return 0;
    if (wa == null) return 1;
    if (wb == null) return -1;
    if (wa !== wb) return wa - wb;
    const sa = venueTravelSpread(a) ?? 0;
    const sb = venueTravelSpread(b) ?? 0;
    return sa - sb;
  });
}
