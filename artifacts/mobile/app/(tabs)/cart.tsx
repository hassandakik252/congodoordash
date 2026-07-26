import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  Platform, Alert, ScrollView, Modal, ActivityIndicator,
  KeyboardAvoidingView, Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { orderApi, userApi, promoApi, type PromoValidateResult } from "@/services/api";
import { formatCurrency } from "@/utils/format";

type PaymentMethod = "cash" | "mobile_money";

interface SavedAddress { label: string; address: string }

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.fieldError}>{message}</Text>;
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLang();
  const { items, storeId, storeName, deliveryFee, subtotal, total, updateQuantity, clearCart } = useCart();
  const { user, updateUser } = useAuth();
  const qc = useQueryClient();

  // Form state
  const [selectedAddress, setSelectedAddress] = useState<string>(user?.address || "");
  const [newAddress, setNewAddress] = useState("");
  const [newAddressLabel, setNewAddressLabel] = useState("");
  const [saveNewAddress, setSaveNewAddress] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addingNew, setAddingNew] = useState(false);

  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [mobileProvider, setMobileProvider] = useState<"M-Pesa" | "Airtel Money" | "">("");
  const [mobilePhone, setMobilePhone] = useState(user?.phone || "");
  const [mobileRef, setMobileRef] = useState("");

  const [note, setNote] = useState("");
  const [driverInstructions, setDriverInstructions] = useState("");

  // Promo code
  const [promoInput, setPromoInput] = useState("");
  const [promoResult, setPromoResult] = useState<PromoValidateResult | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  const discountAmount = promoResult?.discountAmount ?? 0;
  const [tip, setTip] = useState(0);
  const [scheduleHours, setScheduleHours] = useState(0); // 0 = ASAP
  const finalTotal = Math.max(0, total - discountAmount + tip);

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoError("");
    setPromoLoading(true);
    try {
      const result = await promoApi.validate(code, subtotal);
      setPromoResult(result);
      setPromoInput(result.code);
    } catch (e: any) {
      setPromoResult(null);
      setPromoError(e.message || "Code invalide.");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoResult(null);
    setPromoInput("");
    setPromoError("");
  };

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Prevent duplicate submission
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  // Success banner
  const [orderSuccess, setOrderSuccess] = useState(false);
  const successOpacity = useRef(new Animated.Value(0)).current;

  const savedAddresses: SavedAddress[] = (user as any)?.savedAddresses || [];

  // When user selects a saved address, populate the address field
  const handleSelectSaved = (addr: SavedAddress) => {
    setSelectedAddress(addr.address);
    setAddingNew(false);
    setShowAddressModal(false);
  };

  const handleSelectNew = () => {
    setAddingNew(true);
    setShowAddressModal(false);
    setSelectedAddress("");
  };

  const deliveryAddress = addingNew ? newAddress.trim() : selectedAddress;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!deliveryAddress) e.address = t("addressRequired");
    if (payment === "mobile_money") {
      if (!mobileProvider) e.provider = t("selectProvider");
      const digits = mobilePhone.replace(/\D/g, "");
      if (digits.length < 9) e.phone = t("invalidPhone");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleOrder = async () => {
    if (submitting.current) return;
    if (items.length === 0 || !storeId) return;
    if (!validate()) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    submitting.current = true;
    setLoading(true);

    let succeeded = false;
    try {
      // If user wants to save the new address, persist it first
      if (addingNew && saveNewAddress && newAddress.trim()) {
        const label = newAddressLabel.trim() || "Adresse";
        const updated = await userApi.updateProfile({
          savedAddresses: [...savedAddresses, { label, address: newAddress.trim() }],
        });
        // Use the full server response to avoid overwriting any server-side changes
        updateUser(updated);
      }

      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await orderApi.create({
        storeId,
        items: items.map(i => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          modifiers: i.modifiers?.map(m => ({ groupName: m.groupName, label: m.label })),
        })),
        deliveryAddress,
        paymentMethod: payment,
        paymentProvider: payment === "mobile_money" && mobileProvider ? mobileProvider : undefined,
        paymentReference: payment === "mobile_money" && mobileRef.trim() ? mobileRef.trim() : undefined,
        paymentPhone: payment === "mobile_money" && mobilePhone.trim() ? mobilePhone.trim() : undefined,
        notes: note.trim() || undefined,
        driverInstructions: driverInstructions.trim() || undefined,
        promoCode: promoResult?.code || undefined,
        tip: tip > 0 ? tip : undefined,
        scheduledFor: scheduleHours > 0 ? new Date(Date.now() + scheduleHours * 3600_000).toISOString() : undefined,
      });

      succeeded = true;
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Show in-app success banner then navigate — keep button disabled throughout
      setOrderSuccess(true);
      Animated.sequence([
        Animated.timing(successOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(1400),
        Animated.timing(successOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        clearCart();
        router.replace("/(tabs)/orders");
      });
    } catch (e: any) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("orderError"), e.message || t("error"));
    } finally {
      // Only reset on failure — success path keeps button disabled until navigation
      if (!succeeded) {
        setLoading(false);
        submitting.current = false;
      }
    }
  };

  // ── EMPTY CART ──
  if (items.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("yourCart")}</Text>
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons name="cart-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{t("emptyCart")}</Text>
          <Text style={styles.emptyText}>{t("emptyCartDesc")}</Text>
          <Pressable style={styles.browseBtn} onPress={() => router.push("/(tabs)")}>
            <Text style={styles.browseBtnText}>{t("browseRestaurants")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("yourCart")}</Text>
          <Text style={styles.restaurantLabel}>{storeName}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── ITEMS ── */}
          <View style={styles.section}>
            {items.map(item => (
              <View key={item.menuItemId} style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName}>{item.name}</Text>
                  <Text style={styles.cartItemPrice}>{formatCurrency(item.price)}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateQuantity(item.lineId ?? String(item.menuItemId), item.quantity - 1); }}
                  >
                    <Ionicons name="remove" size={18} color={Colors.textPrimary} />
                  </Pressable>
                  <Text style={styles.qty}>{item.quantity}</Text>
                  <Pressable
                    style={[styles.qtyBtn, styles.qtyBtnAdd]}
                    onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateQuantity(item.lineId ?? String(item.menuItemId), item.quantity + 1); }}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          {/* ── DELIVERY ADDRESS ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("deliveryAddress")}</Text>

            {/* Saved address picker button */}
            {savedAddresses.length > 0 && !addingNew && (
              <Pressable style={styles.addrPickerBtn} onPress={() => setShowAddressModal(true)}>
                <Ionicons name="location-outline" size={18} color={Colors.primary} />
                <Text style={styles.addrPickerText} numberOfLines={1}>
                  {selectedAddress || t("savedAddresses")}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </Pressable>
            )}

            {/* New address input */}
            {(addingNew || savedAddresses.length === 0) && (
              <>
                <View style={[styles.inputRow, errors.address ? styles.inputRowError : null]}>
                  <Ionicons name="location-outline" size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    value={newAddress}
                    onChangeText={v => { setNewAddress(v); setErrors(e => ({ ...e, address: "" })); }}
                    placeholder={t("enterAddress")}
                    placeholderTextColor={Colors.placeholder}
                    returnKeyType="done"
                  />
                </View>
                <FieldError message={errors.address} />

                {/* Save option */}
                <Pressable style={styles.checkRow} onPress={() => setSaveNewAddress(!saveNewAddress)}>
                  <View style={[styles.checkbox, saveNewAddress && styles.checkboxActive]}>
                    {saveNewAddress && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text style={styles.checkLabel}>{t("saveAddress")}</Text>
                </Pressable>

                {saveNewAddress && (
                  <View style={[styles.inputRow, { marginTop: 8 }]}>
                    <Ionicons name="bookmark-outline" size={16} color={Colors.textMuted} />
                    <TextInput
                      style={styles.input}
                      value={newAddressLabel}
                      onChangeText={setNewAddressLabel}
                      placeholder={t("addressLabel")}
                      placeholderTextColor={Colors.placeholder}
                      returnKeyType="done"
                    />
                  </View>
                )}
              </>
            )}

            {/* Switch between saved/new */}
            {savedAddresses.length > 0 && (
              <Pressable
                style={styles.switchAddrBtn}
                onPress={() => { setAddingNew(!addingNew); setErrors(e => ({ ...e, address: "" })); }}
              >
                <Ionicons name={addingNew ? "bookmark-outline" : "add-circle-outline"} size={15} color={Colors.primary} />
                <Text style={styles.switchAddrText}>
                  {addingNew ? t("savedAddresses") : t("addNewAddress")}
                </Text>
              </Pressable>
            )}

            {/* Address error when a saved address is selected but nothing is chosen yet */}
            {!addingNew && savedAddresses.length > 0 && errors.address ? (
              <FieldError message={errors.address} />
            ) : null}
          </View>

          {/* ── DRIVER INSTRUCTIONS ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("driverInstructions")}</Text>
            <TextInput
              style={styles.noteInput}
              value={driverInstructions}
              onChangeText={setDriverInstructions}
              placeholder={t("driverInstructionsPlaceholder")}
              placeholderTextColor={Colors.placeholder}
              multiline
              numberOfLines={2}
              returnKeyType="done"
            />
          </View>

          {/* ── PAYMENT METHOD ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("paymentMethod")}</Text>
            <View style={styles.paymentRow}>
              {(["cash", "mobile_money"] as PaymentMethod[]).map(method => (
                <Pressable
                  key={method}
                  style={[styles.paymentBtn, payment === method && styles.paymentBtnActive]}
                  onPress={() => setPayment(method)}
                >
                  <Ionicons
                    name={method === "cash" ? "cash-outline" : "phone-portrait-outline"}
                    size={22}
                    color={payment === method ? "#fff" : Colors.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.paymentLabel, payment === method && styles.paymentLabelActive]}>
                      {method === "cash" ? t("cashOnDelivery") : t("mobileMoney")}
                    </Text>
                    {method === "mobile_money" && payment === method && (
                      <Text style={styles.paymentDesc}>{t("mobileMoneyDesc")}</Text>
                    )}
                  </View>
                  {payment === method && (
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  )}
                </Pressable>
              ))}
            </View>

            {/* Mobile money details */}
            {payment === "mobile_money" && (
              <View style={styles.mobileMoneyForm}>
                {/* Provider picker */}
                <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>{t("selectProvider")}</Text>
                <View style={styles.providerRow}>
                  {(["M-Pesa", "Airtel Money"] as const).map(p => (
                    <Pressable
                      key={p}
                      style={[styles.providerBtn, mobileProvider === p && styles.providerBtnActive]}
                      onPress={() => { setMobileProvider(mobileProvider === p ? "" : p); setErrors(e => ({ ...e, provider: "" })); }}
                    >
                      <Text style={[styles.providerBtnText, mobileProvider === p && styles.providerBtnTextActive]}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
                <FieldError message={errors.provider} />

                <View style={[styles.inputRow, errors.phone ? styles.inputRowError : null, { marginTop: 10 }]}>
                  <Ionicons name="phone-portrait-outline" size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    value={mobilePhone}
                    onChangeText={v => { setMobilePhone(v); setErrors(e => ({ ...e, phone: "" })); }}
                    placeholder={t("mobileMoneyPhone")}
                    placeholderTextColor={Colors.placeholder}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                  />
                </View>
                <FieldError message={errors.phone} />

                <View style={[styles.inputRow, { marginTop: 8 }]}>
                  <Ionicons name="receipt-outline" size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    value={mobileRef}
                    onChangeText={setMobileRef}
                    placeholder={t("mobileMoneyRefOptional")}
                    placeholderTextColor={Colors.placeholder}
                    returnKeyType="done"
                  />
                </View>
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={15} color={Colors.accent} />
                  <Text style={styles.infoBoxText}>{t("mobileMoneyDesc")}</Text>
                </View>
              </View>
            )}
          </View>

          {/* ── RESTAURANT NOTE ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("addNote")}</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder={t("addNote")}
              placeholderTextColor={Colors.placeholder}
              multiline
              numberOfLines={2}
              returnKeyType="done"
            />
          </View>

          {/* ── PROMO CODE ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Code promo</Text>

            {promoResult ? (
              /* Applied promo banner */
              <View style={styles.promoApplied}>
                <Ionicons name="pricetag" size={18} color={Colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.promoAppliedCode}>{promoResult.code}</Text>
                  <Text style={styles.promoAppliedDesc}>
                    {promoResult.type === "fixed"
                      ? `−${formatCurrency(promoResult.discountAmount)}`
                      : `−${promoResult.value}% (−${formatCurrency(promoResult.discountAmount)})`}
                  </Text>
                </View>
                <Pressable onPress={handleRemovePromo} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={Colors.error} />
                </Pressable>
              </View>
            ) : (
              /* Code input row */
              <>
                <View style={styles.promoRow}>
                  <View style={[styles.inputRow, { flex: 1 }, promoError ? styles.inputRowError : null]}>
                    <Ionicons name="pricetag-outline" size={16} color={Colors.textMuted} />
                    <TextInput
                      style={styles.input}
                      value={promoInput}
                      onChangeText={v => { setPromoInput(v.toUpperCase()); setPromoError(""); }}
                      placeholder="EX: BIENVENUE10"
                      placeholderTextColor={Colors.placeholder}
                      autoCapitalize="characters"
                      returnKeyType="done"
                      onSubmitEditing={handleApplyPromo}
                    />
                  </View>
                  <Pressable
                    style={[styles.promoApplyBtn, (!promoInput.trim() || promoLoading) && { opacity: 0.5 }]}
                    onPress={handleApplyPromo}
                    disabled={!promoInput.trim() || promoLoading}
                  >
                    {promoLoading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.promoApplyBtnText}>Appliquer</Text>
                    }
                  </Pressable>
                </View>
                {!!promoError && <Text style={styles.fieldError}>{promoError}</Text>}
              </>
            )}
          </View>

          {/* ── SCHEDULE ── */}
          <View style={styles.section}>
            <Text style={styles.tipTitle}>{language === "fr" ? "Quand ?" : "When?"}</Text>
            <View style={styles.tipRow}>
              {[0, 1, 2, 3].map(h => (
                <Pressable key={h} style={[styles.tipChip, scheduleHours === h && styles.tipChipActive]} onPress={() => setScheduleHours(h)}>
                  <Text style={[styles.tipChipText, scheduleHours === h && styles.tipChipTextActive]}>
                    {h === 0 ? (language === "fr" ? "Maintenant" : "Now") : `+${h}h`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── TIP ── */}
          <View style={styles.section}>
            <Text style={styles.tipTitle}>{language === "fr" ? "Pourboire au livreur" : "Tip your driver"}</Text>
            <View style={styles.tipRow}>
              {[0, 500, 1000, 2000].map(amt => (
                <Pressable key={amt} style={[styles.tipChip, tip === amt && styles.tipChipActive]} onPress={() => setTip(amt)}>
                  <Text style={[styles.tipChipText, tip === amt && styles.tipChipTextActive]}>
                    {amt === 0 ? (language === "fr" ? "Aucun" : "None") : formatCurrency(amt)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── PRICE SUMMARY ── */}
          <View style={[styles.section, styles.summary]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("subtotal")}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("deliveryFee")}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(deliveryFee)}</Text>
            </View>
            {discountAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: Colors.success }]}>
                  Code {promoResult?.code}
                </Text>
                <Text style={[styles.summaryValue, { color: Colors.success }]}>
                  −{formatCurrency(discountAmount)}
                </Text>
              </View>
            )}
            {tip > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{language === "fr" ? "Pourboire" : "Tip"}</Text>
                <Text style={styles.summaryValue}>{formatCurrency(tip)}</Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>{t("total")}</Text>
              <Text style={styles.totalValue}>{formatCurrency(finalTotal)}</Text>
            </View>
          </View>

          <View style={{ height: insets.bottom + (Platform.OS === "web" ? 34 : 110) }} />
        </ScrollView>

        {/* ── PLACE ORDER BUTTON ── */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 16 : 16) }]}>
          <Pressable
            style={({ pressed }) => [
              styles.orderBtn,
              loading && styles.disabledBtn,
              pressed && !loading && { opacity: 0.85 },
            ]}
            onPress={handleOrder}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.orderBtnText}>
                {t("placeOrder")} · {formatCurrency(finalTotal)}
              </Text>
            )}
          </Pressable>
        </View>

        {/* ── SUCCESS BANNER ── */}
        {orderSuccess && (
          <Animated.View style={[styles.successBanner, { opacity: successOpacity }]}>
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.successBannerText}>{t("orderPlaced")} ✓</Text>
          </Animated.View>
        )}

        {/* ── SAVED ADDRESS MODAL ── */}
        <Modal
          visible={showAddressModal}
          transparent
          animationType={Platform.OS === "web" ? "none" : "slide"}
          onRequestClose={() => setShowAddressModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowAddressModal(false)}>
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={styles.modalTitle}>{t("savedAddresses")}</Text>

              {savedAddresses.map((addr, idx) => (
                <Pressable
                  key={idx}
                  style={[styles.addrOption, addr.address === selectedAddress && styles.addrOptionActive]}
                  onPress={() => handleSelectSaved(addr)}
                >
                  <Ionicons name="location" size={20} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addrOptionLabel}>{addr.label}</Text>
                    <Text style={styles.addrOptionAddr} numberOfLines={2}>{addr.address}</Text>
                  </View>
                  {addr.address === selectedAddress && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </Pressable>
              ))}

              <Pressable style={styles.addrNewBtn} onPress={handleSelectNew}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                <Text style={styles.addrNewBtnText}>{t("addNewAddress")}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  restaurantLabel: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 4 },

  // Empty state
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  emptyTitle: { fontSize: 22, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 40 },
  browseBtn: { backgroundColor: Colors.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  browseBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Section
  section: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 12 },

  // Cart items
  cartItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  cartItemInfo: { flex: 1, marginRight: 12 },
  cartItemName: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textPrimary },
  cartItemPrice: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.surfaceAlt, alignItems: "center", justifyContent: "center",
  },
  qtyBtnAdd: { backgroundColor: Colors.primary },
  qty: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, minWidth: 22, textAlign: "center" },

  // Address
  addrPickerBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: Colors.border,
  },
  addrPickerText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textPrimary },
  switchAddrBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  switchAddrText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary },

  // Input
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 14, height: 48,
    borderWidth: 1, borderColor: Colors.border,
  },
  inputRowError: { borderColor: Colors.error },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textPrimary },
  fieldError: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.error, marginTop: 5 },

  // Save checkbox
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
    alignItems: "center", justifyContent: "center",
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  // Payment
  paymentRow: { gap: 10 },
  paymentBtn: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    borderRadius: 12, backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  paymentBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  paymentLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  paymentLabelActive: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  paymentDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 2 },
  providerRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  providerBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
    backgroundColor: Colors.surfaceAlt, borderWidth: 1.5, borderColor: Colors.border,
  },
  providerBtnActive: { backgroundColor: Colors.accent + "22", borderColor: Colors.accent },
  providerBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  providerBtnTextActive: { color: Colors.accent },

  mobileMoneyForm: { marginTop: 14, gap: 0 },
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.accent + "15", borderRadius: 10, padding: 10, marginTop: 10,
    borderWidth: 1, borderColor: Colors.accent + "30",
  },
  infoBoxText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.accent },

  // Note
  noteInput: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textPrimary,
    minHeight: 56, textAlignVertical: "top",
  },

  // Summary
  summary: {},
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  summaryLabel: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  tipTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, marginBottom: 12 },
  tipRow: { flexDirection: "row", gap: 8 },
  tipChip: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  tipChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tipChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  tipChipTextActive: { color: "#fff" },
  summaryValue: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textPrimary },
  totalRow: { paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.border, marginBottom: 0 },
  totalLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  totalValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.primary },

  // Footer
  footer: {
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: Colors.dark, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  orderBtn: {
    backgroundColor: Colors.primary, paddingVertical: 17,
    borderRadius: 16, alignItems: "center", justifyContent: "center",
    minHeight: 56,
  },
  disabledBtn: { opacity: 0.5 },
  orderBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, gap: 4,
  },
  modalTitle: {
    fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary,
    marginBottom: 16,
  },
  addrOption: {
    flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt, marginBottom: 8,
  },
  addrOptionActive: { borderColor: Colors.primary, backgroundColor: "rgba(255,69,0,0.08)" },
  addrOptionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  addrOptionAddr: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  addrNewBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.primary + "44",
    backgroundColor: "rgba(255,69,0,0.06)", marginTop: 4,
  },
  addrNewBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.primary },

  // Success banner
  successBanner: {
    position: "absolute",
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: Colors.success,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  successBannerText: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // Promo code
  promoRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  promoApplyBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 16, height: 48,
    alignItems: "center", justifyContent: "center",
  },
  promoApplyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  promoApplied: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.success + "18",
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.success + "55",
  },
  promoAppliedCode: {
    fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.success,
  },
  promoAppliedDesc: {
    fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2,
  },
});
