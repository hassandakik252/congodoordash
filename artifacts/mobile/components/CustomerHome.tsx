import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  TextInput, Platform, ActivityIndicator, RefreshControl, ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { restaurantApi } from "@/services/api";
import { formatCurrency, getGreeting, RESTAURANT_CATEGORIES, VERTICALS } from "@/utils/format";

export default function CustomerHome() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, language } = useLang();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeVertical, setActiveVertical] = useState("restaurant");
  const isRestaurant = activeVertical === "restaurant";

  // Debounce search input — only fire query 400ms after user stops typing
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  const { data: restaurants, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["restaurants", activeVertical, activeCategory, debouncedSearch],
    queryFn: () => restaurantApi.list({
      vertical: activeVertical,
      // Category chips only apply to restaurants
      category: isRestaurant && activeCategory !== "all" ? activeCategory : undefined,
      search: debouncedSearch || undefined,
    }),
  });

  // Switching vertical resets the (restaurant-only) category filter
  function selectVertical(id: string) {
    setActiveVertical(id);
    setActiveCategory("all");
  }

  const greeting = getGreeting(language);
  const firstName = user?.name?.split(" ")[0] || "";

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}, {firstName}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color={Colors.primary} />
            <Text style={styles.locationText}>Lubumbashi, DRC</Text>
          </View>
        </View>
        <Pressable style={styles.notifBtn} onPress={() => router.push("/(tabs)/notifications")}>
          <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
        </Pressable>
      </View>

      {/* Vertical switcher (Food / Grocery / Pharmacy / Shops / Drinks) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.verticalsRow}
        style={styles.verticalsScroll}
      >
        {VERTICALS.map(v => {
          const active = activeVertical === v.id;
          return (
            <Pressable
              key={v.id}
              style={[styles.verticalChip, active && styles.verticalChipActive]}
              onPress={() => selectVertical(v.id)}
            >
              <Ionicons name={v.icon as any} size={18} color={active ? "#fff" : Colors.primary} />
              <Text style={[styles.verticalLabel, active && styles.verticalLabelActive]}>
                {language === "fr" ? v.labelFr : v.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t("searchRestaurants")}
            placeholderTextColor={Colors.placeholder}
            returnKeyType="search"
          />
          {!!search && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={restaurants || []}
        keyExtractor={item => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 90) }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
        }
        scrollEnabled={!!(restaurants && restaurants.length > 0)}
        ListHeaderComponent={
          <>
            {/* Categories (restaurants only) */}
            {isRestaurant && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesRow}
            >
              {RESTAURANT_CATEGORIES.map(cat => (
                <Pressable
                  key={cat.id}
                  style={[styles.categoryChip, activeCategory === cat.id && styles.categoryChipActive]}
                  onPress={() => setActiveCategory(cat.id)}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={16}
                    color={activeCategory === cat.id ? "#fff" : Colors.textMuted}
                  />
                  <Text style={[styles.categoryLabel, activeCategory === cat.id && styles.categoryLabelActive]}>
                    {language === "fr" ? cat.labelFr : cat.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            )}

            <Text style={styles.sectionTitle}>
              {search
                ? `"${search}"`
                : isRestaurant
                  ? (activeCategory === "all" ? t("allRestaurants") : activeCategory)
                  : (language === "fr"
                      ? VERTICALS.find(v => v.id === activeVertical)?.labelFr
                      : VERTICALS.find(v => v.id === activeVertical)?.label)}
            </Text>

            {isLoading && (
              <View style={styles.loadingCenter}>
                <ActivityIndicator color={Colors.primary} size="large" />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name={(VERTICALS.find(v => v.id === activeVertical)?.icon ?? "storefront") as any} size={56} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {isRestaurant
                  ? (language === "fr" ? "Aucun restaurant trouvé" : "No restaurants found")
                  : (language === "fr" ? "Aucun magasin trouvé" : "No stores found")}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            onPress={() => router.push({ pathname: "/restaurant/[id]", params: { id: item.id } })}
          >
            {/* Placeholder image area */}
            <View style={styles.cardImage}>
              <Ionicons name={(VERTICALS.find(v => v.id === (item.vertical ?? "restaurant"))?.icon ?? "storefront") as any} size={36} color={Colors.primary} />
              <View style={[styles.statusPill, { backgroundColor: item.isOpen ? Colors.success + "22" : Colors.error + "22" }]}>
                <Text style={[styles.statusPillText, { color: item.isOpen ? Colors.success : Colors.error }]}>
                  {item.isOpen ? t("open") : t("closed")}
                </Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.restaurantName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={13} color={Colors.accent} />
                  <Text style={styles.rating}>{item.rating?.toFixed(1)}</Text>
                </View>
              </View>

              <Text style={styles.category}>{item.category}</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{item.deliveryTimeMin} {t("min")}</Text>
                </View>
                <View style={styles.dot} />
                <View style={styles.metaItem}>
                  <Ionicons name="bicycle-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.metaText}>
                    {item.deliveryFee === 0 ? t("free") : formatCurrency(item.deliveryFee)}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  greeting: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  locationText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  notifBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  verticalsScroll: { flexGrow: 0 },
  verticalsRow: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 8 },
  verticalChip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  verticalChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  verticalLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  verticalLabelActive: { color: "#fff" },
  searchRow: { paddingHorizontal: 20, paddingBottom: 12 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 14, height: 50,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textPrimary },
  categoriesRow: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  categoryChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  categoryLabelActive: { color: "#fff" },
  sectionTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.textPrimary, paddingHorizontal: 20, marginBottom: 14 },
  loadingCenter: { paddingTop: 40, alignItems: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  card: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: Colors.surface, borderRadius: 20,
    overflow: "hidden", borderWidth: 1, borderColor: Colors.border,
  },
  cardImage: {
    height: 140, backgroundColor: Colors.surfaceAlt,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  statusPill: {
    position: "absolute", top: 12, right: 12,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardBody: { padding: 14 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  restaurantName: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, marginRight: 8 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  rating: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.accent },
  category: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginBottom: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textMuted },
});
