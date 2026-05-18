import { Check, Crown, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MeetupRow, useCastVote, useConfirmVenue, useSetMeetupStatus } from '@/hooks/useMeetups';
import CalendarExportDialog from '@/components/meetup/CalendarExportDialog';
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

  const pollVenues = (meetup.venue_suggestions || []).filter((v) => v.in_poll);

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

  // Confirmed banner — visible to everyone once the organizer picks a winner
  if (meetup.status === 'Confirmed' && meetup.final_venue) {
    const venue = meetup.final_venue as any;
    return (
      <div className="space-y-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-green-800">
              <Check className="w-5 h-5" />
              <span className="font-semibold">Venue Confirmed!</span>
            </div>
            <div>
              <p className="font-semibold">{venue.name}</p>
              <p className="text-sm text-muted-foreground flex items-start gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {venue.address}
              </p>
            </div>
            <CalendarExportDialog
              meetupName={meetup.name}
              meetupId={meetup.id}
              venueName={venue.name}
              venueAddress={venue.address}
            />
          </CardContent>
        </Card>

        {/* Keep the poll results visible below for reference */}
        <p className="text-xs text-muted-foreground px-1">Final vote tally</p>
        <div className="space-y-3">
          {pollVenues.map((v) => {
            const count = getVoteCount(v.id);
            const pct = (count / maxVotes) * 100;
            return (
              <Card key={v.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">{v.name}</h4>
                    <span className="text-sm font-medium">{count} vote{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isOrganizer && meetup.status === 'Planning' && (
        <Button className="w-full" onClick={() => setStatus.mutate({ meetupId: meetup.id, status: 'Voting' })}>Start Voting Phase</Button>
      )}

      <div className="space-y-3">
        {pollVenues.map((v) => {
          const count = getVoteCount(v.id);
          const isMyVote = myVote?.venue_id === v.id;
          const pct = (count / maxVotes) * 100;
          return (
            <Card key={v.id} className={isMyVote ? 'border-primary' : ''}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{v.name}</h4>
                  <span className="text-sm font-medium">{count} vote{count !== 1 ? 's' : ''}</span>
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
