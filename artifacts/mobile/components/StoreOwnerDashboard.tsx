import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { orderApi } from "@/services/api";
import { formatCurrency, formatDate, getOrderStatusColor } from "@/utils/format";
import LivePulse from "./LivePulse";
import {
  scheduleLocalNotification,
  NotificationEvent,
} from "@/services/pushNotifications";

export default function StoreOwnerDashboard() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();

  const prevOrderIds = useRef<Set<number>>(new Set());
  const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set());

  const { data: orders, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["owner-orders", user?.id],
    queryFn: orderApi.list,
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!orders) return;
    const currentIds = new Set(orders.map((o: any) => o.id));
    const incoming = orders.filter(
      (o: any) => !prevOrderIds.current.has(o.id) && o.status === "pending"
    );
    if (incoming.length > 0 && prevOrderIds.current.size > 0) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      scheduleLocalNotification(
        t("pushNewOrder"),
        incoming.length === 1
          ? t("pushNewOrderDesc")
          : `${incoming.length} ${t("pushNewOrderDescPlural")}`,
        { event: NotificationEvent.NEW_ORDER },
      );
      setNewOrderIds(prev => new Set([...prev, ...incoming.map((o: any) => o.id)]));
      setTimeout(() => {
        setNewOrderIds(prev => {
          const next = new Set(prev);
          incoming.forEach((o: any) => next.delete(o.id));
          return next;
        });
      }, 15000);
    }
    prevOrderIds.current = currentIds;
  }, [orders]);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => orderApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-orders"] });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert(t("error"), e.message || t("error")),
  });

  const activeOrders = orders?.filter((o: any) =>
    !["delivered", "cancelled"].includes(o.status)
  ) || [];
  const completedOrders = orders?.filter((o: any) => o.status === "delivered") || [];
  const totalRevenue = completedOrders.reduce((s: number, o: any) => s + (o.subtotal || 0), 0);
  const pendingCount = activeOrders.filter((o: any) => o.status === "pending").length;

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t("pending"), confirmed: t("confirmed"), preparing: t("preparing"),
      ready_for_pickup: t("readyForPickup"), picked_up: t("pickedUp"),
      delivered: t("delivered"), cancelled: t("cancelled"),
    };
    return map[status] || status;
  };

  const getNextAction = (status: string): { label: string; nextStatus: string; color: string } | null => {
    switch (status) {
      case "pending": return { label: t("confirmOrder"), nextStatus: "confirmed", color: Colors.primary };
      case "confirmed": return { label: t("startPreparing"), nextStatus: "preparing", color: Colors.warning };
      case "preparing": return { label: t("readyForDriver"), nextStatus: "ready_for_pickup", color: Colors.success };
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t("dashboard")}</Text>
        <LivePulse label="Live" color={Colors.success} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: Colors.primary + "44" }]}>
          <Text style={styles.statValue}>{activeOrders.length}</Text>
          <Text style={styles.statLabel}>{t("todayOrders")}</Text>
        </View>
        <View style={[styles.statCard, { borderColor: pendingCount > 0 ? Colors.warning + "88" : Colors.border }]}>
          <Text style={[styles.statValue, { color: pendingCount > 0 ? Colors.warning : Colors.textMuted }]}>
            {pendingCount}
          </Text>
          <Text style={styles.statLabel}>{t("pending")}</Text>
        </View>
        <View style={[styles.statCard, { borderColor: Colors.success + "44" }]}>
          <Text style={[styles.statValue, { color: Colors.success, fontSize: 12 }]}>
            {formatCurrency(totalRevenue)}
          </Text>
          <Text style={styles.statLabel}>{t("totalRevenue")}</Text>
        </View>
      </View>

      {pendingCount > 0 && (
        <View style={styles.alertBanner}>
          <Ionicons name="notifications" size={15} color={Colors.warning} />
          <Text style={styles.alertBannerText}>
            {pendingCount} {t("newOrder")}{pendingCount > 1 ? "s" : ""} à confirmer
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={activeOrders}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{
            paddingHorizontal: 16, paddingTop: 8,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 90),
          }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
          scrollEnabled={activeOrders.length > 0}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={56} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>{t("noOrders")}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const nextAction = getNextAction(item.status);
            const isNew = newOrderIds.has(item.id);

            return (
              <View style={[styles.card, isNew && styles.cardNew, item.status === "pending" && styles.cardPending]}>
                {isNew && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                )}

                {/* Card header */}
                <View style={styles.cardHeader}>
                  <View style={styles.orderNumRow}>
                    <Text style={styles.orderId}>#{item.id}</Text>
                    {item.paymentMethod === "mobile_money" && (
                      <View style={styles.payTag}>
                        <Text style={styles.payTagText}>
                          {item.paymentProvider ? item.paymentProvider : "M-Money"}
                        </Text>
                      </View>
                    )}
                    {(() => {
                      const ps = item.paymentStatus as string;
                      const colorMap: Record<string, string> = {
                        pending: "#F59E0B",
                        submitted: "#3B82F6",
                        confirmed: "#34C759",
                        failed: "#FF3B30",
                        paid: "#34C759",
                      };
                      const labelMap: Record<string, string> = {
                        pending: "En attente",
                        submitted: "Soumis",
                        confirmed: "Confirmé",
                        failed: "Échoué",
                        paid: "Payé",
                      };
                      const color = colorMap[ps] ?? "#9CA3AF";
                      return (
                        <View style={[styles.payTag, { borderColor: color + "44", backgroundColor: color + "15" }]}>
                          <Text style={[styles.payTagText, { color }]}>{labelMap[ps] ?? ps}</Text>
                        </View>
                      );
                    })()}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(item.status) + "22" }]}>
                    <Text style={[styles.statusText, { color: getOrderStatusColor(item.status) }]}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>

                {/* Items */}
                <View style={styles.itemsList}>
                  {item.items?.slice(0, 3).map((i: any, idx: number) => (
                    <Text key={idx} style={styles.itemText}>· {i.quantity}× {i.name}</Text>
                  ))}
                  {(item.items?.length || 0) > 3 && (
                    <Text style={styles.itemMore}>+{item.items.length - 3} de plus</Text>
                  )}
                </View>

                {/* Delivery address */}
                <View style={styles.addrRow}>
                  <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.addrText} numberOfLines={2}>{item.deliveryAddress}</Text>
                </View>

                {/* Customer phone */}
                {item.customerPhone && (
                  <View style={styles.addrRow}>
                    <Ionicons name="call-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.addrText}>{item.customerPhone}</Text>
                  </View>
                )}

                {/* Payment reference */}
                {item.paymentReference && (
                  <View style={styles.addrRow}>
                    <Ionicons name="receipt-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.addrText}>Réf: {item.paymentReference}</Text>
                  </View>
                )}

                {/* Notes */}
                {item.notes && (
                  <View style={styles.noteRow}>
                    <Ionicons name="chatbubble-outline" size={13} color={Colors.accent} />
                    <Text style={styles.noteText} numberOfLines={2}>{item.notes}</Text>
                  </View>
                )}

                {/* Driver instructions */}
                {item.driverInstructions && (
                  <View style={styles.noteRow}>
                    <Ionicons name="navigate-outline" size={13} color={Colors.primary} />
                    <Text style={styles.noteText} numberOfLines={2}>{item.driverInstructions}</Text>
                  </View>
                )}

                {/* Footer */}
                <View style={styles.cardFooter}>
                  <Text style={styles.total}>{formatCurrency(item.total)}</Text>
                  {nextAction ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn,
                        { backgroundColor: nextAction.color },
                        updateStatus.isPending && { opacity: 0.5 },
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => updateStatus.mutate({ id: item.id, status: nextAction.nextStatus })}
                      disabled={updateStatus.isPending}
                    >
                      <Text style={styles.actionBtnText}>{nextAction.label}</Text>
                    </Pressable>
                  ) : item.status === "ready_for_pickup" ? (
                    <View style={styles.waitingBadge}>
                      <Ionicons name="bicycle-outline" size={14} color={Colors.accent} />
                      <Text style={styles.waitingText}>{t("readyForPickup")}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
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
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 12,
    alignItems: "center", borderWidth: 1.5,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.primary, marginBottom: 2 },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textMuted, textAlign: "center" },
  alertBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 10, padding: 11, borderRadius: 12,
    backgroundColor: Colors.warning + "15", borderWidth: 1, borderColor: Colors.warning + "44",
  },
  alertBannerText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.warning },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 15, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
  },
  cardNew: { borderColor: Colors.warning, borderWidth: 2 },
  cardPending: { borderColor: Colors.primary + "55" },
  newBadge: {
    position: "absolute", top: 0, right: 0,
    backgroundColor: Colors.warning, paddingHorizontal: 10, paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  newBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  orderNumRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  orderId: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  payTag: {
    borderWidth: 1, borderColor: Colors.accent + "44", backgroundColor: Colors.accent + "15",
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
  payTagText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.accent },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  orderDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginBottom: 10 },
  itemsList: { marginBottom: 8, gap: 2 },
  itemText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  itemMore: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  addrRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 5 },
  addrText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 5 },
  noteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  total: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.primary },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  actionBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  waitingBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  waitingText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.accent },
});
