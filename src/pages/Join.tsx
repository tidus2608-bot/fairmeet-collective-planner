import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Navigation, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
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
import { DEFAULT_PREFS, UserPreferences } from '@/hooks/useUserPreferences';
import { toast } from 'sonner';

const ALL_CATEGORIES = ['Food', 'Coffee', 'Drinks'] as const;
const PRICE_LABELS: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };
const TRANSPORT_OPTIONS = [
  { value: 'driving', label: '🚗 Driving' },
  { value: 'walking', label: '🚶 Walking' },
  { value: 'cycling', label: '🚲 Cycling' },
  { value: 'transit', label: '🚌 Transit' },
] as const;

export default function Join() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const joinMeetup = useJoinMeetup();

  const [meetup, setMeetup] = useState<{ id: string; name: string } | null>(null);
  const [guestName, setGuestName] = useState('');
  const [transportMode, setTransportMode] = useState('driving');
  const [locationData, setLocationData] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const { error: anonErr } = await supabase.auth.signInAnonymously();
          if (anonErr) throw anonErr;
        }

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
      } catch (e) {
        setPageError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
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

  const toggleCategory = (cat: string) =>
    setPrefs((p) => ({
      ...p,
      categories: p.categories.includes(cat)
        ? p.categories.filter((c) => c !== cat)
        : [...p.categories, cat],
    }));

  const togglePrice = (lvl: number) =>
    setPrefs((p) => ({
      ...p,
      price_levels: p.price_levels.includes(lvl)
        ? p.price_levels.filter((l) => l !== lvl)
        : [...p.price_levels, lvl].sort(),
    }));

  const handleJoin = async () => {
    if (!guestName.trim() || !meetup) return;
    setJoining(true);
    try {
      // Save preferences so the scoring engine uses them
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_preferences')
          .upsert({ user_id: user.id, ...prefs }, { onConflict: 'user_id' });
      }

      const meetupId = await joinMeetup.mutateAsync({
        inviteCode: code!,
        userName: guestName.trim(),
        transportMode,
        location: locationData ? { lat: locationData.lat, lng: locationData.lng } : undefined,
        address: locationData?.address,
      });
      navigate(`/meetup/${meetupId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not join meetup');
      setJoining(false);
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
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="w-full max-w-sm mx-auto space-y-5">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-primary">FairMeet</h1>
          <p className="text-muted-foreground text-sm">You've been invited to</p>
          <p className="text-xl font-semibold">{meetup!.name}</p>
        </div>

        {/* ── Your details ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Your details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Your name</Label>
              <Input
                placeholder="e.g. Alex"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>How will you travel?</Label>
              <Select value={transportMode} onValueChange={setTransportMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSPORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                Starting location
                <span className="text-muted-foreground font-normal ml-1 text-xs">(optional)</span>
              </Label>
              <PlacesAutocomplete
                defaultValue={locationData?.address || ''}
                onSelect={({ lat, lng, address }) => setLocationData({ lat, lng, address })}
              />
              <Button variant="outline" size="sm" className="gap-2 w-full" onClick={handleUseCurrentLocation}>
                <Navigation className="w-3.5 h-3.5" /> Use current location
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Venue preferences ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Venue preferences</CardTitle>
            <p className="text-xs text-muted-foreground">Used to find the best spot for everyone</p>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Categories */}
            <div className="space-y-2">
              <Label className="font-semibold">What kind of place?</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_CATEGORIES.map((c) => (
                  <label key={c} className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-accent">
                    <Checkbox
                      checked={prefs.categories.includes(c)}
                      onCheckedChange={() => toggleCategory(c)}
                    />
                    <span className="text-sm">{c}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label className="font-semibold">Price range</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((lvl) => (
                  <Button
                    key={lvl}
                    type="button"
                    size="sm"
                    variant={prefs.price_levels.includes(lvl) ? 'default' : 'outline'}
                    onClick={() => togglePrice(lvl)}
                    className="flex-1"
                  >
                    {PRICE_LABELS[lvl]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Min rating */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="font-semibold">Minimum rating</Label>
                <span className="text-sm tabular-nums text-muted-foreground">{prefs.min_rating.toFixed(1)} ★</span>
              </div>
              <Slider
                min={0} max={5} step={0.5}
                value={[prefs.min_rating]}
                onValueChange={(v) => setPrefs((p) => ({ ...p, min_rating: v[0] }))}
              />
            </div>

            {/* Max travel */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="font-semibold">Max travel time</Label>
                <span className="text-sm tabular-nums text-muted-foreground">{prefs.max_travel_minutes} min</span>
              </div>
              <Slider
                min={10} max={120} step={5}
                value={[prefs.max_travel_minutes]}
                onValueChange={(v) => setPrefs((p) => ({ ...p, max_travel_minutes: v[0] }))}
              />
            </div>

            {/* Keyword */}
            <div className="space-y-1.5">
              <Label className="font-semibold">
                Keyword <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </Label>
              <Input
                placeholder="e.g. vegan, rooftop, quiet"
                value={prefs.keyword}
                onChange={(e) => setPrefs((p) => ({ ...p, keyword: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full"
          onClick={handleJoin}
          disabled={!guestName.trim() || joining}
        >
          {joining && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Join Meetup
        </Button>
      </div>
    </div>
  );
}
