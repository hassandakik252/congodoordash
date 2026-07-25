import React, { createContext, useContext, useState, ReactNode } from "react";
import { Alert } from "react-native";

export interface CartItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface CartContextValue {
  items: CartItem[];
  restaurantId: number | null;
  restaurantName: string;
  deliveryFee: number;
  addItem: (item: CartItem, restaurantId: number, restaurantName: string, deliveryFee: number) => void;
  removeItem: (menuItemId: number) => void;
  updateQuantity: (menuItemId: number, quantity: number) => void;
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
              setItems([{ ...item, quantity: 1 }]);
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
      const existing = prev.find(i => i.menuItemId === item.menuItemId);
      if (existing) {
        return prev.map(i =>
          i.menuItemId === item.menuItemId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setRestaurantId(rId);
    setRestaurantName(rName);
    setDeliveryFee(rDeliveryFee);
  };

  const removeItem = (menuItemId: number) => {
    setItems(prev => prev.filter(i => i.menuItemId !== menuItemId));
  };

  const updateQuantity = (menuItemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    setItems(prev => prev.map(i => i.menuItemId === menuItemId ? { ...i, quantity } : i));
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
