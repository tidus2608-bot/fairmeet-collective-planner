import { useState } from 'react';
import { Navigation, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MeetupRow,
  useUpdateParticipantLocation,
  useUpdateTransportMode,
  useUpdatePreferences,
} from '@/hooks/useMeetups';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import { toast } from 'sonner';

const VENUE_TYPES = ['Outdoor seating', 'Quiet', 'Vegan options'] as const;

interface Props {
  meetup: MeetupRow;
  userId: string;
}

export default function PreferencesTab({ meetup, userId }: Props) {
  const myParticipant = meetup.participants?.find((p) => p.user_id === userId);
  const updateLocation = useUpdateParticipantLocation();
  const updateTransport = useUpdateTransportMode();
  const updatePreferences = useUpdatePreferences();

  const [maxTravelTime, setMaxTravelTime] = useState<number | null>(
    myParticipant?.max_travel_time ?? null,
  );
  const [fairnessImportance, setFairnessImportance] = useState(
    Math.round((myParticipant?.fairness_importance ?? 0.5) * 100),
  );
  const [selectedVenueTypes, setSelectedVenueTypes] = useState<string[]>(
    myParticipant?.venue_types ?? [],
  );

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

  const handleVenueTypeToggle = (type: string) => {
    setSelectedVenueTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleSubmit = () => {
    updatePreferences.mutate(
      {
        meetupId: meetup.id,
        maxTravelTime,
        fairnessImportance: fairnessImportance / 100,
        venueTypes: selectedVenueTypes,
      },
      {
        onSuccess: () => toast.success('Preferences saved!'),
        onError: () => toast.error('Could not save preferences'),
      },
    );
  };

  const fairnessLabel = fairnessImportance < 34 ? 'Low' : fairnessImportance < 67 ? 'Medium' : 'High';

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
        <CardContent className="space-y-3">
          {VENUE_TYPES.map((type) => (
            <div key={type} className="flex items-center gap-3">
              <Checkbox
                id={`venue-type-${type}`}
                checked={selectedVenueTypes.includes(type)}
                onCheckedChange={() => handleVenueTypeToggle(type)}
              />
              <Label htmlFor={`venue-type-${type}`} className="cursor-pointer font-normal">
                {type}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button
        className="w-full gap-2"
        onClick={handleSubmit}
        disabled={updatePreferences.isPending}
      >
        <Check className="w-4 h-4" />
        {updatePreferences.isPending ? 'Saving…' : 'Submit Preferences'}
      </Button>
    </div>
  );
}
