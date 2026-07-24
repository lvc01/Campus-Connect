import React, { createContext, useContext, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { useTheme } from "../lib/theme-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../lib/theme";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <View style={styles.container}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { colors } = useTheme();

  const getIcon = () => {
    switch (toast.type) {
      case "success": return "checkmark-circle";
      case "error": return "alert-circle";
      case "info": return "information-circle";
    }
  };

  const getIconColor = () => {
    switch (toast.type) {
      case "success": return colors.success;
      case "error": return colors.error;
      case "info": return colors.primary;
    }
  };

  const getBackgroundColor = () => {
    switch (toast.type) {
      case "success": return colors.successLight;
      case "error": return colors.errorLight;
      case "info": return colors.accentLight;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.toast, { backgroundColor: getBackgroundColor(), borderColor: getIconColor() }]}
      onPress={onDismiss}
      activeOpacity={0.8}
    >
      <Ionicons name={getIcon()} size={20} color={getIconColor()} />
      <Text style={[styles.message, { color: colors.textPrimary }]} numberOfLines={2}>
        {toast.message}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: spacing.xxl * 2,
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.sm,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: fontSize.sm,
  },
});
