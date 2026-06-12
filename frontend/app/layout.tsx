
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
  title: "paperAI — AI-Powered GTU Paper Solutions & Document Assistant",
  description:
    "Upload GTU papers, generate accurate AI solutions, chat with PDFs, summarize notes, and prepare smarter for exams. Gemini + Ollama support.",
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
