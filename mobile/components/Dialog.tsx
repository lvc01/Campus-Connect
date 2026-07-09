import React, { createContext, useContext, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { useTheme } from "../lib/theme-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../lib/theme";

interface DialogContextValue {
  open: (content: React.ReactNode) => void;
  close: () => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<React.ReactNode>(null);
  const [visible, setVisible] = useState(false);

  const open = useCallback((c: React.ReactNode) => {
    setContent(c);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(() => setContent(null), 200);
  }, []);

  return (
    <DialogContext.Provider value={{ open, close }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.overlay} onPress={close}>
          <Pressable style={styles.contentContainer} onPress={(e) => e.stopPropagation()}>
            {content}
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

interface DialogContentProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function DialogContent({ children, title, description }: DialogContentProps) {
  const { colors } = useTheme();
  const { close } = useDialog();

  return (
    <View style={[styles.dialog, { backgroundColor: colors.card }]}>
      <TouchableOpacity style={styles.closeButton} onPress={close}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      {title && <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>}
      {description && <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>}
      {children}
    </View>
  );
}

interface DialogButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "destructive";
}

export function DialogButton({ children, onPress, variant = "primary" }: DialogButtonProps) {
  const { colors } = useTheme();
  const { close } = useDialog();

  const getBackgroundColor = () => {
    switch (variant) {
      case "primary": return colors.primary;
      case "secondary": return colors.secondary;
      case "destructive": return colors.destructive;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case "primary": return colors.primaryForeground;
      case "secondary": return colors.textPrimary;
      case "destructive": return colors.destructiveForeground;
    }
  };

  const handlePress = () => {
    onPress?.();
    close();
  };

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: getBackgroundColor() }]}
      onPress={handlePress}
    >
      <Text style={[styles.buttonText, { color: getTextColor() }]}>{children}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  contentContainer: {
    width: "100%",
    maxWidth: 400,
  },
  dialog: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: "100%",
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    padding: spacing.xs,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    marginBottom: spacing.xs,
    paddingRight: spacing.xxl,
  },
  description: {
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  buttonText: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
});
