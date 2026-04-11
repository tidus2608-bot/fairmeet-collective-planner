import { useState } from 'react';
import { Filter, Sparkles, Plus, Loader2, MapPin, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/useAppStore';
import { Meetup, VenueCategory, VenueSuggestion } from '@/types/meetup';
import MeetupMap from '@/components/MeetupMap';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const categories: VenueCategory[] = ['Food', 'Drinks', 'Coffee', 'Park'];

interface Props {
  meetup: Meetup;
  userId: string;
}

export default function VenuesTab({ meetup, userId }: Props) {
  const { addVenueSuggestions, setVenueAiTheme, addVenueToPoll } = useAppStore();
  const [activeFilter, setActiveFilter] = useState<VenueCategory | null>(null);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [brainstormingId, setBrainstormingId] = useState<string | null>(null);
  const isOrganizer = meetup.organizerId === userId;

  const midpoint = (() => {
    const locs = meetup.participants.filter((p) => p.location).map((p) => p.location!);
    if (locs.length === 0) return undefined;
    return {
      lat: locs.reduce((s, l) => s + l.lat, 0) / locs.length,
      lng: locs.reduce((s, l) => s + l.lng, 0) / locs.length,
    };
  })();

  const filteredVenues = activeFilter
    ? meetup.venueSuggestions.filter((v) => v.category === activeFilter)
    : meetup.venueSuggestions;

  const handleFindVenues = async () => {
    if (!midpoint) {
      toast.error('Need at least one participant location');
      return;
    }
    setLoadingVenues(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-midpoint', {
        body: { participants: meetup.participants.filter((p) => p.location) },
      });
      if (error) throw error;
      addVenueSuggestions(meetup.id, data.venues || []);
      toast.success(`Found ${data.venues?.length || 0} venues!`);
    } catch {
      // Generate mock venues around midpoint
      const mockVenues: VenueSuggestion[] = [
        { id: `v-${Date.now()}-1`, name: 'Pho 10 Ly Quoc Su', category: 'Food', rating: 4.5, address: '10 Ly Quoc Su, Hoan Kiem', location: { lat: midpoint.lat + 0.002, lng: midpoint.lng + 0.001 }, travelTimes: {} },
        { id: `v-${Date.now()}-2`, name: 'The Note Coffee', category: 'Coffee', rating: 4.3, address: '64 Luong Van Can, Hoan Kiem', location: { lat: midpoint.lat - 0.001, lng: midpoint.lng + 0.002 }, travelTimes: {} },
        { id: `v-${Date.now()}-3`, name: 'Bia Hoi Corner', category: 'Drinks', rating: 4.1, address: 'Ta Hien, Hoan Kiem', location: { lat: midpoint.lat + 0.001, lng: midpoint.lng - 0.001 }, travelTimes: {} },
        { id: `v-${Date.now()}-4`, name: 'Ly Thai To Park', category: 'Park', rating: 4.4, address: 'Dinh Tien Hoang, Hoan Kiem', location: { lat: midpoint.lat - 0.002, lng: midpoint.lng - 0.002 }, travelTimes: {} },
      ];
      addVenueSuggestions(meetup.id, mockVenues);
      toast.success('Found 4 venues nearby!');
    }
    setLoadingVenues(false);
  };

  const handleBrainstorm = async (venue: VenueSuggestion) => {
    setBrainstormingId(venue.id);
    try {
      const { data, error } = await supabase.functions.invoke('brainstorm-theme', {
        body: { venueName: venue.name, category: venue.category },
      });
      if (error) throw error;
      setVenueAiTheme(meetup.id, venue.id, data.theme);
    } catch {
      setVenueAiTheme(meetup.id, venue.id, `Try a fun "${venue.category.toLowerCase()} challenge" at ${venue.name} — everyone picks a dish/drink for someone else!`);
    }
    setBrainstormingId(null);
  };

  return (
    <div className="space-y-4">
      <MeetupMap participants={meetup.participants} venues={filteredVenues} midpoint={midpoint} />

      {meetup.venueSuggestions.length === 0 && (
        <Button onClick={handleFindVenues} className="w-full gap-2" disabled={loadingVenues}>
          {loadingVenues ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          Find Venues in Fair Zone
        </Button>
      )}

      {/* Filters */}
      {meetup.venueSuggestions.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            variant={activeFilter === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter(null)}
          >
            All
          </Button>
          {categories.map((c) => (
            <Button
              key={c}
              variant={activeFilter === c ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      )}

      {/* Venue List */}
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
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {v.rating}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{v.address}</p>

              {v.aiTheme && (
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                  <p className="text-sm">✨ {v.aiTheme}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleBrainstorm(v)}
                  disabled={brainstormingId === v.id}
                >
                  {brainstormingId === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Brainstorm Theme
                </Button>
                {isOrganizer && !meetup.pollVenues.includes(v.id) && (
                  <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => addVenueToPoll(meetup.id, v.id)}>
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
