
import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { GoogleAnalyticsProvider } from "@/components/google-analytics";
import { Providers } from "@/components/providers";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/seo/site";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300"],
  style: ["normal", "italic"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "paperAI",
    "GTU paper solutions",
    "GTU syllabus",
    "old exam papers",
    "PDF chat",
    "AI study assistant",
    "GTU books",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "education",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/paper_ai_logo.png",
        width: 280,
        height: 72,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/paper_ai_logo.png"],
  },
  icons: {
    icon: [
      { url: "/paper_ai_logo.png", media: "(prefers-color-scheme: light)" },
      { url: "/paper_ai_logo_dark_mode.png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [
      { url: "/paper_ai_logo.png", media: "(prefers-color-scheme: light)" },
      { url: "/paper_ai_logo_dark_mode.png", media: "(prefers-color-scheme: dark)" },
    ],
  },
  verification: {
    google: "HWShO_Zn-OoWzGjGpBwHPMDJh45QT2dWuPoLhNVamZg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM site description" />
      </head>
      <body className={`${fraunces.variable} ${instrumentSans.variable} antialiased`}>
        <Providers>{children}</Providers>
        <GoogleAnalyticsProvider />
      </body>
    </html>
  );
}
