import { useState, useEffect } from 'react';
import { Navigation, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  MeetupRow,
  useUpdateParticipantLocation,
  useUpdateTransportMode,
  useUpdatePreferences,
} from '@/hooks/useMeetups';
import { useUserPreferences, useSaveUserPreferences } from '@/hooks/useUserPreferences';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import { toast } from 'sonner';

const CATEGORIES = ['Food', 'Coffee', 'Drinks'] as const;
const PRICE_LABELS = ['$', '$$', '$$$', '$$$$'];
const RATING_OPTIONS: { label: string; value: number }[] = [
  { label: 'Any', value: 0 },
  { label: '3★+', value: 3 },
  { label: '4★+', value: 4 },
  { label: '4.5★+', value: 4.5 },
];
const FOOD_CUISINES = [
  'Italian', 'Japanese', 'Korean', 'Chinese', 'Thai',
  'Indian', 'Mexican', 'Vietnamese', 'American', 'Mediterranean', 'French',
];
const DRINKS_SUBTYPES = ['Wine Bar', 'Cocktail Bar', 'Pub', 'Night Club'];

interface Props {
  meetup: MeetupRow;
  userId: string;
}

export default function PreferencesTab({ meetup, userId }: Props) {
  const myParticipant = meetup.participants?.find((p) => p.user_id === userId);
  const updateLocation = useUpdateParticipantLocation();
  const updateTransport = useUpdateTransportMode();
  const updatePreferences = useUpdatePreferences();
  const { data: userPrefs } = useUserPreferences();
  const savePref = useSaveUserPreferences();

  const [maxTravelTime, setMaxTravelTime] = useState<number | null>(
    myParticipant?.max_travel_time ?? null,
  );
  const [fairnessImportance, setFairnessImportance] = useState(
    Math.round((myParticipant?.fairness_importance ?? 0.5) * 100),
  );

  // Venue preference state — seeded from global user_preferences once loaded
  const [categories, setCategories] = useState<string[]>(['Food', 'Coffee', 'Drinks']);
  const [priceLevels, setPriceLevels] = useState<number[]>([1, 2, 3, 4]);
  const [minRating, setMinRating] = useState<number>(0);
  const [keyword, setKeyword] = useState<string>('');
  const [openNow, setOpenNow] = useState<boolean>(false);
  const [cuisine, setCuisine] = useState<string>('');

  useEffect(() => {
    if (!userPrefs) return;
    setCategories(userPrefs.categories);
    setPriceLevels(userPrefs.price_levels);
    setMinRating(userPrefs.min_rating);
    setKeyword(userPrefs.keyword);
    setOpenNow(userPrefs.open_now);
    setCuisine(userPrefs.cuisine);
  }, [userPrefs]);

  // Clear cuisine selection when its parent category is deselected
  useEffect(() => {
    if (!cuisine) return;
    const isFood = FOOD_CUISINES.includes(cuisine);
    const isDrinks = DRINKS_SUBTYPES.includes(cuisine);
    if ((isFood && !categories.includes('Food')) || (isDrinks && !categories.includes('Drinks'))) {
      setCuisine('');
    }
  }, [categories, cuisine]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateLocation.mutate({
          meetupId: meetup.id,
          location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          address: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
        });
        toast.success('Location set!');
      },
      () => toast.error('Could not get location'),
    );
  };

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const togglePrice = (lvl: number) => {
    setPriceLevels((prev) =>
      prev.includes(lvl) ? prev.filter((l) => l !== lvl) : [...prev, lvl],
    );
  };

  const handleSubmit = async () => {
    try {
      await Promise.all([
        updatePreferences.mutateAsync({
          meetupId: meetup.id,
          maxTravelTime,
          fairnessImportance: fairnessImportance / 100,
        }),
        savePref.mutateAsync({
          categories,
          min_rating: minRating,
          max_travel_minutes: maxTravelTime ?? 9999,
          price_levels: priceLevels,
          keyword: keyword.trim(),
          open_now: openNow,
          cuisine,
        }),
      ]);
      toast.success('Preferences saved!');
    } catch {
      toast.error('Could not save preferences');
    }
  };

  const fairnessLabel = fairnessImportance < 34 ? 'Low' : fairnessImportance < 67 ? 'Medium' : 'High';
  const isPending = updatePreferences.isPending || savePref.isPending;
  const showCuisineChips = categories.includes('Food') || categories.includes('Drinks');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Starting Point</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PlacesAutocomplete
            defaultValue={myParticipant?.address || ''}
            onSelect={({ lat, lng, address }) =>
              updateLocation.mutate({ meetupId: meetup.id, location: { lat, lng }, address })
            }
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleUseCurrentLocation}
            disabled={updateLocation.isPending}
          >
            <Navigation className="w-3.5 h-3.5" /> Use My Location
          </Button>
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Transport Mode</Label>
            <Select
              value={myParticipant?.transport_mode || 'driving'}
              onValueChange={(v) => updateTransport.mutate({ meetupId: meetup.id, mode: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="driving">🚗 Driving</SelectItem>
                <SelectItem value="walking">🚶 Walking</SelectItem>
                <SelectItem value="cycling">🚲 Cycling</SelectItem>
                <SelectItem value="transit">🚌 Transit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Travel Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Max Travel Time</Label>
              <span className="text-sm font-semibold text-primary">
                {maxTravelTime === null ? 'Any' : `${maxTravelTime} min`}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={maxTravelTime === null ? 'default' : 'outline'}
                className={cn('flex-1', maxTravelTime === null && 'pointer-events-none')}
                onClick={() => setMaxTravelTime(null)}
              >
                Not important
              </Button>
              <Button
                type="button"
                size="sm"
                variant={maxTravelTime !== null ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setMaxTravelTime((v) => v ?? 30)}
              >
                Set a limit
              </Button>
            </div>
            {maxTravelTime !== null && (
              <>
                <Slider
                  min={15}
                  max={120}
                  step={5}
                  value={[maxTravelTime]}
                  onValueChange={([v]) => setMaxTravelTime(v)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>15 min</span>
                  <span>120 min</span>
                </div>
              </>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Importance of Fairness</Label>
              <span className="text-sm font-semibold text-primary">{fairnessLabel}</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[fairnessImportance]}
              onValueChange={([v]) => setFairnessImportance(v)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Venue Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">What type?</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  size="sm"
                  variant={categories.includes(cat) ? 'default' : 'outline'}
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {showCuisineChips && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cuisine</Label>
              <div className="flex flex-wrap gap-2">
                {categories.includes('Food') && FOOD_CUISINES.map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={cuisine === c ? 'default' : 'outline'}
                    onClick={() => setCuisine((prev) => prev === c ? '' : c)}
                  >
                    {c}
                  </Button>
                ))}
                {categories.includes('Drinks') && DRINKS_SUBTYPES.map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={cuisine === c ? 'default' : 'outline'}
                    onClick={() => setCuisine((prev) => prev === c ? '' : c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Price</Label>
            <div className="flex flex-wrap gap-2">
              {PRICE_LABELS.map((label, i) => (
                <Button
                  key={i}
                  type="button"
                  size="sm"
                  variant={priceLevels.includes(i + 1) ? 'default' : 'outline'}
                  onClick={() => togglePrice(i + 1)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Min. Rating</Label>
            <div className="flex flex-wrap gap-2">
              {RATING_OPTIONS.map(({ label, value }) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={minRating === value ? 'default' : 'outline'}
                  onClick={() => setMinRating(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keyword" className="text-sm font-medium">
              Keyword
            </Label>
            <Input
              id="keyword"
              placeholder="e.g. quiet, rooftop, outdoor"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="open-now"
              checked={openNow}
              onCheckedChange={(v) => setOpenNow(!!v)}
            />
            <Label htmlFor="open-now" className="text-sm font-medium cursor-pointer">
              Open now only
            </Label>
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full gap-2"
        onClick={handleSubmit}
        disabled={isPending}
      >
        <Check className="w-4 h-4" />
        {isPending ? 'Saving…' : 'Submit Preferences'}
      </Button>
    </div>
  );
}
