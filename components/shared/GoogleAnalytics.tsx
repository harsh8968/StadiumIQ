import Script from "next/script";
import { publicEnv } from "@/lib/env";

/**
 * Google Analytics 4 (gtag.js). Renders nothing when `NEXT_PUBLIC_GA_ID` is
 * unset, so local/demo builds incur zero third-party network cost.
 *
 * Loaded with `strategy="afterInteractive"` so it never blocks initial paint
 * — part of our Core Web Vitals budget.
 */
export function GoogleAnalytics() {
  const gaId = publicEnv.NEXT_PUBLIC_GA_ID;
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
