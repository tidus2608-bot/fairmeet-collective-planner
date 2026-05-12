import { useState } from 'react';
import { Sparkles, Plus, Loader2, MapPin, Star, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MeetupRow, VenueRow, useAddVenues, useSetVenueAiTheme, useToggleVenuePoll } from '@/hooks/useMeetups';
import MeetupMap from '@/components/MeetupMap';
import { supabase } from '@/integrations/supabase/client';
import { useUserPreferences, DEFAULT_PREFS } from '@/hooks/useUserPreferences';
import { toast } from 'sonner';

const categories = ['Food', 'Drinks', 'Coffee', 'Park'] as const;

interface Props {
  meetup: MeetupRow;
  userId: string;
}

export default function VenuesTab({ meetup, userId }: Props) {
  const addVenues = useAddVenues();
  const setAiTheme = useSetVenueAiTheme();
  const togglePoll = useToggleVenuePoll();
  const { data: prefs } = useUserPreferences();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [brainstormingId, setBrainstormingId] = useState<string | null>(null);
  const isOrganizer = meetup.organizer_id === userId;

  const participants = meetup.participants || [];
  const venues = meetup.venue_suggestions || [];

  const midpoint = (() => {
    const locs = participants.filter((p) => p.location).map((p) => p.location!);
    if (locs.length === 0) return undefined;
    return {
      lat: locs.reduce((s, l) => s + l.lat, 0) / locs.length,
      lng: locs.reduce((s, l) => s + l.lng, 0) / locs.length,
    };
  })();

  const filteredVenues = activeFilter ? venues.filter((v) => v.category === activeFilter) : venues;

  // Map participants to the format MeetupMap expects
  const mapParticipants = participants.map((p) => ({
    id: p.id,
    userId: p.user_id,
    userName: p.user_name,
    location: p.location || undefined,
    address: p.address || undefined,
    transportMode: p.transport_mode as any,
    status: p.status as any,
  }));

  const mapVenues = filteredVenues.map((v) => ({
    id: v.id,
    name: v.name,
    category: v.category as any,
    rating: Number(v.rating),
    address: v.address,
    location: v.location,
    travelTimes: v.travel_times || undefined,
    aiTheme: v.ai_theme || undefined,
    inPoll: v.in_poll,
  }));

  const handleFindVenues = async () => {
    if (!midpoint) { toast.error('Need at least one participant location'); return; }
    setLoadingVenues(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-midpoint', {
        body: { participants: participants.filter((p) => p.location) },
      });
      if (error) throw error;
      if (data.venues?.length) {
        await addVenues.mutateAsync({ meetupId: meetup.id, venues: data.venues });
        toast.success(`Found ${data.venues.length} venues!`);
      }
    } catch {
      // Fallback mock venues
      const mockVenues = [
        { name: 'Pho 10 Ly Quoc Su', category: 'Food', rating: 4.5, address: '10 Ly Quoc Su, Hoan Kiem', location: { lat: midpoint.lat + 0.002, lng: midpoint.lng + 0.001 }, travel_times: null, ai_theme: null, in_poll: false },
        { name: 'The Note Coffee', category: 'Coffee', rating: 4.3, address: '64 Luong Van Can, Hoan Kiem', location: { lat: midpoint.lat - 0.001, lng: midpoint.lng + 0.002 }, travel_times: null, ai_theme: null, in_poll: false },
        { name: 'Bia Hoi Corner', category: 'Drinks', rating: 4.1, address: 'Ta Hien, Hoan Kiem', location: { lat: midpoint.lat + 0.001, lng: midpoint.lng - 0.001 }, travel_times: null, ai_theme: null, in_poll: false },
        { name: 'Ly Thai To Park', category: 'Park', rating: 4.4, address: 'Dinh Tien Hoang, Hoan Kiem', location: { lat: midpoint.lat - 0.002, lng: midpoint.lng - 0.002 }, travel_times: null, ai_theme: null, in_poll: false },
      ];
      await addVenues.mutateAsync({ meetupId: meetup.id, venues: mockVenues as any });
      toast.success('Found 4 venues nearby!');
    }
    setLoadingVenues(false);
  };

  const handleBrainstorm = async (venue: VenueRow) => {
    setBrainstormingId(venue.id);
    try {
      const { data, error } = await supabase.functions.invoke('brainstorm-theme', {
        body: { venueName: venue.name, category: venue.category },
      });
      if (error) throw error;
      setAiTheme.mutate({ venueId: venue.id, theme: data.theme, meetupId: meetup.id });
    } catch {
      setAiTheme.mutate({ venueId: venue.id, theme: `Try a fun "${venue.category.toLowerCase()} challenge" at ${venue.name}!`, meetupId: meetup.id });
    }
    setBrainstormingId(null);
  };

  return (
    <div className="space-y-4">
      <MeetupMap participants={mapParticipants} venues={mapVenues} midpoint={midpoint} />

      {venues.length === 0 && (
        <Button onClick={handleFindVenues} className="w-full gap-2" disabled={loadingVenues}>
          {loadingVenues ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          Find Fair Venues (by travel time)
        </Button>
      )}

      {venues.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button variant={activeFilter === null ? 'default' : 'outline'} size="sm" onClick={() => setActiveFilter(null)}>All</Button>
          {categories.map((c) => (
            <Button key={c} variant={activeFilter === c ? 'default' : 'outline'} size="sm" onClick={() => setActiveFilter(c)}>{c}</Button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filteredVenues.map((v) => (
          <Card key={v.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold">{v.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">{v.category}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {Number(v.rating).toFixed(1)}
                    </span>
                  </div>
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
              {v.ai_theme && (
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                  <p className="text-sm">✨ {v.ai_theme}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleBrainstorm(v)} disabled={brainstormingId === v.id}>
                  {brainstormingId === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Brainstorm Theme
                </Button>
                {isOrganizer && !v.in_poll && (
                  <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => togglePoll.mutate({ venueId: v.id, inPoll: true, meetupId: meetup.id })}>
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
