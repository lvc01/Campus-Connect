import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "../lib/api-client";
import { useAuth } from "./useAuth";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const { isAuthenticated } = useAuth();
  const notificationSubscription = useRef<Notifications.EventSubscription | undefined>(undefined);
  const responseSubscription = useRef<Notifications.EventSubscription | undefined>(undefined);

  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotifications();

    notificationSubscription.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Notification received:", notification);
      }
    );

    responseSubscription.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("Notification tapped:", response);
      }
    );

    return () => {
      notificationSubscription.current?.remove();
      responseSubscription.current?.remove();
    };
  }, [isAuthenticated]);

  async function registerForPushNotifications() {
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device");
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission not granted");
      return;
    }

    const token = await Notifications.getExpoPushTokenAsync();
    console.log("Expo Push Token:", token.data);

    try {
      await api.post("/auth/mobile/push-token", {
        push_token: token.data,
        platform: Platform.OS === "android" ? "android" : "ios",
      });
    } catch (error) {
      console.error("Failed to register push token:", error);
    }

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  }

  async function scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>
  ) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
      },
      trigger: null,
    });
  }

  return {
    scheduleLocalNotification,
  };
}
