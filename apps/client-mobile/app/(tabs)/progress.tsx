import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/lib/auth";
import { colors, spacing, fontSize } from "../../src/lib/theme";

interface WeightEntry {
  date: string;
  value: number;
}

interface Stats {
  currentStreak: number;
  longestStreak: number;
  weeklyAdherence: number;
  monthlyAdherence: number;
  totalWorkouts: number;
  totalCheckins: number;
}

interface ProgressPhoto {
  id: string;
  storage_path: string;
  photo_type: string;
  taken_at: string;
  notes?: string;
}

const { width: screenWidth } = Dimensions.get("window");

export default function ProgressScreen() {
  const { clientId, orgId } = useAuth();
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null);
  const [activePhotoTab, setActivePhotoTab] = useState<"all" | "front" | "side" | "back">("all");

  const loadData = useCallback(async () => {
    if (!clientId || !orgId) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get weight history
    const { data: weightData } = await supabase
      .from("activity_events")
      .select("created_at, payload")
      .eq("client_id", clientId)
      .eq("type", "weight")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true });

    setWeights(
      (weightData ?? []).map((w: any) => ({
        date: w.created_at.split("T")[0],
        value: w.payload?.value ?? 0,
      }))
    );

    // Get progress photos
    const { data: photoData } = await supabase
      .from("checkin_photos")
      .select("*")
      .eq("client_id", clientId)
      .order("taken_at", { ascending: false })
      .limit(50);

    setPhotos(photoData ?? []);

    // Calculate stats
    const { data: allActivity } = await supabase
      .from("activity_events")
      .select("created_at, type")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    const activities = allActivity ?? [];

    // Calculate streaks (days with any activity)
    const activityDays = new Set(
      activities.map((a: any) => a.created_at.split("T")[0])
    );
    const sortedDays = Array.from(activityDays).sort().reverse();

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split("T")[0];

      if (activityDays.has(dateStr)) {
        tempStreak++;
        if (i === 0 || currentStreak > 0) {
          currentStreak = tempStreak;
        }
      } else {
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
        tempStreak = 0;
        if (i === 0) currentStreak = 0;
      }
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;

    // Weekly adherence (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weeklyDays = sortedDays.filter(
      (d) => new Date(d) >= sevenDaysAgo
    ).length;

    // Monthly adherence
    const monthlyDays = sortedDays.filter(
      (d) => new Date(d) >= thirtyDaysAgo
    ).length;

    const totalWorkouts = activities.filter((a: any) => a.type === "workout").length;
    const totalCheckins = activities.filter((a: any) => a.type === "checkin").length;

    setStats({
      currentStreak,
      longestStreak,
      weeklyAdherence: Math.round((weeklyDays / 7) * 100),
      monthlyAdherence: Math.round((monthlyDays / 30) * 100),
      totalWorkouts,
      totalCheckins,
    });
  }, [clientId, orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getPhotoUrl = (storagePath: string) => {
    const { data } = supabase.storage
      .from("progress-photos")
      .getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const filteredPhotos = activePhotoTab === "all"
    ? photos
    : photos.filter((p) => p.photo_type === activePhotoTab);

  const weightChange =
    weights.length >= 2
      ? weights[weights.length - 1].value - weights[0].value
      : null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Streaks */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Streaks</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.currentStreak ?? 0}</Text>
            <Text style={styles.statLabel}>Current Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.longestStreak ?? 0}</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </View>
        </View>
      </View>

      {/* Adherence */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Adherence</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.weeklyAdherence ?? 0}%</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.monthlyAdherence ?? 0}%</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
        </View>
      </View>

      {/* Weight Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weight (Last 30 Days)</Text>
        {weights.length > 0 ? (
          <>
            <View style={styles.chartContainer}>
              {weights.map((w, i) => {
                const minWeight = Math.min(...weights.map((x) => x.value));
                const maxWeight = Math.max(...weights.map((x) => x.value));
                const range = maxWeight - minWeight || 1;
                const height = ((w.value - minWeight) / range) * 100 + 20;

                return (
                  <View key={i} style={styles.barContainer}>
                    <View style={[styles.bar, { height: `${height}%` }]} />
                  </View>
                );
              })}
            </View>
            <View style={styles.weightSummary}>
              <Text style={styles.weightCurrent}>
                Current: {weights[weights.length - 1]?.value.toFixed(1)} kg
              </Text>
              {weightChange !== null && (
                <Text
                  style={[
                    styles.weightChange,
                    weightChange < 0 ? styles.weightDown : styles.weightUp,
                  ]}
                >
                  {weightChange > 0 ? "+" : ""}
                  {weightChange.toFixed(1)} kg
                </Text>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>No weight entries yet</Text>
        )}
      </View>

      {/* Progress Photos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress Photos</Text>

        {/* Photo Type Filter */}
        <View style={styles.photoTabs}>
          {(["all", "front", "side", "back"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.photoTab, activePhotoTab === tab && styles.photoTabActive]}
              onPress={() => setActivePhotoTab(tab)}
            >
              <Text style={[styles.photoTabText, activePhotoTab === tab && styles.photoTabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredPhotos.length > 0 ? (
          <View style={styles.photoGrid}>
            {filteredPhotos.map((photo) => (
              <TouchableOpacity
                key={photo.id}
                style={styles.photoThumbnail}
                onPress={() => setSelectedPhoto(photo)}
              >
                <Image
                  source={{ uri: getPhotoUrl(photo.storage_path) }}
                  style={styles.thumbnailImage}
                />
                <View style={styles.photoOverlay}>
                  <Text style={styles.photoDate}>{formatDate(photo.taken_at)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            No progress photos yet. Add them in your weekly check-in!
          </Text>
        )}
      </View>

      {/* Activity Totals */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Time</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalWorkouts ?? 0}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalCheckins ?? 0}</Text>
            <Text style={styles.statLabel}>Check-ins</Text>
          </View>
        </View>
      </View>

      {/* Photo Modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setSelectedPhoto(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {selectedPhoto && (
            <View style={styles.modalContent}>
              <Image
                source={{ uri: getPhotoUrl(selectedPhoto.storage_path) }}
                style={styles.modalImage}
                resizeMode="contain"
              />
              <View style={styles.modalInfo}>
                <Text style={styles.modalDate}>
                  {new Date(selectedPhoto.taken_at).toLocaleDateString("en-AU", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
                <Text style={styles.modalType}>
                  {selectedPhoto.photo_type.charAt(0).toUpperCase() + selectedPhoto.photo_type.slice(1)} View
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: "center",
  },
  statValue: {
    fontSize: fontSize.xxxl,
    fontWeight: "bold",
    color: colors.primary,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    gap: 2,
  },
  barContainer: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  bar: {
    backgroundColor: colors.primary,
    borderRadius: 2,
    minHeight: 4,
  },
  weightSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  weightCurrent: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: "600",
  },
  weightChange: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  weightDown: {
    color: colors.success,
  },
  weightUp: {
    color: colors.warning,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  photoTabs: {
    flexDirection: "row",
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  photoTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: "center",
  },
  photoTabActive: {
    backgroundColor: colors.primary,
  },
  photoTabText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  photoTabTextActive: {
    color: "#fff",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  photoThumbnail: {
    width: (screenWidth - spacing.md * 2 - spacing.md * 2 - spacing.sm * 2) / 3,
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  photoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: spacing.xs,
  },
  photoDate: {
    color: "#fff",
    fontSize: fontSize.xs,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 1,
    padding: spacing.sm,
  },
  modalContent: {
    width: "100%",
    alignItems: "center",
  },
  modalImage: {
    width: screenWidth - spacing.lg * 2,
    height: screenWidth * 1.3,
  },
  modalInfo: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  modalDate: {
    color: "#fff",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  modalType: {
    color: "rgba(255,255,255,0.7)",
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
});
