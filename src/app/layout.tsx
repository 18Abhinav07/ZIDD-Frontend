import type { Metadata } from "next";
import { Instrument_Serif, Anton, Outfit } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-hero",
  weight: ["800", "900"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "400",
  style: ["normal", "italic"],
});

const anton = Anton({
  subsets: ["latin"],
  variable: "--font-ghost",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Zidd - AI Communication Coach",
  description: "High-end cinematic AI spoken English and communication coaching.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable} ${anton.variable} ${outfit.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
