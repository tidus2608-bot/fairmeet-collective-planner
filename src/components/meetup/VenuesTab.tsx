import { useState, useEffect, useRef } from 'react';
import { Plus, Loader2, Star, Clock, Users, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MeetupRow,
  ParticipantRow,
  useReplaceVenues,
  useToggleVenuePoll,
  useUpdateTransportMode,
} from '@/hooks/useMeetups';
import type { TransportMode, VenueCategory } from '@/types/meetup';
import MeetupMap from '@/components/MeetupMap';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CATEGORY_FILTERS = ['Food', 'Drinks', 'Coffee'] as const;

const TRANSPORT_OPTIONS = [
  { value: 'driving', label: '🚗 Driving' },
  { value: 'walking', label: '🚶 Walking' },
  { value: 'cycling', label: '🚲 Cycling' },
  { value: 'transit', label: '🚌 Transit' },
] as const;

interface Props {
  meetup: MeetupRow;
  userId: string;
}

export default function VenuesTab({ meetup, userId }: Props) {
  const replaceVenues = useReplaceVenues();
  const togglePoll = useToggleVenuePoll();
  const updateTransport = useUpdateTransportMode();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const isOrganizer = meetup.organizer_id === userId;

  const participants = meetup.participants || [];
  const venues = meetup.venue_suggestions || [];
  const locatedParticipants = participants.filter((p) => p.location);
  const locatedCount = locatedParticipants.length;
  const myParticipant = participants.find((p) => p.user_id === userId);
  const myMode = myParticipant?.transport_mode || 'driving';

  // Refs to detect real changes vs initial mount
  const prevLocatedCountRef = useRef<number | null>(null);
  const prevModeRef = useRef<string | null>(null);

  const midpoint =
    locatedCount > 0
      ? {
          lat: locatedParticipants.reduce((s, p) => s + p.location!.lat, 0) / locatedCount,
          lng: locatedParticipants.reduce((s, p) => s + p.location!.lng, 0) / locatedCount,
        }
      : undefined;

  const filteredVenues = activeFilter
    ? venues.filter((v) => v.category === activeFilter)
    : venues;

  const mapParticipants = participants.map((p) => ({
    id: p.id,
    userId: p.user_id,
    userName: p.user_name,
    location: p.location || undefined,
    address: p.address || undefined,
    transportMode: p.transport_mode as TransportMode,
    status: p.status as 'awaiting' | 'location_set',
  }));

  const mapVenues = filteredVenues.map((v) => ({
    id: v.id,
    name: v.name,
    category: v.category as VenueCategory,
    rating: Number(v.rating),
    address: v.address,
    location: v.location,
    travelTimes: v.travel_times || undefined,
    aiTheme: undefined,
    inPoll: v.in_poll,
  }));

  const runVenueSearch = async (located: ParticipantRow[]) => {
    setLoadingVenues(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-midpoint', {
        body: { participants: located },
      });
      if (error) throw error;
      if (data.venues?.length) {
        await replaceVenues.mutateAsync({ meetupId: meetup.id, venues: data.venues });
        toast.success(`Found ${data.venues.length} venues`);
      } else {
        toast.error(data.note || 'No venues found nearby');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not find venues');
    }
    setLoadingVenues(false);
  };

  // Trigger when a new participant sets their location
  useEffect(() => {
    const prev = prevLocatedCountRef.current;
    prevLocatedCountRef.current = locatedCount;

    if (locatedCount < 2) return;
    if (prev === null && venues.length > 0) return; // existing venues on mount → skip
    if (prev === null || locatedCount > prev) {
      runVenueSearch(locatedParticipants);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locatedCount]);

  // Re-run when the current user changes their transport mode
  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = myMode;

    if (prev === null) return; // initial mount → skip
    if (myMode === prev) return; // no real change
    if (locatedCount >= 2) {
      runVenueSearch(locatedParticipants);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myMode]);

  const handleModeChange = (mode: string) => {
    updateTransport.mutate({ meetupId: meetup.id, mode });
  };

  return (
    <div className="space-y-4">
      <MeetupMap participants={mapParticipants} venues={mapVenues} midpoint={midpoint} />

      {/* Waiting state */}
      {locatedCount < 2 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <Users className="w-8 h-8 opacity-40" />
          <p className="font-medium">Waiting for participants</p>
          <p className="text-sm">
            {locatedCount === 0
              ? 'Venue suggestions appear once 2 people share their location.'
              : '1 person has shared their location — one more to go!'}
          </p>
        </div>
      )}

      {/* Loading state */}
      {locatedCount >= 2 && loadingVenues && (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Finding fair venues…</span>
        </div>
      )}

      {/* Transport mode selector + category filters */}
      {locatedCount >= 2 && !loadingVenues && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={myMode} onValueChange={handleModeChange}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSPORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {venues.length > 0 && (
            <>
              <div className="w-px h-5 bg-border" />
              <Button
                variant={activeFilter === null ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => setActiveFilter(null)}
              >
                All
              </Button>
              {CATEGORY_FILTERS.map((c) => (
                <Button
                  key={c}
                  variant={activeFilter === c ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => setActiveFilter(c)}
                >
                  {c}
                </Button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Venue cards */}
      <div className="space-y-3">
        {filteredVenues.map((v) => (
          <Card key={v.id}>
            <CardContent className="p-4 space-y-3">
              <div>
                <h4 className="font-semibold">{v.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {v.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {Number(v.rating).toFixed(1)}
                  </span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">{v.address}</p>

              {v.travel_times && Object.keys(v.travel_times).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {participants
                    .filter((p) => v.travel_times?.[p.user_id] != null)
                    .map((p) => {
                      const mins = v.travel_times![p.user_id];
                      const worst = Math.max(...Object.values(v.travel_times!));
                      const isWorst = mins === worst;
                      return (
                        <Badge
                          key={p.user_id}
                          variant={isWorst ? 'default' : 'outline'}
                          className="text-xs gap-1"
                        >
                          <Clock className="w-3 h-3" />
                          {p.user_name.split(' ')[0]} {mins}m
                        </Badge>
                      );
                    })}
                </div>
              )}

              <div className="flex items-center gap-2">
                <a
                  href={`https://www.google.com/maps?q=${v.location.lat},${v.location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> View in Maps
                  </Button>
                </a>
                {isOrganizer && !v.in_poll && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5"
                    onClick={() =>
                      togglePoll.mutate({ venueId: v.id, inPoll: true, meetupId: meetup.id })
                    }
                  >
                    <Plus className="w-3.5 h-3.5" /> Add to Vote
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
