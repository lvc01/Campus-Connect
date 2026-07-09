import React from "react";
import { View, Text, StyleSheet, Animated, Pressable } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../lib/theme-context";
import { useScrollHide } from "../../lib/scroll-context";
import { Ionicons } from "@expo/vector-icons";
import { useUnreadNotificationCount } from "../../hooks/useUnreadNotificationCount";

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { colors } = useTheme();
  const { scrollProgress, hideTabBar } = useScrollHide();

  const currentRouteName = state.routes[state.index]?.name;
  if (currentRouteName === "compose" || currentRouteName === "notifications") return null;

  return (
    <Animated.View
      style={[
        styles.tabBar,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          transform: [{ translateY: scrollProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 80] }) }],
          opacity: scrollProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        },
        hideTabBar && { display: "none" },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        if (route.name === "compose" || route.name === "notifications" || route.name === "explore") return null;
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const color = isFocused ? colors.primary : colors.mutedForeground;

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const iconName = (() => {
          switch (route.name) {
            case "index": return "home" as const;
            case "clubs": return "people-circle" as const;
            case "events": return "calendar" as const;
            case "marketplace": return "pricetag" as const;
            case "messages": return "chatbubbles" as const;
            default: return "ellipse" as const;
          }
        })();

        return (
          <Pressable key={route.key} onPress={onPress} style={styles.tabItem}>
            <Ionicons name={iconName} size={24} color={color} />
            <Text style={[styles.tabLabel, { color }]}>
              {options.title || route.name}
            </Text>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

export default function TabsLayout() {
  const { isAuthenticated, loading } = useAuth();
  const { colors } = useTheme();
  const unreadCount = useUnreadNotificationCount();

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="clubs" options={{ title: "Clubs" }} />
      <Tabs.Screen name="events" options={{ title: "Events" }} />
      <Tabs.Screen name="marketplace" options={{ title: "Shop" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="compose" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ title: "Search" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingBottom: 20,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
});
