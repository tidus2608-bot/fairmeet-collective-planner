import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DEFAULT_PREFS,
  UserPreferences,
  useUserPreferences,
  useSaveUserPreferences,
} from '@/hooks/useUserPreferences';

const ALL_CATEGORIES = ['Food', 'Coffee', 'Drinks', 'Park'] as const;
const PRICE_LABELS: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useUserPreferences();
  const save = useSaveUserPreferences();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [displayName, setDisplayName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (data) setPrefs(data);
  }, [data]);

  useEffect(() => {
    if (user) setDisplayName(user.user_metadata?.display_name || user.email?.split('@')[0] || '');
  }, [user]);

  const toggleCategory = (cat: string) => {
    setPrefs((p) => ({
      ...p,
      categories: p.categories.includes(cat)
        ? p.categories.filter((c) => c !== cat)
        : [...p.categories, cat],
    }));
  };

  const togglePrice = (lvl: number) => {
    setPrefs((p) => ({
      ...p,
      price_levels: p.price_levels.includes(lvl)
        ? p.price_levels.filter((l) => l !== lvl)
        : [...p.price_levels, lvl].sort(),
    }));
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync(prefs);
      toast.success('Preferences saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save preferences');
    }
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) { toast.error('Display name cannot be empty'); return; }
    setSavingProfile(true);
    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName.trim() } });
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else toast.success('Profile updated');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="font-semibold flex items-center gap-1.5"><User className="w-4 h-4" /> Profile</Label>
            <div className="space-y-1.5">
              <Label htmlFor="display-name" className="text-sm font-normal">Display name</Label>
              <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
            </div>
            <Button size="sm" className="gap-1.5" onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save profile
            </Button>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          The preferences below narrow venue searches before they hit the map — fewer, better matches.
        </p>

        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="font-semibold">Categories</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CATEGORIES.map((c) => (
                <label
                  key={c}
                  className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={prefs.categories.includes(c)}
                    onCheckedChange={() => toggleCategory(c)}
                  />
                  <span className="text-sm">{c}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between">
              <Label className="font-semibold">Minimum rating</Label>
              <span className="text-sm tabular-nums">{prefs.min_rating.toFixed(1)} ★</span>
            </div>
            <Slider
              min={0}
              max={5}
              step={0.5}
              value={[prefs.min_rating]}
              onValueChange={(v) => setPrefs((p) => ({ ...p, min_rating: v[0] }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between">
              <Label className="font-semibold">Max travel time (worst person)</Label>
              <span className="text-sm tabular-nums">{prefs.max_travel_minutes} min</span>
            </div>
            <Slider
              min={10}
              max={120}
              step={5}
              value={[prefs.max_travel_minutes]}
              onValueChange={(v) => setPrefs((p) => ({ ...p, max_travel_minutes: v[0] }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="font-semibold">Price range</Label>
            <div className="flex gap-2 flex-wrap">
              {[0, 1, 2, 3, 4].map((lvl) => (
                <Button
                  key={lvl}
                  type="button"
                  size="sm"
                  variant={prefs.price_levels.includes(lvl) ? 'default' : 'outline'}
                  onClick={() => togglePrice(lvl)}
                >
                  {PRICE_LABELS[lvl]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <Label htmlFor="keyword" className="font-semibold">
              Keyword (optional)
            </Label>
            <Input
              id="keyword"
              placeholder="e.g. vegan, rooftop, quiet"
              value={prefs.keyword}
              onChange={(e) => setPrefs((p) => ({ ...p, keyword: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Sent to Google Places to bias the search.
            </p>
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full gap-2" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
