import { useState } from 'react';
import { MapPin, Navigation, Copy, Trash2, LogOut, Check, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/store/useAppStore';
import { Meetup, TransportMode } from '@/types/meetup';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Props {
  meetup: Meetup;
  userId: string;
}

export default function OverviewTab({ meetup, userId }: Props) {
  const { updateParticipantLocation, updateParticipantTransport, deleteMeetup, leaveMeetup } = useAppStore();
  const navigate = useNavigate();
  const isOrganizer = meetup.organizerId === userId;
  const myParticipant = meetup.participants.find((p) => p.userId === userId);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        updateParticipantLocation(meetup.id, userId, { lat: latitude, lng: longitude }, `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        toast.success('Location set!');
      },
      () => toast.error('Could not get location')
    );
  };

  const handleCopyInvite = () => {
    const link = `${window.location.origin}/join/${meetup.inviteCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied!');
  };

  return (
    <div className="space-y-4">
      {/* Your Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Starting Location</label>
            <PlacesAutocomplete
              defaultValue={myParticipant?.address || ''}
              onSelect={({ lat, lng, address }) => updateParticipantLocation(meetup.id, userId, { lat, lng }, address)}
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleUseCurrentLocation}>
            <Navigation className="w-3.5 h-3.5" /> Use current location
          </Button>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Transport Mode</label>
            <Select
              value={myParticipant?.transportMode || 'driving'}
              onValueChange={(v) => updateParticipantTransport(meetup.id, userId, v as TransportMode)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
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

      {/* Participants */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Participants</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyInvite}>
              <Copy className="w-3.5 h-3.5" /> Copy Invite
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {meetup.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <div className={`w-2.5 h-2.5 rounded-full ${p.status === 'location_set' ? 'bg-green-500' : 'bg-amber-400'}`} />
                <span className="text-sm flex-1">{p.userName}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {p.status === 'location_set' ? <><Check className="w-3 h-3" /> Location Set</> : <><Clock className="w-3 h-3" /> Awaiting</>}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Confirmed Venue */}
      {meetup.status === 'Confirmed' && meetup.finalVenue && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-green-800">✅ Confirmed Venue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold">{meetup.finalVenue.name}</p>
            <p className="text-sm text-muted-foreground">{meetup.finalVenue.address}</p>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${meetup.finalVenue.location.lat},${meetup.finalVenue.location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Get Directions
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Management */}
      <div className="pt-2">
        {isOrganizer ? (
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={() => {
              deleteMeetup(meetup.id);
              navigate('/dashboard');
            }}
          >
            <Trash2 className="w-4 h-4" /> Delete Meetup
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full gap-2 text-destructive border-destructive"
            onClick={() => {
              leaveMeetup(meetup.id);
              navigate('/dashboard');
            }}
          >
            <LogOut className="w-4 h-4" /> Leave Meetup
          </Button>
        )}
      </div>
    </div>
  );
}
