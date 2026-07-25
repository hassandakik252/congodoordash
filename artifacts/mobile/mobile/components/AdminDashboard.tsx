import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { adminApi, adminEarningsApi, notificationApi, analyticsApi, promoApi } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

type AdminSection = "dashboard" | "orders" | "restaurants" | "users" | "drivers" | "payments" | "earnings" | "notifs" | "analytics" | "promos";

const VEHICLE_LABELS: Record<string, string> = {
  motorcycle: "Moto",
  bicycle: "Vélo",
  car: "Voiture",
  foot: "À pied",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready_for_pickup: "Prête",
  picked_up: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
  all: "Tous",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  preparing: "#8B5CF6",
  ready_for_pickup: "#06B6D4",
  picked_up: "#F97316",
  delivered: "#10B981",
  cancelled: "#EF4444",
};

const DRIVER_STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  approved: "#10B981",
  rejected: "#EF4444",
};

const DRIVER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Rejeté",
};

const ROLE_LABELS: Record<string, string> = {
  all: "Tous",
  customer: "Clients",
  driver: "Livreurs",
  restaurant_owner: "Propriétaires",
};

const ROLE_COLORS: Record<string, string> = {
  customer: "#3B82F6",
  driver: "#F97316",
  restaurant_owner: "#8B5CF6",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  all: "Tous",
  pending: "En attente",
  submitted: "Soumis",
  confirmed: "Confirmé",
  failed: "Échoué",
};

function formatCDF(amount: number) {
  return new Intl.NumberFormat("fr-CD", {
    style: "currency",
    currency: "CDF",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Nav Tabs ─────────────────────────────────────────────────────────────────
const NAV_ITEMS: { key: AdminSection; icon: string; label: string }[] = [
  { key: "dashboard", icon: "bar-chart-outline", label: "Tableau" },
  { key: "orders", icon: "list-outline", label: "Commandes" },
  { key: "restaurants", icon: "restaurant-outline", label: "Restaus" },
  { key: "users", icon: "people-outline", label: "Utilisateurs" },
  { key: "drivers", icon: "bicycle-outline", label: "Livreurs" },
  { key: "payments", icon: "card-outline", label: "Paiements" },
  { key: "earnings", icon: "wallet-outline", label: "Revenus" },
  { key: "notifs", icon: "notifications-outline", label: "Alertes" },
  { key: "analytics", icon: "trending-up-outline", label: "Stats" },
  { key: "promos", icon: "pricetag-outline", label: "Promos" },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color + "55" }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Filter Pills ─────────────────────────────────────────────────────────────
function FilterPills({ options, value, onChange, colorMap }: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  colorMap?: Record<string, string>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      {options.map(opt => {
        const active = value === opt.key;
        const color = colorMap?.[opt.key] || Colors.primary;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.pill, active && { backgroundColor: color, borderColor: color }]}
          >
            <Text style={[styles.pillText, active && { color: "#fff" }]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardScreen() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.stats();
      setStats(data);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />;

  return (
    <ScrollView
      contentContainerStyle={styles.sectionContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
    >
      <Text style={styles.sectionTitle}>Tableau de bord</Text>
      {stats && (
        <View style={styles.statsGrid}>
          <StatCard label="Total commandes" value={stats.totalOrders} color="#FF4500" icon="📦" />
          <StatCard label="Commandes livrées" value={stats.deliveredOrders} color="#10B981" icon="✅" />
          <StatCard label="Commandes actives" value={stats.activeOrders} color="#F59E0B" icon="🔄" />
          <StatCard label="Revenu total" value={formatCDF(stats.revenue)} color="#8B5CF6" icon="💰" />
          <StatCard label="Restaurants" value={stats.totalRestaurants} color="#3B82F6" icon="🍽️" />
          <StatCard label="Clients" value={stats.totalCustomers} color="#06B6D4" icon="👤" />
          <StatCard label="Livreurs" value={stats.totalDrivers} color="#F97316" icon="🛵" />
          {(stats.pendingDrivers ?? 0) > 0 && (
            <StatCard label="Livreurs en attente" value={stats.pendingDrivers} color="#F59E0B" icon="⏳" />
          )}
          {(stats.pendingPayments ?? 0) > 0 && (
            <StatCard label="Paiements à vérifier" value={stats.pendingPayments} color="#3B82F6" icon="💳" />
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Orders ───────────────────────────────────────────────────────────────────
function OrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.orders(status);
      setOrders(data);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const statuses = ["all", "pending", "confirmed", "preparing", "ready_for_pickup", "picked_up", "delivered", "cancelled"];

  return (
    <View style={{ flex: 1 }}>
      <FilterPills
        options={statuses.map(s => ({ key: s, label: STATUS_LABELS[s] || s }))}
        value={status}
        onChange={setStatus}
        colorMap={STATUS_COLORS}
      />
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.sectionContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
        >
          <Text style={styles.sectionTitle}>Commandes ({orders.length})</Text>
          {orders.length === 0 ? (
            <Text style={styles.emptyText}>Aucune commande</Text>
          ) : orders.map(o => (
            <View key={o.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardId}>#{o.id}</Text>
                <Badge label={STATUS_LABELS[o.status] || o.status} color={STATUS_COLORS[o.status] || Colors.textMuted} />
              </View>
              <Text style={styles.cardMain}>{o.customerName || "—"}</Text>
              <Text style={styles.cardSub}>{o.restaurantName || "—"}</Text>
              <View style={styles.cardRow}>
                <Badge
                  label={o.paymentMethod === "cash" ? "Espèces" : "Mobile"}
                  color={o.paymentMethod === "cash" ? Colors.success : Colors.accent}
                />
                <Text style={styles.cardAmount}>{formatCDF(o.total)}</Text>
              </View>
              <Text style={styles.cardDate}>{formatDate(o.createdAt)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Restaurants ──────────────────────────────────────────────────────────────
function RestaurantsScreen() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.restaurants(query);
      setRestaurants(data);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: number) => {
    setToggling(id);
    try {
      await adminApi.toggleRestaurant(id);
      setRestaurants(rs => rs.map(r => r.id === id ? { ...r, isOpen: !r.isOpen } : r));
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setToggling(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => setQuery(search)}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => setQuery(search)}>
          <Ionicons name="search" size={18} color="#fff" />
        </TouchableOpacity>
        {query ? (
          <TouchableOpacity style={styles.clearBtn} onPress={() => { setSearch(""); setQuery(""); }}>
            <Ionicons name="close" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.sectionContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
        >
          <Text style={styles.sectionTitle}>Restaurants ({restaurants.length})</Text>
          {restaurants.length === 0 ? (
            <Text style={styles.emptyText}>Aucun restaurant</Text>
          ) : restaurants.map(r => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardId}>#{r.id}</Text>
                <Badge label={r.isOpen ? "Ouvert" : "Fermé"} color={r.isOpen ? Colors.success : Colors.error} />
              </View>
              <Text style={styles.cardMain}>{r.name}</Text>
              <Text style={styles.cardSub}>{r.category} · {r.address}</Text>
              <Text style={styles.cardSub}>Proprio: {r.ownerName || "—"} · ⭐ {r.rating?.toFixed(1)}</Text>
              <Text style={styles.cardSub}>Livraison: {r.deliveryFee === 0 ? "Gratuit" : formatCDF(r.deliveryFee)}</Text>
              <TouchableOpacity
                style={[styles.actionBtn, r.isOpen ? styles.actionBtnDanger : styles.actionBtnSuccess]}
                onPress={() => toggle(r.id)}
                disabled={toggling === r.id}
              >
                <Text style={styles.actionBtnText}>{toggling === r.id ? "…" : r.isOpen ? "Fermer" : "Ouvrir"}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
function UsersScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [role, setRole] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.users(role, query);
      setUsers(data);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, query]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: number) => {
    setToggling(id);
    try {
      await adminApi.toggleUser(id);
      setUsers(us => us.map(u => u.id === id ? { ...u, isActive: !u.isActive } : u));
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setToggling(null);
    }
  };

  const roles = ["all", "customer", "driver", "restaurant_owner"];

  return (
    <View style={{ flex: 1 }}>
      <FilterPills
        options={roles.map(r => ({ key: r, label: ROLE_LABELS[r] }))}
        value={role}
        onChange={setRole}
        colorMap={ROLE_COLORS}
      />
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par nom ou email…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => setQuery(search)}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => setQuery(search)}>
          <Ionicons name="search" size={18} color="#fff" />
        </TouchableOpacity>
        {query ? (
          <TouchableOpacity style={styles.clearBtn} onPress={() => { setSearch(""); setQuery(""); }}>
            <Ionicons name="close" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.sectionContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
        >
          <Text style={styles.sectionTitle}>Utilisateurs ({users.length})</Text>
          {users.length === 0 ? (
            <Text style={styles.emptyText}>Aucun utilisateur</Text>
          ) : users.map(u => (
            <View key={u.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardId}>#{u.id}</Text>
                <Badge label={u.isActive ? "Actif" : "Inactif"} color={u.isActive ? Colors.success : Colors.error} />
              </View>
              <Text style={styles.cardMain}>{u.name}</Text>
              <Text style={styles.cardSub}>{u.email}</Text>
              <Text style={styles.cardSub}>{u.phone}</Text>
              <View style={styles.cardRow}>
                <Badge label={ROLE_LABELS[u.role] || u.role} color={ROLE_COLORS[u.role] || Colors.textMuted} />
                <Text style={styles.cardDate}>{formatDate(u.createdAt)}</Text>
              </View>
              <TouchableOpacity
                style={[styles.actionBtn, u.isActive ? styles.actionBtnDanger : styles.actionBtnSuccess]}
                onPress={() => toggle(u.id)}
                disabled={toggling === u.id}
              >
                <Text style={styles.actionBtnText}>{toggling === u.id ? "…" : u.isActive ? "Désactiver" : "Activer"}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Drivers ──────────────────────────────────────────────────────────────────
function DriversScreen() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.drivers(filter);
      setDrivers(data);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: number) => {
    setActionId(id);
    try {
      await adminApi.approveDriver(id);
      setDrivers(d => d.map(dr => dr.id === id ? { ...dr, driverStatus: "approved", isActive: true } : dr));
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionId(id);
    try {
      await adminApi.rejectDriver(id);
      setDrivers(d => d.map(dr => dr.id === id ? { ...dr, driverStatus: "rejected", isActive: false } : dr));
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setActionId(null);
    }
  };

  const filters = ["all", "pending", "approved", "rejected"];

  return (
    <View style={{ flex: 1 }}>
      <FilterPills
        options={filters.map(f => ({ key: f, label: DRIVER_STATUS_LABELS[f] || "Tous" }))}
        value={filter}
        onChange={setFilter}
        colorMap={DRIVER_STATUS_COLORS}
      />
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.sectionContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
        >
          <Text style={styles.sectionTitle}>Livreurs ({drivers.length})</Text>
          {drivers.length === 0 ? (
            <Text style={styles.emptyText}>Aucun livreur</Text>
          ) : drivers.map(dr => {
            const statusColor = DRIVER_STATUS_COLORS[dr.driverStatus ?? "pending"];
            return (
              <View key={dr.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardId}>#{dr.id}</Text>
                  <Badge label={DRIVER_STATUS_LABELS[dr.driverStatus ?? "pending"] || dr.driverStatus} color={statusColor} />
                </View>
                <Text style={styles.cardMain}>{dr.name}</Text>
                <Text style={styles.cardSub}>{dr.email}</Text>
                <Text style={styles.cardSub}>
                  📱 {dr.phone}
                  {dr.vehicleType ? `  🛵 ${VEHICLE_LABELS[dr.vehicleType] ?? dr.vehicleType}` : ""}
                </Text>
                <Text style={styles.cardDate}>{formatDate(dr.createdAt)}</Text>
                {dr.avgRating !== null && dr.avgRating !== undefined && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={13} color="#FFB800" />
                    <Text style={styles.ratingText}>
                      {Number(dr.avgRating).toFixed(1)} ({dr.ratingCount} avis)
                    </Text>
                  </View>
                )}
                {dr.driverStatus === "pending" && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnSuccess, { flex: 1 }]}
                      onPress={() => handleApprove(dr.id)}
                      disabled={actionId === dr.id}
                    >
                      <Text style={styles.actionBtnText}>{actionId === dr.id ? "…" : "✓ Approuver"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnDanger, { flex: 1 }]}
                      onPress={() => handleReject(dr.id)}
                      disabled={actionId === dr.id}
                    >
                      <Text style={styles.actionBtnText}>{actionId === dr.id ? "…" : "✗ Rejeter"}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {dr.driverStatus === "approved" && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDanger]}
                    onPress={() => handleReject(dr.id)}
                    disabled={actionId === dr.id}
                  >
                    <Text style={styles.actionBtnText}>{actionId === dr.id ? "…" : "Révoquer"}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────
function PaymentsScreen() {
  const [payments, setPayments] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.payments(filter);
      setPayments(data);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const review = async (id: number, action: "confirmed" | "failed") => {
    setActionId(id);
    try {
      await adminApi.reviewPayment(id, action);
      setPayments(ps => ps.map(p => p.id === id ? { ...p, paymentStatus: action } : p));
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setActionId(null);
    }
  };

  const filters = ["all", "pending", "submitted", "confirmed", "failed"];

  return (
    <View style={{ flex: 1 }}>
      <FilterPills
        options={filters.map(f => ({ key: f, label: PAYMENT_STATUS_LABELS[f] || f }))}
        value={filter}
        onChange={setFilter}
      />
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.sectionContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
        >
          <Text style={styles.sectionTitle}>Paiements Mobile ({payments.length})</Text>
          {payments.length === 0 ? (
            <Text style={styles.emptyText}>Aucun paiement</Text>
          ) : payments.map(p => (
            <View key={p.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardId}>Commande #{p.id}</Text>
                <Badge
                  label={PAYMENT_STATUS_LABELS[p.paymentStatus] || p.paymentStatus}
                  color={p.paymentStatus === "confirmed" ? Colors.success : p.paymentStatus === "failed" ? Colors.error : Colors.accent}
                />
              </View>
              <Text style={styles.cardMain}>{p.customerName || "—"}</Text>
              <Text style={styles.cardSub}>Via: {p.paymentProvider || "—"}</Text>
              {p.paymentReference && <Text style={styles.cardSub}>Réf: {p.paymentReference}</Text>}
              {p.paymentPhone && <Text style={styles.cardSub}>📱 {p.paymentPhone}</Text>}
              <Text style={styles.cardAmount}>{formatCDF(p.total)}</Text>
              <Text style={styles.cardDate}>{formatDate(p.createdAt)}</Text>
              {p.paymentStatus === "submitted" && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnSuccess, { flex: 1 }]}
                    onPress={() => review(p.id, "confirmed")}
                    disabled={actionId === p.id}
                  >
                    <Text style={styles.actionBtnText}>{actionId === p.id ? "…" : "✓ Confirmer"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDanger, { flex: 1 }]}
                    onPress={() => review(p.id, "failed")}
                    disabled={actionId === p.id}
                  >
                    <Text style={styles.actionBtnText}>{actionId === p.id ? "…" : "✗ Rejeter"}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Admin Earnings ───────────────────────────────────────────────────────────
function AdminEarningsScreen() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settlingId, setSettlingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminEarningsApi.drivers();
      setDrivers(data);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSettle = (driver: any) => {
    Alert.prompt(
      `Régler ${driver.driver.name}`,
      `Solde en attente: ${formatCDF(driver.pendingBalance)}\nMontant à enregistrer:`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer règlement",
          onPress: async (amount: string | undefined) => {
            const val = parseFloat(amount || "0");
            if (isNaN(val) || val <= 0) {
              Alert.alert("Montant invalide", "Saisissez un montant valide.");
              return;
            }
            setSettlingId(driver.driver.id);
            try {
              await adminEarningsApi.settle(driver.driver.id, val);
              Alert.alert("Règlement enregistré", `${formatCDF(val)} réglé pour ${driver.driver.name}`);
              load();
            } catch (e: any) {
              Alert.alert("Erreur", e.message);
            } finally {
              setSettlingId(null);
            }
          },
        },
      ],
      "plain-text",
      driver.pendingBalance.toFixed(0)
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.sectionContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
    >
      <Text style={styles.sectionTitle}>Revenus des livreurs</Text>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : drivers.length === 0 ? (
        <Text style={styles.emptyText}>Aucune donnée de revenus.</Text>
      ) : drivers.map((d) => {
        const hasMismatch = d.mismatch;
        const hasPending = d.pendingBalance > 0;
        return (
          <View
            key={d.driver.id}
            style={[
              styles.card,
              hasMismatch && { borderColor: Colors.error + "66", borderWidth: 1.5 },
            ]}
          >
            <View style={styles.cardRow}>
              <View>
                <Text style={styles.cardMain}>{d.driver.name}</Text>
                <Text style={styles.cardSub}>{d.driver.phone}</Text>
              </View>
              {hasMismatch ? (
                <Badge label="⚠ Écart" color={Colors.error} />
              ) : (
                <Badge label="✓ OK" color={Colors.success} />
              )}
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <View style={styles.earningChip}>
                <Text style={styles.earningChipLabel}>Livraisons</Text>
                <Text style={styles.earningChipValue}>{d.totalDeliveries}</Text>
              </View>
              <View style={styles.earningChip}>
                <Text style={styles.earningChipLabel}>Gains</Text>
                <Text style={[styles.earningChipValue, { color: Colors.primary }]}>{formatCDF(d.totalEarnings)}</Text>
              </View>
              <View style={styles.earningChip}>
                <Text style={styles.earningChipLabel}>Cash collecté</Text>
                <Text style={[styles.earningChipValue, { color: Colors.accent }]}>{formatCDF(d.totalCashCollected)}</Text>
              </View>
              <View style={styles.earningChip}>
                <Text style={styles.earningChipLabel}>Déjà réglé</Text>
                <Text style={[styles.earningChipValue, { color: Colors.success }]}>{formatCDF(d.totalSettled)}</Text>
              </View>
              <View style={[styles.earningChip, hasPending && { borderColor: Colors.error + "55", backgroundColor: Colors.error + "12" }]}>
                <Text style={styles.earningChipLabel}>Solde dû</Text>
                <Text style={[styles.earningChipValue, { color: hasPending ? Colors.error : Colors.textMuted }]}>
                  {formatCDF(d.pendingBalance)}
                </Text>
              </View>
            </View>

            {d.lastSettledAt && (
              <Text style={[styles.cardDate, { marginTop: 6 }]}>
                Dernier règlement: {formatDate(d.lastSettledAt)}
              </Text>
            )}

            {hasPending && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSuccess, { marginTop: 10 }]}
                onPress={() => handleSettle(d)}
                disabled={settlingId === d.driver.id}
              >
                <Text style={styles.actionBtnText}>
                  {settlingId === d.driver.id ? "…" : `💵 Marquer réglé (${formatCDF(d.pendingBalance)})`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Admin Notification Types ─────────────────────────────────────────────────
const NOTIF_META: Record<string, { icon: string; color: string; label: string }> = {
  driver_application: { icon: "bicycle-outline", color: Colors.accent, label: "Candidature livreur" },
  payment_submitted:  { icon: "card-outline",    color: Colors.primary, label: "Paiement soumis" },
  payment_failed:     { icon: "close-circle-outline", color: Colors.error, label: "Paiement rejeté" },
  payment_confirmed:  { icon: "checkmark-circle-outline", color: Colors.success, label: "Paiement confirmé" },
  new_order:          { icon: "receipt-outline",  color: Colors.primary, label: "Nouvelle commande" },
  order_cancelled:    { icon: "close-outline",    color: Colors.error,   label: "Commande annulée" },
};

// ─── Admin Notifications ──────────────────────────────────────────────────────
function AdminNotificationsScreen({ onBadgeChange }: { onBadgeChange?: (n: number) => void }) {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await notificationApi.list();
      setNotifs(data);
      const unread = data.filter((n: any) => !n.isRead).length;
      onBadgeChange?.(unread);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (id: number) => {
    try {
      await notificationApi.markRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      const unread = notifs.filter(n => n.id !== id && !n.isRead).length;
      onBadgeChange?.(unread);
    } catch {}
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await notificationApi.markAllRead();
      setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
      onBadgeChange?.(0);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifs.filter(n => !n.isRead).length;

  return (
    <View style={{ flex: 1 }}>
      {/* Header bar with mark-all button */}
      <View style={styles.notifHeader}>
        <Text style={styles.sectionTitle}>
          Alertes {unreadCount > 0 ? `(${unreadCount} non lues)` : ""}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAll} disabled={markingAll}>
            <Text style={styles.markAllBtn}>
              {markingAll ? "…" : "Tout lire"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.sectionContent, { paddingTop: 8 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : notifs.length === 0 ? (
          <View style={styles.notifEmpty}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Aucune alerte pour l'instant.</Text>
          </View>
        ) : notifs.map(n => {
          const meta = NOTIF_META[n.type] ?? { icon: "alert-circle-outline", color: Colors.textMuted, label: n.type };
          return (
            <TouchableOpacity
              key={n.id}
              style={[styles.notifCard, !n.isRead && styles.notifCardUnread]}
              activeOpacity={0.8}
              onPress={() => !n.isRead && handleMarkRead(n.id)}
            >
              {/* Unread dot */}
              {!n.isRead && <View style={styles.unreadDot} />}

              <View style={[styles.notifIconBox, { backgroundColor: meta.color + "18" }]}>
                <Ionicons name={meta.icon as any} size={20} color={meta.color} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.notifTitleRow}>
                  <Text style={[styles.notifTitle, !n.isRead && { color: Colors.textPrimary }]} numberOfLines={1}>
                    {n.title}
                  </Text>
                  <Text style={styles.notifTime}>{formatDate(n.createdAt)}</Text>
                </View>
                <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                <Text style={[styles.notifTypeLabel, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Admin Promos Screen ───────────────────────────────────────────────────────
function AdminPromosScreen() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [type, setType] = useState<"fixed" | "percent">("fixed");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const loadPromos = useCallback(async () => {
    try {
      const data = await promoApi.list();
      setPromos(data);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPromos(); }, [loadPromos]);

  const resetForm = () => {
    setCode(""); setType("fixed"); setValue("");
    setMinOrder(""); setMaxUses(""); setExpiresAt("");
    setShowForm(false);
  };

  const handleCreate = async () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode || trimmedCode.length < 3) {
      Alert.alert("Erreur", "Le code doit comporter au moins 3 caractères."); return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      Alert.alert("Erreur", "La valeur doit être un nombre positif."); return;
    }
    if (type === "percent" && numValue > 100) {
      Alert.alert("Erreur", "Le pourcentage ne peut pas dépasser 100%."); return;
    }

    setSaving(true);
    try {
      await promoApi.create({
        code: trimmedCode,
        type,
        value: numValue,
        minOrderAmount: minOrder ? parseFloat(minOrder) : undefined,
        maxUses: maxUses ? parseInt(maxUses) : undefined,
        expiresAt: expiresAt || undefined,
      });
      resetForm();
      await loadPromos();
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      const updated = await promoApi.toggle(id);
      setPromos(prev => prev.map(p => p.id === id ? updated : p));
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert("Supprimer", "Supprimer ce code promo ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive",
        onPress: async () => {
          try {
            await promoApi.remove(id);
            setPromos(prev => prev.filter(p => p.id !== id));
          } catch (e: any) {
            Alert.alert("Erreur", e.message);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.sectionContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPromos(); }} tintColor={Colors.primary} />}
    >
      {/* Create button */}
      <TouchableOpacity style={styles.promoCreateBtn} onPress={() => setShowForm(!showForm)}>
        <Ionicons name={showForm ? "close-outline" : "add-circle-outline"} size={20} color="#fff" />
        <Text style={styles.promoCreateBtnText}>{showForm ? "Annuler" : "Créer un code promo"}</Text>
      </TouchableOpacity>

      {/* Create form */}
      {showForm && (
        <View style={styles.promoFormCard}>
          <Text style={styles.sectionTitle}>Nouveau code promo</Text>

          {/* Code */}
          <Text style={styles.promoFieldLabel}>Code *</Text>
          <View style={styles.promoInput}>
            <TextInput
              value={code}
              onChangeText={v => setCode(v.toUpperCase())}
              placeholder="EX: BIENVENUE10"
              placeholderTextColor={Colors.placeholder}
              style={styles.promoInputText}
              autoCapitalize="characters"
              maxLength={20}
            />
          </View>

          {/* Type */}
          <Text style={[styles.promoFieldLabel, { marginTop: 12 }]}>Type *</Text>
          <View style={styles.promoTypeRow}>
            {(["fixed", "percent"] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.promoTypeBtn, type === t && styles.promoTypeBtnActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.promoTypeBtnText, type === t && { color: "#fff" }]}>
                  {t === "fixed" ? "Montant fixe (CDF)" : "Pourcentage (%)"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Value */}
          <Text style={[styles.promoFieldLabel, { marginTop: 12 }]}>
            Valeur * {type === "fixed" ? "(CDF)" : "(%)"}
          </Text>
          <View style={styles.promoInput}>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={type === "fixed" ? "5000" : "10"}
              placeholderTextColor={Colors.placeholder}
              style={styles.promoInputText}
              keyboardType="numeric"
            />
          </View>

          {/* Optional fields row */}
          <View style={styles.promoOptRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.promoFieldLabel}>Min. commande (CDF)</Text>
              <View style={styles.promoInput}>
                <TextInput
                  value={minOrder}
                  onChangeText={setMinOrder}
                  placeholder="Aucun"
                  placeholderTextColor={Colors.placeholder}
                  style={styles.promoInputText}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.promoFieldLabel}>Max. utilisations</Text>
              <View style={styles.promoInput}>
                <TextInput
                  value={maxUses}
                  onChangeText={setMaxUses}
                  placeholder="Illimité"
                  placeholderTextColor={Colors.placeholder}
                  style={styles.promoInputText}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Expires at */}
          <Text style={[styles.promoFieldLabel, { marginTop: 12 }]}>Expiration (AAAA-MM-JJ)</Text>
          <View style={styles.promoInput}>
            <TextInput
              value={expiresAt}
              onChangeText={setExpiresAt}
              placeholder="2026-12-31"
              placeholderTextColor={Colors.placeholder}
              style={styles.promoInputText}
            />
          </View>

          <TouchableOpacity
            style={[styles.promoSubmitBtn, saving && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.promoSubmitBtnText}>Créer le code</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Promo list */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
      ) : promos.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 48, gap: 12 }}>
          <Ionicons name="pricetag-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Aucun code promo créé.</Text>
        </View>
      ) : promos.map(p => {
        const expired = p.expiresAt && new Date(p.expiresAt) < new Date();
        const maxed = p.maxUses !== null && p.usedCount >= p.maxUses;
        const badgeColor = !p.isActive || expired || maxed ? Colors.textMuted : Colors.success;

        return (
          <View key={p.id} style={styles.promoCard}>
            <View style={styles.promoCardHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.promoCardCode}>{p.code}</Text>
                  <View style={[styles.promoStatusBadge, { backgroundColor: badgeColor + "22" }]}>
                    <Text style={[styles.promoStatusText, { color: badgeColor }]}>
                      {!p.isActive ? "Inactif" : expired ? "Expiré" : maxed ? "Épuisé" : "Actif"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.promoCardValue}>
                  {p.type === "fixed"
                    ? `${p.value.toLocaleString()} CDF`
                    : `${p.value}% de réduction`}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={styles.promoActionBtn} onPress={() => handleToggle(p.id)}>
                  <Ionicons
                    name={p.isActive ? "pause-circle-outline" : "play-circle-outline"}
                    size={20}
                    color={p.isActive ? Colors.accent : Colors.success}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.promoActionBtn} onPress={() => handleDelete(p.id)}>
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.promoCardMeta}>
              {p.minOrderAmount && (
                <Text style={styles.promoMeta}>Min: {p.minOrderAmount.toLocaleString()} CDF</Text>
              )}
              {p.maxUses && (
                <Text style={styles.promoMeta}>{p.usedCount}/{p.maxUses} utilisations</Text>
              )}
              {!p.maxUses && (
                <Text style={styles.promoMeta}>{p.usedCount} utilisations</Text>
              )}
              {p.expiresAt && (
                <Text style={[styles.promoMeta, expired && { color: Colors.error }]}>
                  Expire: {new Date(p.expiresAt).toLocaleDateString("fr-CD")}
                </Text>
              )}
              {!p.expiresAt && <Text style={styles.promoMeta}>Pas d'expiration</Text>}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Analytics helpers ────────────────────────────────────────────────────────
function fmtDay(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("fr-CD", { weekday: "short", day: "2-digit" });
}

function fmtCDF(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
}

// Simple pure-RN bar chart
function BarChart({
  data,
  getValue,
  getLabel,
  color,
  formatValue,
  height = 160,
}: {
  data: any[];
  getValue: (item: any) => number;
  getLabel: (item: any) => string;
  color: string;
  formatValue?: (v: number) => string;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return <Text style={[styles.emptyText, { marginTop: 16 }]}>Pas de données</Text>;
  }
  const max = Math.max(...data.map(getValue), 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: height + 28, gap: 4, paddingHorizontal: 2 }}>
      {data.map((item, i) => {
        const val = getValue(item);
        const barH = Math.max((val / max) * height, val > 0 ? 4 : 0);
        return (
          <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: height + 28 }}>
            {/* Value label */}
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: Colors.textMuted, marginBottom: 2 }}>
              {val > 0 ? (formatValue ? formatValue(val) : val) : ""}
            </Text>
            {/* Bar */}
            <View
              style={{
                width: "100%",
                height: barH,
                backgroundColor: val > 0 ? color : Colors.border,
                borderRadius: 4,
              }}
            />
            {/* Label */}
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 8, color: Colors.textMuted, marginTop: 4, textAlign: "center" }} numberOfLines={2}>
              {getLabel(item)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

type Period = 7 | 14 | 30;
const PERIODS: { label: string; days: Period }[] = [
  { label: "7 jours", days: 7 },
  { label: "14 jours", days: 14 },
  { label: "30 jours", days: 30 },
];

// ─── Admin Analytics Screen ───────────────────────────────────────────────────
function AdminAnalyticsScreen() {
  const [period, setPeriod] = useState<Period>(7);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (days: Period) => {
    try {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - (days - 1));
      from.setHours(0, 0, 0, 0);
      const result = await analyticsApi.get(from.toISOString(), to.toISOString());
      setData(result);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period]);

  const handlePeriod = (days: Period) => {
    setPeriod(days);
    setLoading(true);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.sectionContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(period); }} tintColor={Colors.primary} />}
    >
      {/* Period selector */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.days}
            style={[styles.periodBtn, period === p.days && styles.periodBtnActive]}
            onPress={() => handlePeriod(p.days)}
          >
            <Text style={[styles.periodBtnText, period === p.days && styles.periodBtnTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : !data ? null : (
        <>
          {/* Summary cards */}
          <View style={styles.analyticsCardRow}>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsCardValue}>{data.totals.totalOrders}</Text>
              <Text style={styles.analyticsCardLabel}>Commandes</Text>
            </View>
            <View style={[styles.analyticsCard, { borderColor: Colors.success + "60" }]}>
              <Text style={[styles.analyticsCardValue, { color: Colors.success }]}>
                {fmtCDF(data.totals.totalRevenue)} CDF
              </Text>
              <Text style={styles.analyticsCardLabel}>Revenu livré</Text>
            </View>
            <View style={[styles.analyticsCard, { borderColor: Colors.error + "60" }]}>
              <Text style={[styles.analyticsCardValue, { color: Colors.error }]}>{data.totals.cancelledOrders}</Text>
              <Text style={styles.analyticsCardLabel}>Annulées</Text>
            </View>
          </View>

          {/* Orders per day chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Commandes par jour</Text>
            <BarChart
              data={data.ordersPerDay}
              getValue={item => item.count}
              getLabel={item => fmtDay(item.day)}
              color={Colors.primary}
            />
          </View>

          {/* Revenue per day chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Revenu par jour (CDF)</Text>
            <BarChart
              data={data.revenuePerDay}
              getValue={item => item.revenue}
              getLabel={item => fmtDay(item.day)}
              color={Colors.success}
              formatValue={v => fmtCDF(v)}
            />
          </View>

          {/* Top restaurants */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Top restaurants</Text>
            {data.topRestaurants.length === 0 ? (
              <Text style={[styles.emptyText, { marginTop: 8 }]}>Pas de données</Text>
            ) : (
              <View style={{ gap: 10, marginTop: 8 }}>
                {data.topRestaurants.map((r: any, i: number) => {
                  const maxCount = data.topRestaurants[0].orderCount || 1;
                  const pct = (r.orderCount / maxCount) * 100;
                  return (
                    <View key={r.restaurantId}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                          <View style={[styles.rankBadge, i === 0 && { backgroundColor: Colors.accent }]}>
                            <Text style={styles.rankText}>#{i + 1}</Text>
                          </View>
                          <Text style={styles.restaurantName} numberOfLines={1}>{r.restaurantName}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.restaurantOrders}>{r.orderCount} cmd</Text>
                          <Text style={styles.restaurantRevenue}>{fmtCDF(r.revenue)} CDF</Text>
                        </View>
                      </View>
                      {/* Progress bar */}
                      <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: i === 0 ? Colors.accent : Colors.primary }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ─── Main AdminDashboard ───────────────────────────────────────────────────────
export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const qc = useQueryClient();
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [notifBadge, setNotifBadge] = useState(0);

  useEffect(() => {
    notificationApi.unreadCount()
      .then(data => setNotifBadge(data.count))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Déconnexion",
        style: "destructive",
        onPress: () => {
          qc.clear();
          logout();
        },
      },
    ]);
  };

  const currentNav = NAV_ITEMS.find(n => n.key === section);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🚀 Deliver LBH</Text>
          <Text style={styles.headerSub}>{currentNav?.label || "Admin"}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={Colors.error} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {section === "dashboard" && <DashboardScreen />}
        {section === "orders" && <OrdersScreen />}
        {section === "restaurants" && <RestaurantsScreen />}
        {section === "users" && <UsersScreen />}
        {section === "drivers" && <DriversScreen />}
        {section === "payments" && <PaymentsScreen />}
        {section === "earnings" && <AdminEarningsScreen />}
        {section === "notifs" && <AdminNotificationsScreen onBadgeChange={setNotifBadge} />}
        {section === "analytics" && <AdminAnalyticsScreen />}
        {section === "promos" && <AdminPromosScreen />}
      </View>

      {/* Bottom Nav */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 8 : 4) }]}>
        {NAV_ITEMS.map(item => {
          const active = section === item.key;
          const badge = item.key === "notifs" && notifBadge > 0 ? notifBadge : 0;
          return (
            <TouchableOpacity key={item.key} style={styles.navItem} onPress={() => setSection(item.key)}>
              <View>
                <Ionicons
                  name={(active ? item.icon.replace("-outline", "") : item.icon) as any}
                  size={22}
                  color={active ? Colors.primary : Colors.textMuted}
                />
                {badge > 0 && (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeText}>{badge > 99 ? "99+" : badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.navLabel, active && { color: Colors.primary }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
  },
  sectionContent: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "47%",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderTopWidth: 3,
    alignItems: "center",
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardId: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
  },
  cardMain: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.textPrimary,
  },
  cardSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  cardAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.primary,
  },
  cardDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  pillsRow: {
    paddingVertical: 10,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 10,
  },
  clearBtn: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  actionBtnSuccess: {
    backgroundColor: Colors.success + "22",
    borderWidth: 1,
    borderColor: Colors.success + "55",
  },
  actionBtnDanger: {
    backgroundColor: Colors.error + "22",
    borderWidth: 1,
    borderColor: Colors.error + "55",
  },
  actionBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textPrimary,
  },
  earningChip: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    minWidth: 80,
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  earningChipLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 2,
    textAlign: "center",
  },
  earningChipValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  ratingRow: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4,
  },
  ratingText: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.accent,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 40,
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
  },
  navLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
  },
  navBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  navBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: "#fff",
  },
  // Notifications screen
  notifHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  markAllBtn: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.primary,
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  notifCardUnread: {
    borderColor: Colors.primary + "55",
    backgroundColor: Colors.primary + "08",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 4,
    flexShrink: 0,
  },
  notifIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
    gap: 6,
  },
  notifTitle: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  notifTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  notifBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  notifTypeLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  notifEmpty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  // Analytics
  periodRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  periodBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  periodBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
  },
  periodBtnTextActive: {
    color: "#fff",
  },
  analyticsCardRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  analyticsCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  analyticsCardValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.primary,
    marginBottom: 2,
  },
  analyticsCardLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  chartTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rankText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: Colors.textPrimary,
  },
  restaurantName: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textPrimary,
  },
  restaurantOrders: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.textPrimary,
  },
  restaurantRevenue: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
  },
  progressBg: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  // Promos
  promoCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    justifyContent: "center",
  },
  promoCreateBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  promoFormCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.primary + "44",
    marginBottom: 16,
  },
  promoFieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  promoInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 44,
    justifyContent: "center",
  },
  promoInputText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textPrimary,
  },
  promoTypeRow: {
    flexDirection: "row",
    gap: 8,
  },
  promoTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  promoTypeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  promoTypeBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
  },
  promoOptRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  promoSubmitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 16,
  },
  promoSubmitBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  promoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  promoCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  promoCardCode: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  promoCardValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  promoStatusBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  promoStatusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
  },
  promoActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  promoCardMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
  promoMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
