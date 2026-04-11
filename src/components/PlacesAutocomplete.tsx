import { useRef, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

interface PlacesAutocompleteProps {
  onSelect: (place: { lat: number; lng: number; address: string }) => void;
  placeholder?: string;
  defaultValue?: string;
}

export default function PlacesAutocomplete({ onSelect, placeholder = 'Search for a location...', defaultValue = '' }: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (!window.google?.maps?.places || !inputRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['geocode', 'establishment'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || place.name || '';
        setValue(address);
        onSelect({ lat, lng, address });
      }
    });

    return () => {
      window.google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [onSelect]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className="w-full"
    />
  );
}
