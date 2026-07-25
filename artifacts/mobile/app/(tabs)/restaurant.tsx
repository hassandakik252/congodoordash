import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Switch, ActivityIndicator, Image, Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { restaurantApi } from "@/services/api";
import { formatCurrency } from "@/utils/format";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Restaurant {
  id: number;
  ownerId: number;
  name: string;
  description?: string | null;
  category: string;
  address: string;
  phone: string;
  imageUrl?: string | null;
  rating: number;
  deliveryTimeMin: number;
  deliveryFee: number;
  isOpen: boolean;
  openingHours?: string | null;
}

interface FormState {
  name: string;
  description: string;
  phone: string;
  address: string;
  category: string;
  imageUrl: string;
  deliveryFee: string;
  deliveryTimeMin: string;
  openingHours: string;
  isOpen: boolean;
}

function restaurantToForm(r: Restaurant): FormState {
  return {
    name: r.name,
    description: r.description || "",
    phone: r.phone,
    address: r.address,
    category: r.category,
    imageUrl: r.imageUrl || "",
    deliveryFee: String(r.deliveryFee),
    deliveryTimeMin: String(r.deliveryTimeMin),
    openingHours: r.openingHours || "",
    isOpen: r.isOpen,
  };
}

function isDirty(form: FormState, original: FormState): boolean {
  return (Object.keys(form) as Array<keyof FormState>).some(
    (k) => form[k] !== original[k]
  );
}

// ── Field component ───────────────────────────────────────────────────────────

function Field({
  label, value, onChangeText, placeholder, keyboardType,
  multiline, error, icon, required,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  error?: string;
  icon?: string;
  required?: boolean;
}) {
  return (
    <View style={fStyles.group}>
      <Text style={fStyles.label}>
        {label}
        {required ? <Text style={{ color: Colors.primary }}> *</Text> : null}
      </Text>
      <View style={[
        fStyles.row,
        multiline ? { height: 80, alignItems: "flex-start", paddingTop: 12 } : null,
        error ? fStyles.rowErr : null,
      ]}>
        {icon ? <Ionicons name={icon as any} size={16} color={Colors.textMuted} /> : null}
        <TextInput
          style={[fStyles.input, multiline ? { textAlignVertical: "top" } : null]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          keyboardType={keyboardType || "default"}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          autoCapitalize="none"
        />
      </View>
      {error ? <Text style={fStyles.err}>{error}</Text> : null}
    </View>
  );
}

const fStyles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.surfaceAlt, borderRadius: 12,
    paddingHorizontal: 14, height: 48,
    borderWidth: 1, borderColor: Colors.border,
  },
  rowErr: { borderColor: Colors.error },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textPrimary },
  err: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.error, marginTop: 4 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function RestaurantProfileScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const qc = useQueryClient();
  const saving = useRef(false);

  const [form, setForm] = useState<FormState | null>(null);
  const [original, setOriginal] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // ── Load restaurant ────────────────────────────────────────────────────────

  const { data: restaurant, isLoading, isError } = useQuery<Restaurant>({
    queryKey: ["my-restaurant"],
    queryFn: restaurantApi.mine,
  });

  // Populate form when data loads (only if not already dirty)
  useEffect(() => {
    if (restaurant && !form) {
      const f = restaurantToForm(restaurant);
      setForm(f);
      setOriginal(f);
    }
  }, [restaurant]);

  const dirty = form && original ? isDirty(form, original) : false;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const setField = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(f => f ? { ...f, [key]: val } : f);
    setSaved(false);
    setSaveErr(null);
    // Clear field error
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }, []);

  const validate = (): boolean => {
    if (!form) return false;
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t("nameMin");
    if (!form.phone.trim()) e.phone = t("phoneMin");
    if (!form.address.trim()) e.address = t("addressMin");
    const fee = parseFloat(form.deliveryFee);
    if (isNaN(fee) || fee < 0) e.deliveryFee = t("deliveryFeeMin");
    const time = parseInt(form.deliveryTimeMin);
    if (isNaN(time) || time < 1) e.deliveryTimeMin = t("deliveryTimeMin2");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save mutation ──────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (body: any) => restaurantApi.updateMine(body),
    onSuccess: (updated) => {
      // Sync local state + query cache
      const f = restaurantToForm(updated);
      setOriginal(f);
      setForm(f);
      qc.setQueryData(["my-restaurant"], updated);
      // Also invalidate the public restaurant list so customers see the change
      qc.invalidateQueries({ queryKey: ["restaurants"] });
      setSaved(true);
      setSaveErr(null);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e: any) => {
      setSaveErr(e.message || t("restaurantSaveError"));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    onSettled: () => {
      saving.current = false;
    },
  });

  const handleSave = () => {
    if (saving.current || !form) return;
    if (!validate()) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    saving.current = true;
    setSaved(false);
    setSaveErr(null);

    saveMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      phone: form.phone.trim(),
      address: form.address.trim(),
      category: form.category.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      deliveryFee: parseFloat(form.deliveryFee),
      deliveryTimeMin: parseInt(form.deliveryTimeMin),
      openingHours: form.openingHours.trim() || undefined,
      isOpen: form.isOpen,
    });
  };

  const handleToggleOpen = (val: boolean) => {
    if (!form) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setField("isOpen", val);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: topPad }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !restaurant || !form) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: topPad }]}>
        <Ionicons name="storefront-outline" size={64} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>{t("noRestaurant")}</Text>
        <Text style={styles.emptyDesc}>{t("noRestaurantDesc")}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── Fixed header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("restaurantProfile")}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{restaurant.name}</Text>
        </View>

        {/* Status badge */}
        <View style={[styles.statusBadge, restaurant.isOpen ? styles.statusOpen : styles.statusClosed]}>
          <View style={[styles.statusDot, { backgroundColor: restaurant.isOpen ? Colors.success : Colors.error }]} />
          <Text style={[styles.statusText, { color: restaurant.isOpen ? Colors.success : Colors.error }]}>
            {restaurant.isOpen ? t("restaurantOpen") : t("restaurantClosed")}
          </Text>
        </View>
      </View>

      {/* ── Scrollable form body ──────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 110) },
        ]}
      >
        {/* Cover image preview */}
        {form.imageUrl ? (
          <Image
            source={{ uri: form.imageUrl }}
            style={styles.coverImg}
            resizeMode="cover"
            onError={() => {}}
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
            <Text style={styles.coverPlaceholderText}>No cover image</Text>
          </View>
        )}

        {/* ── Open/Closed toggle ────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("restaurantStatus")}</Text>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleLabel, { color: form.isOpen ? Colors.success : Colors.error }]}>
                {form.isOpen ? t("restaurantOpenToggle") : t("restaurantClosedToggle")}
              </Text>
              <Text style={styles.toggleDesc}>
                {form.isOpen
                  ? "Customers can place orders"
                  : "New orders are paused"}
              </Text>
            </View>
            <Switch
              value={form.isOpen}
              onValueChange={handleToggleOpen}
              trackColor={{ false: Colors.error + "44", true: Colors.success + "55" }}
              thumbColor={form.isOpen ? Colors.success : Colors.error}
            />
          </View>
        </View>

        {/* ── Basic Info ────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("restaurantInfo")}</Text>

          <Field
            label={t("name")}
            value={form.name}
            onChangeText={v => setField("name", v)}
            placeholder="Le Poulet d'Or"
            error={errors.name}
            icon="storefront-outline"
            required
          />

          <Field
            label={t("description")}
            value={form.description}
            onChangeText={v => setField("description", v)}
            placeholder={t("itemDescriptionPlaceholder")}
            multiline
          />

          <Field
            label={t("phone")}
            value={form.phone}
            onChangeText={v => setField("phone", v)}
            placeholder="+243 9XX XXX XXX"
            keyboardType="phone-pad"
            error={errors.phone}
            icon="call-outline"
            required
          />

          <Field
            label={t("address")}
            value={form.address}
            onChangeText={v => setField("address", v)}
            placeholder="Avenue des Flamboyants, Lubumbashi"
            error={errors.address}
            icon="location-outline"
            required
          />

          <Field
            label={t("restaurantCategory")}
            value={form.category}
            onChangeText={v => setField("category", v)}
            placeholder="e.g. Fast Food, Grillades"
            icon="pricetag-outline"
          />

          <Field
            label={t("openingHours")}
            value={form.openingHours}
            onChangeText={v => setField("openingHours", v)}
            placeholder={t("openingHoursPlaceholder")}
            icon="time-outline"
          />
        </View>

        {/* ── Delivery settings ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery</Text>

          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Field
                label={t("deliveryFee")}
                value={form.deliveryFee}
                onChangeText={v => setField("deliveryFee", v.replace(/[^0-9.]/g, ""))}
                placeholder={t("deliveryFeePlaceholder")}
                keyboardType="numeric"
                error={errors.deliveryFee}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={t("deliveryTime")}
                value={form.deliveryTimeMin}
                onChangeText={v => setField("deliveryTimeMin", v.replace(/[^0-9]/g, ""))}
                placeholder={t("deliveryTimePlaceholder")}
                keyboardType="numeric"
                error={errors.deliveryTimeMin}
              />
            </View>
          </View>
        </View>

        {/* ── Cover image URL ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("restaurantImageUrl")}</Text>
          <View style={fStyles.row}>
            <Ionicons name="image-outline" size={16} color={Colors.textMuted} />
            <TextInput
              style={fStyles.input}
              value={form.imageUrl}
              onChangeText={v => setField("imageUrl", v)}
              placeholder={t("itemImageUrlPlaceholder")}
              placeholderTextColor={Colors.placeholder}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* ── Feedback messages ─────────────────────────────────────────── */}
        {saved && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.successText}>{t("restaurantSaved")}</Text>
          </View>
        )}
        {saveErr && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{saveErr}</Text>
          </View>
        )}

        {/* ── Save button ───────────────────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            !dirty && styles.saveBtnDim,
            saveMutation.isPending && styles.saveBtnDim,
            pressed && dirty && !saveMutation.isPending && { opacity: 0.85 },
          ]}
          onPress={handleSave}
          disabled={saveMutation.isPending}
          accessibilityLabel="save-restaurant"
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons
                name={dirty ? "save-outline" : "checkmark-circle-outline"}
                size={18}
                color="#fff"
              />
              <Text style={styles.saveBtnText}>
                {dirty ? t("save") : t("saved")}
              </Text>
            </>
          )}
        </Pressable>

        {dirty && (
          <Text style={styles.dirtyHint}>{t("unsavedChanges")}</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },

  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 32 },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },

  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1,
  },
  statusOpen: { backgroundColor: Colors.success + "12", borderColor: Colors.success + "44" },
  statusClosed: { backgroundColor: Colors.error + "12", borderColor: Colors.error + "44" },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },

  // Cover image
  coverImg: { width: "100%", height: 140, borderRadius: 14, marginBottom: 4, backgroundColor: Colors.surfaceAlt },
  coverPlaceholder: {
    width: "100%", height: 100, borderRadius: 14,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4,
  },
  coverPlaceholderText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted },

  // Card sections
  card: {
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.primary,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14,
  },

  // Open/Closed toggle
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  toggleDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 3 },

  // Two column layout
  twoCol: { flexDirection: "row", gap: 12 },

  // Feedback
  successBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.success + "14", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.success + "44",
  },
  successText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.success },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.error + "14", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.error + "44",
  },
  errorText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.error },

  // Save button
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14,
  },
  saveBtnDim: { opacity: 0.45 },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  dirtyHint: {
    textAlign: "center", fontSize: 12,
    fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: -8,
  },
});
