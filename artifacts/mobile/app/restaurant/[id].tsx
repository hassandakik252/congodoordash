import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  Platform, ActivityIndicator, Alert, SectionList,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useCart } from "@/context/CartContext";
import { useLang } from "@/context/LanguageContext";
import { restaurantApi } from "@/services/api";
import { formatCurrency, unitSuffix, VERTICALS } from "@/utils/format";

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { t, language } = useLang();
  const { addItem, items, itemCount, total, restaurantId } = useCart();
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");

  const numericId = id ? Number(id) : NaN;

  const restaurantQuery = useQuery({
    queryKey: ["restaurant", numericId],
    queryFn: () => restaurantApi.get(numericId),
    enabled: !isNaN(numericId),
  });

  const menuQuery = useQuery({
    queryKey: ["menu", numericId],
    queryFn: () => restaurantApi.getMenu(numericId),
    enabled: !isNaN(numericId),
  });

  const restaurant = restaurantQuery.data;
  const menuItems = menuQuery.data || [];

  // Non-restaurant stores (grocery/retail/pharmacy) get an in-store search box.
  const isRestaurant = !restaurant?.vertical || restaurant.vertical === "restaurant";
  const storeIcon = (VERTICALS.find(v => v.id === (restaurant?.vertical ?? "restaurant"))?.icon ?? "storefront") as any;
  const productIcon = isRestaurant ? "fast-food" : "cube";

  // Drinks vertical: one-time age confirmation on entering the store.
  const ageAsked = useRef(false);
  useEffect(() => {
    if (restaurant?.vertical === "drinks" && !ageAsked.current) {
      ageAsked.current = true;
      Alert.alert(
        language === "fr" ? "Vérification de l'âge" : "Age verification",
        language === "fr"
          ? "La vente d'alcool est réservée aux personnes de 18 ans et plus. Avez-vous 18 ans ou plus ?"
          : "Alcohol is sold only to people 18 or older. Are you 18 or older?",
        [
          { text: language === "fr" ? "Non" : "No", style: "cancel", onPress: () => router.back() },
          { text: language === "fr" ? "Oui, j'ai 18 ans+" : "Yes, I'm 18+" },
        ],
      );
    }
  }, [restaurant?.vertical, language]);

  const isOutOfStock = (item: any) =>
    item.stockQuantity != null && item.stockQuantity <= 0;

  // Client-side search over the loaded catalog (name / brand). For very large
  // catalogs the paginated /stores/:id/products endpoint (storeApi.searchProducts)
  // should replace this — wired in the API layer, ready to adopt.
  const q = search.trim().toLowerCase();
  const visibleItems = q
    ? menuItems.filter((i: any) =>
        i.name?.toLowerCase().includes(q) || i.brand?.toLowerCase().includes(q))
    : menuItems;

  // Group items by category (aisle)
  const grouped = visibleItems.reduce((acc: Record<string, any[]>, item: any) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});
  const sections = Object.entries(grouped).map(([title, data]) => ({ title, data }));

  const handleAddToCart = (item: any) => {
    if (!restaurant) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addItem(
      { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, imageUrl: item.imageUrl },
      restaurant.id,
      restaurant.name,
      restaurant.deliveryFee
    );
    setAddedItems(prev => new Set([...prev, item.id]));
    setTimeout(() => {
      setAddedItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 1500);
  };

  const cartFromHere = restaurantId === numericId;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        {cartFromHere && itemCount > 0 && (
          <Pressable style={styles.cartBubble} onPress={() => router.push("/(tabs)/cart")}>
            <Ionicons name="cart" size={18} color="#fff" />
            <Text style={styles.cartBubbleText}>{itemCount}</Text>
          </Pressable>
        )}
      </View>

      {restaurantQuery.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : restaurant ? (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id.toString()}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : cartFromHere && itemCount > 0 ? 110 : 24) }}
          ListHeaderComponent={
            <View>
              {/* Restaurant Hero */}
              <View style={styles.hero}>
                <View style={styles.heroImage}>
                  <Ionicons name={storeIcon} size={48} color={Colors.primary} />
                </View>
                <View style={styles.heroInfo}>
                  <Text style={styles.restaurantName}>{restaurant.name}</Text>
                  <Text style={styles.restaurantDesc}>{restaurant.description || restaurant.category}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="star" size={14} color={Colors.accent} />
                      <Text style={styles.metaText}>{restaurant.rating?.toFixed(1)}</Text>
                    </View>
                    <View style={styles.dot} />
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.metaText}>{restaurant.deliveryTimeMin} {t("min")}</Text>
                    </View>
                    <View style={styles.dot} />
                    <View style={styles.metaItem}>
                      <Ionicons name="bicycle-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.metaText}>{restaurant.deliveryFee === 0 ? t("free") : formatCurrency(restaurant.deliveryFee)}</Text>
                    </View>
                  </View>
                  <View style={[styles.openBadge, { backgroundColor: restaurant.isOpen ? Colors.success + "22" : Colors.error + "22" }]}>
                    <View style={[styles.openDot, { backgroundColor: restaurant.isOpen ? Colors.success : Colors.error }]} />
                    <Text style={[styles.openText, { color: restaurant.isOpen ? Colors.success : Colors.error }]}>
                      {restaurant.isOpen ? t("open") : t("closed")}
                    </Text>
                  </View>
                </View>
              </View>

              {/* In-store catalog search (grocery / retail / pharmacy) */}
              {!isRestaurant && menuItems.length > 0 && (
                <View style={styles.storeSearchBar}>
                  <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.storeSearchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder={language === "fr" ? "Rechercher un produit" : "Search products"}
                    placeholderTextColor={Colors.placeholder}
                    returnKeyType="search"
                  />
                  {!!search && (
                    <Pressable onPress={() => setSearch("")}>
                      <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                    </Pressable>
                  )}
                </View>
              )}

              {menuQuery.isLoading && <View style={styles.loadingArea}><ActivityIndicator color={Colors.primary} /></View>}
              {sections.length === 0 && !menuQuery.isLoading && (
                <View style={styles.empty}>
                  <Ionicons name="fast-food-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>{t("noItems")}</Text>
                </View>
              )}
            </View>
          }
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.categoryHeader}>{title}</Text>
          )}
          renderItem={({ item }) => {
            const inCart = items.find(i => i.menuItemId === item.id);
            const justAdded = addedItems.has(item.id);
            const outOfStock = isOutOfStock(item);
            const available = item.isAvailable && !outOfStock;
            const lowStock = item.stockQuantity != null && item.stockQuantity > 0 && item.stockQuantity <= 5;
            return (
              <View style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <Text style={styles.menuItemName}>{item.name}</Text>
                  {item.requiresPrescription && (
                    <View style={styles.rxBadge}>
                      <Ionicons name="medkit" size={11} color={Colors.accent} />
                      <Text style={styles.rxBadgeText}>{language === "fr" ? "Ordonnance requise" : "Prescription required"}</Text>
                    </View>
                  )}
                  {!!item.brand && <Text style={styles.menuItemBrand}>{item.brand}</Text>}
                  {item.description && (
                    <Text style={styles.menuItemDesc} numberOfLines={2}>{item.description}</Text>
                  )}
                  <Text style={styles.menuItemPrice}>
                    {formatCurrency(item.price)}
                    <Text style={styles.unitSuffix}>{unitSuffix(item.unit, language)}</Text>
                  </Text>
                  {outOfStock && (
                    <Text style={styles.outOfStock}>{language === "fr" ? "Rupture de stock" : "Out of stock"}</Text>
                  )}
                  {!outOfStock && lowStock && (
                    <Text style={styles.lowStock}>
                      {language === "fr" ? `Plus que ${item.stockQuantity} en stock` : `Only ${item.stockQuantity} left`}
                    </Text>
                  )}
                </View>
                <View style={styles.menuItemRight}>
                  <View style={styles.menuItemImagePlaceholder}>
                    <Ionicons name={productIcon} size={24} color={Colors.primary} />
                    {inCart && (
                      <View style={styles.inCartBadge}>
                        <Text style={styles.inCartBadgeText}>{inCart.quantity}</Text>
                      </View>
                    )}
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.addBtn,
                      justAdded && styles.addBtnSuccess,
                      !available && styles.addBtnDisabled,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => available && handleAddToCart(item)}
                    disabled={!available}
                  >
                    <Ionicons
                      name={justAdded ? "checkmark" : "add"}
                      size={18}
                      color="#fff"
                    />
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t("error")}</Text>
        </View>
      )}

      {/* Floating Cart Bar */}
      {cartFromHere && itemCount > 0 && (
        <View style={[styles.cartBar, { bottom: insets.bottom + (Platform.OS === "web" ? 34 : 20) }]}>
          <Pressable
            style={({ pressed }) => [styles.cartBarBtn, pressed && { opacity: 0.9 }]}
            onPress={() => router.push("/(tabs)/cart")}
          >
            <View style={styles.cartBarLeft}>
              <View style={styles.cartBarCount}><Text style={styles.cartBarCountText}>{itemCount}</Text></View>
              <Text style={styles.cartBarLabel}>{t("viewCart")}</Text>
            </View>
            <Text style={styles.cartBarTotal}>{formatCurrency(total)}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  cartBubble: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
  },
  cartBubbleText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { padding: 20 },
  heroImage: {
    height: 180, backgroundColor: Colors.surface, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  heroInfo: { gap: 8 },
  restaurantName: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  restaurantDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textMuted },
  openBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: "flex-start" },
  openDot: { width: 7, height: 7, borderRadius: 4 },
  openText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  loadingArea: { paddingVertical: 40, alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  categoryHeader: {
    fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.textPrimary,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  menuItem: {
    flexDirection: "row", justifyContent: "space-between",
    marginHorizontal: 16, marginBottom: 14, padding: 14,
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  menuItemLeft: { flex: 1, marginRight: 12 },
  menuItemName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, marginBottom: 4 },
  menuItemBrand: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary, marginBottom: 4 },
  rxBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: Colors.accent + "1A", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 6 },
  rxBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.accent },
  menuItemDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginBottom: 8 },
  menuItemPrice: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.primary },
  unitSuffix: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  outOfStock: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.error, marginTop: 6 },
  lowStock: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.accent, marginTop: 6 },
  storeSearchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 14, height: 48,
    borderWidth: 1, borderColor: Colors.border,
  },
  storeSearchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textPrimary },
  menuItemRight: { alignItems: "center", gap: 8 },
  menuItemImagePlaceholder: {
    width: 72, height: 72, borderRadius: 14,
    backgroundColor: Colors.surfaceAlt, alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  inCartBadge: {
    position: "absolute", top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  inCartBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  addBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  addBtnSuccess: { backgroundColor: Colors.success },
  addBtnDisabled: { backgroundColor: Colors.textMuted, opacity: 0.5 },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  cartBar: {
    position: "absolute", left: 16, right: 16,
  },
  cartBarBtn: {
    backgroundColor: Colors.primary, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 20,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 8,
  },
  cartBarLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  cartBarCount: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  cartBarCountText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  cartBarLabel: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cartBarTotal: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
