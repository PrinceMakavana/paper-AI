
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

export const metadata: Metadata = {
  title: "paperAI — AI Document Assistant",
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
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${fraunces.variable} ${instrumentSans.variable} antialiased`}>
        <Providers>{children}</Providers>
        <GoogleAnalyticsProvider />
      </body>
    </html>
  );
}
