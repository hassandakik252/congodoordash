import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  ActivityIndicator, Animated, TextInput, Alert, Modal,
} from "react-native";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { orderApi } from "@/services/api";
import { formatCurrency, formatDate, getOrderStatusColor } from "@/utils/format";
import LivePulse from "@/components/LivePulse";
import {
  scheduleLocalNotification,
  NotificationEvent,
} from "@/services/pushNotifications";

const STATUS_STEPS = [
  "pending", "confirmed", "preparing", "ready_for_pickup", "picked_up", "delivered",
];

const STATUS_ICONS: Record<string, string> = {
  pending: "time-outline",
  confirmed: "checkmark-circle-outline",
  preparing: "flame-outline",
  ready_for_pickup: "bag-check-outline",
  picked_up: "bicycle-outline",
  delivered: "home-outline",
};

function StepLine({ done }: { done: boolean }) {
  const width = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: done ? 1 : 0, duration: 500, useNativeDriver: false }).start();
  }, [done]);
  return (
    <View style={lineStyles.wrap}>
      <View style={lineStyles.base} />
      <Animated.View style={[lineStyles.fill, { flex: width }]} />
    </View>
  );
}

const lineStyles = StyleSheet.create({
  wrap: { flex: 1, height: 3, backgroundColor: Colors.surfaceAlt, borderRadius: 2, overflow: "hidden" },
  base: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.surfaceAlt },
  fill: { height: 3, backgroundColor: Colors.success },
});

function InfoRow({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={17} color={Colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      </View>
    </View>
  );
}

/** Maps payment status to a display color */
function usePaymentStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "#F59E0B",
    submitted: "#3B82F6",
    confirmed: "#34C759",
    failed: "#FF3B30",
    paid: "#34C759",
  };
  return map[status] ?? "#9CA3AF";
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { t, language } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();

  const orderId = id ? Number(id) : NaN;
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => orderApi.get(orderId),
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
    enabled: !isNaN(orderId),
  });

  // ── Push notification on status change ────────────────────────────────────
  // Fires a local OS notification when the polled status transitions so
  // customers/drivers are alerted even if the app is backgrounded.
  const prevOrderStatus = useRef<string | null>(null);
  useEffect(() => {
    if (!order) return;
    const prev = prevOrderStatus.current;
    const curr = order.status as string;

    if (prev !== null && prev !== curr) {
      if (curr === "picked_up") {
        scheduleLocalNotification(
          t("pushDriverAccepted"),
          t("pushDriverAcceptedDesc"),
          { event: NotificationEvent.DRIVER_ACCEPTED, orderId: order.id },
        );
      } else if (curr === "delivered") {
        scheduleLocalNotification(
          t("pushDelivered"),
          t("pushDeliveredDesc"),
          { event: NotificationEvent.DELIVERED, orderId: order.id },
        );
      } else if (curr !== "cancelled") {
        scheduleLocalNotification(
          t("pushStatusChanged"),
          t("pushStatusChangedDesc"),
          { event: NotificationEvent.STATUS_CHANGED, orderId: order.id, status: curr },
        );
      }
    }
    prevOrderStatus.current = curr;
  }, [order?.status]);

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t("pending"), confirmed: t("confirmed"), preparing: t("preparing"),
      ready_for_pickup: t("readyForPickup"), picked_up: t("pickedUp"),
      delivered: t("delivered"), cancelled: t("cancelled"),
    };
    return map[status] || status;
  };

  const stepDesc: Record<string, { fr: string; en: string }> = {
    pending: { fr: "Commande reçue, en attente de confirmation", en: "Order received, awaiting confirmation" },
    confirmed: { fr: "Confirmée par le restaurant", en: "Confirmed by restaurant" },
    preparing: { fr: "En cours de préparation", en: "Being prepared" },
    ready_for_pickup: { fr: "Prêt — en attente d'un livreur", en: "Ready — waiting for a driver" },
    picked_up: { fr: "En route vers vous", en: "On the way to you" },
    delivered: { fr: "Livré ! Bon appétit 🎉", en: "Delivered! Enjoy your meal 🎉" },
  };

  const currentStep = order ? STATUS_STEPS.indexOf(order.status) : -1;
  const isActive = order && !["delivered", "cancelled"].includes(order.status);

  // Show customer phone only to restaurant and driver
  const canSeePhone = user?.role === "restaurant_owner" || user?.role === "driver";

  // Payment status colour
  const paymentStatusColor = usePaymentStatusColor(order?.paymentStatus ?? "pending");

  // ── Submit Reference form (mobile money customers only) ───────────────────
  const [refInput, setRefInput] = useState("");
  const [refPhoneInput, setRefPhoneInput] = useState("");
  const [refSuccess, setRefSuccess] = useState(false);

  const submitRefMutation = useMutation({
    mutationFn: ({ reference, phone }: { reference: string; phone?: string }) =>
      orderApi.submitPaymentReference(orderId, { reference, phone }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      setRefSuccess(true);
      setRefInput("");
    },
    onError: (err: any) => {
      Alert.alert(t("error"), err.message || t("error"));
    },
  });

  /** Returns the translated label for a payment status value */
  const getPaymentStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      pending: t("paymentPendingLabel"),
      submitted: t("paymentSubmitted"),
      confirmed: t("paymentConfirmed"),
      failed: t("paymentFailed"),
      paid: t("paymentPaid"),
    };
    return map[status] ?? status;
  };

  // ── Cancel order (customer only, while order is still active) ─────────────
  const CANCELLABLE_STATUSES = ["pending", "confirmed", "preparing", "ready_for_pickup"];

  const cancelMutation = useMutation({
    mutationFn: () => orderApi.updateStatus(orderId, "cancelled"),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: any) => {
      Alert.alert(t("error"), err.message || t("error"));
    },
  });

  const handleCancelOrder = () => {
    Alert.alert(
      language === "fr" ? "Annuler la commande ?" : "Cancel Order?",
      language === "fr"
        ? "Cette action est irréversible. Voulez-vous vraiment annuler cette commande ?"
        : "This action cannot be undone. Are you sure you want to cancel this order?",
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: language === "fr" ? "Oui, annuler" : "Yes, Cancel",
          style: "destructive",
          onPress: () => cancelMutation.mutate(),
        },
      ]
    );
  };

  // ── Substitution approval (customer) ─────────────────────────────────────
  const approveSubMutation = useMutation({
    mutationFn: (vars: { menuItemId: number; approved: boolean }) =>
      orderApi.approveSubstitutions(orderId, [{ menuItemId: vars.menuItemId, approved: vars.approved }]),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: any) => Alert.alert(t("error"), err.message || t("error")),
  });

  // Charged amount for a line, mirroring the server's picking logic.
  const lineTotalDisplay = (item: any): number => {
    if (item.lineStatus === "out_of_stock") return 0;
    if (item.lineStatus === "substituted") return item.approved === false ? 0 : (item.finalPrice ?? item.price * item.quantity);
    if (item.lineStatus === "weight_adjusted") return item.finalPrice ?? item.price * item.quantity;
    return item.price * item.quantity;
  };

  const pendingSubs = (order?.items ?? []).filter(
    (i: any) => i.lineStatus === "substituted" && (i.approved === null || i.approved === undefined),
  );

  // ── Shopper picking (store owner or assigned driver) ─────────────────────
  const isShopper =
    !!order &&
    order.status !== "delivered" &&
    order.status !== "cancelled" &&
    (user?.role === "restaurant_owner" || (user?.role === "driver" && order?.driverId === user?.id));

  const pickMutation = useMutation({
    mutationFn: (items: Array<{ menuItemId: number; lineStatus: string; substituteName?: string; finalPrice?: number }>) =>
      orderApi.pick(orderId, items as any),
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: any) => Alert.alert(t("error"), err.message || t("error")),
  });

  // Modal for substitute / weight price entry
  const [pickModal, setPickModal] = useState<{ menuItemId: number; name: string; mode: "substitute" | "weight" } | null>(null);
  const [subName, setSubName] = useState("");
  const [subPrice, setSubPrice] = useState("");

  const openPickModal = (item: any, mode: "substitute" | "weight") => {
    setPickModal({ menuItemId: item.menuItemId, name: item.name, mode });
    setSubName("");
    setSubPrice(mode === "weight" ? String(item.price ?? "") : "");
  };
  const submitPickModal = () => {
    if (!pickModal) return;
    const price = parseFloat(subPrice);
    if (isNaN(price) || price < 0) { Alert.alert(t("error"), language === "fr" ? "Prix invalide" : "Invalid price"); return; }
    if (pickModal.mode === "substitute" && !subName.trim()) { Alert.alert(t("error"), language === "fr" ? "Nom du remplacement requis" : "Substitute name required"); return; }
    pickMutation.mutate([{
      menuItemId: pickModal.menuItemId,
      lineStatus: pickModal.mode === "substitute" ? "substituted" : "weight_adjusted",
      substituteName: pickModal.mode === "substitute" ? subName.trim() : undefined,
      finalPrice: price,
    }]);
    setPickModal(null);
  };

  const isCustomerOwner = user?.role === "customer" && order?.customerId === user?.id;
  const canSubmitRef =
    isCustomerOwner &&
    order?.paymentMethod === "mobile_money" &&
    ["pending", "submitted"].includes(order?.paymentStatus ?? "");

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t("orderDetails")}</Text>
        {isActive ? <LivePulse label="Live" color={Colors.primary} /> : <View style={{ width: 60 }} />}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : !order ? (
        <View style={styles.center}><Text style={styles.errorText}>{t("error")}</Text></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* ── STATUS CARD ── */}
          <View style={[styles.section, styles.statusCard]}>
            <View style={styles.statusHeader}>
              <View>
                <Text style={styles.orderNum}>#{order.id}</Text>
                <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(order.status) + "22" }]}>
                <Text style={[styles.statusBadgeText, { color: getOrderStatusColor(order.status) }]}>
                  {getStatusLabel(order.status)}
                </Text>
              </View>
            </View>

            {order.status !== "cancelled" && (
              <View style={styles.tracker}>
                {STATUS_STEPS.map((step, idx) => {
                  const done = idx <= currentStep;
                  const active = idx === currentStep;
                  return (
                    <React.Fragment key={step}>
                      <View style={styles.stepCol}>
                        <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                          <Ionicons name={STATUS_ICONS[step] as any} size={11} color={done ? "#fff" : Colors.textMuted} />
                        </View>
                        <Text style={[styles.stepLabel, done && styles.stepLabelDone]} numberOfLines={2}>
                          {getStatusLabel(step)}
                        </Text>
                      </View>
                      {idx < STATUS_STEPS.length - 1 && (
                        <View style={styles.lineWrap}><StepLine done={idx < currentStep} /></View>
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            )}

            {order.status !== "cancelled" && (
              <View style={styles.descBox}>
                <Ionicons name="information-circle-outline" size={14} color={Colors.primary} />
                <Text style={styles.descText}>
                  {language === "fr" ? stepDesc[order.status]?.fr : stepDesc[order.status]?.en}
                </Text>
              </View>
            )}
          </View>

          {/* ── RESTAURANT ── */}
          <View style={styles.section}>
            <View style={styles.restaurantRow}>
              <View style={styles.restaurantIcon}>
                <Ionicons name="restaurant" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.restaurantName}>{order.restaurantName}</Text>
            </View>
          </View>

          {/* ── SUBSTITUTIONS TO APPROVE (customer) ── */}
          {isCustomerOwner && pendingSubs.length > 0 && (
            <View style={[styles.section, styles.subCard]}>
              <Text style={styles.sectionTitle}>
                {language === "fr" ? "Remplacements à approuver" : "Substitutions to approve"}
              </Text>
              {pendingSubs.map((item: any, idx: number) => (
                <View key={idx} style={styles.subItem}>
                  <Text style={styles.subOriginal}>
                    {item.name}
                  </Text>
                  <View style={styles.subArrowRow}>
                    <Ionicons name="arrow-forward" size={13} color={Colors.accent} />
                    <Text style={styles.subReplacement}>{item.substituteName}</Text>
                    <Text style={styles.subPrice}>{formatCurrency(item.finalPrice ?? item.price * item.quantity)}</Text>
                  </View>
                  <View style={styles.subActions}>
                    <Pressable
                      style={({ pressed }) => [styles.subBtn, styles.subReject, pressed && { opacity: 0.8 }]}
                      disabled={approveSubMutation.isPending}
                      onPress={() => approveSubMutation.mutate({ menuItemId: item.menuItemId, approved: false })}
                    >
                      <Ionicons name="close" size={15} color={Colors.error} />
                      <Text style={[styles.subBtnText, { color: Colors.error }]}>{language === "fr" ? "Refuser" : "Reject"}</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.subBtn, styles.subApprove, pressed && { opacity: 0.8 }]}
                      disabled={approveSubMutation.isPending}
                      onPress={() => approveSubMutation.mutate({ menuItemId: item.menuItemId, approved: true })}
                    >
                      <Ionicons name="checkmark" size={15} color="#fff" />
                      <Text style={[styles.subBtnText, { color: "#fff" }]}>{language === "fr" ? "Accepter" : "Approve"}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── ITEMS ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("items")}</Text>
            {order.items?.map((item: any, idx: number) => {
              const oos = item.lineStatus === "out_of_stock" || (item.lineStatus === "substituted" && item.approved === false);
              const substituted = item.lineStatus === "substituted" && item.approved !== false;
              const weight = item.lineStatus === "weight_adjusted";
              return (
                <View key={idx} style={[styles.itemRow, idx === order.items.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={styles.itemQty}>{item.quantity}×</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, oos && styles.itemNameOos]}>{item.name}</Text>
                    {substituted && item.substituteName && (
                      <Text style={styles.itemSubNote}>{language === "fr" ? "Remplacé par " : "Replaced with "}{item.substituteName}</Text>
                    )}
                    {oos && <Text style={styles.itemOosNote}>{language === "fr" ? "Indisponible" : "Unavailable"}</Text>}
                    {weight && <Text style={styles.itemWeightNote}>{language === "fr" ? "Prix ajusté au poids" : "Weight-adjusted price"}</Text>}
                  </View>
                  <Text style={[styles.itemPrice, oos && styles.itemNameOos]}>{formatCurrency(lineTotalDisplay(item))}</Text>
                </View>
              );
            })}
          </View>

          {/* ── SHOPPER PICKING (store owner / driver) ── */}
          {isShopper && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{language === "fr" ? "Préparation / Picking" : "Picking"}</Text>
              {order.items?.map((item: any, idx: number) => (
                <View key={idx} style={styles.pickRow}>
                  <View style={styles.pickRowTop}>
                    <Text style={styles.pickName}>{item.quantity}× {item.name}</Text>
                    {item.lineStatus && (
                      <Text style={styles.pickStatus}>
                        {item.lineStatus === "found" ? (language === "fr" ? "Trouvé" : "Found")
                          : item.lineStatus === "out_of_stock" ? (language === "fr" ? "Rupture" : "Out")
                          : item.lineStatus === "substituted" ? (language === "fr" ? "Remplacé" : "Substituted")
                          : item.lineStatus === "weight_adjusted" ? (language === "fr" ? "Pesé" : "Weighed")
                          : ""}
                      </Text>
                    )}
                  </View>
                  <View style={styles.pickBtns}>
                    <Pressable style={[styles.pickBtn, item.lineStatus === "found" && styles.pickBtnActive]} disabled={pickMutation.isPending}
                      onPress={() => pickMutation.mutate([{ menuItemId: item.menuItemId, lineStatus: "found" }])}>
                      <Text style={styles.pickBtnText}>{language === "fr" ? "Trouvé" : "Found"}</Text>
                    </Pressable>
                    <Pressable style={[styles.pickBtn, item.lineStatus === "out_of_stock" && styles.pickBtnActiveErr]} disabled={pickMutation.isPending}
                      onPress={() => pickMutation.mutate([{ menuItemId: item.menuItemId, lineStatus: "out_of_stock" }])}>
                      <Text style={styles.pickBtnText}>{language === "fr" ? "Rupture" : "Out"}</Text>
                    </Pressable>
                    <Pressable style={[styles.pickBtn, item.lineStatus === "substituted" && styles.pickBtnActive]} disabled={pickMutation.isPending}
                      onPress={() => openPickModal(item, "substitute")}>
                      <Text style={styles.pickBtnText}>{language === "fr" ? "Remplacer" : "Sub"}</Text>
                    </Pressable>
                    <Pressable style={[styles.pickBtn, item.lineStatus === "weight_adjusted" && styles.pickBtnActive]} disabled={pickMutation.isPending}
                      onPress={() => openPickModal(item, "weight")}>
                      <Text style={styles.pickBtnText}>{language === "fr" ? "Peser" : "Weigh"}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── PRICE BREAKDOWN ── */}
          <View style={styles.section}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("subtotal")}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(order.subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("deliveryFee")}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(order.deliveryFee)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>{t("total")}</Text>
              <Text style={styles.totalValue}>{formatCurrency(order.total)}</Text>
            </View>
          </View>

          {/* ── DELIVERY & PAYMENT INFO ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{language === "fr" ? "Livraison & Paiement" : "Delivery & Payment"}</Text>

            <InfoRow icon="location-outline" label={t("deliveryAddress")} value={order.deliveryAddress} />

            <InfoRow
              icon={order.paymentMethod === "cash" ? "cash-outline" : "phone-portrait-outline"}
              label={t("paymentMethod")}
              value={
                order.paymentMethod === "cash"
                  ? t("cashOnDelivery")
                  : `${t("mobileMoney")}${order.paymentProvider ? ` · ${order.paymentProvider}` : ""}`
              }
            />

            <InfoRow
              icon="shield-checkmark-outline"
              label={t("paymentStatus")}
              value={getPaymentStatusLabel(order.paymentStatus)}
              valueColor={paymentStatusColor}
            />

            {order.paymentReference && (
              <InfoRow icon="receipt-outline" label={t("paymentRef")} value={order.paymentReference} />
            )}

            {order.paymentPhone && order.paymentMethod === "mobile_money" && (
              <InfoRow icon="phone-portrait-outline" label={t("paymentPhone")} value={order.paymentPhone} />
            )}

            {order.paymentRequestedAt && (
              <InfoRow icon="time-outline" label={t("paymentRequestedAt")} value={formatDate(order.paymentRequestedAt)} />
            )}

            {order.paymentConfirmedAt && (
              <InfoRow icon="checkmark-circle-outline" label={t("paymentConfirmedAt")} value={formatDate(order.paymentConfirmedAt)} />
            )}

            {/* Customer phone — visible to restaurant and driver */}
            {canSeePhone && order.customerPhone && (
              <InfoRow icon="call-outline" label={t("customerPhone")} value={order.customerPhone} />
            )}

            {order.notes && (
              <InfoRow icon="chatbubble-outline" label={t("orderNotes")} value={order.notes} />
            )}

            {order.driverInstructions && (
              <InfoRow icon="navigate-outline" label={t("driverNote")} value={order.driverInstructions} />
            )}
          </View>

          {/* ── SUBMIT PAYMENT REFERENCE (mobile money customers only) ── */}
          {canSubmitRef && (
            <View style={[styles.section, styles.refCard]}>
              <View style={styles.refCardHeader}>
                <Ionicons name="phone-portrait-outline" size={20} color={Colors.accent} />
                <Text style={styles.refCardTitle}>
                  {order.paymentStatus === "submitted" ? t("submitRefUpdate") : t("submitRefTitle")}
                </Text>
              </View>

              {refSuccess ? (
                <View style={styles.refSuccessRow}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                  <Text style={styles.refSuccessText}>{t("submitRefSuccess")}</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.refCardDesc}>{t("submitRefDesc")}</Text>

                  <View style={styles.refInput}>
                    <Ionicons name="receipt-outline" size={16} color={Colors.textMuted} />
                    <TextInput
                      style={styles.refInputField}
                      value={refInput}
                      onChangeText={setRefInput}
                      placeholder={t("transactionRef")}
                      placeholderTextColor={Colors.placeholder}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={[styles.refInput, { marginTop: 8 }]}>
                    <Ionicons name="phone-portrait-outline" size={16} color={Colors.textMuted} />
                    <TextInput
                      style={styles.refInputField}
                      value={refPhoneInput}
                      onChangeText={setRefPhoneInput}
                      placeholder={order.paymentPhone || t("mobileMoneyPhone")}
                      placeholderTextColor={Colors.placeholder}
                      keyboardType="phone-pad"
                      returnKeyType="done"
                    />
                  </View>

                  <Pressable
                    style={[styles.refBtn, (!refInput.trim() || submitRefMutation.isPending) && styles.refBtnDisabled]}
                    onPress={() => {
                      if (!refInput.trim()) return;
                      submitRefMutation.mutate({
                        reference: refInput.trim(),
                        phone: refPhoneInput.trim() || undefined,
                      });
                    }}
                    disabled={!refInput.trim() || submitRefMutation.isPending}
                  >
                    {submitRefMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.refBtnText}>{t("submitRefBtn")}</Text>
                    )}
                  </Pressable>
                </>
              )}

              {order.paymentStatus === "submitted" && !refSuccess && (
                <View style={styles.awaitingRow}>
                  <Ionicons name="time-outline" size={14} color={Colors.warning} />
                  <Text style={styles.awaitingText}>{t("awaitingReview")}</Text>
                </View>
              )}
            </View>
          )}

          {/* ── CANCEL ORDER (customer, active orders only) ── */}
          {isCustomerOwner && order && CANCELLABLE_STATUSES.includes(order.status) && (
            <Pressable
              style={[styles.cancelOrderBtn, cancelMutation.isPending && { opacity: 0.5 }]}
              onPress={handleCancelOrder}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.error} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color={Colors.error} />
                  <Text style={styles.cancelOrderText}>
                    {language === "fr" ? "Annuler la commande" : "Cancel Order"}
                  </Text>
                </>
              )}
            </Pressable>
          )}

          <View style={{ height: insets.bottom + (Platform.OS === "web" ? 34 : 24) }} />
        </ScrollView>
      )}

      {/* ── Substitute / Weigh price-entry modal ── */}
      <Modal visible={!!pickModal} transparent animationType="fade" onRequestClose={() => setPickModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pickModal?.mode === "substitute"
                ? (language === "fr" ? "Remplacer l'article" : "Substitute item")
                : (language === "fr" ? "Prix au poids" : "Weight price")}
            </Text>
            <Text style={styles.modalSub}>{pickModal?.name}</Text>
            {pickModal?.mode === "substitute" && (
              <TextInput
                style={styles.modalInput}
                value={subName}
                onChangeText={setSubName}
                placeholder={language === "fr" ? "Nom du remplacement" : "Substitute name"}
                placeholderTextColor={Colors.placeholder}
              />
            )}
            <TextInput
              style={styles.modalInput}
              value={subPrice}
              onChangeText={setSubPrice}
              keyboardType="numeric"
              placeholder={language === "fr" ? "Prix final (CDF)" : "Final price (CDF)"}
              placeholderTextColor={Colors.placeholder}
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalCancel]} onPress={() => setPickModal(null)}>
                <Text style={styles.modalBtnText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalConfirm]} onPress={submitPickModal}>
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>{t("confirm")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.textSecondary },

  section: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  statusCard: { borderColor: Colors.primary + "33" },
  statusHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20,
  },
  orderNum: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  orderDate: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  tracker: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  stepCol: { alignItems: "center", width: 44 },
  lineWrap: { flex: 1, marginTop: 13 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surfaceAlt, borderWidth: 2, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  stepDotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  stepDotActive: { borderColor: Colors.primary, borderWidth: 2.5 },
  stepLabel: {
    fontSize: 9, fontFamily: "Inter_500Medium", color: Colors.textMuted,
    textAlign: "center", marginTop: 4, maxWidth: 44,
  },
  stepLabelDone: { color: Colors.textPrimary },
  descBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primary + "11", borderRadius: 10, padding: 10,
  },
  descText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary },

  restaurantRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  restaurantIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: "rgba(255,69,0,0.12)", alignItems: "center", justifyContent: "center",
  },
  restaurantName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },

  sectionTitle: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textMuted,
    marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5,
  },

  itemRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  itemQty: { width: 28, fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  itemName: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textPrimary },
  itemNameOos: { textDecorationLine: "line-through", color: Colors.textMuted },
  itemSubNote: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.accent, marginTop: 2 },
  itemOosNote: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.error, marginTop: 2 },
  itemWeightNote: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  itemPrice: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  subCard: { borderWidth: 1, borderColor: Colors.accent + "55" },
  subItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  subOriginal: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  subArrowRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  subReplacement: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  subPrice: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.primary },
  subActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  subBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 12 },
  subReject: { backgroundColor: Colors.error + "18", borderWidth: 1, borderColor: Colors.error + "55" },
  subApprove: { backgroundColor: Colors.primary },
  subBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pickRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  pickName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textPrimary },
  pickStatus: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.accent },
  pickBtns: { flexDirection: "row", gap: 6 },
  pickBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  pickBtnActive: { backgroundColor: Colors.primary + "33", borderColor: Colors.primary },
  pickBtnActiveErr: { backgroundColor: Colors.error + "22", borderColor: Colors.error },
  pickBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", paddingHorizontal: 28 },
  modalCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 4, marginBottom: 14 },
  modalInput: { backgroundColor: Colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, height: 48, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textPrimary, marginBottom: 10 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  modalCancel: { backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  modalConfirm: { backgroundColor: Colors.primary },
  modalBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },

  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  summaryLabel: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  summaryValue: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textPrimary },
  totalRow: { paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, marginBottom: 0 },
  totalLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  totalValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.primary },

  infoRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12,
  },
  infoLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted, marginBottom: 2 },
  infoValue: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textPrimary },

  // ── Submit Reference card ──────────────────────────────────────────────────
  refCard: { borderColor: Colors.accent + "44" },
  refCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  refCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, flex: 1 },
  refCardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginBottom: 12, lineHeight: 19 },
  refInput: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 14, height: 46,
    borderWidth: 1, borderColor: Colors.border,
  },
  refInputField: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textPrimary },
  refBtn: {
    backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 13,
    alignItems: "center", marginTop: 12,
  },
  refBtnDisabled: { opacity: 0.45 },
  refBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  refSuccessRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  refSuccessText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.success },
  awaitingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  awaitingText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.warning },

  cancelOrderBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.error + "12",
    borderWidth: 1, borderColor: Colors.error + "44",
  },
  cancelOrderText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.error },
});
