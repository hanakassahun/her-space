import type { Metadata, Viewport } from "next";
import { DM_Sans, Noto_Sans_Ethiopic, Sora } from "next/font/google";
import AppChrome from "@/components/AppChrome";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const notoSansEthiopic = Noto_Sans_Ethiopic({
  variable: "--font-noto-ethiopic",
  subsets: ["ethiopic", "latin"],
  display: "swap",
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
  return (
    <html
      lang="en"
      className={`${sora.variable} ${dmSans.variable} ${notoSansEthiopic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <AppChrome>{children}</AppChrome>
        </LanguageProvider>
      </body>
    </html>
  );
}
