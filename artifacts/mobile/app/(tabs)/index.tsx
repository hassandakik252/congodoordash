import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { authApi } from "@/services/api";
import CustomerHome from "@/components/CustomerHome";
import DriverDashboard from "@/components/DriverDashboard";
import StoreOwnerDashboard from "@/components/StoreOwnerDashboard";
import AdminDashboard from "@/components/AdminDashboard";

function DriverPendingScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuth();
  const { t } = useLang();
  const [refreshing, setRefreshing] = React.useState(false);
  const isPending = user?.driverStatus === "pending";
  const isRejected = user?.driverStatus === "rejected";
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const freshUser = await authApi.me();
      updateUser(freshUser);
    } catch {}
    setRefreshing(false);
  };

  // Auto-poll every 15 seconds while pending so the screen updates immediately on approval
  useEffect(() => {
    if (!isPending) return;
    intervalRef.current = setInterval(async () => {
      try {
        const freshUser = await authApi.me();
        updateUser(freshUser);
      } catch {}
    }, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPending]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.center}>
        <View style={[styles.iconCircle, isRejected ? styles.iconCircleRed : styles.iconCircleYellow]}>
          <Ionicons
            name={isRejected ? "close-circle-outline" : "time-outline"}
            size={52}
            color={isRejected ? Colors.error : Colors.accent}
          />
        </View>

        <Text style={styles.statusTitle}>
          {isRejected ? t("driverRejectedTitle") : t("driverPendingTitle")}
        </Text>

        <Text style={styles.statusDesc}>
          {isRejected ? t("driverRejectedDesc") : t("driverPendingDesc")}
        </Text>

        {isPending && (
          <View style={styles.stepsCard}>
            {[
              { icon: "checkmark-circle-outline", text: t("driverStep1"), done: true },
              { icon: "hourglass-outline", text: t("driverStep2"), done: false },
              { icon: "bicycle-outline", text: t("driverStep3"), done: false },
            ].map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <Ionicons
                  name={step.icon as any}
                  size={20}
                  color={step.done ? Colors.success : Colors.textMuted}
                />
                <Text style={[styles.stepText, step.done ? styles.stepDone : null]}>
                  {step.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.75 }]}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <Ionicons name="refresh-outline" size={16} color={Colors.primary} />
          <Text style={styles.refreshBtnText}>
            {refreshing ? t("loading") : t("driverCheckStatus")}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.75 }]}
          onPress={logout}
        >
          <Text style={styles.logoutBtnText}>{t("logout")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();

  if (user?.role === "admin") return <AdminDashboard />;
  if (user?.role === "driver") {
    // null means a legacy account created before the driverStatus column — let them in
    if (user.driverStatus === "pending" || user.driverStatus === "rejected") {
      return <DriverPendingScreen />;
    }
    return <DriverDashboard />;
  }
  if (user?.role === "store_owner") return <StoreOwnerDashboard />;
  return <CustomerHome />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },

  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  iconCircleYellow: { backgroundColor: Colors.accent + "20", borderWidth: 2, borderColor: Colors.accent + "44" },
  iconCircleRed: { backgroundColor: Colors.error + "18", borderWidth: 2, borderColor: Colors.error + "44" },

  statusTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.textPrimary, textAlign: "center" },
  statusDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },

  stepsCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 18,
    width: "100%", gap: 14, borderWidth: 1, borderColor: Colors.border, marginTop: 8,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, flex: 1 },
  stepDone: { color: Colors.success, fontFamily: "Inter_500Medium" },

  refreshBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.primary + "66",
    backgroundColor: Colors.primary + "12",
  },
  refreshBtnText: { color: Colors.primary, fontSize: 14, fontFamily: "Inter_600SemiBold" },

  logoutBtn: { marginTop: 4 },
  logoutBtnText: { color: Colors.textMuted, fontSize: 13, fontFamily: "Inter_400Regular", textDecorationLine: "underline" },
});
