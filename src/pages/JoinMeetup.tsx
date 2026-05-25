import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <div className="min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Dot pattern background */}
        <div className="pattern-bg fixed inset-0 pointer-events-none" />

        {/* Invitation card */}
        <div className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.05)] p-8 space-y-6">
          {/* Header logo */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-surface-container-low rounded-2xl shadow-sm flex items-center justify-center">
              <MapPin className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h1 className="text-xl font-bold leading-tight text-on-surface">
              You're invited to{' '}
              <span className="text-primary">{preview?.name ?? 'a Meetup'}!</span>
            </h1>

            {/* Host chip */}
            {preview && (
              <div className="inline-flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-full border border-outline-variant/30">
                <div className="w-7 h-7 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-xs font-bold">
                  {preview.organizer_name[0].toUpperCase()}
                </div>
                <span className="text-sm text-on-surface-variant">
                  Hosted by{' '}
                  <span className="text-primary font-semibold">{preview.organizer_name}</span>
                </span>
              </div>
            )}
          </div>

          {/* Join form */}
          <form onSubmit={handleGuestJoin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant ml-1" htmlFor="guest-name">
                Enter your name to join
              </label>
              <div className="relative">
                <input
                  id="guest-name"
                  autoFocus
                  placeholder="E.g. Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className="w-full h-14 bg-surface-variant/30 border-none rounded-xl px-5 pr-12 text-base focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest outline-none transition-all placeholder:text-outline-variant"
                />
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline-variant">
                  <Users className="w-4 h-4" />
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={!name.trim() || submitting || joinMeetup.isPending}
              className="w-full h-14 bg-primary text-on-primary rounded-2xl font-semibold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {(submitting || joinMeetup.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Get Started
            </button>
          </form>

          {/* Features grid */}
          <div className="pt-4 border-t border-outline-variant/20 grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center text-center p-3 gap-2">
              <div className="w-10 h-10 bg-tertiary-container/10 text-tertiary rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="text-xs text-on-surface-variant">Fairest Locations</span>
            </div>
            <div className="flex flex-col items-center text-center p-3 gap-2">
              <div className="w-10 h-10 bg-primary-container/10 text-primary rounded-full flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs text-on-surface-variant">Group Voting</span>
            </div>
          </div>

          <button
            onClick={loginFallback}
            className="w-full text-xs text-on-surface-variant hover:underline text-center"
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
