import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import SecurityProvider from "@/components/providers/SecurityProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const maxDuration = 300; // Allow 5 minutes for AI generation

export const metadata: Metadata = {
  title: "과사람 의대관 | Premium Report System",
  description: "ClassIn Learning Report Analysis System",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased select-none`}
      >
        <AuthProvider>
          <SecurityProvider>
            {children}
          </SecurityProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
