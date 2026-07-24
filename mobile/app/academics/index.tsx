import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "../../lib/api-client";
import { useTheme } from "../../lib/theme-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import type { Course } from "../../types";

const FACULTIES = ["All", "Engineering", "Computer Applications", "Management"];

export default function AcademicsScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<"all" | "my">("all");
  const [faculty, setFaculty] = useState("All");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, refetch, isRefetching, isLoading } = useQuery({
    queryKey: ["courses", faculty, search],
    queryFn: () =>
      api.get<{ items: Course[] }>("/academics/courses", {
        params: {
          ...(faculty !== "All" ? { faculty } : {}),
          ...(search ? { search } : {}),
        },
      }),
  });

  const courses = data?.items || [];
  const displayed = tab === "my" ? courses.filter((c) => c.is_member) : courses;

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const renderItem = ({ item }: { item: Course }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => router.push(`/academics/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardBadges}>
          <View style={[styles.codeBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.codeText, { color: colors.primary }]}>{item.code}</Text>
          </View>
          {item.is_member && (
            <View style={[styles.joinedBadge, { backgroundColor: colors.success + "20" }]}>
              <Text style={[styles.joinedText, { color: colors.success }]}>Joined</Text>
            </View>
          )}
        </View>
        {item.year && (
          <Text style={[styles.yearText, { color: colors.textSecondary }]}>
            Y{item.year}{item.semester ? `S${item.semester}` : ""}
          </Text>
        )}
      </View>

      <Text style={[styles.courseName, { color: colors.textPrimary }]} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={[styles.facultyText, { color: colors.textSecondary }]}>{item.faculty}</Text>

      <View style={styles.cardFooter}>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="people" size={14} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {item.member_count} members
            </Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="document-text" size={14} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {item.resource_count} resources
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.joinButton,
            item.is_member
              ? { backgroundColor: colors.muted }
              : { backgroundColor: colors.primary + "20" },
          ]}
          onPress={() => {
            if (item.is_member) {
              api.delete(`/academics/courses/${item.id}/join`).then(() => refetch());
            } else {
              api.post(`/academics/courses/${item.id}/join`).then(() => refetch());
            }
          }}
        >
          <Ionicons
            name={item.is_member ? "person-remove" : "person-add"}
            size={14}
            color={item.is_member ? colors.textSecondary : colors.primary}
          />
          <Text
            style={[
              styles.joinText,
              { color: item.is_member ? colors.textSecondary : colors.primary },
            ]}
          >
            {item.is_member ? "Leave" : "Join"}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Academics</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, tab === "all" && { borderBottomColor: colors.primary }]}
          onPress={() => setTab("all")}
        >
          <Ionicons name="book" size={14} color={tab === "all" ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, { color: tab === "all" ? colors.primary : colors.textSecondary }]}>
            All Courses
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "my" && { borderBottomColor: colors.primary }]}
          onPress={() => setTab("my")}
        >
          <Ionicons name="people" size={14} color={tab === "my" ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, { color: tab === "my" ? colors.primary : colors.textSecondary }]}>
            My Courses
          </Text>
          {courses.some((c) => c.is_member) && (
            <View style={[styles.countBadge, { backgroundColor: colors.primary + "20" }]}>
              <Text style={[styles.countText, { color: colors.primary }]}>
                {courses.filter((c) => c.is_member).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchText, { color: colors.textPrimary }]}
            placeholder="Search courses..."
            placeholderTextColor={colors.textSecondary}
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Faculty filters */}
      <View style={styles.filters}>
        {FACULTIES.map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              {
                backgroundColor: faculty === f ? colors.primary : "transparent",
                borderColor: faculty === f ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setFaculty(f)}
          >
            <Text
              style={[
                styles.filterText,
                { color: faculty === f ? colors.primaryForeground : colors.textSecondary },
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Course list */}
      {isLoading ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="book-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {tab === "my" ? "You haven't joined any courses yet." : "No courses found."}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  back: {
    fontSize: fontSize.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  countBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 10,
    fontWeight: "700",
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchText: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  filters: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
  list: {
    padding: spacing.lg,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  cardBadges: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  codeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  codeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  joinedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  joinedText: {
    fontSize: 10,
    fontWeight: "700",
  },
  yearText: {
    fontSize: 10,
    fontWeight: "600",
  },
  courseName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  facultyText: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stats: {
    flexDirection: "row",
    gap: spacing.md,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statText: {
    fontSize: fontSize.xs,
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  joinText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  loading: {
    marginTop: spacing.xxl * 2,
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxl * 3,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    textAlign: "center",
  },
});
