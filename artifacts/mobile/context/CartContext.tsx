import React, { createContext, useContext, useState, ReactNode } from "react";
import { Alert } from "react-native";

export interface CartModifier { groupName: string; label: string; price: number }

export interface CartItem {
  menuItemId: number;
  name: string;
  price: number;         // unit price incl. selected modifiers
  quantity: number;
  imageUrl?: string;
  modifiers?: CartModifier[];
  lineId?: string;       // identity (menuItemId + modifier signature); set on add
}

function makeLineId(menuItemId: number, modifiers?: CartModifier[]): string {
  const sig = (modifiers ?? []).map(m => `${m.groupName}:${m.label}`).sort().join("|");
  return sig ? `${menuItemId}#${sig}` : String(menuItemId);
}

interface CartContextValue {
  items: CartItem[];
  restaurantId: number | null;
  restaurantName: string;
  deliveryFee: number;
  addItem: (item: CartItem, restaurantId: number, restaurantName: string, deliveryFee: number) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);

  const addItem = (item: CartItem, rId: number, rName: string, rDeliveryFee: number) => {
    const lineId = makeLineId(item.menuItemId, item.modifiers);
    const withId = { ...item, lineId };
    if (restaurantId && restaurantId !== rId) {
      // Different restaurant — ask before clearing existing cart
      Alert.alert(
        "Vider le panier ?",
        `Votre panier contient des articles de ${restaurantName}. Voulez-vous le vider pour commander chez ${rName} ?`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Vider et ajouter",
            style: "destructive",
            onPress: () => {
              setItems([{ ...withId, quantity: 1 }]);
              setRestaurantId(rId);
              setRestaurantName(rName);
              setDeliveryFee(rDeliveryFee);
            },
          },
        ]
      );
      return;
    }
    setItems(prev => {
      const existing = prev.find(i => i.lineId === lineId);
      if (existing) {
        return prev.map(i => i.lineId === lineId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...withId, quantity: 1 }];
    });
    setRestaurantId(rId);
    setRestaurantName(rName);
    setDeliveryFee(rDeliveryFee);
  };

  const removeItem = (lineId: string) => {
    setItems(prev => prev.filter(i => (i.lineId ?? String(i.menuItemId)) !== lineId));
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(lineId);
      return;
    }
    setItems(prev => prev.map(i => (i.lineId ?? String(i.menuItemId)) === lineId ? { ...i, quantity } : i));
  };

  const clearCart = () => {
    setItems([]);
    setRestaurantId(null);
    setRestaurantName("");
    setDeliveryFee(0);
  };

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = subtotal + deliveryFee;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, restaurantId, restaurantName, deliveryFee,
      addItem, removeItem, updateQuantity, clearCart,
      subtotal, total, itemCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
