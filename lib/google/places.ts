/**
 * Google Places API URL helpers.
 *
 * StadiumIQ surfaces venue-adjacent searches (parking, hotels, transit)
 * using Google Maps Places URLs. These deep-link into the native Maps app
 * on mobile and the Maps web experience on desktop — no SDK key required
 * for the URL-based approach, which keeps the fan experience fast and
 * privacy-friendly (no tracking pixel on our domain).
 *
 * When `NEXT_PUBLIC_GOOGLE_MAPS_KEY` is set, the caller may upgrade these
 * to Places API JSON calls for richer results (reviews, hours, photos).
 * That upgrade path is documented but left to the venue operator.
 *
 * @see https://developers.google.com/maps/documentation/urls/get-started
 * @see https://developers.google.com/maps/documentation/places/web-service
 */

import type { VenueLocation } from "./maps";

// ── Nearby search URL builders ─────────────────────────────────────────────

/**
 * Build a Google Maps "Find parking near venue" deep-link URL.
 *
 * Opens the Maps parking layer centered on the venue's coordinates, giving
 * fans real-time parking availability without leaving the Maps ecosystem.
 *
 * @param venue  The venue's geocoded location.
 * @param radius Approximate search radius in metres (default 500 m).
 * @returns      A fully-formed Google Maps search URL.
 *
 * @example
 *   getNearbyParkingUrl(DEMO_VENUE)
 *   → "https://www.google.com/maps/search/parking+near+Wankhede+Stadium..."
 */
export function getNearbyParkingUrl(
  venue: VenueLocation,
  radius = 500,
): string {
  const query = `parking near ${venue.name}`;
  const params = new URLSearchParams({
    api: "1",
    query,
    // Bias results toward the venue coordinates.
    query_place_id: venue.placeId ?? "",
    center: `${venue.lat},${venue.lng}`,
    radius: String(radius),
  });
  if (!venue.placeId) params.delete("query_place_id");
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/**
 * Build a Google Maps hotel search URL near the venue.
 *
 * Useful for fans travelling from out of town — surfaces nearby hotels
 * with live pricing via the Maps integration.
 *
 * @param venue  The venue's geocoded location.
 * @param nights Hint for the search query label (default 1 night).
 * @returns      A fully-formed Google Maps search URL.
 *
 * @example
 *   getNearbyHotelsUrl(DEMO_VENUE)
 *   → "https://www.google.com/maps/search/hotels+near+Wankhede+Stadium..."
 */
export function getNearbyHotelsUrl(
  venue: VenueLocation,
  nights = 1,
): string {
  const query = `hotels near ${venue.name}`;
  const params = new URLSearchParams({
    api: "1",
    query: nights > 1 ? `${query} (${nights} nights)` : query,
    center: `${venue.lat},${venue.lng}`,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/**
 * Build a Google Maps transit search URL from the fan's position to the venue.
 *
 * Uses the Maps Directions URL format so the fan's GPS is used as the
 * origin automatically when the URL is opened on a mobile device.
 *
 * @param venue   The destination venue.
 * @param origin  Optional explicit origin address or lat/lng string.
 *                Defaults to empty (Maps will use current location).
 * @returns       A Google Maps Directions URL with travelmode=transit.
 *
 * @example
 *   getTransitDirectionsUrl(DEMO_VENUE)
 *   → "https://www.google.com/maps/dir/?api=1&destination=...&travelmode=transit"
 */
export function getTransitDirectionsUrl(
  venue: VenueLocation,
  origin = "",
): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${venue.lat},${venue.lng}`,
    travelmode: "transit",
  });
  if (venue.placeId) params.set("destination_place_id", venue.placeId);
  if (origin) params.set("origin", origin);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Build a Google Maps restaurant/food search URL near the venue.
 *
 * Surfaced in the pre-arrival flow to help fans find food options before
 * entering the stadium — complements the in-venue concession ordering.
 *
 * @param venue  The venue's geocoded location.
 * @param query  Override the default search query (default: "restaurants near").
 * @returns      A Google Maps search URL for food near the venue.
 *
 * @example
 *   getNearbyFoodUrl(DEMO_VENUE, "street food")
 *   → "https://www.google.com/maps/search/street+food+near+Wankhede..."
 */
export function getNearbyFoodUrl(
  venue: VenueLocation,
  query = "restaurants",
): string {
  const fullQuery = `${query} near ${venue.name}`;
  const params = new URLSearchParams({
    api: "1",
    query: fullQuery,
    center: `${venue.lat},${venue.lng}`,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/**
 * Build a Google Maps place detail URL for the venue itself.
 *
 * When the fan taps "View on Google Maps" in the venue info sheet, this
 * URL opens the full Maps place card — reviews, photos, opening hours.
 *
 * @param venue The venue to link to.
 * @returns     A Google Maps place detail URL.
 */
export function getVenuePlaceUrl(venue: VenueLocation): string {
  if (venue.placeId) {
    const params = new URLSearchParams({ api: "1", place_id: venue.placeId });
    return `https://www.google.com/maps/place/?${params.toString()}`;
  }
  const params = new URLSearchParams({
    api: "1",
    query: venue.address || `${venue.lat},${venue.lng}`,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
