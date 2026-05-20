import { useState } from 'react';
import { Plus, Loader2, MapPin, Star, Clock, Trash2, RefreshCw, Globe, Phone, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MeetupRow, VenueRow, useAddVenues, useToggleVenuePoll, useDeleteVenue } from '@/hooks/useMeetups';
import MeetupMap from '@/components/MeetupMap';
import AddVenueDialog from '@/components/meetup/AddVenueDialog';
import { supabase } from '@/integrations/supabase/client';
import { useUserPreferences, DEFAULT_PREFS } from '@/hooks/useUserPreferences';
import { venuePhotoUrl, priceLevelLabel, venueWorstMinutes, sortByFairness } from '@/lib/venue';
import type { Participant, TransportMode, VenueCategory } from '@/types/meetup';
import { toast } from 'sonner';

const categories = ['Food', 'Drinks', 'Coffee', 'Park'] as const;

interface Props {
  meetup: MeetupRow;
  userId: string;
}

export default function VenuesTab({ meetup, userId }: Props) {
  const addVenues = useAddVenues();
  const togglePoll = useToggleVenuePoll();
  const deleteVenue = useDeleteVenue();
  const { data: prefs } = useUserPreferences();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const isOrganizer = meetup.organizer_id === userId;

  const participants = meetup.participants || [];
  const venues = meetup.venue_suggestions || [];
  const locatedParticipants = participants.filter((p) => p.location);

  const midpoint = (() => {
    const locs = locatedParticipants.map((p) => p.location!);
    if (locs.length === 0) return undefined;
    return {
      lat: locs.reduce((s, l) => s + l.lat, 0) / locs.length,
      lng: locs.reduce((s, l) => s + l.lng, 0) / locs.length,
    };
  })();

  const sortedVenues = sortByFairness(venues);
  const fairestId = sortedVenues.find((v) => venueWorstMinutes(v) != null)?.id;
  const filteredVenues = activeFilter ? sortedVenues.filter((v) => v.category === activeFilter) : sortedVenues;

  const mapParticipants = participants.map((p) => ({
    id: p.id,
    userId: p.user_id,
    userName: p.user_name,
    location: p.location || undefined,
    address: p.address || undefined,
    transportMode: p.transport_mode as TransportMode,
    status: p.status as Participant['status'],
  }));

  const mapVenues = filteredVenues.map((v) => ({
    id: v.id,
    name: v.name,
    category: v.category as VenueCategory,
    rating: Number(v.rating),
    address: v.address,
    location: v.location,
    travelTimes: v.travel_times || undefined,
    aiTheme: v.ai_theme || undefined,
    inPoll: v.in_poll,
  }));

  const discoverVenues = async (replace: boolean) => {
    if (!midpoint) {
      toast.error('Set at least one participant location on the Overview tab first');
      return;
    }
    setLoadingVenues(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-midpoint', {
        body: {
          participants: locatedParticipants,
          preferences: prefs ?? DEFAULT_PREFS,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const found: VenueRow[] = data?.venues ?? [];
      if (!found.length) {
        toast.warning('No venues matched — try widening your preferences in Settings.');
        return;
      }
      await addVenues.mutateAsync({ meetupId: meetup.id, venues: found, replace });
      toast.success(`Found ${found.length} fair venue${found.length === 1 ? '' : 's'}!`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not reach the venue search service';
      toast.error(`Venue search failed: ${msg}`);
    } finally {
      setLoadingVenues(false);
    }
  };

  const handleDelete = (venue: VenueRow) => {
    deleteVenue.mutate(
      { venueId: venue.id, meetupId: meetup.id },
      {
        onSuccess: () => toast.success(`Removed ${venue.name}`),
        onError: () => toast.error('Could not remove venue'),
      },
    );
  };

  return (
    <div className="space-y-4">
      <MeetupMap participants={mapParticipants} venues={mapVenues} midpoint={midpoint} />

      {locatedParticipants.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground space-y-1">
            <MapPin className="w-6 h-6 mx-auto opacity-50" />
            <p className="text-sm font-medium">No participant locations yet</p>
            <p className="text-xs">Ask everyone to set their location on the Overview tab so FairMeet can find venues that are fair for the whole group.</p>
          </CardContent>
        </Card>
      )}

      {venues.length === 0 && locatedParticipants.length > 0 && (
        <Button onClick={() => discoverVenues(false)} className="w-full gap-2" disabled={loadingVenues}>
          {loadingVenues ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          Find Fair Venues (by travel time)
        </Button>
      )}

      {venues.length === 0 && isOrganizer && locatedParticipants.length > 0 && (
        <AddVenueDialog meetupId={meetup.id} userId={userId} />
      )}

      {venues.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
            <Button variant={activeFilter === null ? 'default' : 'outline'} size="sm" onClick={() => setActiveFilter(null)}>All</Button>
            {categories.map((c) => (
              <Button key={c} variant={activeFilter === c ? 'default' : 'outline'} size="sm" onClick={() => setActiveFilter(c)}>{c}</Button>
            ))}
          </div>
          {isOrganizer && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConfirmRefresh(true)} disabled={loadingVenues}>
              {loadingVenues ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </Button>
          )}
        </div>
      )}

      {venues.length > 0 && isOrganizer && <AddVenueDialog meetupId={meetup.id} userId={userId} />}

      {loadingVenues && venues.length === 0 && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}><CardContent className="p-4 space-y-3">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent></Card>
          ))}
        </div>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-2">
        {filteredVenues.map((v) => {
          const photo = venuePhotoUrl(v.photo_reference);
          const price = priceLevelLabel(v.price_level);
          const worst = venueWorstMinutes(v);
          const isFairest = v.id === fairestId;
          const canRemove = isOrganizer || v.added_by === userId;
          return (
            <Card key={v.id} className={isFairest ? 'border-primary' : ''}>
              <CardContent className="p-0">
                {photo && (
                  <img src={photo} alt={v.name} className="w-full h-32 object-cover rounded-t-lg" loading="lazy" />
                )}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-semibold">{v.name}</h4>
                        {isFairest && (
                          <Badge className="text-[10px] gap-0.5"><Award className="w-3 h-3" /> Fairest pick</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{v.category}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {Number(v.rating).toFixed(1)}
                        </span>
                        {price && <span className="text-xs text-muted-foreground">{price}</span>}
                        {v.opening_hours?.open_now != null && (
                          <Badge variant={v.opening_hours.open_now ? 'default' : 'outline'} className="text-[10px]">
                            {v.opening_hours.open_now ? 'Open now' : 'Closed'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {canRemove && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(v)} disabled={deleteVenue.isPending}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground">{v.address}</p>

                  {(v.website || v.phone) && (
                    <div className="flex flex-wrap gap-3 text-xs">
                      {v.website && (
                        <a href={v.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <Globe className="w-3 h-3" /> Website
                        </a>
                      )}
                      {v.phone && (
                        <a href={`tel:${v.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                          <Phone className="w-3 h-3" /> {v.phone}
                        </a>
                      )}
                    </div>
                  )}

                  {worst != null && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Worst trip for the group: <span className="font-medium text-foreground">{worst}m</span>
                    </p>
                  )}

                  {v.travel_times && Object.keys(v.travel_times).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {participants
                        .filter((p) => v.travel_times?.[p.user_id] != null)
                        .map((p) => {
                          const mins = v.travel_times![p.user_id];
                          const worstT = Math.max(...Object.values(v.travel_times!));
                          const isWorst = mins === worstT;
                          return (
                            <Badge key={p.user_id} variant={isWorst ? 'default' : 'outline'} className="text-xs gap-1">
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

                  <div className="flex gap-2 flex-wrap">
                    {isOrganizer && !v.in_poll && (
                      <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => togglePoll.mutate({ venueId: v.id, inPoll: true, meetupId: meetup.id })}>
                        <Plus className="w-3.5 h-3.5" /> Add to Vote
                      </Button>
                    )}
                    {isOrganizer && v.in_poll && (
                      <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => togglePoll.mutate({ venueId: v.id, inPoll: false, meetupId: meetup.id })}>
                        Remove from Vote
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={confirmRefresh} onOpenChange={setConfirmRefresh}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refresh venues?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the current suggestions with a fresh search using all participants' latest locations. Venues currently in the vote will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => discoverVenues(true)}>Refresh</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
