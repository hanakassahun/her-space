import type { Metadata, Viewport } from "next";
import { DM_Sans, Noto_Sans_Ethiopic, Sora } from "next/font/google";
import { preconnect } from "react-dom";
import AppChrome from "@/components/AppChrome";
import { AuthProvider } from "@/components/AuthProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const notoSansEthiopic = Noto_Sans_Ethiopic({
  variable: "--font-noto-ethiopic",
  subsets: ["ethiopic", "latin"],
  display: "swap",
  preload: false,
  weight: "variable",
});

export const metadata: Metadata = {
  title: "Her Space",
  description: "Learn. Share. Know yourself.",
  appleWebApp: {
    capable: true,
    title: "Her Space",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2A1B3D",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      preconnect(new URL(supabaseUrl).origin, { crossOrigin: "anonymous" });
    } catch {
      // Ignore an invalid optional endpoint; Supabase reports its own configuration errors.
    }
  }

  return (
    <html
      lang="en"
      className={`${sora.variable} ${dmSans.variable} ${notoSansEthiopic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <AuthProvider>
            <AppChrome>{children}</AppChrome>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
