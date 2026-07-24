import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../hooks/useAuth";
import { ThemeProvider, useTheme } from "../lib/theme-context";
import { DialogProvider } from "../components/Dialog";
import { ToastProvider } from "../components/Toast";
import { ScrollProvider } from "../lib/scroll-context";
import { usePushNotifications } from "../hooks/usePushNotifications";

const queryClient = new QueryClient();

function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  usePushNotifications();
  return <>{children}</>;
}

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <DialogProvider>
            <ToastProvider>
              <AuthProvider>
                <ScrollProvider>
                  <PushNotificationProvider>
                    <ThemedStatusBar />
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="(auth)" />
                      <Stack.Screen name="(tabs)" />
                    </Stack>
                  </PushNotificationProvider>
                </ScrollProvider>
              </AuthProvider>
            </ToastProvider>
          </DialogProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
