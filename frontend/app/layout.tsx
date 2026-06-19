
import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { GoogleAnalyticsProvider } from "@/components/google-analytics";
import { Providers } from "@/components/providers";

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

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const siteName = "paperAI";
const title = "paperAI — AI-Powered GTU Paper Solutions & PDF Chat";
const description =
  "Find GTU syllabus, old exam papers, books, and paper solutions, then upload PDFs to generate AI answers, summaries, and document-grounded chat.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: title,
    template: `%s | ${siteName}`,
  },
  description,
  keywords: [
    "paperAI",
    "GTU paper solutions",
    "GTU syllabus",
    "old exam papers",
    "PDF chat",
    "AI study assistant",
    "GTU books",
  ],
  authors: [{ name: "paperAI" }],
  creator: "paperAI",
  publisher: "paperAI",
  category: "education",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title,
    description,
    images: [
      {
        url: "/paper_ai_logo.png",
        width: 280,
        height: 72,
        alt: "paperAI",
      },
    ],
  },
  twitter: {
    card: "summary",
    title,
    description,
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
      </head>
      <body className={`${fraunces.variable} ${instrumentSans.variable} antialiased`}>
        <Providers>{children}</Providers>
        <GoogleAnalyticsProvider />
      </body>
    </html>
  );
}
