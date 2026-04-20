/**
 * Google Wallet integration helpers.
 *
 * StadiumIQ uses the Google Wallet Generic Pass API to issue digital
 * order receipts and venue entry tickets directly to fans' Google Wallet.
 * This provides a native, on-device record that survives network outages
 * inside the stadium — critical for good fan UX at gate entry.
 *
 * Architecture overview:
 * 1. The server signs a JWT (RS256) containing the pass object payload.
 * 2. The signed JWT is embedded in a "Save to Google Wallet" URL.
 * 3. The fan taps the URL → OS-native Wallet flow → pass lands in Wallet.
 *
 * Prerequisites:
 * - A Google Cloud service account with "Google Wallet API" enabled.
 * - `GOOGLE_WALLET_ISSUER_ID` — the numeric issuer ID from the Wallet console.
 * - `GOOGLE_WALLET_CLASS_ID` — the pass class created in the Wallet console.
 *
 * In demo/mock mode these helpers still produce structurally valid URLs
 * (using placeholder IDs) so the UI can render the "Save to Wallet" button
 * without live credentials.
 *
 * @see https://developers.google.com/wallet/generic/web
 * @see https://developers.google.com/wallet/generic/rest/v1/genericobject
 */

// ── Constants ──────────────────────────────────────────────────────────────

/** Base URL for the Google Wallet "Save" deep-link flow. */
const WALLET_SAVE_BASE = "https://pay.google.com/gp/v/save";

/** Issuer ID for the StadiumIQ generic pass class. Falls back to demo value. */
const ISSUER_ID =
  process.env.GOOGLE_WALLET_ISSUER_ID ?? "3388000000022795702";

/** Pass class ID — must match the class created in the Google Wallet console. */
const PASS_CLASS_ID =
  process.env.GOOGLE_WALLET_CLASS_ID ?? "stadiumiq_order_receipt";

// ── Types ──────────────────────────────────────────────────────────────────

export interface OrderPassData {
  /** The internal order ID (e.g. "ord-abc123"). */
  orderId: string;
  /** Human-readable pickup location name (e.g. "Burger Stand — Gate B"). */
  poiName: string;
  /** 4-digit pickup code shown to the concession attendant. */
  pickupCode: string;
  /** Order total in paise / cents (displayed after dividing by 100). */
  totalCents: number;
  /** ISO 8601 timestamp when the order was placed. */
  createdAt: string;
  /** Fan's display name for the pass header (optional). */
  fanName?: string;
}

export interface EventTicketPassData {
  /** Unique ticket ID from the ticketing system. */
  ticketId: string;
  /** Venue name (e.g. "Wankhede Stadium"). */
  venueName: string;
  /** Seat or section label. */
  seat: string;
  /** Match or event name. */
  eventName: string;
  /** ISO 8601 date/time of the event. */
  eventDate: string;
  /** Barcode / QR code value for gate scanning. */
  barcode: string;
}

// ── Payload builders ───────────────────────────────────────────────────────

/**
 * Build an unsigned Google Wallet Generic Pass payload for an order receipt.
 *
 * The returned object is the `payload` field that must be base64url-encoded
 * and embedded in a signed JWT before use. In demo mode the payload is
 * still structurally correct so developers can inspect the schema.
 *
 * @param order  Order data to embed in the pass.
 * @returns      An unsigned Google Wallet object payload.
 *
 * @example
 *   const payload = buildOrderReceiptPassPayload(order);
 *   // sign with RS256 → base64url → append to WALLET_SAVE_BASE
 */
export function buildOrderReceiptPassPayload(order: OrderPassData): object {
  const totalDisplay = `$${(order.totalCents / 100).toFixed(2)}`;
  return {
    iss: "service-account@stadiumiq.iam.gserviceaccount.com",
    aud: "google",
    typ: "savetowallet",
    payload: {
      genericObjects: [
        {
          id: `${ISSUER_ID}.${PASS_CLASS_ID}.${order.orderId}`,
          classId: `${ISSUER_ID}.${PASS_CLASS_ID}`,
          genericType: "GENERIC_OTHER",
          hexBackgroundColor: "#0f172a",
          logo: {
            sourceUri: {
              uri: "https://stadium-iq-phi.vercel.app/icon.svg",
            },
            contentDescription: {
              defaultValue: { language: "en-US", value: "StadiumIQ" },
            },
          },
          cardTitle: {
            defaultValue: { language: "en-US", value: "StadiumIQ Order" },
          },
          subheader: {
            defaultValue: { language: "en-US", value: "Pickup Code" },
          },
          header: {
            defaultValue: { language: "en-US", value: order.pickupCode },
          },
          textModulesData: [
            {
              id: "poi",
              header: "Location",
              body: order.poiName,
            },
            {
              id: "total",
              header: "Order Total",
              body: totalDisplay,
            },
            {
              id: "ordered_at",
              header: "Ordered At",
              body: new Date(order.createdAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ],
          barcode: {
            type: "QR_CODE",
            value: order.orderId,
            alternateText: order.pickupCode,
          },
          state: "ACTIVE",
        },
      ],
    },
  };
}

/**
 * Build an unsigned Google Wallet Generic Pass payload for an event ticket.
 *
 * @param ticket  Event ticket data to embed.
 * @returns       An unsigned Google Wallet object payload.
 */
export function buildEventTicketPassPayload(
  ticket: EventTicketPassData,
): object {
  const classId = `${ISSUER_ID}.stadiumiq_event_ticket`;
  return {
    iss: "service-account@stadiumiq.iam.gserviceaccount.com",
    aud: "google",
    typ: "savetowallet",
    payload: {
      genericObjects: [
        {
          id: `${ISSUER_ID}.stadiumiq_event_ticket.${ticket.ticketId}`,
          classId,
          genericType: "GENERIC_OTHER",
          hexBackgroundColor: "#1e3a5f",
          cardTitle: {
            defaultValue: { language: "en-US", value: ticket.eventName },
          },
          subheader: {
            defaultValue: { language: "en-US", value: ticket.venueName },
          },
          header: {
            defaultValue: { language: "en-US", value: ticket.seat },
          },
          textModulesData: [
            {
              id: "event_date",
              header: "Date & Time",
              body: new Date(ticket.eventDate).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            },
            {
              id: "ticket_id",
              header: "Ticket ID",
              body: ticket.ticketId,
            },
          ],
          barcode: {
            type: "QR_CODE",
            value: ticket.barcode,
            alternateText: ticket.ticketId,
          },
          state: "ACTIVE",
        },
      ],
    },
  };
}

// ── URL builder ────────────────────────────────────────────────────────────

/**
 * Build a "Save to Google Wallet" URL from a pre-signed JWT string.
 *
 * The JWT must be signed with the Google Cloud service account key (RS256)
 * before being passed to this function. In production this signing happens
 * server-side in an API route — never client-side.
 *
 * @param signedJwt The RS256-signed JWT string from the server.
 * @returns         The full "Save to Google Wallet" URL to present to the fan.
 *
 * @example
 *   // Server-side API route:
 *   const jwt = signWalletJwt(buildOrderReceiptPassPayload(order));
 *   const url = buildSaveToWalletUrl(jwt);
 *   return NextResponse.json({ walletUrl: url });
 */
export function buildSaveToWalletUrl(signedJwt: string): string {
  return `${WALLET_SAVE_BASE}/${signedJwt}`;
}

/**
 * Generate a deterministic demo "Save to Google Wallet" URL for an order.
 *
 * In mock mode (no real service account) this produces a structurally valid
 * URL with a base64url-encoded unsigned payload. Google's endpoint will
 * reject it, but the URL shape is correct for UI development/testing.
 *
 * @param order The order to encode in the demo URL.
 * @returns     A demo wallet URL (not valid for real wallet saves).
 */
export function buildDemoWalletUrl(order: OrderPassData): string {
  const payload = buildOrderReceiptPassPayload(order);
  // In a real implementation this would be a signed JWT via google-auth-library.
  // For demo mode, base64url-encode the unsigned payload as a visual placeholder.
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return buildSaveToWalletUrl(encoded);
}

/**
 * Returns `true` when the Google Wallet integration is fully configured.
 * Use this to conditionally render the "Save to Wallet" button.
 */
export const isWalletConfigured: boolean = Boolean(
  process.env.GOOGLE_WALLET_ISSUER_ID &&
    process.env.GOOGLE_WALLET_CLASS_ID,
);
