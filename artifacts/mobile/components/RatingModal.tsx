import React, { useState } from "react";
import {
  Modal, View, Text, StyleSheet, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

interface RatingModalProps {
  visible: boolean;
  order: { id: number; storeName: string; driverId?: number | null } | null;
  onClose: () => void;
  onSubmit: (payload: { orderId: number; storeRating: number; driverRating?: number; comment?: string }) => Promise<void>;
}

function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.starSection}>
      <Text style={styles.starLabel}>{label}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map(n => (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={8}>
            <Ionicons
              name={n <= value ? "star" : "star-outline"}
              size={34}
              color={n <= value ? "#FFB800" : Colors.textMuted}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function RatingModal({ visible, order, onClose, onSubmit }: RatingModalProps) {
  const [storeRating, setRestaurantRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setRestaurantRating(0);
    setDriverRating(0);
    setComment("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!order) return;
    if (storeRating === 0) {
      setError("Veuillez noter le restaurant.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit({
        orderId: order.id,
        storeRating,
        driverRating: driverRating > 0 ? driverRating : undefined,
        comment: comment.trim() || undefined,
      });
      reset();
      onClose();
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'envoi.");
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Évaluer votre commande</Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.storeName}>{order.storeName}</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
            <StarRow
              label="Restaurant"
              value={storeRating}
              onChange={setRestaurantRating}
            />

            {order.driverId && (
              <StarRow
                label="Livreur"
                value={driverRating}
                onChange={setDriverRating}
              />
            )}

            <View style={styles.commentBox}>
              <Text style={styles.commentLabel}>Commentaire (optionnel)</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Partagez votre expérience…"
                placeholderTextColor={Colors.textMuted}
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={400}
                numberOfLines={3}
              />
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [styles.submitBtn, loading && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitText}>Envoyer l'évaluation</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: "85%",
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center", marginBottom: 16,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 4,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  storeName: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textMuted,
    marginBottom: 20,
  },
  starSection: { marginBottom: 20 },
  starLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, marginBottom: 10 },
  stars: { flexDirection: "row", gap: 10 },
  commentBox: { marginBottom: 12 },
  commentLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, marginBottom: 8 },
  commentInput: {
    backgroundColor: Colors.surfaceAlt, borderRadius: 12, padding: 12,
    color: Colors.textPrimary, fontFamily: "Inter_400Regular", fontSize: 14,
    minHeight: 72, textAlignVertical: "top",
    borderWidth: 1, borderColor: Colors.border,
  },
  errorText: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.error,
    marginBottom: 8,
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: "center", marginTop: 12,
  },
  submitText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
