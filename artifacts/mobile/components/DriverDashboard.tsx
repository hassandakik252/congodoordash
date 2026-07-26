import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  Platform, ActivityIndicator, Alert, RefreshControl, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { orderApi, earningsApi, reviewApi } from "@/services/api";
import { formatCurrency, formatDate, getOrderStatusColor } from "@/utils/format";
import LivePulse from "./LivePulse";
import DriverEarnings from "./DriverEarnings";
import {
  scheduleLocalNotification,
  NotificationEvent,
} from "@/services/pushNotifications";

type Tab = "available" | "mine" | "earnings";

/**
 * Animates a flash when new orders appear.
 * Accepts an optional onFlash callback — called once per "new orders detected"
 * event so callers can fire push / haptic alerts without duplicating the
 * prev-count tracking logic.
 */
function useNewOrderFlash(count: number, onFlash?: () => void) {
  const flash = useRef(new Animated.Value(0)).current;
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onFlash?.();
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 180, useNativeDriver: false }),
        Animated.timing(flash, { toValue: 0, duration: 350, useNativeDriver: false }),
        Animated.timing(flash, { toValue: 1, duration: 180, useNativeDriver: false }),
        Animated.timing(flash, { toValue: 0, duration: 350, useNativeDriver: false }),
      ]).start();
    }
    prevCount.current = count;
  }, [count]);

  return flash;
}

export default function DriverDashboard() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user: authUser } = useAuth();
  const [tab, setTab] = useState<Tab>("available");
  const qc = useQueryClient();

  const availableQuery = useQuery({
    queryKey: ["driver-available"],
    queryFn: orderApi.availableForDriver,
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
  });

  const myQuery = useQuery({
    queryKey: ["driver-orders", authUser?.id],
    queryFn: orderApi.myDriverOrders,
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
  });

  const todayEarningsQuery = useQuery({
    queryKey: ["driver-earnings", "today"],
    queryFn: () => earningsApi.summary("today"),
    refetchInterval: 30000,
  });

  const todayEarnings = todayEarningsQuery.data?.totalEarnings ?? 0;
  const todayDeliveries = todayEarningsQuery.data?.totalDeliveries ?? 0;

  const ratingQuery = useQuery({
    queryKey: ["driver-rating", authUser?.id],
    queryFn: () => reviewApi.driverAvg(authUser!.id),
    enabled: !!authUser?.id,
  });
  const myRating = ratingQuery.data?.avg;

  const availableCount = availableQuery.data?.length ?? 0;
  const flash = useNewOrderFlash(availableCount, () => {
    scheduleLocalNotification(
      t("pushNewOrder"),
      t("pushNewOrderDesc"),
      { event: NotificationEvent.NEW_ORDER },
    );
  });

  const acceptOrder = useMutation({
    mutationFn: (id: number) => orderApi.acceptOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver-available"] });
      qc.invalidateQueries({ queryKey: ["driver-orders"] });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTab("mine");
    },
    onError: (e: any) => {
      Alert.alert("", e.message || t("error"));
      qc.invalidateQueries({ queryKey: ["driver-available"] });
    },
  });

  const deliverOrder = useMutation({
    mutationFn: (id: number) => orderApi.updateStatus(id, "delivered"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver-orders"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["driver-earnings"] });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert("", e.message || t("error")),
  });

  const confirmCash = useMutation({
    mutationFn: (id: number) => earningsApi.confirmCash(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver-orders"] });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert("Erreur", e.message || t("error")),
  });

  const currentData = tab === "available" ? availableQuery.data : myQuery.data;
  const isLoading = tab === "available" ? availableQuery.isLoading : myQuery.isLoading;
  const refetch = tab === "available" ? availableQuery.refetch : myQuery.refetch;
  const isRefetching = tab === "available" ? availableQuery.isRefetching : myQuery.isRefetching;

  const handleConfirmCash = (id: number) => {
    Alert.alert(
      "Confirmer réception des espèces",
      "Confirmez-vous avoir reçu le paiement en espèces du client ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer", onPress: () => confirmCash.mutate(id) },
      ]
    );
  };

  const activeDeliveries = myQuery.data?.filter((o: any) => o.status === "picked_up")?.length ?? 0;

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t("pending"), confirmed: t("confirmed"), preparing: t("preparing"),
      ready_for_pickup: t("readyForPickup"), picked_up: t("pickedUp"),
      delivered: t("delivered"), cancelled: t("cancelled"),
    };
    return map[status] || status;
  };

  const handleAccept = (id: number) => {
    Alert.alert(
      t("pickUp"),
      t("acceptDeliveryMsg"),
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("confirm"), onPress: () => acceptOrder.mutate(id) },
      ]
    );
  };

  const handleDeliver = (id: number) => {
    Alert.alert(
      t("markDelivered"),
      t("confirmDeliveryMsg"),
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("confirm"), onPress: () => deliverOrder.mutate(id) },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t("driver")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.subtitle}>{authUser?.name}</Text>
            {myRating != null && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="star" size={13} color={Colors.accent} />
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.accent }}>{myRating.toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>
        <LivePulse label="Live" color={Colors.success} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Animated.View style={[
          styles.statCard,
          {
            borderColor: flash.interpolate({
              inputRange: [0, 1],
              outputRange: [Colors.border, Colors.primary],
            }),
          }
        ]}>
          <Text style={styles.statNum}>{availableCount}</Text>
          <Text style={styles.statLabel}>{t("availableOrders")}</Text>
        </Animated.View>
        <View style={[styles.statCard, { borderColor: Colors.accent + "44" }]}>
          <Text style={[styles.statNum, { color: Colors.accent }]}>{activeDeliveries}</Text>
          <Text style={styles.statLabel}>{t("myDeliveries")}</Text>
        </View>
        <Pressable
          style={[styles.statCard, styles.earningsStatCard]}
          onPress={() => setTab("earnings")}
        >
          <Text style={[styles.statNum, styles.earningsStatNum]} numberOfLines={1} adjustsFontSizeToFit>
            {todayEarnings > 0
              ? new Intl.NumberFormat("fr-CD", { style: "currency", currency: "CDF", maximumFractionDigits: 0 }).format(todayEarnings)
              : "—"
            }
          </Text>
          <Text style={styles.statLabel}>
            {todayDeliveries > 0 ? `Gains · ${todayDeliveries} livr.` : "Gains du jour"}
          </Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {([
          { key: "available" as Tab, label: t("availableOrders"), count: availableCount },
          { key: "mine" as Tab, label: t("myDeliveries"), count: activeDeliveries },
          { key: "earnings" as Tab, label: "Gains", count: 0 },
        ]).map(tb => (
          <Pressable
            key={tb.key}
            style={[styles.tabBtn, tab === tb.key && styles.tabBtnActive]}
            onPress={() => setTab(tb.key)}
          >
            <Text style={[styles.tabText, tab === tb.key && styles.tabTextActive]}>{tb.label}</Text>
            {tb.count > 0 && (
              <View style={[styles.countBadge, tab === tb.key && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                <Text style={styles.countBadgeText}>{tb.count}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {tab === "earnings" ? (
        <DriverEarnings />
      ) : isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={currentData || []}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 90) }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
          scrollEnabled={!!(currentData && currentData.length > 0)}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bicycle-outline" size={56} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {tab === "available" ? t("noAvailableOrders") : t("noOrders")}
              </Text>
              <Text style={styles.emptyText}>
                {tab === "available" ? t("noAvailableDesc") : t("noOrdersDesc")}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.storeName}>{item.storeName}</Text>
                  <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(item.status) + "22" }]}>
                  <Text style={[styles.statusText, { color: getOrderStatusColor(item.status) }]}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>

              {/* Items */}
              <Text style={styles.itemsText} numberOfLines={2}>
                {item.items?.map((i: any) => `${i.quantity}× ${i.name}`).join(", ")}
              </Text>

              {/* Address */}
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={14} color={Colors.primary} />
                <Text style={styles.infoText} numberOfLines={2}>{item.deliveryAddress}</Text>
              </View>

              {/* Customer phone */}
              {item.customerPhone && (
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={14} color={Colors.success} />
                  <Text style={[styles.infoText, { color: Colors.success }]}>{item.customerPhone}</Text>
                </View>
              )}

              {/* Driver instructions */}
              {item.driverInstructions && (
                <View style={[styles.instructionsBox]}>
                  <Ionicons name="navigate-outline" size={13} color={Colors.accent} />
                  <Text style={styles.instructionsText}>{item.driverInstructions}</Text>
                </View>
              )}

              {/* Payment info */}
              <View style={styles.paymentInfoRow}>
                <View style={styles.payBadge}>
                  <Ionicons
                    name={item.paymentMethod === "cash" ? "cash-outline" : "phone-portrait-outline"}
                    size={12}
                    color={Colors.textMuted}
                  />
                  <Text style={styles.payBadgeText}>
                    {item.paymentMethod === "cash" ? "Cash" : "M-Money"}
                  </Text>
                </View>
                {item.paymentStatus === "paid" && (
                  <View style={[styles.payBadge, { borderColor: Colors.success + "44", backgroundColor: Colors.success + "12" }]}>
                    <Text style={[styles.payBadgeText, { color: Colors.success }]}>{t("paymentPaid")}</Text>
                  </View>
                )}
              </View>

              {/* Cash Confirmation Banner */}
              {tab === "mine" && item.status === "picked_up" && item.paymentMethod === "cash" && !item.cashConfirmed && (
                <Pressable
                  style={({ pressed }) => [styles.cashConfirmBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => handleConfirmCash(item.id)}
                  disabled={confirmCash.isPending}
                >
                  <Ionicons name="cash-outline" size={15} color={Colors.accent} />
                  <Text style={styles.cashConfirmText}>
                    {confirmCash.isPending ? "Confirmation…" : "Confirmer réception des espèces"}
                  </Text>
                </Pressable>
              )}
              {tab === "mine" && item.status === "picked_up" && item.paymentMethod === "cash" && item.cashConfirmed && (
                <View style={styles.cashConfirmedBanner}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                  <Text style={styles.cashConfirmedText}>Espèces reçues ✓</Text>
                </View>
              )}

              {/* Footer */}
              <View style={styles.cardFooter}>
                <Text style={styles.total}>{formatCurrency(item.total)}</Text>
                {tab === "available" && item.status === "ready_for_pickup" && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      acceptOrder.isPending && { opacity: 0.5 },
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => handleAccept(item.id)}
                    disabled={acceptOrder.isPending}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>{t("pickUp")}</Text>
                  </Pressable>
                )}
                {tab === "mine" && item.status === "picked_up" && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { backgroundColor: (item.paymentMethod === "cash" && !item.cashConfirmed) ? Colors.surfaceAlt : Colors.success },
                      deliverOrder.isPending && { opacity: 0.5 },
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => handleDeliver(item.id)}
                    disabled={deliverOrder.isPending || (item.paymentMethod === "cash" && !item.cashConfirmed)}
                  >
                    <Ionicons name="checkmark-done-outline" size={16} color={item.paymentMethod === "cash" && !item.cashConfirmed ? Colors.textMuted : "#fff"} />
                    <Text style={[styles.actionBtnText, item.paymentMethod === "cash" && !item.cashConfirmed && { color: Colors.textMuted }]}>
                      {t("markDelivered")}
                    </Text>
                  </Pressable>
                )}
                {tab === "mine" && item.status === "delivered" && (
                  <View style={styles.deliveredBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                    <Text style={styles.deliveredText}>{t("delivered")}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    alignItems: "center", borderWidth: 1.5,
  },
  statNum: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.primary, marginBottom: 2 },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted, textAlign: "center" },
  earningsStatCard: {
    borderColor: Colors.success + "55",
    backgroundColor: Colors.success + "0C",
  },
  earningsStatNum: {
    color: Colors.success,
    fontSize: 16,
  },
  tabRow: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 14,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 4,
  },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  tabTextActive: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  countBadge: {
    backgroundColor: Colors.primary, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 5,
  },
  countBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 32 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 15, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 8 },
  storeName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  orderDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  itemsText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginBottom: 8 },
  infoRow: { flexDirection: "row", gap: 7, marginBottom: 6, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  instructionsBox: {
    flexDirection: "row", gap: 7, alignItems: "flex-start",
    backgroundColor: Colors.accent + "12", borderRadius: 10, padding: 9, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.accent + "30",
  },
  instructionsText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.accent },
  paymentInfoRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  payBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Colors.surfaceAlt,
  },
  payBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  cashConfirmBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.accent + "18", borderRadius: 10, padding: 10,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.accent + "44",
  },
  cashConfirmText: {
    flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.accent,
  },
  cashConfirmedBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.success + "14", borderRadius: 10, padding: 8,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.success + "33",
  },
  cashConfirmedText: {
    fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.success,
  },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  total: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.primary },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  actionBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  deliveredBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  deliveredText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.success },
});
