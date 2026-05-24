import { ThumbsUp, ThumbsDown, Crown, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MeetupRow, useVoteVenue, useConfirmVenue, useSetMeetupStatus } from '@/hooks/useMeetups';
import { venuePhotoUrl, venueWorstMinutes, sortByFairness } from '@/lib/venue';
import { toast } from 'sonner';

interface Props {
  meetup: MeetupRow;
  userId: string;
}

export default function VoteTab({ meetup, userId }: Props) {
  const voteVenue = useVoteVenue();
  const confirmVenue = useConfirmVenue();
  const setStatus = useSetMeetupStatus();
  const isOrganizer = meetup.organizer_id === userId;
  const votes = meetup.poll_votes || [];

  const pollVenues = sortByFairness((meetup.venue_suggestions || []).filter((v) => v.in_poll));

  const getUpvotes = (venueId: string) =>
    votes.filter((v) => v.venue_id === venueId && v.vote_type === 'up').length;
  const getDownvotes = (venueId: string) =>
    votes.filter((v) => v.venue_id === venueId && v.vote_type === 'down').length;
  const getMyVoteType = (venueId: string) =>
    votes.find((v) => v.venue_id === venueId && v.user_id === userId)?.vote_type ?? null;

  const totalUpvotes = pollVenues.reduce((sum, v) => sum + getUpvotes(v.id), 0);
  const sortedByVotes = [...pollVenues].sort((a, b) => getUpvotes(b.id) - getUpvotes(a.id));

  if (pollVenues.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <MapPin className="w-10 h-10 mx-auto opacity-30 mb-3" />
        <p className="text-lg font-medium">No venues in poll yet</p>
        <p className="text-sm mt-1">The organizer can add venues from the Venues tab</p>
        {isOrganizer && meetup.status === 'Planning' && (meetup.venue_suggestions?.length || 0) > 0 && (
          <Button
            className="mt-4"
            onClick={() => setStatus.mutate({ meetupId: meetup.id, status: 'Voting' })}
          >
            Start Voting Phase
          </Button>
        )}
      </div>
    );
  }

  const handleVote = (venueId: string, voteType: 'up' | 'down') => {
    voteVenue.mutate(
      { meetupId: meetup.id, venueId, voteType, currentVoteType: getMyVoteType(venueId) },
      { onError: () => toast.error('Could not record vote') },
    );
  };

  return (
    <div className="space-y-5">
      {isOrganizer && meetup.status === 'Planning' && (
        <Button
          className="w-full"
          onClick={() => setStatus.mutate({ meetupId: meetup.id, status: 'Voting' })}
        >
          Start Voting Phase
        </Button>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Live Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedByVotes.map((v, idx) => {
            const upvotes = getUpvotes(v.id);
            const pct = totalUpvotes > 0 ? (upvotes / totalUpvotes) * 100 : 0;
            return (
              <div key={v.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    {idx === 0 && <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                    <span className="font-medium truncate">{v.name}</span>
                  </span>
                  <span className="text-muted-foreground font-medium ml-2 flex-shrink-0">
                    {Math.round(pct)}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${idx === 0 ? 'bg-primary' : 'bg-primary/50'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pollVenues.map((v) => {
          const upvotes = getUpvotes(v.id);
          const downvotes = getDownvotes(v.id);
          const myVoteType = getMyVoteType(v.id);
          const photo = venuePhotoUrl(v.photo_reference);
          const worst = venueWorstMinutes(v);
          return (
            <Card
              key={v.id}
              className={
                myVoteType === 'up'
                  ? 'border-green-500'
                  : myVoteType === 'down'
                    ? 'border-red-400'
                    : ''
              }
            >
              <CardContent className="p-0">
                {photo && (
                  <img
                    src={photo}
                    alt={v.name}
                    className="w-full h-28 object-cover rounded-t-lg"
                    loading="lazy"
                  />
                )}
                <div className="p-3 space-y-2">
                  <h4 className="font-semibold text-sm truncate">{v.name}</h4>
                  {worst != null && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Worst trip {worst}m
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={myVoteType === 'up' ? 'default' : 'outline'}
                      className={`flex-1 gap-1.5 ${myVoteType === 'up' ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}`}
                      onClick={() => handleVote(v.id, 'up')}
                      disabled={voteVenue.isPending}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {upvotes}
                    </Button>
                    <Button
                      size="sm"
                      variant={myVoteType === 'down' ? 'destructive' : 'outline'}
                      className="flex-1 gap-1.5"
                      onClick={() => handleVote(v.id, 'down')}
                      disabled={voteVenue.isPending}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      {downvotes}
                    </Button>
                  </div>
                  {isOrganizer && meetup.status === 'Voting' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full gap-1.5"
                      onClick={() =>
                        confirmVenue.mutate({
                          meetupId: meetup.id,
                          venue: { name: v.name, address: v.address, location: v.location },
                        })
                      }
                      disabled={confirmVenue.isPending}
                    >
                      <Crown className="w-3.5 h-3.5" /> Confirm Winner
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
