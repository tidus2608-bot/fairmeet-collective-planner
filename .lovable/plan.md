

# FairMeet — Google Maps Integration Plan

## What's Needed

Google Maps requires a **Google Maps API key** with these APIs enabled:
- Maps JavaScript API (interactive map)
- Places API (autocomplete, nearby search)
- Geocoding API (address ↔ coordinates)
- Directions API (travel time calculations)

Since this is a **publishable client-side key** (restricted by HTTP referrer), it can be stored in the codebase as a `VITE_` env var. However, for Directions/Places server-side calls, we'll also need it in edge functions.

## Setup Steps

1. **You provide a Google Maps API key** — I'll guide you on where to get one from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. **Store it as a project secret** (`GOOGLE_MAPS_API_KEY`) for edge functions, and also as a `VITE_GOOGLE_MAPS_API_KEY` in the codebase for client-side map rendering
3. **Install `@react-google-maps/api`** for the React map component

## Implementation

### Client-Side (React)
- `GoogleMapsProvider` wrapper using `@react-google-maps/api` with Places library
- Interactive map on the Venues tab showing participant markers, venue markers, and fair-zone circle
- Places Autocomplete input on the Overview tab for starting location
- "Use current location" via browser Geolocation API

### Server-Side (Edge Functions)
- **`calculate-midpoint`** — computes geographic centroid of participants, then calls Google Places Nearby Search to find venues in the fair zone
- **`get-travel-times`** — calls Google Directions API to calculate per-participant travel times to each venue

### Map Features
- Custom colored markers (blue for participants, red for venues)
- InfoWindows with participant/venue details
- Semi-transparent circle overlay showing the "fair zone" around the midpoint
- Category-filtered venue markers

## Shall I proceed?

This plan covers the full Google Maps integration as part of the larger FairMeet build. I'll ask you to add the API key as a secret before wiring up the map features.

