import { GoogleAnalytics } from "@next/third-parties/google";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalyticsProvider() {
  if (!GA_ID) return null;
  return <GoogleAnalytics gaId={GA_ID} />;
}
