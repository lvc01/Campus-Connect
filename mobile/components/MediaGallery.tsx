import React, { useState, useRef } from "react";
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Modal, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme-context";
import { spacing, borderRadius } from "../lib/theme";

export interface MediaItem {
  url: string;
  // Backend MediaType values: "image" | "video" | "document".
  // Older payloads use "type"; newer ones use "media_type". Accept both.
  type?: string;
  media_type?: string;
}

interface MediaGalleryProps {
  media: MediaItem[];
}

const isVideo = (m: MediaItem) => (m.media_type ?? m.type) === "video";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MEDIA_HEIGHT = 240;

/**
 * Post media gallery. Renders all images in a swipeable paged carousel
 * with a page indicator (replacing the old "+N" single-image behavior),
 * and a tappable full-screen viewer. Page width is measured from the
 * container layout so it adapts to any parent padding. Video entries
 * currently render a poster with a play badge — a native player requires
 * a video library (expo-video), which is intentionally not a dependency yet.
 */
export function MediaGallery({ media }: MediaGalleryProps) {
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState<number | null>(null);
  const [pageWidth, setPageWidth] = useState(SCREEN_WIDTH);
  const scrollRef = useRef<ScrollView>(null);

  if (!media || media.length === 0) return null;

  const handleScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (idx !== activeIndex) setActiveIndex(idx);
  };

  return (
    <>
      <View
        style={styles.container}
        onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {media.map((item, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.95}
              onPress={() => setFullscreen(index)}
              style={{ width: pageWidth }}
            >
              <Image source={{ uri: item.url }} style={styles.media} resizeMode="cover" />
              {isVideo(item) && (
                <View style={styles.videoBadge}>
                  <Ionicons name="play-circle" size={40} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Page indicator — only when more than one item */}
        {media.length > 1 && (
          <View style={styles.indicatorRow}>
            {media.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  { backgroundColor: index === activeIndex ? colors.primary : colors.border },
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* Full-screen viewer */}
      <Modal visible={fullscreen !== null} transparent animationType="fade" onRequestClose={() => setFullscreen(null)}>
        <View style={styles.fullscreenOverlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setFullscreen(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {fullscreen !== null && (
            <Image
              source={{ uri: media[fullscreen].url }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  media: {
    width: "100%",
    height: MEDIA_HEIGHT,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  videoBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  indicatorRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: spacing.sm,
  },
  fullscreenImage: {
    width: "100%",
    height: "80%",
  },
});
