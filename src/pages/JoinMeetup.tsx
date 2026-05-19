import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useJoinMeetup } from '@/hooks/useMeetups';

export const PENDING_JOIN_KEY = 'fairmeet-pending-join';

export default function JoinMeetup() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const joinMeetup = useJoinMeetup();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (loading || !code || attempted.current) return;
    attempted.current = true;

    if (!user) {
      // Stash the code so Login can resume the join after authentication.
      sessionStorage.setItem(PENDING_JOIN_KEY, code);
      navigate('/', { replace: true });
      return;
    }

    joinMeetup.mutate(code, {
      onSuccess: (meetupId) => {
        sessionStorage.removeItem(PENDING_JOIN_KEY);
        navigate(`/meetup/${meetupId}`, { replace: true });
      },
      onError: () => {
        sessionStorage.removeItem(PENDING_JOIN_KEY);
        setError('This invite link is invalid or has expired.');
      },
    });
  }, [loading, user, code, joinMeetup, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <MapPin className="w-10 h-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Can't join this meetup</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => navigate('/dashboard')}>Go to dashboard</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-6 h-6 animate-spin" />
      <p className="text-sm text-muted-foreground">Joining meetup…</p>
    </div>
  );
}
