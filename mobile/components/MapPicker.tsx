import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme-context";

interface MapPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: string, coordinates: { lat: number; lng: number }) => void;
  initialLocation?: string;
}

export function MapPicker({ visible, onClose, onSelect, initialLocation }: MapPickerProps) {
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState({
    latitude: -15.3875,
    longitude: 28.3228,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  React.useEffect(() => {
    if (visible) {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          setRegion((prev) => ({
            ...prev,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          }));
        }
      })();
    }
  }, [visible]);

  const handleMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarker({ lat: latitude, lng: longitude });
    setLoading(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.street, r.city, r.region].filter(Boolean);
        setAddress(parts.join(", "));
      }
    } catch {
      setAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    }
    setLoading(false);
  };

  const handleConfirm = () => {
    if (marker && address) {
      onSelect(address, marker);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.cancel, { color: colors.primary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Pick Location</Text>
          <TouchableOpacity onPress={handleConfirm} disabled={!marker || !address}>
            <Text style={[styles.done, { color: marker && address ? colors.primary : colors.textSecondary }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <MapView
          ref={mapRef}
          style={styles.map}
          region={region}
          onRegionChangeComplete={setRegion}
          onPress={handleMapPress}
        >
          {marker && (
            <Marker
              coordinate={{ latitude: marker.lat, longitude: marker.lng }}
              draggable
              onDragEnd={(e) => handleMapPress({ nativeEvent: { coordinate: e.nativeEvent.coordinate } })}
            />
          )}
        </MapView>

        {/* Address preview */}
        <View style={[styles.addressBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : marker ? (
            <View style={styles.addressRow}>
              <Ionicons name="location" size={16} color={colors.primary} />
              <Text style={[styles.addressText, { color: colors.textPrimary }]} numberOfLines={2}>
                {address}
              </Text>
            </View>
          ) : (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Tap on the map to select a location</Text>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: "600" },
  cancel: { fontSize: 16 },
  done: { fontSize: 16, fontWeight: "600" },
  map: { flex: 1 },
  addressBar: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addressText: { fontSize: 14, flex: 1 },
  hint: { fontSize: 14, textAlign: "center" },
});
