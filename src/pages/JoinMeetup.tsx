import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useJoinMeetup } from '@/hooks/useMeetups';
import { supabase } from '@/integrations/supabase/client';

export const PENDING_JOIN_KEY = 'fairmeet-pending-join';

interface MeetupPreview {
  name: string;
  organizer_name: string;
  participant_count: number;
}

export default function JoinMeetup() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, loading, signInAsGuest } = useAuth();
  const joinMeetup = useJoinMeetup();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<MeetupPreview | null>(null);
  const attempted = useRef(false);

  // Try to fetch meetup preview by invite code (best-effort; may be blocked by RLS).
  useEffect(() => {
    if (!code) return;
    supabase
      .from('meetups')
      .select('name, participants(user_name)')
      .eq('invite_code', code)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const participants = (data.participants as { user_name: string }[]) || [];
        setPreview({
          name: data.name,
          organizer_name: participants[0]?.user_name || 'Someone',
          participant_count: participants.length,
        });
      });
  }, [code]);

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
    attempted.current = true;
    const { error: authError } = await signInAsGuest(trimmed);
    setSubmitting(false);
    if (authError) {
      attempted.current = false;
      const disabled = /disabled|not enabled/i.test(authError.message);
      setError(
        disabled
          ? 'Guest joining isn\'t enabled for this app yet. Please log in instead.'
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
      <div className="min-h-screen bg-primary/5 flex flex-col items-center justify-center gap-4 p-6 text-center">
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

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-primary/5 to-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          {/* Hero */}
          <div className="text-center space-y-2 pb-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-2">
              <MapPin className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold leading-tight">
              You're invited to{' '}
              <span className="text-primary">{preview?.name ?? 'a Meetup'}!</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Join your friends and find the perfect place to meet
            </p>
          </div>

          {/* Host card */}
          {preview && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="text-sm bg-primary/10 text-primary">
                    {preview.organizer_name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">Hosted by {preview.organizer_name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {preview.participant_count} participant{preview.participant_count !== 1 ? 's' : ''} so far
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Join form */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <p className="text-sm font-medium">What's your name?</p>
              <form onSubmit={handleGuestJoin} className="space-y-3">
                <Input
                  autoFocus
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                />
                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={!name.trim() || submitting || joinMeetup.isPending}
                >
                  {(submitting || joinMeetup.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  Get Started
                </Button>
              </form>
            </CardContent>
          </Card>

          <button
            onClick={loginFallback}
            className="w-full text-xs text-muted-foreground hover:underline text-center"
          >
            Have an account? Log in instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary/5 flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Joining meetup…</p>
    </div>
  );
}
