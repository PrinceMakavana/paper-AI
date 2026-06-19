import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "paperAI Admin Portal",
  description: "Admin portal for paperAI subject data management.",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [{ url: "/paper_ai_logo.png" }],
    apple: [{ url: "/paper_ai_logo.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
