import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useJoinMeetup } from '@/hooks/useMeetups';
import { toast } from 'sonner';

export default function Join() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const joinMeetup = useJoinMeetup();

  const [meetup, setMeetup] = useState<{ id: string; name: string } | null>(null);
  const [guestName, setGuestName] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Ensure an auth session exists — anonymous if needed
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const { error: anonErr } = await supabase.auth.signInAnonymously();
          if (anonErr) throw anonErr;
        }

        // Fetch meetup by invite code
        const { data, error: mErr } = await supabase
          .from('meetups')
          .select('id, name')
          .eq('invite_code', code!)
          .single();
        if (mErr || !data) {
          setPageError('Invite link not found or has expired.');
          setLoading(false);
          return;
        }

        // If the user is already a participant, go straight in
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (userId) {
          const { data: existing } = await supabase
            .from('participants')
            .select('id')
            .eq('meetup_id', data.id)
            .eq('user_id', userId)
            .maybeSingle();
          if (existing) {
            navigate(`/meetup/${data.id}`, { replace: true });
            return;
          }
        }

        setMeetup({ id: data.id, name: data.name });
      } catch (e: any) {
        setPageError(e.message || 'Something went wrong. Please try again.');
      }
      setLoading(false);
    };
    init();
  }, [code, navigate]);

  const handleJoin = async () => {
    if (!guestName.trim() || !meetup) return;
    try {
      const meetupId = await joinMeetup.mutateAsync({ inviteCode: code!, userName: guestName.trim() });
      navigate(`/meetup/${meetupId}`);
    } catch (e: any) {
      toast.error(e.message || 'Could not join meetup');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-2">
            <p className="font-medium text-destructive">{pageError}</p>
            <p className="text-sm text-muted-foreground">Ask the organiser to share a fresh invite link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-primary">FairMeet</h1>
          <p className="text-muted-foreground text-sm">You've been invited to</p>
          <p className="text-xl font-semibold">{meetup!.name}</p>
        </div>

        {/* Name form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Join the meetup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Your name</label>
              <Input
                placeholder="e.g. Alex"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                autoFocus
              />
            </div>
            <Button
              className="w-full"
              onClick={handleJoin}
              disabled={!guestName.trim() || joinMeetup.isPending}
            >
              {joinMeetup.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Join Meetup
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
