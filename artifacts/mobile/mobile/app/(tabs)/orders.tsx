import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { orderApi, reviewApi } from "@/services/api";
import { formatCurrency, formatDate, getOrderStatusColor } from "@/utils/format";
import LivePulse from "@/components/LivePulse";
import RatingModal from "@/components/RatingModal";

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [ratingOrder, setRatingOrder] = useState<{ id: number; restaurantName: string; driverId?: number | null } | null>(null);
  const [reviewedOrders, setReviewedOrders] = useState<Set<number>>(new Set());

  const { data: orders, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: orderApi.list,
    enabled: !!user,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  const submitReview = useMutation({
    mutationFn: reviewApi.submit,
    onSuccess: (_, vars) => {
      setReviewedOrders(prev => new Set([...prev, vars.orderId]));
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t("pending"), confirmed: t("confirmed"), preparing: t("preparing"),
      ready_for_pickup: t("readyForPickup"), picked_up: t("pickedUp"),
      delivered: t("delivered"), cancelled: t("cancelled"),
    };
    return map[status] || status;
  };

  const OrderCard = ({ item }: { item: any }) => {
    const isActive = !["delivered", "cancelled"].includes(item.status);
    const isDelivered = item.status === "delivered";
    const alreadyReviewed = reviewedOrders.has(item.id) || item.reviewed;

    return (
      <Pressable
        style={({ pressed }) => [styles.card, isActive && styles.cardActive, pressed && { opacity: 0.85 }]}
        onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.restaurantName}>{item.restaurantName}</Text>
            <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(item.status) + "22" }]}>
            <Text style={[styles.statusText, { color: getOrderStatusColor(item.status) }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        {isActive && (
          <View style={styles.progressHint}>
            <Ionicons name="time-outline" size={13} color={Colors.primary} />
            <Text style={styles.progressText}>{t("trackOrder")} →</Text>
          </View>
        )}

        <View style={styles.divider} />
        <View style={styles.cardBottom}>
          <Text style={styles.itemCount}>
            {item.items?.length || 0} {t("items")}
          </Text>
          <Text style={styles.total}>{formatCurrency(item.total)}</Text>
        </View>

        {isDelivered && !alreadyReviewed && (
          <Pressable
            style={({ pressed }) => [styles.rateBtn, pressed && { opacity: 0.8 }]}
            onPress={(e) => {
              e.stopPropagation?.();
              setRatingOrder({ id: item.id, restaurantName: item.restaurantName, driverId: item.driverId });
            }}
          >
            <Ionicons name="star-outline" size={14} color="#FFB800" />
            <Text style={styles.rateBtnText}>Évaluer</Text>
          </Pressable>
        )}

        {isDelivered && alreadyReviewed && (
          <View style={styles.reviewedBadge}>
            <Ionicons name="star" size={13} color="#FFB800" />
            <Text style={styles.reviewedText}>Évalué</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("myOrders")}</Text>
        {orders?.some((o: any) => !["delivered", "cancelled"].includes(o.status)) && (
          <LivePulse label="Live" color={Colors.primary} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={orders || []}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 90),
          }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={56} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>{t("noOrders")}</Text>
              <Text style={styles.emptyText}>{t("noOrdersDesc")}</Text>
            </View>
          }
          renderItem={({ item }) => <OrderCard item={item} />}
        />
      )}

      <RatingModal
        visible={!!ratingOrder}
        order={ratingOrder}
        onClose={() => setRatingOrder(null)}
        onSubmit={submitReview.mutateAsync}
      />
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardActive: { borderColor: Colors.primary + "55", borderWidth: 1.5 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  restaurantName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, marginBottom: 4 },
  orderDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  progressHint: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: 8, marginBottom: 2,
  },
  progressText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemCount: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  total: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.primary },
  rateBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 12, alignSelf: "flex-start",
    backgroundColor: "#FFB80018", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: "#FFB80044",
  },
  rateBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFB800" },
  reviewedBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: 12, alignSelf: "flex-start",
  },
  reviewedText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textMuted },
});
