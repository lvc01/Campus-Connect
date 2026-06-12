import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { NotificationProvider } from "@/context/notification-context";
import { ChatProvider } from "@/context/chat-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeInitScript } from "@/components/theme-init-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "CU Campus Connect | Student Social Network",
  description: "The verified, university-only social network for Chandigarh University students.",
  keywords: ["university", "social media", "Chandigarh University", "CU", "India", "students", "campus"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
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
