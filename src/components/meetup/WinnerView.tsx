import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { MapPin, Star, ExternalLink, MessageCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { MeetupRow } from '@/hooks/useMeetups';

interface Props {
  meetup: MeetupRow;
  onOpenChat: () => void;
}

export default function WinnerView({ meetup, onOpenChat }: Props) {
  const fired = useRef(false);
  const venue = meetup.final_venue;

  useEffect(() => {
    if (fired.current || !venue) return;
    fired.current = true;
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#4648d4', '#6063ee', '#c0c1ff', '#00885d', '#ffdad6'],
    });
  }, [venue]);

  if (!venue) return null;

  const finalVenueData = meetup.venue_suggestions?.find((v) => v.name === venue.name);
  const travelTimes = finalVenueData?.travel_times;
  const participants = meetup.participants || [];

  const times = travelTimes ? Object.values(travelTimes) : [];
  const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const maxTime = times.length > 0 ? Math.max(...times) : null;
  const rating = finalVenueData?.rating ? Number(finalVenueData.rating) : null;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${venue.location?.lat},${venue.location?.lng}`;

  return (
    <div className="space-y-6 py-4">
      {/* Celebration header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-primary-container rounded-full shadow-lg flex items-center justify-center text-3xl animate-bounce mx-auto">
          🎉
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary">We have a winner!</h1>
          <p className="text-sm text-on-surface-variant mt-1">The fairest venue for everyone in the group</p>
        </div>
      </div>

      {/* Winner venue card */}
      <Card className="border-surface-container soft-glow overflow-hidden">
        <CardContent className="p-0">
          {/* Venue image placeholder */}
          {finalVenueData?.photo_reference ? (
            <div className="relative h-48 w-full">
              <img
                src={`https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${finalVenueData.photo_reference}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                alt={venue.name}
                className="w-full h-full object-cover"
              />
              {rating != null && (
                <div className="absolute top-3 right-3 bg-primary text-on-primary text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-md font-semibold">
                  <Star className="w-3 h-3 fill-current" />
                  {rating.toFixed(1)}
                </div>
              )}
            </div>
          ) : (
            <div className="h-32 bg-surface-container-low flex items-center justify-center text-on-surface-variant/30">
              <MapPin className="w-10 h-10" />
            </div>
          )}

          <div className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-on-surface">{venue.name}</h2>
                {rating != null && (
                  <div className="flex items-center gap-0.5 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-outline-variant'}`}
                      />
                    ))}
                    <span className="text-sm text-on-surface-variant ml-1">{rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-sm text-on-surface-variant flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
              {venue.address}
            </p>

            {maxTime != null && (
              <p className="text-xs text-on-surface-variant flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" />
                Longest trip: <span className="font-semibold text-on-surface ml-1">{maxTime} min</span>
              </p>
            )}

            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 bg-primary text-on-primary rounded-xl py-4 font-semibold text-sm active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              <ExternalLink className="w-4 h-4" /> Get Directions
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Fairness card */}
      {(avgTime != null || maxTime != null || participants.length > 0) && (
        <Card className="border-outline-variant/30">
          <CardContent className="p-4 space-y-4 bg-surface-container-low rounded-xl">
            <h3 className="text-sm font-semibold text-on-surface">Why it's the fairest choice</h3>
            {avgTime != null && maxTime != null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Travel time variance</span>
                  <span className="font-medium text-tertiary">
                    Low (±{Math.round(maxTime - avgTime)} min)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-tertiary rounded-full"
                    style={{ width: `${maxTime > 0 ? Math.max(10, 100 - ((maxTime - avgTime) / maxTime) * 100) : 100}%` }}
                  />
                </div>
              </div>
            )}
            {participants.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Attendees notified</span>
                  <span className="font-medium text-tertiary">
                    {participants.length} / {participants.length}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="h-full bg-tertiary rounded-full w-full" />
                </div>
              </div>
            )}
            {avgTime != null && (
              <p className="text-xs text-on-surface-variant flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Average trip: <span className="font-semibold text-on-surface ml-1">{avgTime} min</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <button
        onClick={onOpenChat}
        className="flex w-full items-center justify-center gap-2 bg-secondary-container text-on-secondary-container rounded-xl py-4 font-semibold text-sm active:scale-95 transition-all"
      >
        <MessageCircle className="w-4 h-4" /> Open Chat
      </button>
    </div>
  );
}
