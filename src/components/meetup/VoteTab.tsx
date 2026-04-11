import { Check, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAppStore } from '@/store/useAppStore';
import { Meetup } from '@/types/meetup';
import { toast } from 'sonner';

interface Props {
  meetup: Meetup;
  userId: string;
}

export default function VoteTab({ meetup, userId }: Props) {
  const { castVote, confirmVenue, setMeetupStatus } = useAppStore();
  const isOrganizer = meetup.organizerId === userId;
  const myVote = meetup.pollVotes.find((v) => v.userId === userId);

  const pollVenuesList = meetup.venueSuggestions.filter((v) => meetup.pollVenues.includes(v.id));

  const getVoteCount = (venueId: string) => meetup.pollVotes.filter((v) => v.venueId === venueId).length;
  const maxVotes = Math.max(1, ...pollVenuesList.map((v) => getVoteCount(v.id)));

  if (pollVenuesList.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No venues in poll yet</p>
        <p className="text-sm mt-1">The organizer can add venues from the Venues tab</p>
        {isOrganizer && meetup.status === 'Planning' && meetup.venueSuggestions.length > 0 && (
          <Button className="mt-4" onClick={() => setMeetupStatus(meetup.id, 'Voting')}>
            Start Voting Phase
          </Button>
        )}
      </div>
    );
  }

  const handleVote = (venueId: string) => {
    castVote(meetup.id, venueId);
    toast.success('Vote cast!');
  };

  const handleConfirm = (venueId: string) => {
    confirmVenue(meetup.id, venueId);
    toast.success('Venue confirmed!');
  };

  return (
    <div className="space-y-4">
      {isOrganizer && meetup.status === 'Planning' && (
        <Button className="w-full" onClick={() => setMeetupStatus(meetup.id, 'Voting')}>
          Start Voting Phase
        </Button>
      )}

      <div className="space-y-3">
        {pollVenuesList.map((v) => {
          const count = getVoteCount(v.id);
          const isMyVote = myVote?.venueId === v.id;
          const pct = (count / maxVotes) * 100;

          return (
            <Card key={v.id} className={isMyVote ? 'border-primary' : ''}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{v.name}</h4>
                  <span className="text-sm font-medium">{count} vote{count !== 1 ? 's' : ''}</span>
                </div>

                {/* Bar */}
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={isMyVote ? 'default' : 'outline'}
                    className="gap-1.5"
                    onClick={() => handleVote(v.id)}
                  >
                    <Check className="w-3.5 h-3.5" /> {isMyVote ? 'Voted' : 'Vote'}
                  </Button>
                  {isOrganizer && meetup.status === 'Voting' && (
                    <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => handleConfirm(v.id)}>
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
