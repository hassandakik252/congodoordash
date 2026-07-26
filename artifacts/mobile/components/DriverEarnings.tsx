import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { earningsApi } from "@/services/api";

type Period = "today" | "week" | "all";

function formatCDF(amount: number) {
  return new Intl.NumberFormat("fr-CD", {
    style: "currency",
    currency: "CDF",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-CD", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return `Aujourd'hui ${formatTime(iso)}`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) + " " + formatTime(iso);
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  all: "Tout",
};

function motivationalMessage(totalDeliveries: number, totalEarnings: number, period: Period): string {
  if (totalDeliveries === 0) {
    return period === "today" ? "Commencez à livrer pour gagner !" : "Aucune livraison sur cette période.";
  }
  if (period === "today") {
    if (totalDeliveries >= 10) return "Journée exceptionnelle ! 🔥";
    if (totalDeliveries >= 5) return "Excellent rythme, continuez !";
    if (totalDeliveries >= 2) return "Bonne journée, vous avancez bien !";
    return "Première livraison du jour, allez-y !";
  }
  if (period === "week") {
    if (totalDeliveries >= 40) return "Semaine record ! Bravo. 💪";
    if (totalDeliveries >= 20) return "Belle semaine, continuez comme ça !";
    return "Semaine en cours, gardez le cap !";
  }
  return `${totalDeliveries} livraisons au total !`;
}

export default function DriverEarnings() {
  const [period, setPeriod] = useState<Period>("today");
  const [showSettlements, setShowSettlements] = useState(false);

  const earningsQuery = useQuery({
    queryKey: ["driver-earnings", period],
    queryFn: () => earningsApi.summary(period),
    refetchInterval: 30000,
  });

  const settlementsQuery = useQuery({
    queryKey: ["driver-settlements"],
    queryFn: earningsApi.settlements,
    enabled: showSettlements,
  });

  const data = earningsQuery.data;
  const loading = earningsQuery.isLoading;
  const refreshing = earningsQuery.isRefetching;

  const avgPerDelivery = data && data.totalDeliveries > 0
    ? data.totalEarnings / data.totalDeliveries
    : 0;

  const owes = data?.totalOwedToCompany > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => earningsQuery.refetch()}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Period Tabs */}
      <View style={styles.periodRow}>
        {(["today", "week", "all"] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
            activeOpacity={0.8}
          >
            <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Chargement des gains…</Text>
        </View>
      ) : data ? (
        <>
          {/* Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroLabel}>Vos gains</Text>
            <Text style={styles.heroAmount}>{formatCDF(data.totalEarnings)}</Text>
            <View style={styles.heroDeliveryRow}>
              <Ionicons name="bicycle" size={16} color={Colors.textMuted} />
              <Text style={styles.heroDeliveryCount}>
                {data.totalDeliveries} livraison{data.totalDeliveries !== 1 ? "s" : ""}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <Text style={styles.heroMotivation}>
              {motivationalMessage(data.totalDeliveries, data.totalEarnings, period)}
            </Text>
          </View>

          {/* Stat Chips */}
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Ionicons name="trending-up-outline" size={18} color={Colors.primary} />
              <Text style={styles.chipValue}>{formatCDF(avgPerDelivery)}</Text>
              <Text style={styles.chipLabel}>Moy. / livraison</Text>
            </View>
            <View style={[styles.chip, owes && { borderColor: Colors.error + "55", backgroundColor: Colors.error + "10" }]}>
              <Ionicons
                name={owes ? "arrow-up-circle-outline" : "checkmark-circle-outline"}
                size={18}
                color={owes ? Colors.error : Colors.success}
              />
              <Text style={[styles.chipValue, { color: owes ? Colors.error : Colors.success }]}>
                {formatCDF(data.totalCashCollected)}
              </Text>
              <Text style={styles.chipLabel}>Cash collecté</Text>
            </View>
          </View>

          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Ionicons name="cash-outline" size={18} color={Colors.accent} />
              <Text style={[styles.chipValue, { color: Colors.accent }]}>{formatCDF(data.totalTips ?? 0)}</Text>
              <Text style={styles.chipLabel}>Pourboires</Text>
            </View>
            <View style={styles.chip}>
              <Ionicons name="wallet-outline" size={18} color={Colors.success} />
              <Text style={[styles.chipValue, { color: Colors.success }]}>{formatCDF(data.netPayable ?? 0)}</Text>
              <Text style={styles.chipLabel}>À recevoir</Text>
            </View>
          </View>

          {/* Cash Settlement Status */}
          {data.totalCashCollected > 0 && (
            <View style={[
              styles.balanceBanner,
              owes
                ? { backgroundColor: Colors.error + "14", borderColor: Colors.error + "44" }
                : { backgroundColor: Colors.success + "14", borderColor: Colors.success + "44" },
            ]}>
              <Ionicons
                name={owes ? "alert-circle-outline" : "shield-checkmark-outline"}
                size={20}
                color={owes ? Colors.error : Colors.success}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.balanceTitle, { color: owes ? Colors.error : Colors.success }]}>
                  {owes ? `Remettez ${formatCDF(data.totalOwedToCompany)}` : "Vous êtes à jour ✓"}
                </Text>
                <Text style={styles.balanceSubtitle}>
                  {owes
                    ? `Cash collecté (${formatCDF(data.totalCashCollected)}) − vos gains (${formatCDF(data.totalEarnings)})`
                    : "Tout le cash a été remis à l'entreprise."
                  }
                </Text>
              </View>
            </View>
          )}

          {/* Deliveries List */}
          {data.deliveries?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Livraisons ({data.deliveries.length})
              </Text>
              {data.deliveries.map((d: any, i: number) => (
                <View key={d.id} style={styles.deliveryCard}>
                  <View style={styles.deliveryTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deliveryRestaurant}>{d.storeName}</Text>
                      <Text style={styles.deliveryAddress} numberOfLines={1}>{d.deliveryAddress}</Text>
                      <Text style={styles.deliveryDate}>{formatDateShort(d.deliveredAt)}</Text>
                    </View>

                    {/* Commission pill — large and prominent */}
                    <View style={styles.commissionPill}>
                      <Text style={styles.commissionPlus}>+</Text>
                      <Text style={styles.commissionAmount}>{formatCDF(d.deliveryFee)}</Text>
                    </View>
                  </View>

                  {d.paymentMethod === "cash" && (
                    <View style={styles.cashRow}>
                      <View style={styles.methodBadge}>
                        <Ionicons name="cash-outline" size={11} color={Colors.accent} />
                        <Text style={styles.methodText}>Espèces</Text>
                      </View>
                      <Text style={styles.cashCollected}>
                        {formatCDF(d.total)} collecté
                      </Text>
                    </View>
                  )}
                  {d.paymentMethod !== "cash" && (
                    <View style={styles.cashRow}>
                      <View style={[styles.methodBadge, { borderColor: Colors.success + "55" }]}>
                        <Ionicons name="phone-portrait-outline" size={11} color={Colors.success} />
                        <Text style={[styles.methodText, { color: Colors.success }]}>Mobile Money</Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}

          {data.deliveries?.length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons name="bicycle-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {period === "today" ? "Pas encore de livraison aujourd'hui" : "Aucune livraison sur cette période"}
              </Text>
              <Text style={styles.emptySubtitle}>
                Acceptez une commande pour commencer à gagner !
              </Text>
            </View>
          )}

          {/* Settlement History Toggle */}
          <TouchableOpacity
            style={styles.settlementsToggle}
            onPress={() => setShowSettlements(!showSettlements)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showSettlements ? "chevron-up-outline" : "chevron-down-outline"}
              size={15}
              color={Colors.textMuted}
            />
            <Text style={styles.settlementsToggleText}>Historique des règlements</Text>
          </TouchableOpacity>

          {showSettlements && (
            <View style={styles.settlementsBox}>
              {settlementsQuery.isLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} />
              ) : !settlementsQuery.data?.length ? (
                <Text style={styles.emptySmall}>Aucun règlement enregistré.</Text>
              ) : settlementsQuery.data.map((s: any) => (
                <View key={s.id} style={styles.settlementCard}>
                  <View style={styles.settlementRow}>
                    <View style={styles.settlementLeft}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={styles.settlementAmount}>{formatCDF(s.cashAmount)}</Text>
                    </View>
                    <Text style={styles.settlementDate}>{formatDateShort(s.createdAt)}</Text>
                  </View>
                  {s.note && <Text style={styles.settlementNote}>{s.note}</Text>}
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyBox}>
          <Ionicons name="warning-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Impossible de charger les gains.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 48 },

  // Period
  periodRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  periodBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center",
  },
  periodBtnActive: { backgroundColor: Colors.primary },
  periodBtnText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.textMuted },
  periodBtnTextActive: { color: "#fff", fontFamily: "Inter_700Bold" },

  // Loading
  loadingBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  loadingText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textMuted },

  // Hero
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.primary + "44",
    overflow: "hidden",
    position: "relative",
  },
  heroGlow: {
    position: "absolute",
    top: -40,
    width: 200,
    height: 120,
    borderRadius: 100,
    backgroundColor: Colors.primary + "18",
  },
  heroLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 40,
    color: Colors.primary,
    letterSpacing: -1,
  },
  heroDeliveryRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6,
  },
  heroDeliveryCount: {
    fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textMuted,
  },
  heroDivider: {
    width: 40, height: 1, backgroundColor: Colors.border, marginVertical: 12,
  },
  heroMotivation: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
  },

  // Chips
  chipsRow: { flexDirection: "row", gap: 10 },
  chip: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  chipLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
  },

  // Balance Banner
  balanceBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  balanceTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    marginBottom: 2,
  },
  balanceSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
  },

  // Section title
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textPrimary,
    marginTop: 4,
  },

  // Delivery Cards
  deliveryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deliveryTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  deliveryRestaurant: {
    fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.textPrimary, marginBottom: 2,
  },
  deliveryAddress: {
    fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary, marginBottom: 2,
  },
  deliveryDate: {
    fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.textMuted,
  },
  commissionPill: {
    backgroundColor: Colors.primary + "1A",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.primary + "44",
    minWidth: 72,
  },
  commissionPlus: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.primary,
    marginBottom: -2,
  },
  commissionAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.primary,
    textAlign: "center",
  },
  cashRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  methodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accent + "55",
    backgroundColor: Colors.surfaceAlt,
  },
  methodText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: Colors.accent,
  },
  cashCollected: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Empty
  emptyBox: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
  },
  emptySmall: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    paddingVertical: 12,
  },

  // Settlements
  settlementsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
  },
  settlementsToggleText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textMuted,
  },
  settlementsBox: { gap: 8 },
  settlementCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.success + "33",
  },
  settlementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settlementLeft: {
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  settlementAmount: {
    fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.success,
  },
  settlementDate: {
    fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textMuted,
  },
  settlementNote: {
    fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary,
  },
});
