import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/lib/auth";
import { colors, spacing, fontSize } from "../../src/lib/theme";

interface Habit {
  id: string;
  habit_id: string;
  habits: { name: string };
  completed_today: boolean;
}

interface SelectedPhoto {
  uri: string;
  type: "front" | "side" | "back" | "other";
}

const photoTypes = [
  { key: "front", label: "Front" },
  { key: "side", label: "Side" },
  { key: "back", label: "Back" },
  { key: "other", label: "Other" },
] as const;

export default function TodayScreen() {
  const { clientId, orgId } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [workoutDone, setWorkoutDone] = useState(false);
  const [weight, setWeight] = useState("");
  const [checkinNotes, setCheckinNotes] = useState("");
  const [checkinPhotos, setCheckinPhotos] = useState<SelectedPhoto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const loadData = useCallback(async () => {
    if (!clientId || !orgId) return;

    // Get assigned habits
    const { data: clientHabits } = await supabase
      .from("client_habits")
      .select("id, habit_id, habits(name)")
      .eq("client_id", clientId);

    // Get today's activity
    const { data: todayActivity } = await supabase
      .from("activity_events")
      .select("type, payload")
      .eq("client_id", clientId)
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);

    const completedHabits = new Set(
      todayActivity
        ?.filter((a) => a.type === "habit")
        .map((a) => a.payload?.habit_id)
    );

    const hasWorkout = todayActivity?.some((a) => a.type === "workout");

    setHabits(
      (clientHabits ?? []).map((h: any) => ({
        ...h,
        completed_today: completedHabits.has(h.habit_id),
      }))
    );
    setWorkoutDone(hasWorkout ?? false);
  }, [clientId, orgId, today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const toggleHabit = async (habit: Habit) => {
    if (habit.completed_today || !clientId || !orgId) return;

    await supabase.from("activity_events").insert({
      org_id: orgId,
      client_id: clientId,
      type: "habit",
      payload: {
        habit_id: habit.habit_id,
        habit_name: habit.habits.name,
      },
    });

    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id ? { ...h, completed_today: true } : h
      )
    );
  };

  const toggleWorkout = async () => {
    if (workoutDone || !clientId || !orgId) return;

    await supabase.from("activity_events").insert({
      org_id: orgId,
      client_id: clientId,
      type: "workout",
      payload: { completed: true },
    });

    setWorkoutDone(true);
  };

  const saveWeight = async () => {
    if (!weight || !clientId || !orgId) return;
    setSaving(true);

    await supabase.from("activity_events").insert({
      org_id: orgId,
      client_id: clientId,
      type: "weight",
      payload: { value: parseFloat(weight), unit: "kg" },
    });

    // Also update client profile weight
    await supabase
      .from("clients")
      .update({ weight_kg: parseFloat(weight) })
      .eq("id", clientId);

    setWeight("");
    setSaving(false);
    Alert.alert("Saved", "Weight logged successfully!");
  };

  const pickImage = async (photoType: "front" | "side" | "back" | "other") => {
    // Check if already have this type
    if (checkinPhotos.find((p) => p.type === photoType)) {
      Alert.alert("Already Added", `You already have a ${photoType} photo. Remove it first.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCheckinPhotos((prev) => [
        ...prev,
        { uri: result.assets[0].uri, type: photoType },
      ]);
    }
  };

  const takePhoto = async (photoType: "front" | "side" | "back" | "other") => {
    // Check if already have this type
    if (checkinPhotos.find((p) => p.type === photoType)) {
      Alert.alert("Already Added", `You already have a ${photoType} photo. Remove it first.`);
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow access to your camera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCheckinPhotos((prev) => [
        ...prev,
        { uri: result.assets[0].uri, type: photoType },
      ]);
    }
  };

  const removePhoto = (type: string) => {
    setCheckinPhotos((prev) => prev.filter((p) => p.type !== type));
  };

  const uploadPhoto = async (photo: SelectedPhoto): Promise<string | null> => {
    try {
      const filename = `${clientId}/${today}/${photo.type}-${Date.now()}.jpg`;

      // Fetch the file
      const response = await fetch(photo.uri);
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from("progress-photos")
        .upload(filename, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (error) {
        console.error("Upload error:", error);
        return null;
      }

      return filename;
    } catch (err) {
      console.error("Upload error:", err);
      return null;
    }
  };

  const saveCheckin = async () => {
    if (!clientId || !orgId) return;
    if (!checkinNotes && checkinPhotos.length === 0) {
      Alert.alert("Required", "Please add notes or photos for your check-in.");
      return;
    }

    setSaving(true);
    setUploadingPhoto(checkinPhotos.length > 0);

    // Upload photos first
    const uploadedPaths: string[] = [];
    for (const photo of checkinPhotos) {
      const path = await uploadPhoto(photo);
      if (path) uploadedPaths.push(path);
    }

    setUploadingPhoto(false);

    // Create activity event
    const { data: activityEvent, error: activityError } = await supabase
      .from("activity_events")
      .insert({
        org_id: orgId,
        client_id: clientId,
        type: "checkin",
        payload: { notes: checkinNotes },
        photo_paths: uploadedPaths.length > 0 ? uploadedPaths : null,
      })
      .select()
      .single();

    if (activityError) {
      Alert.alert("Error", "Failed to save check-in.");
      setSaving(false);
      return;
    }

    // Create checkin_photos records
    if (uploadedPaths.length > 0 && activityEvent) {
      const photoRecords = checkinPhotos.map((photo, index) => ({
        org_id: orgId,
        client_id: clientId,
        activity_event_id: activityEvent.id,
        storage_path: uploadedPaths[index],
        photo_type: photo.type,
      }));

      await supabase.from("checkin_photos").insert(photoRecords);
    }

    setCheckinNotes("");
    setCheckinPhotos([]);
    setSaving(false);
    Alert.alert("Check-in Saved!", "Your progress has been recorded.");
  };

  const showPhotoOptions = (photoType: "front" | "side" | "back" | "other") => {
    Alert.alert("Add Photo", `Add ${photoType} view photo`, [
      { text: "Take Photo", onPress: () => takePhoto(photoType) },
      { text: "Choose from Library", onPress: () => pickImage(photoType) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.greeting}>
        {new Date().toLocaleDateString("en-AU", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </Text>

      {/* Habits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Habits</Text>
        {habits.length > 0 ? (
          habits.map((habit) => (
            <TouchableOpacity
              key={habit.id}
              style={styles.habitRow}
              onPress={() => toggleHabit(habit)}
              disabled={habit.completed_today}
            >
              <Ionicons
                name={habit.completed_today ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={habit.completed_today ? colors.success : colors.textMuted}
              />
              <Text
                style={[
                  styles.habitText,
                  habit.completed_today && styles.habitCompleted,
                ]}
              >
                {habit.habits.name}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>No habits assigned yet</Text>
        )}
      </View>

      {/* Workout */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workout</Text>
        <TouchableOpacity
          style={[styles.workoutButton, workoutDone && styles.workoutDone]}
          onPress={toggleWorkout}
          disabled={workoutDone}
        >
          <Ionicons
            name={workoutDone ? "checkmark-circle" : "barbell-outline"}
            size={24}
            color={workoutDone ? colors.success : colors.primary}
          />
          <Text style={[styles.workoutText, workoutDone && styles.workoutTextDone]}>
            {workoutDone ? "Workout Complete!" : "Mark Workout Complete"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Weight */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Log Weight</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Weight in kg"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.saveButton, !weight && styles.saveButtonDisabled]}
            onPress={saveWeight}
            disabled={!weight || saving}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress Check-in with Photos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Check-in</Text>

        {/* Photo Grid */}
        <View style={styles.photoGrid}>
          {photoTypes.map((pt) => {
            const photo = checkinPhotos.find((p) => p.type === pt.key);
            return (
              <View key={pt.key} style={styles.photoSlot}>
                {photo ? (
                  <View style={styles.photoPreview}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                    <TouchableOpacity
                      style={styles.removePhoto}
                      onPress={() => removePhoto(pt.key)}
                    >
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={() => showPhotoOptions(pt.key)}
                  >
                    <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.photoLabel}>{pt.label}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <Text style={styles.photoHint}>
          Add progress photos (optional) - Front, Side, Back views
        </Text>

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="How are you feeling this week? Any wins or challenges?"
          value={checkinNotes}
          onChangeText={setCheckinNotes}
          multiline
          numberOfLines={4}
          placeholderTextColor={colors.textMuted}
        />

        <TouchableOpacity
          style={[
            styles.saveButton,
            styles.fullWidth,
            (!checkinNotes && checkinPhotos.length === 0) && styles.saveButtonDisabled,
          ]}
          onPress={saveCheckin}
          disabled={(!checkinNotes && checkinPhotos.length === 0) || saving}
        >
          <Text style={styles.saveButtonText}>
            {uploadingPhoto
              ? "Uploading Photos..."
              : saving
              ? "Saving..."
              : "Submit Check-in"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  greeting: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.lg,
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
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  habitText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  habitCompleted: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  workoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: spacing.sm,
  },
  workoutDone: {
    borderColor: colors.success,
    backgroundColor: "#f0fdf4",
  },
  workoutText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.primary,
  },
  workoutTextDone: {
    color: colors.success,
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: spacing.md,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: fontSize.md,
    textAlign: "center",
  },
  fullWidth: {
    alignItems: "center",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  photoSlot: {
    width: "48%",
    aspectRatio: 3 / 4,
  },
  addPhotoButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  photoLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  photoPreview: {
    flex: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  removePhoto: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "white",
    borderRadius: 12,
  },
  photoHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.md,
  },
});
