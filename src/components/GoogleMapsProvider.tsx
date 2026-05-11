import { LoadScript } from '@react-google-maps/api';
import { ReactNode } from 'react';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDl2gzzUO5n5BfQ9CxJZ0BeKVDVxwlknnQ';

const libraries: ("places")[] = ['places'];

export default function GoogleMapsProvider({ children }: { children: ReactNode }) {
  if (!GOOGLE_MAPS_API_KEY) {
    return <>{children}</>;
  }
  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={libraries}>
      {children}
    </LoadScript>
  );
}
