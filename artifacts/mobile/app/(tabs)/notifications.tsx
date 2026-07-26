import React, { useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { notificationApi } from "@/services/api";

type NotifType =
  | "new_order"
  | "order_confirmed"
  | "order_preparing"
  | "order_ready"
  | "driver_assigned"
  | "order_delivered"
  | "order_cancelled"
  | "payment_submitted"
  | "payment_confirmed"
  | "payment_failed"
  | "driver_application";

const NOTIF_ICONS: Record<NotifType, { name: string; color: string }> = {
  new_order:          { name: "bag-add-outline",          color: Colors.primary },
  order_confirmed:    { name: "checkmark-circle-outline", color: Colors.success },
  order_preparing:    { name: "flame-outline",            color: Colors.accent },
  order_ready:        { name: "bag-check-outline",        color: Colors.accent },
  driver_assigned:    { name: "bicycle-outline",          color: "#4A90E2" },
  order_delivered:    { name: "home-outline",             color: Colors.success },
  order_cancelled:    { name: "close-circle-outline",     color: Colors.error },
  payment_submitted:  { name: "receipt-outline",          color: "#4A90E2" },
  payment_confirmed:  { name: "checkmark-done-outline",   color: Colors.success },
  payment_failed:     { name: "alert-circle-outline",     color: Colors.error },
  driver_application: { name: "person-add-outline",       color: Colors.accent },
};

function timeAgo(dateStr: string, t: (k: any) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return `${mins} ${t("minutesAgo")}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${t("hoursAgo")}`;
  if (hrs < 48) return t("yesterday");
  return new Date(dateStr).toLocaleDateString("fr-CD", { day: "numeric", month: "short" });
}

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  orderId: number | null;
  isRead: boolean;
  createdAt: string;
}

function NotifCard({
  notif,
  onPress,
  onMarkRead,
}: {
  notif: Notification;
  onPress: () => void;
  onMarkRead: () => void;
}) {
  const { t } = useLang();
  const icon = NOTIF_ICONS[notif.type as NotifType] ?? { name: "notifications-outline", color: Colors.textMuted };

  return (
    <Pressable
      style={[styles.card, !notif.isRead && styles.cardUnread]}
      onPress={onPress}
    >
      <View style={[styles.iconWrap, { backgroundColor: icon.color + "18" }]}>
        <Ionicons name={icon.name as any} size={22} color={icon.color} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, !notif.isRead && styles.cardTitleUnread]} numberOfLines={1}>
            {notif.title}
          </Text>
          <Text style={styles.cardTime}>{timeAgo(notif.createdAt, t)}</Text>
        </View>
        <Text style={styles.cardBody} numberOfLines={2}>{notif.body}</Text>
        {notif.orderId && (
          <Text style={styles.cardOrderRef}>{t("orderRef")} #{notif.orderId}</Text>
        )}
      </View>
      {!notif.isRead && (
        <Pressable
          style={styles.readDot}
          onPress={(e) => { e.stopPropagation(); onMarkRead(); }}
          hitSlop={12}
        >
          <View style={styles.unreadDot} />
        </Pressable>
      )}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const qc = useQueryClient();

  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationApi.list(),
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const handlePress = useCallback((notif: Notification) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!notif.isRead) markRead.mutate(notif.id);
    if (notif.orderId) router.push({ pathname: "/order/[id]", params: { id: notif.orderId } });
  }, [markRead]);

  const unreadCount = (notifications as Notification[]).filter(n => !n.isRead).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t("notifications")}</Text>
          {unreadCount > 0 && (
            <Text style={styles.subtitle}>
              {unreadCount} {t("unreadNotif")}
            </Text>
          )}
        </View>
        {unreadCount > 0 && (
          <Pressable
            style={[styles.markAllBtn, markAll.isPending && { opacity: 0.5 }]}
            onPress={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            {markAll.isPending
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Text style={styles.markAllText}>{t("markAllRead")}</Text>
            }
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (notifications as Notification[]).length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{t("noNotifications")}</Text>
          <Text style={styles.emptyDesc}>{t("noNotificationsDesc")}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications as Notification[]}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 40 : 100) }}
          onRefresh={refetch}
          refreshing={isLoading}
          renderItem={({ item }) => (
            <NotifCard
              notif={item}
              onPress={() => handlePress(item)}
              onMarkRead={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                markRead.mutate(item.id);
              }}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },

  header: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  markAllBtn: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  markAllText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.primary },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, textAlign: "center" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },

  card: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.dark,
  },
  cardUnread: { backgroundColor: Colors.surface + "CC" },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  cardContent: { flex: 1, gap: 3 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  cardTitleUnread: { color: Colors.textPrimary, fontFamily: "Inter_600SemiBold" },
  cardTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, flexShrink: 0 },
  cardBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 18 },
  cardOrderRef: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.primary, marginTop: 2 },

  readDot: { paddingTop: 4, alignSelf: "flex-start" },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.primary },

  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 72 },
});
