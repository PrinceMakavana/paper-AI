import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "paperAI Admin Portal",
  description: "Admin portal for paperAI subject data management.",
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
