import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, SectionList, Pressable, TextInput,
  Modal, Platform, Alert, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Switch, Image, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { pickAndUploadImage } from "@/utils/imageUpload";
import { useLang } from "@/context/LanguageContext";
import { restaurantApi } from "@/services/api";
import { formatCurrency } from "@/utils/format";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: number;
  restaurantId: number;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  imageUrl?: string | null;
  isAvailable: boolean;
}

interface FormState {
  name: string;
  description: string;
  price: string;
  category: string;
  imageUrl: string;
  isAvailable: boolean;
}

const BLANK_FORM: FormState = {
  name: "", description: "", price: "", category: "", imageUrl: "", isAvailable: true,
};

const CATEGORY_SUGGESTIONS = ["Plats", "Pizzas", "Burgers", "Poulet", "Boissons", "Desserts",
  "Entrées", "Grillades", "Sandwichs", "Pâtes", "Soupes", "Salades"];

// ── Item Form Modal ───────────────────────────────────────────────────────────

function ItemFormModal({
  visible,
  editing,
  form,
  setForm,
  errors,
  saving,
  onSave,
  onClose,
}: {
  visible: boolean;
  editing: MenuItem | null;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errors: Record<string, string>;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const [uploading, setUploading] = useState(false);

  const setField = (key: keyof FormState, val: any) =>
    setForm(f => ({ ...f, [key]: val }));

  const handlePickImage = async () => {
    try {
      setUploading(true);
      const url = await pickAndUploadImage();
      if (url) setField("imageUrl", url);
    } catch (e: any) {
      Alert.alert(t("error"), e?.message || t("error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === "web" ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
            onPress={e => e.stopPropagation()}
          >
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editing ? t("editItem") : t("addItem")}
              </Text>
              <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Name */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t("itemName")} *</Text>
                <View style={[styles.inputRow, errors.name ? styles.inputErr : null]}>
                  <TextInput
                    style={styles.input}
                    value={form.name}
                    onChangeText={v => setField("name", v)}
                    placeholder={t("itemNamePlaceholder")}
                    placeholderTextColor={Colors.placeholder}
                    returnKeyType="next"
                  />
                </View>
                {errors.name ? <Text style={styles.errText}>{errors.name}</Text> : null}
              </View>

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t("itemDescription")}</Text>
                <View style={[styles.inputRow, { height: 72, alignItems: "flex-start", paddingTop: 12 }]}>
                  <TextInput
                    style={[styles.input, { textAlignVertical: "top" }]}
                    value={form.description}
                    onChangeText={v => setField("description", v)}
                    placeholder={t("itemDescriptionPlaceholder")}
                    placeholderTextColor={Colors.placeholder}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>

              {/* Price */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t("itemPrice")} *</Text>
                <View style={[styles.inputRow, errors.price ? styles.inputErr : null]}>
                  <Text style={styles.prefix}>CDF</Text>
                  <TextInput
                    style={styles.input}
                    value={form.price}
                    onChangeText={v => setField("price", v.replace(/[^0-9]/g, ""))}
                    placeholder={t("itemPricePlaceholder")}
                    placeholderTextColor={Colors.placeholder}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                </View>
                {errors.price ? <Text style={styles.errText}>{errors.price}</Text> : null}
              </View>

              {/* Category */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t("itemCategory")} *</Text>
                <View style={[styles.inputRow, errors.category ? styles.inputErr : null]}>
                  <TextInput
                    style={styles.input}
                    value={form.category}
                    onChangeText={v => setField("category", v)}
                    placeholder={t("itemCategoryPlaceholder")}
                    placeholderTextColor={Colors.placeholder}
                    returnKeyType="next"
                  />
                </View>
                {errors.category ? <Text style={styles.errText}>{errors.category}</Text> : null}
                {/* Category suggestion chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 8 }}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {CATEGORY_SUGGESTIONS.map(cat => (
                    <Pressable
                      key={cat}
                      style={[
                        styles.chip,
                        form.category === cat && styles.chipActive,
                      ]}
                      onPress={() => setField("category", cat)}
                    >
                      <Text style={[styles.chipText, form.category === cat && styles.chipTextActive]}>
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Image */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t("itemImageUrl")}</Text>
                {!!form.imageUrl && (
                  <Image source={{ uri: form.imageUrl }} style={styles.uploadPreview} resizeMode="cover" />
                )}
                <Pressable style={styles.uploadBtn} onPress={handlePickImage} disabled={uploading}>
                  {uploading
                    ? <ActivityIndicator color={Colors.primary} size="small" />
                    : <><Ionicons name="cloud-upload-outline" size={18} color={Colors.primary} /><Text style={styles.uploadBtnText}>{form.imageUrl ? "Changer la photo" : "Ajouter une photo"}</Text></>}
                </Pressable>
                <View style={styles.inputRow}>
                  <Ionicons name="image-outline" size={16} color={Colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    value={form.imageUrl}
                    onChangeText={v => setField("imageUrl", v)}
                    placeholder={t("itemImageUrlPlaceholder")}
                    placeholderTextColor={Colors.placeholder}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>
                {form.imageUrl ? (
                  <Image
                    source={{ uri: form.imageUrl }}
                    style={styles.imgPreview}
                    resizeMode="cover"
                    onError={() => {}}
                  />
                ) : null}
              </View>

              {/* Availability toggle */}
              <View style={[styles.formGroup, styles.toggleRow]}>
                <View>
                  <Text style={styles.label}>
                    {form.isAvailable ? t("itemAvailable") : t("itemUnavailable")}
                  </Text>
                  <Text style={styles.toggleDesc}>
                    {form.isAvailable
                      ? "Visible to customers"
                      : "Hidden from customers"}
                  </Text>
                </View>
                <Switch
                  value={form.isAvailable}
                  onValueChange={v => setField("isAvailable", v)}
                  trackColor={{ false: Colors.border, true: Colors.success + "88" }}
                  thumbColor={form.isAvailable ? Colors.success : Colors.textMuted}
                />
              </View>

              {/* Save button */}
              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  saving && styles.saveBtnDisabled,
                  pressed && !saving && { opacity: 0.85 },
                ]}
                onPress={onSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>{t("save")}</Text>
                  </>
                )}
              </Pressable>

              <View style={{ height: 24 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MenuManagementScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const qc = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const saving = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const {
    data: restaurant, isLoading: rLoading, isError: rError,
  } = useQuery({
    queryKey: ["my-restaurant"],
    queryFn: restaurantApi.mine,
  });

  const {
    data: items, isLoading: mLoading, refetch, isRefetching,
  } = useQuery({
    queryKey: ["my-menu"],
    queryFn: restaurantApi.mineMenu,
    enabled: !!restaurant,
  });

  // ── Grouped sections ───────────────────────────────────────────────────────

  const sections = React.useMemo(() => {
    if (!items) return [];
    const map: Record<string, MenuItem[]> = {};
    items.forEach((item: MenuItem) => {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [items]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-menu"] });

  const addMutation = useMutation({
    mutationFn: (body: any) => restaurantApi.addMenuItem(restaurant!.id, body),
    onSuccess: () => { invalidate(); closeModal(); if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
    onError: (e: any) => Alert.alert(t("error"), e.message),
    onSettled: () => { saving.current = false; setIsSaving(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, body }: { itemId: number; body: any }) =>
      restaurantApi.updateMenuItem(restaurant!.id, itemId, body),
    onSuccess: () => { invalidate(); closeModal(); if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
    onError: (e: any) => Alert.alert(t("error"), e.message),
    onSettled: () => { saving.current = false; setIsSaving(false); },
  });

  const toggleMutation = useMutation({
    mutationFn: (itemId: number) =>
      restaurantApi.toggleMenuItemAvailability(restaurant!.id, itemId),
    onMutate: async (itemId: number) => {
      await qc.cancelQueries({ queryKey: ["my-menu"] });
      const prev = qc.getQueryData<MenuItem[]>(["my-menu"]);
      qc.setQueryData<MenuItem[]>(["my-menu"], (old) =>
        old?.map((it) => it.id === itemId ? { ...it, isAvailable: !it.isAvailable } : it) ?? []
      );
      return { prev };
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["my-menu"], ctx.prev);
      Alert.alert(t("error"), e.message);
    },
    onSettled: () => { invalidate(); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: number) =>
      restaurantApi.deleteMenuItem(restaurant!.id, itemId),
    onSuccess: () => { invalidate(); if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); },
    onError: (e: any) => Alert.alert(t("error"), e.message),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditing(null);
    setForm(BLANK_FORM);
    setErrors({});
    setModalVisible(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description || "",
      price: String(item.price),
      category: item.category,
      imageUrl: item.imageUrl || "",
      isAvailable: item.isAvailable,
    });
    setErrors({});
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditing(null);
    setForm(BLANK_FORM);
    setErrors({});
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t("nameRequired");
    const price = parseFloat(form.price);
    if (!form.price || isNaN(price) || price <= 0) e.price = t("priceRequired");
    if (!form.category.trim()) e.category = t("categoryRequired");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (saving.current) return;
    if (!validate()) { if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    saving.current = true;
    setIsSaving(true);

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: parseFloat(form.price),
      category: form.category.trim(),
      imageUrl: form.imageUrl.trim() || undefined,
      isAvailable: form.isAvailable,
    };

    if (editing) {
      updateMutation.mutate({ itemId: editing.id, body });
    } else {
      addMutation.mutate(body);
    }
  };

  const handleDelete = (item: MenuItem) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingDelete(item.id);
  };

  const confirmDelete = (itemId: number) => {
    setPendingDelete(null);
    deleteMutation.mutate(itemId);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const cancelDelete = () => setPendingDelete(null);

  // ── Loading / error states ─────────────────────────────────────────────────

  if (rLoading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (rError || !restaurant) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        <Ionicons name="storefront-outline" size={64} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>{t("noRestaurant")}</Text>
        <Text style={styles.emptyDesc}>{t("noRestaurantDesc")}</Text>
      </View>
    );
  }

  const totalItems = items?.length ?? 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("menuManagement")}</Text>
          <Text style={styles.restaurantName} numberOfLines={1}>{restaurant.name}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          onPress={openAdd}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>{t("addItem")}</Text>
        </Pressable>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{totalItems}</Text>
          <Text style={styles.statLbl}>{t("itemsCount")}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: Colors.success }]}>
            {items?.filter((i: MenuItem) => i.isAvailable).length ?? 0}
          </Text>
          <Text style={styles.statLbl}>{t("available")}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: Colors.textMuted }]}>
            {items?.filter((i: MenuItem) => !i.isAvailable).length ?? 0}
          </Text>
          <Text style={styles.statLbl}>{t("unavailable")}</Text>
        </View>
      </View>

      {/* Menu list */}
      {mLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="restaurant-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{t("noMenuItems")}</Text>
          <Text style={styles.emptyDesc}>{t("noMenuItemsDesc")}</Text>
          <Pressable style={styles.addFirstBtn} onPress={openAdd}>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.addFirstBtnText}>{t("addFirstItem")}</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id.toString()}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
          contentContainerStyle={{
            paddingHorizontal: 16, paddingTop: 4,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100),
          }}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>
                {section.data.length} {t("itemsCount")}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <MenuItemCard
              item={item}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item)}
              onToggle={() => toggleMutation.mutate(item.id)}
              toggling={toggleMutation.isPending}
              pendingDelete={pendingDelete === item.id}
              onConfirmDelete={() => confirmDelete(item.id)}
              onCancelDelete={cancelDelete}
            />
          )}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Add/Edit modal */}
      <ItemFormModal
        visible={modalVisible}
        editing={editing}
        form={form}
        setForm={setForm}
        errors={errors}
        saving={isSaving}
        onSave={handleSave}
        onClose={closeModal}
      />
    </View>
  );
}

// ── Menu Item Card ─────────────────────────────────────────────────────────────

function MenuItemCard({
  item, onEdit, onDelete, onToggle, toggling,
  pendingDelete, onConfirmDelete, onCancelDelete,
}: {
  item: MenuItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  toggling: boolean;
  pendingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const { t } = useLang();

  return (
    <View style={[styles.card, !item.isAvailable && styles.cardUnavailable]}>
      {/* Left: image (if any) */}
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.cardImg}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.cardImgPlaceholder}>
          <Ionicons name="fast-food-outline" size={24} color={Colors.textMuted} />
        </View>
      )}

      {/* Center: info */}
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.cardName, !item.isAvailable && styles.textMuted]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardPrice}>{formatCurrency(item.price)}</Text>
        </View>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        {/* Inline delete confirmation */}
        {pendingDelete ? (
          <View style={styles.deleteConfirmRow}>
            <Text style={styles.deleteConfirmText}>{t("deleteItemTitle")}</Text>
            <View style={styles.deleteConfirmBtns}>
              <Pressable
                style={({ pressed }) => [styles.deleteConfirmCancel, pressed && { opacity: 0.7 }]}
                onPress={onCancelDelete}
              >
                <Text style={styles.deleteConfirmCancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.deleteConfirmOk, pressed && { opacity: 0.7 }]}
                onPress={onConfirmDelete}
                accessibilityLabel="Supprimer"
              >
                <Ionicons name="trash" size={13} color="#fff" />
                <Text style={styles.deleteConfirmOkText}>{t("delete")}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* Bottom actions */
          <View style={styles.cardFooter}>
            {/* Availability toggle */}
            <Pressable
              style={[styles.availBadge, item.isAvailable ? styles.availBadgeOn : styles.availBadgeOff]}
              onPress={onToggle}
              disabled={toggling}
            >
              <View style={[styles.availDot, { backgroundColor: item.isAvailable ? Colors.success : Colors.textMuted }]} />
              <Text style={[styles.availText, { color: item.isAvailable ? Colors.success : Colors.textMuted }]}>
                {item.isAvailable ? t("available") : t("unavailable")}
              </Text>
            </Pressable>

            {/* Edit / Delete */}
            <View style={styles.cardActions}>
              <Pressable
                style={({ pressed }) => [styles.iconBtn, styles.editBtn, pressed && { opacity: 0.7 }]}
                onPress={onEdit}
                hitSlop={8}
              >
                <Ionicons name="create-outline" size={16} color={Colors.primary} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.iconBtn, styles.deleteBtn, pressed && { opacity: 0.7 }]}
                onPress={onDelete}
                hitSlop={8}
                accessibilityLabel={`delete-${item.id}`}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  restaurantName: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 12,
  },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Stats bar
  statsBar: {
    flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.primary },
  statLbl: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 4 },

  // Empty
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 32 },
  addFirstBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 14, marginTop: 8,
  },
  addFirstBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Section header
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 4, marginTop: 8,
  },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.primary, textTransform: "uppercase", letterSpacing: 0.8 },
  sectionCount: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },

  // Item card
  card: {
    flexDirection: "row", backgroundColor: Colors.surface, borderRadius: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
  },
  cardUnavailable: { opacity: 0.65 },
  cardImg: { width: 80, height: 80 },
  cardImgPlaceholder: {
    width: 80, height: 80, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.surfaceAlt,
  },
  cardBody: { flex: 1, padding: 10, justifyContent: "space-between" },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  cardName: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  cardPrice: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.primary, flexShrink: 0 },
  cardDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },

  availBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    borderWidth: 1,
  },
  availBadgeOn: { backgroundColor: Colors.success + "12", borderColor: Colors.success + "44" },
  availBadgeOff: { backgroundColor: Colors.border + "55", borderColor: Colors.border },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  cardActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  editBtn: { backgroundColor: Colors.primary + "12", borderColor: Colors.primary + "44" },
  deleteBtn: { backgroundColor: Colors.error + "12", borderColor: Colors.error + "44" },

  textMuted: { color: Colors.textMuted },

  // Delete confirmation inline panel
  deleteConfirmRow: {
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.error + "33",
  },
  deleteConfirmText: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: Colors.error, marginBottom: 8,
  },
  deleteConfirmBtns: { flexDirection: "row", gap: 8 },
  deleteConfirmCancel: {
    flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center",
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
  },
  deleteConfirmCancelText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  deleteConfirmOk: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 7, borderRadius: 8, gap: 5,
    backgroundColor: Colors.error,
  },
  deleteConfirmOkText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // Modal / sheet
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: "92%",
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: "center", marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.surfaceAlt, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
  },

  // Form
  formGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  uploadPreview: { width: "100%", height: 160, borderRadius: 12, marginBottom: 10, backgroundColor: Colors.surfaceAlt },
  uploadBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    height: 46, borderRadius: 12, marginBottom: 10,
    backgroundColor: Colors.primary + "1A", borderWidth: 1, borderColor: Colors.primary + "55",
  },
  uploadBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 14,
    height: 48, borderWidth: 1, borderColor: Colors.border,
  },
  inputErr: { borderColor: Colors.error },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textPrimary },
  prefix: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textMuted },
  errText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.error, marginTop: 4 },

  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontFamily: "Inter_600SemiBold" },

  imgPreview: {
    width: "100%", height: 100, borderRadius: 10,
    marginTop: 10, backgroundColor: Colors.surfaceAlt,
  },

  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },

  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
