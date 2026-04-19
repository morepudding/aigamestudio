import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar, OfficeNavProvider } from "@/components/sidebar";
import { ChatPanelProvider } from "@/components/chat/ChatPanelProvider";
import { ChatPanelMount } from "@/components/chat/ChatPanelMount";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ConditionalLayout } from "@/components/ConditionalLayout";

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
          <OfficeNavProvider>
            <Sidebar />
            <ConditionalLayout>{children}</ConditionalLayout>
          </OfficeNavProvider>
          <ChatPanelMount />
          <ChatBubble />
        </ChatPanelProvider>
      </body>
    </html>
  );
}
