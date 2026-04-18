import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Footer } from "@/components/footer";
import { ChatPanelProvider } from "@/components/chat/ChatPanelProvider";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ChatBubble } from "@/components/chat/ChatBubble";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1a1025",
};

export const metadata: Metadata = {
  title: "Eden Studio",
  description: "Eden — web-first game studio crafting expressive browser games",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Eden Studio",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-background text-foreground overflow-hidden">
        <ChatPanelProvider>
          <Sidebar />
          <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 pb-24 md:px-10 md:py-10 md:pb-10 lg:px-14 lg:py-14">{children}</main>
            <Footer />
          </div>
          <ChatPanel />
          <ChatBubble />
        </ChatPanelProvider>
      </body>
    </html>
  );
}
