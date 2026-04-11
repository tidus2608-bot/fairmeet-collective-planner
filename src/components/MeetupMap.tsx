import { GoogleMap, Marker, Circle, InfoWindow } from '@react-google-maps/api';
import { useState, useMemo } from 'react';
import { Participant, VenueSuggestion } from '@/types/meetup';

interface MeetupMapProps {
  participants: Participant[];
  venues: VenueSuggestion[];
  midpoint?: { lat: number; lng: number };
  fairZoneRadius?: number;
}

const containerStyle = { width: '100%', height: '300px' };

export default function MeetupMap({ participants, venues, midpoint, fairZoneRadius = 2000 }: MeetupMapProps) {
  const [selectedMarker, setSelectedMarker] = useState<{ type: string; id: string } | null>(null);

  const center = useMemo(() => {
    if (midpoint) return midpoint;
    const locs = participants.filter((p) => p.location).map((p) => p.location!);
    if (locs.length === 0) return { lat: 21.0285, lng: 105.8542 }; // Hanoi default
    const lat = locs.reduce((s, l) => s + l.lat, 0) / locs.length;
    const lng = locs.reduce((s, l) => s + l.lng, 0) / locs.length;
    return { lat, lng };
  }, [participants, midpoint]);

  if (!window.google?.maps) {
    return (
      <div className="w-full h-[300px] bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Map requires Google Maps API key</p>
      </div>
    );
  }

  return (
    <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={13} options={{ disableDefaultUI: true, zoomControl: true }}>
      {participants.filter((p) => p.location).map((p) => (
        <Marker
          key={p.id}
          position={p.location!}
          icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' }}
          onClick={() => setSelectedMarker({ type: 'participant', id: p.id })}
        >
          {selectedMarker?.type === 'participant' && selectedMarker.id === p.id && (
            <InfoWindow onCloseClick={() => setSelectedMarker(null)}>
              <div className="text-sm font-medium">{p.userName}<br /><span className="text-xs opacity-70">{p.address}</span></div>
            </InfoWindow>
          )}
        </Marker>
      ))}

      {venues.map((v) => (
        <Marker
          key={v.id}
          position={v.location}
          icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
          onClick={() => setSelectedMarker({ type: 'venue', id: v.id })}
        >
          {selectedMarker?.type === 'venue' && selectedMarker.id === v.id && (
            <InfoWindow onCloseClick={() => setSelectedMarker(null)}>
              <div className="text-sm"><strong>{v.name}</strong><br />{v.category} · ⭐ {v.rating}<br /><span className="text-xs">{v.address}</span></div>
            </InfoWindow>
          )}
        </Marker>
      ))}

      {midpoint && (
        <Circle
          center={midpoint}
          radius={fairZoneRadius}
          options={{
            fillColor: '#4f46e5',
            fillOpacity: 0.1,
            strokeColor: '#4f46e5',
            strokeOpacity: 0.3,
            strokeWeight: 2,
          }}
        />
      )}
    </GoogleMap>
  );
}
