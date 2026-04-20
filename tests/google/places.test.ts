import { describe, it, expect } from "vitest";
import {
  getNearbyParkingUrl,
  getNearbyHotelsUrl,
  getTransitDirectionsUrl,
  getNearbyFoodUrl,
  getVenuePlaceUrl,
} from "@/lib/google/places";
import type { VenueLocation } from "@/lib/google/maps";

const venue: VenueLocation = {
  name: "Test Stadium",
  address: "1 Stadium Rd, Mumbai, 400020",
  lat: 18.9388,
  lng: 72.8258,
  placeId: "ChIJf9IZiA7O5zsR_test",
};

const venueNoPlaceId: VenueLocation = {
  name: "Bare Arena",
  address: "99 Bare Rd, City",
  lat: 19.0,
  lng: 73.0,
};

// ── getNearbyParkingUrl ────────────────────────────────────────────────────

describe("lib/google/places — getNearbyParkingUrl", () => {
  it("returns a valid Google Maps search URL", () => {
    const url = getNearbyParkingUrl(venue);
    expect(url).toContain("https://www.google.com/maps/search/");
    expect(url).toContain("api=1");
  });

  it("includes 'parking' in the query", () => {
    const url = getNearbyParkingUrl(venue);
    expect(url).toContain("parking");
  });

  it("includes venue name in query", () => {
    const url = getNearbyParkingUrl(venue);
    expect(url).toContain("Test+Stadium");
  });

  it("includes venue coordinates as center", () => {
    const url = getNearbyParkingUrl(venue);
    expect(url).toContain("center=18.9388");
    expect(url).toContain("72.8258");
  });

  it("respects a custom radius", () => {
    const url = getNearbyParkingUrl(venue, 1000);
    expect(url).toContain("radius=1000");
  });

  it("omits query_place_id when venue has no placeId", () => {
    const url = getNearbyParkingUrl(venueNoPlaceId);
    expect(url).not.toContain("query_place_id");
  });
});

// ── getNearbyHotelsUrl ─────────────────────────────────────────────────────

describe("lib/google/places — getNearbyHotelsUrl", () => {
  it("returns a valid Google Maps search URL", () => {
    const url = getNearbyHotelsUrl(venue);
    expect(url).toContain("https://www.google.com/maps/search/");
  });

  it("includes 'hotels' in the query", () => {
    const url = getNearbyHotelsUrl(venue);
    expect(url).toContain("hotels");
  });

  it("appends night count when nights > 1", () => {
    const url = getNearbyHotelsUrl(venue, 3);
    expect(url).toContain("3+nights");
  });

  it("does not append night count for default 1-night stay", () => {
    const url = getNearbyHotelsUrl(venue);
    expect(url).not.toContain("night");
  });

  it("includes venue coordinates as center bias", () => {
    const url = getNearbyHotelsUrl(venue);
    expect(url).toContain("center=18.9388");
  });
});

// ── getTransitDirectionsUrl ────────────────────────────────────────────────

describe("lib/google/places — getTransitDirectionsUrl", () => {
  it("returns a Google Maps directions URL", () => {
    const url = getTransitDirectionsUrl(venue);
    expect(url).toContain("https://www.google.com/maps/dir/");
    expect(url).toContain("api=1");
  });

  it("sets travelmode to transit", () => {
    const url = getTransitDirectionsUrl(venue);
    expect(url).toContain("travelmode=transit");
  });

  it("includes venue coordinates as destination", () => {
    const url = getTransitDirectionsUrl(venue);
    expect(url).toContain("destination=18.9388");
  });

  it("includes destination_place_id when venue has placeId", () => {
    const url = getTransitDirectionsUrl(venue);
    expect(url).toContain("destination_place_id=ChIJf9IZiA7O5zsR_test");
  });

  it("omits destination_place_id when venue has no placeId", () => {
    const url = getTransitDirectionsUrl(venueNoPlaceId);
    expect(url).not.toContain("destination_place_id");
  });

  it("includes origin when provided", () => {
    const url = getTransitDirectionsUrl(venue, "Bandra Station");
    expect(url).toContain("origin=Bandra+Station");
  });

  it("omits origin when not provided", () => {
    const url = getTransitDirectionsUrl(venue);
    expect(url).not.toContain("origin=");
  });
});

// ── getNearbyFoodUrl ───────────────────────────────────────────────────────

describe("lib/google/places — getNearbyFoodUrl", () => {
  it("defaults to 'restaurants' as the query type", () => {
    const url = getNearbyFoodUrl(venue);
    expect(url).toContain("restaurants");
  });

  it("accepts a custom query string", () => {
    const url = getNearbyFoodUrl(venue, "street food");
    expect(url).toContain("street");
  });

  it("includes venue name for proximity context", () => {
    const url = getNearbyFoodUrl(venue);
    expect(url).toContain("Test+Stadium");
  });

  it("returns a valid Google Maps search URL", () => {
    const url = getNearbyFoodUrl(venue);
    expect(url).toContain("https://www.google.com/maps/search/");
    expect(url).toContain("api=1");
  });
});

// ── getVenuePlaceUrl ───────────────────────────────────────────────────────

describe("lib/google/places — getVenuePlaceUrl", () => {
  it("returns a place detail URL when placeId is known", () => {
    const url = getVenuePlaceUrl(venue);
    expect(url).toContain("https://www.google.com/maps/place/");
    expect(url).toContain("place_id=ChIJf9IZiA7O5zsR_test");
  });

  it("falls back to a search URL when placeId is absent but address is set", () => {
    const url = getVenuePlaceUrl(venueNoPlaceId);
    expect(url).toContain("https://www.google.com/maps/search/");
    expect(url).toContain("query=");
  });

  it("fallback URL contains the venue address", () => {
    const url = getVenuePlaceUrl(venueNoPlaceId);
    expect(url).toContain("Bare+Rd");
  });
});
