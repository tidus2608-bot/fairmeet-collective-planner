import { Check, Crown, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MeetupRow, useCastVote, useConfirmVenue, useSetMeetupStatus } from '@/hooks/useMeetups';
import { venuePhotoUrl, venueWorstMinutes, sortByFairness } from '@/lib/venue';
import { toast } from 'sonner';

interface Props {
  meetup: MeetupRow;
  userId: string;
}

export default function VoteTab({ meetup, userId }: Props) {
  const castVote = useCastVote();
  const confirmVenue = useConfirmVenue();
  const setStatus = useSetMeetupStatus();
  const isOrganizer = meetup.organizer_id === userId;
  const votes = meetup.poll_votes || [];
  const myVote = votes.find((v) => v.user_id === userId);

  const pollVenues = sortByFairness((meetup.venue_suggestions || []).filter((v) => v.in_poll));

  const getVoteCount = (venueId: string) => votes.filter((v) => v.venue_id === venueId).length;
  const maxVotes = Math.max(1, ...pollVenues.map((v) => getVoteCount(v.id)));

  if (pollVenues.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No venues in poll yet</p>
        <p className="text-sm mt-1">The organizer can add venues from the Venues tab</p>
        {isOrganizer && meetup.status === 'Planning' && (meetup.venue_suggestions?.length || 0) > 0 && (
          <Button className="mt-4" onClick={() => setStatus.mutate({ meetupId: meetup.id, status: 'Voting' })}>Start Voting Phase</Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isOrganizer && meetup.status === 'Planning' && (
        <Button className="w-full" onClick={() => setStatus.mutate({ meetupId: meetup.id, status: 'Voting' })}>Start Voting Phase</Button>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-2">
        {pollVenues.map((v) => {
          const count = getVoteCount(v.id);
          const isMyVote = myVote?.venue_id === v.id;
          const pct = (count / maxVotes) * 100;
          const photo = venuePhotoUrl(v.photo_reference);
          const worst = venueWorstMinutes(v);
          return (
            <Card key={v.id} className={isMyVote ? 'border-primary' : ''}>
              <CardContent className="p-0">
                {photo && (
                  <img src={photo} alt={v.name} className="w-full h-28 object-cover rounded-t-lg" loading="lazy" />
                )}
                <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold truncate">{v.name}</h4>
                    {worst != null && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Worst trip {worst}m
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium whitespace-nowrap">{count} vote{count !== 1 ? 's' : ''}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={isMyVote ? 'default' : 'outline'} className="gap-1.5" onClick={() => castVote.mutate({ meetupId: meetup.id, venueId: v.id })}>
                    <Check className="w-3.5 h-3.5" /> {isMyVote ? 'Voted' : 'Vote'}
                  </Button>
                  {isOrganizer && meetup.status === 'Voting' && (
                    <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => confirmVenue.mutate({ meetupId: meetup.id, venue: { name: v.name, address: v.address, location: v.location } })}>
                      <Crown className="w-3.5 h-3.5" /> Confirm
                    </Button>
                  )}
                </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
