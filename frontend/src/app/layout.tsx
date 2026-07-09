import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { NotificationProvider } from "@/context/notification-context";
import { ChatProvider } from "@/context/chat-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeInitScript } from "@/components/theme-init-script";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["opsz", "SOFT", "WONK"],
});

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "CU Campus Connect | Student Social Network",
  description: "The verified, university-only social network for Chandigarh University students.",
  keywords: ["university", "social media", "Chandigarh University", "CU", "India", "students", "campus"],
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
    shortcut: "/icon.png",
  },
  openGraph: {
    images: [{ url: "/icon.png", width: 512, height: 512 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${fraunces.variable} ${geist.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <ThemeInitScript />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider>
              <NotificationProvider>
                <ChatProvider>
                  <Toaster position="top-center" richColors closeButton />
                  <div className="flex-1 flex flex-col">
                    {children}
                  </div>
                </ChatProvider>
              </NotificationProvider>
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
