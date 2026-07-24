import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import { Animated } from "react-native";

interface ScrollContextValue {
  scrollProgress: Animated.Value;
  hideTabBar: boolean;
  setHideTabBar: (v: boolean) => void;
}

const ScrollContext = createContext<ScrollContextValue>({
  scrollProgress: new Animated.Value(0),
  hideTabBar: false,
  setHideTabBar: () => {},
});

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const scrollProgress = useRef(new Animated.Value(0)).current;
  const [hideTabBar, setHideTabBar] = useState(false);
  return (
    <ScrollContext.Provider value={{ scrollProgress, hideTabBar, setHideTabBar }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScrollHide() {
  return useContext(ScrollContext);
}
