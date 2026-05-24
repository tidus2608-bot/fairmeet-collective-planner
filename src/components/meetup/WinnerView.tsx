import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { MapPin, Star, ExternalLink, MessageCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
  }, [venue]);

  if (!venue) return null;

  const finalVenueData = meetup.venue_suggestions?.find((v) => v.name === venue.name);
  const travelTimes = finalVenueData?.travel_times;
  const participants = meetup.participants || [];

  const times = travelTimes ? Object.values(travelTimes) : [];
  const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const maxTime = times.length > 0 ? Math.max(...times) : null;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${venue.location?.lat},${venue.location?.lng}`;

  return (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-2">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-bold">We have a winner!</h1>
        <p className="text-sm text-muted-foreground">The fairest venue for everyone in the group</p>
      </div>

      <Card className="border-green-400">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold">{venue.name}</h2>
                <Badge className="text-xs bg-green-600 hover:bg-green-700 text-white border-0">
                  Fairest pick
                </Badge>
              </div>
              {finalVenueData && (
                <div className="flex items-center gap-0.5 mt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < Math.round(Number(finalVenueData.rating)) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
                    />
                  ))}
                  <span className="text-sm text-muted-foreground ml-1">
                    {Number(finalVenueData.rating).toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            {venue.address}
          </p>

          {maxTime != null && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Longest trip: <span className="font-semibold text-foreground ml-1">{maxTime} min</span>
            </p>
          )}

          <Button className="w-full gap-2" asChild>
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" /> Get Directions
            </a>
          </Button>
        </CardContent>
      </Card>

      {(avgTime != null || maxTime != null || participants.length > 0) && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold">Why it's the fairest choice</h3>
            {avgTime != null && maxTime != null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Travel time variance</span>
                  <span className="font-medium text-green-600">
                    Low (±{Math.round(maxTime - avgTime)} min)
                  </span>
                </div>
                <Progress
                  value={maxTime > 0 ? Math.max(10, 100 - ((maxTime - avgTime) / maxTime) * 100) : 100}
                  className="h-2 [&>div]:bg-green-500"
                />
              </div>
            )}
            {participants.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Attendees notified</span>
                  <span className="font-medium text-green-600">
                    {participants.length} / {participants.length}
                  </span>
                </div>
                <Progress value={100} className="h-2 [&>div]:bg-green-500" />
              </div>
            )}
            {avgTime != null && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Average trip: <span className="font-semibold text-foreground ml-1">{avgTime} min</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Button variant="outline" className="w-full gap-2" onClick={onOpenChat}>
        <MessageCircle className="w-4 h-4" /> Open Chat
      </Button>
    </div>
  );
}
