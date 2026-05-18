import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Navigation, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import { supabase } from '@/integrations/supabase/client';
import { useJoinMeetup } from '@/hooks/useMeetups';
import { toast } from 'sonner';

const TRANSPORT_OPTIONS = [
  { value: 'driving',  label: '🚗 Driving' },
  { value: 'walking',  label: '🚶 Walking' },
  { value: 'cycling',  label: '🚲 Cycling' },
  { value: 'transit',  label: '🚌 Transit' },
] as const;

export default function Join() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const joinMeetup = useJoinMeetup();

  const [meetup, setMeetup] = useState<{ id: string; name: string } | null>(null);
  const [guestName, setGuestName] = useState('');
  const [transportMode, setTransportMode] = useState('driving');
  const [locationData, setLocationData] = useState<{
    lat: number; lng: number; address: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Ensure an auth session — anonymous if needed
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

        // Already a participant? Go straight in
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

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationData({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
        });
        toast.success('Location detected!');
      },
      () => toast.error('Could not get location'),
    );
  };

  const handleJoin = async () => {
    if (!guestName.trim() || !meetup) return;
    try {
      const meetupId = await joinMeetup.mutateAsync({
        inviteCode: code!,
        userName: guestName.trim(),
        transportMode,
        location: locationData ? { lat: locationData.lat, lng: locationData.lng } : undefined,
        address: locationData?.address,
      });
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
            <p className="text-sm text-muted-foreground">Ask the organiser for a fresh invite link.</p>
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Join the meetup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Your name</label>
              <Input
                placeholder="e.g. Alex"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Transport mode */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">How will you travel?</label>
              <Select value={transportMode} onValueChange={setTransportMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Starting location */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Starting location
                <span className="text-muted-foreground font-normal ml-1">(optional)</span>
              </label>
              <PlacesAutocomplete
                defaultValue={locationData?.address || ''}
                onSelect={({ lat, lng, address }) => setLocationData({ lat, lng, address })}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-2 w-full"
                onClick={handleUseCurrentLocation}
              >
                <Navigation className="w-3.5 h-3.5" /> Use current location
              </Button>
              {!locationData && (
                <p className="text-xs text-muted-foreground">
                  Adding your location helps find a fair meetup spot for everyone.
                </p>
              )}
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
