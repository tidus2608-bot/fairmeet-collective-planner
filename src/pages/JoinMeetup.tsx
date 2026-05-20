import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useJoinMeetup } from '@/hooks/useMeetups';

export const PENDING_JOIN_KEY = 'fairmeet-pending-join';

export default function JoinMeetup() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, loading, signInAsGuest } = useAuth();
  const joinMeetup = useJoinMeetup();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const attempted = useRef(false);

  const runJoin = (guestName?: string) => {
    if (!code) return;
    joinMeetup.mutate(
      { code, name: guestName },
      {
        onSuccess: (meetupId) => {
          sessionStorage.removeItem(PENDING_JOIN_KEY);
          navigate(`/meetup/${meetupId}`, { replace: true });
        },
        onError: () => setError('This invite link is invalid or has expired.'),
      },
    );
  };

  // A logged-in host (or a returning guest with an existing session) joins
  // immediately. New guests get the name form below instead.
  useEffect(() => {
    if (loading || !code || !user || attempted.current) return;
    attempted.current = true;
    runJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, code]);

  const handleGuestJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setSubmitting(true);
    attempted.current = true; // stop the effect from double-firing once the session appears
    const { error: authError } = await signInAsGuest(trimmed);
    setSubmitting(false);
    if (authError) {
      attempted.current = false;
      const disabled = /disabled|not enabled/i.test(authError.message);
      setError(
        disabled
          ? 'Guest joining isn’t enabled for this app yet. Please log in instead.'
          : 'Could not start a guest session. Please try again or log in.',
      );
      return;
    }
    runJoin(trimmed);
  };

  const loginFallback = () => {
    if (code) sessionStorage.setItem(PENDING_JOIN_KEY, code);
    navigate('/', { replace: true });
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <MapPin className="w-10 h-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Can't join this meetup</h1>
        <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loginFallback}>Log in</Button>
          <Button onClick={() => navigate('/dashboard')}>Go to dashboard</Button>
        </div>
      </div>
    );
  }

  // New guest: ask only for a display name, then join anonymously.
  if (!loading && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6">
        <div className="text-center space-y-1">
          <MapPin className="w-9 h-9 text-primary mx-auto" />
          <h1 className="text-xl font-semibold">Join the meetup</h1>
          <p className="text-sm text-muted-foreground">Enter your name to join as a guest.</p>
        </div>
        <form onSubmit={handleGuestJoin} className="w-full max-w-xs space-y-3">
          <Input
            autoFocus
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          <Button type="submit" className="w-full gap-2" disabled={!name.trim() || submitting || joinMeetup.isPending}>
            {(submitting || joinMeetup.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
            Join meetup
          </Button>
        </form>
        <button onClick={loginFallback} className="text-xs text-muted-foreground hover:underline">
          Have an account? Log in
        </button>
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
