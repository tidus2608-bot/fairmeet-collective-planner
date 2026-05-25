import { ThumbsUp, ThumbsDown, Crown, Clock, MapPin, Star } from 'lucide-react';
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
      <div className="text-center py-16 text-on-surface-variant">
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

      {/* Live Leaderboard */}
      <Card className="border border-surface-container">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-on-surface">Live Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedByVotes.map((v, idx) => {
            const upvotes = getUpvotes(v.id);
            const pct = totalUpvotes > 0 ? (upvotes / totalUpvotes) * 100 : 0;
            return (
              <div key={v.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0
                      ${idx === 0
                        ? 'bg-tertiary-container text-on-tertiary'
                        : 'bg-primary-container text-on-primary-container'}`}>
                      {idx + 1}
                    </div>
                    <span className="font-medium truncate text-on-surface">{v.name}</span>
                  </span>
                  <span className="text-on-surface-variant font-medium ml-2 flex-shrink-0">
                    {upvotes} vote{upvotes !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${idx === 0 ? 'bg-tertiary-container' : 'bg-primary-container'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Venue Cards */}
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pollVenues.map((v) => {
          const upvotes = getUpvotes(v.id);
          const downvotes = getDownvotes(v.id);
          const myVoteType = getMyVoteType(v.id);
          const photo = venuePhotoUrl(v.photo_reference);
          const worst = venueWorstMinutes(v);
          const rating = v.rating ? Number(v.rating) : null;
          return (
            <Card
              key={v.id}
              className={`overflow-hidden border soft-glow transition-all active:scale-[0.98]
                ${myVoteType === 'up'
                  ? 'border-primary ring-2 ring-primary/20'
                  : myVoteType === 'down'
                    ? 'border-error-container ring-2 ring-error-container/20'
                    : 'border-surface-container-high'}`}
            >
              <CardContent className="p-0">
                {/* Image with overlay badges */}
                <div className="relative h-48 w-full bg-surface-container-high">
                  {photo ? (
                    <img
                      src={photo}
                      alt={v.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-on-surface-variant/30">
                      <MapPin className="w-8 h-8" />
                    </div>
                  )}
                  {rating != null && (
                    <div className="absolute top-3 left-3 bg-primary text-on-primary text-xs px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                      <Star className="w-3 h-3 fill-current" />
                      {rating.toFixed(1)}
                    </div>
                  )}
                  {worst != null && (
                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm text-on-surface text-xs px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                      <Clock className="w-3 h-3 text-primary" />
                      Worst: {worst}m
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold text-base text-on-surface truncate">{v.name}</h4>
                    {v.address && (
                      <p className="text-sm text-on-surface-variant truncate mt-0.5">{v.address}</p>
                    )}
                  </div>

                  {/* Vote buttons */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleVote(v.id, 'up')}
                        disabled={voteVenue.isPending}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50
                          ${myVoteType === 'up'
                            ? 'bg-primary-container text-on-primary-container'
                            : 'bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container'}`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-medium text-on-surface-variant min-w-[1ch]">{upvotes}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleVote(v.id, 'down')}
                        disabled={voteVenue.isPending}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50
                          ${myVoteType === 'down'
                            ? 'bg-error-container text-on-error-container'
                            : 'bg-surface-container-high hover:bg-error-container hover:text-on-error-container'}`}
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-medium text-on-surface-variant min-w-[1ch]">{downvotes}</span>
                    </div>
                    {isOrganizer && meetup.status === 'Voting' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="ml-auto gap-1.5"
                        onClick={() =>
                          confirmVenue.mutate({
                            meetupId: meetup.id,
                            venue: { name: v.name, address: v.address, location: v.location },
                          })
                        }
                        disabled={confirmVenue.isPending}
                      >
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
