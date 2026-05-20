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

// Sort venues fairest-first (smallest spread of travel times, i.e. everyone the
// same time). Venues without travel data sort to the end.
export function sortByFairness(venues: VenueRow[]): VenueRow[] {
  return [...venues].sort((a, b) => {
    const sa = venueTravelSpread(a);
    const sb = venueTravelSpread(b);
    if (sa == null && sb == null) return 0;
    if (sa == null) return 1;
    if (sb == null) return -1;
    return sa - sb;
  });
}
