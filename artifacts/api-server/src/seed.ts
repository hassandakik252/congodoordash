import { db } from "@workspace/db";
import {
  restaurantsTable,
  menuItemsTable,
  usersTable,
  ordersTable,
  reviewsTable,
} from "@workspace/db/schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding demo data…");

  const existing = await db.select().from(restaurantsTable).limit(1);
  if (existing.length > 0) {
    console.log("Data already seeded. Skipping.");
    return;
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  const hash = (pw: string) => bcrypt.hash(pw, 10);

  // Store owners
  const [owner1] = await db.insert(usersTable).values({
    email: "owner@deliverlbh.com",
    passwordHash: await hash("admin1234"),
    name: "Admin Owner",
    phone: "+243810000000",
    role: "restaurant_owner",
    merchantStatus: "approved",
  }).returning();
  console.log(`Created owner: ${owner1.email}`);

  const [owner2] = await db.insert(usersTable).values({
    email: "owner2@deliverlbh.com",
    passwordHash: await hash("owner1234"),
    name: "Sophie Kabila",
    phone: "+243810000008",
    role: "restaurant_owner",
    merchantStatus: "approved",
  }).returning();
  console.log(`Created owner: ${owner2.email}`);

  const [owner3] = await db.insert(usersTable).values({
    email: "owner3@deliverlbh.com",
    passwordHash: await hash("owner1234"),
    name: "Jean-Pierre Mutombo",
    phone: "+243810000009",
    role: "restaurant_owner",
    merchantStatus: "approved",
  }).returning();
  console.log(`Created owner: ${owner3.email}`);

  // Customers
  const [customer1] = await db.insert(usersTable).values({
    email: "customer@deliverlbh.com",
    passwordHash: await hash("customer1234"),
    name: "Client Démo",
    phone: "+243810000010",
    role: "customer",
    address: "Avenue des Savonniers, Lubumbashi",
    savedAddresses: [
      { label: "Maison", address: "Avenue des Savonniers, Lubumbashi" },
      { label: "Bureau", address: "Boulevard M'siri, Lubumbashi" },
    ],
  }).returning();
  console.log(`Created customer: ${customer1.email}`);

  const [customer2] = await db.insert(usersTable).values({
    email: "customer2@deliverlbh.com",
    passwordHash: await hash("customer1234"),
    name: "Marie Tshilomba",
    phone: "+243810000020",
    role: "customer",
    address: "Avenue Lumumba, Lubumbashi",
    savedAddresses: [
      { label: "Maison", address: "Avenue Lumumba, Lubumbashi" },
    ],
  }).returning();
  console.log(`Created customer: ${customer2.email}`);

  // Drivers
  const [driver1] = await db.insert(usersTable).values({
    email: "driver@deliverlbh.com",
    passwordHash: await hash("driver1234"),
    name: "Livreur Démo",
    phone: "+243810000011",
    role: "driver",
    driverStatus: "approved",
    vehicleType: "Moto",
    address: "Avenue des Sports, Lubumbashi",
  }).returning();
  console.log(`Created approved driver: ${driver1.email}`);

  const [driver2] = await db.insert(usersTable).values({
    email: "driver2@deliverlbh.com",
    passwordHash: await hash("driver1234"),
    name: "Pascal Nkulu",
    phone: "+243810000012",
    role: "driver",
    driverStatus: "approved",
    vehicleType: "Moto",
    address: "Avenue Kasaï, Lubumbashi",
  }).returning();
  console.log(`Created approved driver: ${driver2.email}`);

  const [driver3] = await db.insert(usersTable).values({
    email: "driver3@deliverlbh.com",
    passwordHash: await hash("driver1234"),
    name: "Emmanuel Kalonji",
    phone: "+243810000013",
    role: "driver",
    driverStatus: "pending",
    vehicleType: "Vélo",
    address: "Avenue Sendwe, Lubumbashi",
  }).returning();
  console.log(`Created pending driver: ${driver3.email}`);

  // ── Stores ─────────────────────────────────────────────────────────────────

  const stores = await db.insert(restaurantsTable).values([
    // ── Restaurants (owner1) ────────────────────────────────────────────────
    {
      ownerId: owner1.id,
      vertical: "restaurant",
      name: "Chez Mama Ngozi",
      description: "Authentic Congolese home cooking with fufu, saka-saka and grilled fish",
      category: "Congolais",
      address: "Avenue Lumumba, Lubumbashi",
      phone: "+243 810 000 001",
      isOpen: true,
      rating: 4.8,
      deliveryTimeMin: 25,
      deliveryFee: 2000,
    },
    {
      ownerId: owner1.id,
      vertical: "restaurant",
      name: "Le Poulet d'Or",
      description: "The best grilled and fried chicken in Lubumbashi",
      category: "Poulet",
      address: "Avenue Kasaï, Lubumbashi",
      phone: "+243 810 000 002",
      isOpen: true,
      rating: 4.6,
      deliveryTimeMin: 20,
      deliveryFee: 1500,
    },
    {
      ownerId: owner1.id,
      vertical: "restaurant",
      name: "Pizza Roma",
      description: "Italian-style pizza baked in wood-fired oven",
      category: "Pizza",
      address: "Boulevard Kamanyola, Lubumbashi",
      phone: "+243 810 000 003",
      isOpen: true,
      rating: 4.4,
      deliveryTimeMin: 35,
      deliveryFee: 3000,
    },
    {
      ownerId: owner1.id,
      vertical: "restaurant",
      name: "Dragon Palace",
      description: "Chinese cuisine adapted for local tastes — chow mein, fried rice, dumplings",
      category: "Chinois",
      address: "Avenue Sendwe, Lubumbashi",
      phone: "+243 810 000 004",
      isOpen: true,
      rating: 4.2,
      deliveryTimeMin: 30,
      deliveryFee: 2500,
    },
    {
      ownerId: owner1.id,
      vertical: "restaurant",
      name: "Quick Burger LBH",
      description: "Fast burgers, fries and cold drinks",
      category: "Fast Food",
      address: "Route Nationale, Lubumbashi",
      phone: "+243 810 000 005",
      isOpen: false,
      rating: 4.0,
      deliveryTimeMin: 15,
      deliveryFee: 1000,
    },
    {
      ownerId: owner1.id,
      vertical: "restaurant",
      name: "Boissons Tropicales",
      description: "Fresh juices, bissap, ginger beer and tropical cocktails",
      category: "Boissons",
      address: "Avenue Mobutu, Lubumbashi",
      phone: "+243 810 000 006",
      isOpen: true,
      rating: 4.7,
      deliveryTimeMin: 10,
      deliveryFee: 0,
    },
    // ── Grocery (owner1) ────────────────────────────────────────────────────
    {
      ownerId: owner1.id,
      vertical: "grocery",
      name: "Supermarché Katanga",
      description: "Épicerie de quartier — produits frais, boissons et essentiels du foyer",
      category: "Épicerie",
      address: "Avenue de l'Université, Lubumbashi",
      phone: "+243 810 000 007",
      isOpen: true,
      rating: 4.5,
      deliveryTimeMin: 40,
      deliveryFee: 2500,
    },
    // ── Pharmacy (owner2) ────────────────────────────────────────────────────
    {
      ownerId: owner2.id,
      vertical: "pharmacy",
      name: "Pharmacie Santé Plus",
      description: "Médicaments, parapharmacie et conseil santé — livraison rapide à domicile",
      category: "Pharmacie",
      address: "Avenue Kasaï, Lubumbashi",
      phone: "+243 810 000 030",
      isOpen: true,
      rating: 4.7,
      deliveryTimeMin: 20,
      deliveryFee: 1500,
    },
    // ── Retail (owner2) ──────────────────────────────────────────────────────
    {
      ownerId: owner2.id,
      vertical: "retail",
      name: "Boutique Mode LBH",
      description: "Vêtements, chaussures et accessoires pour toute la famille",
      category: "Mode & Vêtements",
      address: "Boulevard M'siri, Lubumbashi",
      phone: "+243 810 000 031",
      isOpen: true,
      rating: 4.3,
      deliveryTimeMin: 45,
      deliveryFee: 3000,
    },
    // ── Drinks bar (owner3) ──────────────────────────────────────────────────
    {
      ownerId: owner3.id,
      vertical: "drinks",
      name: "Bar-Café Makasi",
      description: "Bières locales et importées, sodas, cafés et cocktails sans alcool",
      category: "Bar & Café",
      address: "Avenue de la Gare, Lubumbashi",
      phone: "+243 810 000 040",
      isOpen: true,
      rating: 4.6,
      deliveryTimeMin: 15,
      deliveryFee: 1000,
    },
  ]).returning();

  console.log(`Created ${stores.length} stores`);

  // Convenience aliases
  const [
    storeMama,    // 0 — Chez Mama Ngozi
    storePoulet,  // 1 — Le Poulet d'Or
    storePizza,   // 2 — Pizza Roma
    storeDragon,  // 3 — Dragon Palace
    storeBurger,  // 4 — Quick Burger LBH
    storeJuices,  // 5 — Boissons Tropicales
    storeSuper,   // 6 — Supermarché Katanga
    storePharm,   // 7 — Pharmacie Santé Plus
    storeRetail,  // 8 — Boutique Mode LBH
    storeBar,     // 9 — Bar-Café Makasi
  ] = stores;

  // ── Menu items ─────────────────────────────────────────────────────────────

  type MenuItem = {
    storeId: number;
    name: string;
    description: string;
    price: number;
    category: string;
    isAvailable: boolean;
    stockQuantity?: number;
    unit?: "each" | "kg" | "g" | "L" | "pack";
    brand?: string;
  };

  const allItems = await db.insert(menuItemsTable).values([
    // ── Chez Mama Ngozi ──
    { storeId: storeMama.id, name: "Fufu + Saka-Saka", description: "Fufu de manioc avec saka-saka aux crevettes", price: 8000, category: "Plats", isAvailable: true },
    { storeId: storeMama.id, name: "Poisson Braisé", description: "Poisson du lac braisé avec bananes plantains", price: 12000, category: "Plats", isAvailable: true },
    { storeId: storeMama.id, name: "Pondu Complet", description: "Feuilles de manioc avec viande et riz", price: 9000, category: "Plats", isAvailable: true },
    { storeId: storeMama.id, name: "Brochettes de Chèvre", description: "6 brochettes marinées et grillées", price: 10000, category: "Grillades", isAvailable: true },
    { storeId: storeMama.id, name: "Jus de Bissap", description: "Jus d'hibiscus frais, sucré ou nature", price: 2000, category: "Boissons", isAvailable: true },
    // ── Le Poulet d'Or ──
    { storeId: storePoulet.id, name: "Poulet Entier Grillé", description: "Poulet entier mariné aux épices africaines", price: 18000, category: "Poulet", isAvailable: true },
    { storeId: storePoulet.id, name: "Demi-Poulet + Frites", description: "Demi-poulet grillé avec frites maison", price: 12000, category: "Poulet", isAvailable: true },
    { storeId: storePoulet.id, name: "Ailes de Poulet (6 pièces)", description: "Ailes croustillantes épicées", price: 7000, category: "Poulet", isAvailable: true },
    { storeId: storePoulet.id, name: "Cuisse de Poulet Frite", description: "Cuisse dorée, servie avec riz", price: 9000, category: "Poulet", isAvailable: true },
    { storeId: storePoulet.id, name: "Sandwich Poulet", description: "Poulet grillé, laitue, tomate, mayo", price: 5000, category: "Sandwichs", isAvailable: true },
    { storeId: storePoulet.id, name: "Coca-Cola 33cl", description: "", price: 1500, category: "Boissons", isAvailable: true },
    // ── Pizza Roma ──
    { storeId: storePizza.id, name: "Pizza Margherita", description: "Sauce tomate, mozzarella, basilic frais", price: 15000, category: "Pizzas", isAvailable: true },
    { storeId: storePizza.id, name: "Pizza Tropicale", description: "Jambon, ananas, mozzarella", price: 18000, category: "Pizzas", isAvailable: true },
    { storeId: storePizza.id, name: "Pizza 4 Fromages", description: "Mozzarella, gorgonzola, emmental, chèvre", price: 20000, category: "Pizzas", isAvailable: true },
    { storeId: storePizza.id, name: "Pizza Poulet BBQ", description: "Poulet, poivrons, oignons, sauce BBQ", price: 19000, category: "Pizzas", isAvailable: true },
    { storeId: storePizza.id, name: "Lasagnes", description: "Lasagnes à la bolognaise maison", price: 14000, category: "Pâtes", isAvailable: true },
    { storeId: storePizza.id, name: "Tiramisu", description: "Dessert classique au café et mascarpone", price: 5000, category: "Desserts", isAvailable: true },
    // ── Dragon Palace ──
    { storeId: storeDragon.id, name: "Riz Cantonnais", description: "Riz sauté aux légumes, œufs et sauce soja", price: 8000, category: "Riz", isAvailable: true },
    { storeId: storeDragon.id, name: "Chow Mein Poulet", description: "Nouilles sautées au poulet et légumes", price: 10000, category: "Nouilles", isAvailable: true },
    { storeId: storeDragon.id, name: "Raviolis Frits (8 pièces)", description: "Dumplings frits au porc", price: 7000, category: "Entrées", isAvailable: true },
    { storeId: storeDragon.id, name: "Bœuf à la Sauce d'Huître", description: "Tranches de bœuf, brocolis, sauce d'huître", price: 14000, category: "Viandes", isAvailable: true },
    { storeId: storeDragon.id, name: "Soupe de Wontons", description: "Wontons au porc en bouillon clair", price: 6000, category: "Soupes", isAvailable: true },
    { storeId: storeDragon.id, name: "Thé au Jasmin", description: "Thé vert au jasmin, chaud ou glacé", price: 2000, category: "Boissons", isAvailable: true },
    // ── Quick Burger LBH ──
    { storeId: storeBurger.id, name: "Burger Classic", description: "Bœuf 150g, cheddar, salade, tomate, oignons", price: 8000, category: "Burgers", isAvailable: true },
    { storeId: storeBurger.id, name: "Double Cheese Burger", description: "Double steak, double cheddar", price: 12000, category: "Burgers", isAvailable: true },
    { storeId: storeBurger.id, name: "Burger Poulet Crispy", description: "Filet de poulet croustillant, sauce sriracha", price: 9000, category: "Burgers", isAvailable: true },
    { storeId: storeBurger.id, name: "Frites Maison", description: "Frites croustillantes, sauce au choix", price: 3000, category: "Accompagnements", isAvailable: true },
    { storeId: storeBurger.id, name: "Milkshake Chocolat", description: "Milkshake épais au chocolat belge", price: 4000, category: "Boissons", isAvailable: false },
    // ── Boissons Tropicales ──
    { storeId: storeJuices.id, name: "Jus d'Ananas Frais", description: "100% ananas frais, sans sucre ajouté", price: 2500, category: "Jus Frais", isAvailable: true },
    { storeId: storeJuices.id, name: "Jus de Mangue", description: "Mangues locales mixées avec une touche de citron", price: 2500, category: "Jus Frais", isAvailable: true },
    { storeId: storeJuices.id, name: "Bissap (Gingembre)", description: "Hibiscus infusé au gingembre frais", price: 2000, category: "Boissons Locales", isAvailable: true },
    { storeId: storeJuices.id, name: "Cocktail Tropical", description: "Mélange maison ananas, fruit de la passion, gingembre", price: 3500, category: "Cocktails", isAvailable: true },
    { storeId: storeJuices.id, name: "Smoothie Avocat-Citron", description: "Avocat, citron vert, lait de coco", price: 3000, category: "Smoothies", isAvailable: true },
    { storeId: storeJuices.id, name: "Eau Minérale 1L", description: "Eau minérale fraîche", price: 1000, category: "Eau", isAvailable: true },
    // ── Supermarché Katanga ──
    { storeId: storeSuper.id, name: "Riz Parfumé", description: "Sac de riz long grain", price: 25000, category: "Céréales", isAvailable: true, stockQuantity: 40, unit: "pack" as const, brand: "Riz du Katanga" },
    { storeId: storeSuper.id, name: "Bananes Plantains", description: "Vendues au kilo", price: 3000, category: "Fruits & Légumes", isAvailable: true, stockQuantity: 80, unit: "kg" as const },
    { storeId: storeSuper.id, name: "Tomates Fraîches", description: "Tomates locales, au kilo", price: 2500, category: "Fruits & Légumes", isAvailable: true, stockQuantity: 60, unit: "kg" as const },
    { storeId: storeSuper.id, name: "Huile de Palme 1L", description: "Huile de palme rouge", price: 6000, category: "Épicerie", isAvailable: true, stockQuantity: 30, unit: "each" as const, brand: "Congo Palm" },
    { storeId: storeSuper.id, name: "Farine de Manioc", description: "Farine de manioc, paquet 1kg", price: 4000, category: "Céréales", isAvailable: true, stockQuantity: 50, unit: "pack" as const },
    { storeId: storeSuper.id, name: "Savon de Ménage", description: "Savon multi-usage", price: 1500, category: "Maison", isAvailable: true, stockQuantity: 100, unit: "each" as const, brand: "Savonnerie LBH" },
    { storeId: storeSuper.id, name: "Lait en Poudre 400g", description: "Lait entier en poudre", price: 8000, category: "Produits Laitiers", isAvailable: true, stockQuantity: 25, unit: "each" as const, brand: "Nido" },
    { storeId: storeSuper.id, name: "Œufs (Plateau de 30)", description: "Plateau de 30 œufs frais", price: 12000, category: "Produits Laitiers", isAvailable: true, stockQuantity: 20, unit: "pack" as const },
    // ── Pharmacie Santé Plus ──
    { storeId: storePharm.id, name: "Paracétamol 500mg ×16", description: "Antalgique et antipyrétique, boîte de 16 comprimés", price: 2500, category: "Antalgiques", isAvailable: true, stockQuantity: 200, unit: "pack" as const, brand: "Doliprane" },
    { storeId: storePharm.id, name: "Ibuprofène 400mg ×20", description: "Anti-inflammatoire non stéroïdien", price: 4000, category: "Anti-inflammatoires", isAvailable: true, stockQuantity: 150, unit: "pack" as const },
    { storeId: storePharm.id, name: "Masques Chirurgicaux ×50", description: "Masques à usage unique, boîte de 50", price: 6000, category: "Protection", isAvailable: true, stockQuantity: 80, unit: "pack" as const },
    { storeId: storePharm.id, name: "Gel Hydroalcoolique 500ml", description: "Solution désinfectante pour les mains", price: 5000, category: "Hygiène", isAvailable: true, stockQuantity: 60, unit: "each" as const },
    { storeId: storePharm.id, name: "Vitamines C 1000mg ×30", description: "Complément alimentaire immunisant", price: 8000, category: "Compléments", isAvailable: true, stockQuantity: 100, unit: "pack" as const },
    { storeId: storePharm.id, name: "Thermomètre Numérique", description: "Thermomètre digital auriculaire", price: 15000, category: "Matériel", isAvailable: true, stockQuantity: 30, unit: "each" as const },
    // ── Boutique Mode LBH ──
    { storeId: storeRetail.id, name: "T-Shirt Classique", description: "T-shirt 100% coton, disponible en plusieurs couleurs, S-XXL", price: 12000, category: "Hauts", isAvailable: true, stockQuantity: 50, unit: "each" as const },
    { storeId: storeRetail.id, name: "Robe Wax Africaine", description: "Robe en tissu wax à motifs congolais", price: 35000, category: "Robes", isAvailable: true, stockQuantity: 20, unit: "each" as const },
    { storeId: storeRetail.id, name: "Jean Slim Homme", description: "Jean slim stretch, bleu classique, 28-42", price: 28000, category: "Pantalons", isAvailable: true, stockQuantity: 30, unit: "each" as const },
    { storeId: storeRetail.id, name: "Sandales Cuir", description: "Sandales en cuir artisanal, homme/femme", price: 22000, category: "Chaussures", isAvailable: true, stockQuantity: 40, unit: "each" as const },
    { storeId: storeRetail.id, name: "Sac à Main Wax", description: "Sac en tissu wax imprimé, fermeture zippée", price: 18000, category: "Accessoires", isAvailable: true, stockQuantity: 25, unit: "each" as const },
    // ── Bar-Café Makasi ──
    { storeId: storeBar.id, name: "Primus 65cl", description: "Bière locale congolaise, bouteille 65cl", price: 3000, category: "Bières Locales", isAvailable: true },
    { storeId: storeBar.id, name: "Heineken 33cl", description: "Bière internationale, canette 33cl", price: 4500, category: "Bières Importées", isAvailable: true },
    { storeId: storeBar.id, name: "Coca-Cola 50cl", description: "Soda classique en bouteille", price: 2000, category: "Sodas", isAvailable: true },
    { storeId: storeBar.id, name: "Café Espresso", description: "Double espresso serré, grains locaux", price: 2500, category: "Cafés", isAvailable: true },
    { storeId: storeBar.id, name: "Mocktail Passion", description: "Fruit de la passion, citron vert, sirop de canne, soda", price: 4000, category: "Cocktails Sans Alcool", isAvailable: true },
    { storeId: storeBar.id, name: "Eau Minérale 50cl", description: "Eau fraîche", price: 1000, category: "Eau", isAvailable: true },
  ] as MenuItem[]).returning();

  console.log(`Created ${allItems.length} menu items`);

  // Build a lookup: storeId → items (for easy order construction)
  const itemsByStore = new Map<number, typeof allItems>();
  for (const item of allItems) {
    const storeId = (item as any).storeId as number;
    if (!itemsByStore.has(storeId)) itemsByStore.set(storeId, []);
    itemsByStore.get(storeId)!.push(item);
  }

  const pick = (storeId: number, idx: number) => itemsByStore.get(storeId)![idx];

  // ── Orders ─────────────────────────────────────────────────────────────────
  // Cover every order status + every payment state combination:
  //   pending          → cash / pending
  //   confirmed        → mobile_money / submitted
  //   preparing        → cash / pending
  //   ready_for_pickup → mobile_money / confirmed
  //   picked_up        → cash / pending
  //   delivered (×2)   → cash / paid  AND  mobile_money / confirmed
  //   cancelled        → mobile_money / failed

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000);

  const orders = await db.insert(ordersTable).values([
    // 1. PENDING — cash/pending
    {
      customerId: customer1.id,
      restaurantId: storeMama.id,
      restaurantName: storeMama.name,
      status: "pending" as const,
      paymentMethod: "cash" as const,
      paymentStatus: "pending" as const,
      deliveryAddress: "Avenue des Savonniers, Lubumbashi",
      customerPhone: customer1.phone,
      items: [
        { menuItemId: pick(storeMama.id, 0).id, name: pick(storeMama.id, 0).name, price: pick(storeMama.id, 0).price, quantity: 2 },
        { menuItemId: pick(storeMama.id, 4).id, name: pick(storeMama.id, 4).name, price: pick(storeMama.id, 4).price, quantity: 1 },
      ],
      subtotal: pick(storeMama.id, 0).price * 2 + pick(storeMama.id, 4).price,
      deliveryFee: storeMama.deliveryFee,
      total: pick(storeMama.id, 0).price * 2 + pick(storeMama.id, 4).price + storeMama.deliveryFee,
      discountAmount: 0,
      createdAt: hoursAgo(0.5),
      updatedAt: hoursAgo(0.5),
    },
    // 2. CONFIRMED — mobile_money/submitted
    {
      customerId: customer2.id,
      restaurantId: storePoulet.id,
      restaurantName: storePoulet.name,
      status: "confirmed" as const,
      paymentMethod: "mobile_money" as const,
      paymentStatus: "submitted" as const,
      paymentProvider: "M-Pesa",
      paymentReference: "MPESA-2024-00123",
      paymentPhone: "+243810000020",
      paymentRequestedAt: hoursAgo(1),
      deliveryAddress: "Avenue Lumumba, Lubumbashi",
      customerPhone: customer2.phone,
      items: [
        { menuItemId: pick(storePoulet.id, 1).id, name: pick(storePoulet.id, 1).name, price: pick(storePoulet.id, 1).price, quantity: 1 },
        { menuItemId: pick(storePoulet.id, 5).id, name: pick(storePoulet.id, 5).name, price: pick(storePoulet.id, 5).price, quantity: 2 },
      ],
      subtotal: pick(storePoulet.id, 1).price + pick(storePoulet.id, 5).price * 2,
      deliveryFee: storePoulet.deliveryFee,
      total: pick(storePoulet.id, 1).price + pick(storePoulet.id, 5).price * 2 + storePoulet.deliveryFee,
      discountAmount: 0,
      createdAt: hoursAgo(1.5),
      updatedAt: hoursAgo(1),
    },
    // 3. PREPARING — cash/pending
    {
      customerId: customer1.id,
      restaurantId: storePizza.id,
      restaurantName: storePizza.name,
      status: "preparing" as const,
      paymentMethod: "cash" as const,
      paymentStatus: "pending" as const,
      deliveryAddress: "Boulevard M'siri, Lubumbashi",
      customerPhone: customer1.phone,
      items: [
        { menuItemId: pick(storePizza.id, 0).id, name: pick(storePizza.id, 0).name, price: pick(storePizza.id, 0).price, quantity: 1 },
        { menuItemId: pick(storePizza.id, 5).id, name: pick(storePizza.id, 5).name, price: pick(storePizza.id, 5).price, quantity: 2 },
      ],
      subtotal: pick(storePizza.id, 0).price + pick(storePizza.id, 5).price * 2,
      deliveryFee: storePizza.deliveryFee,
      total: pick(storePizza.id, 0).price + pick(storePizza.id, 5).price * 2 + storePizza.deliveryFee,
      discountAmount: 0,
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(1.5),
    },
    // 4. READY_FOR_PICKUP — mobile_money/confirmed
    {
      customerId: customer2.id,
      driverId: driver1.id,
      restaurantId: storeDragon.id,
      restaurantName: storeDragon.name,
      status: "ready_for_pickup" as const,
      paymentMethod: "mobile_money" as const,
      paymentStatus: "confirmed" as const,
      paymentProvider: "Airtel Money",
      paymentReference: "AIRTEL-2024-00456",
      paymentPhone: "+243810000020",
      paymentRequestedAt: hoursAgo(3),
      paymentConfirmedAt: hoursAgo(2.5),
      deliveryAddress: "Avenue Kasaï, Lubumbashi",
      customerPhone: customer2.phone,
      items: [
        { menuItemId: pick(storeDragon.id, 0).id, name: pick(storeDragon.id, 0).name, price: pick(storeDragon.id, 0).price, quantity: 2 },
        { menuItemId: pick(storeDragon.id, 2).id, name: pick(storeDragon.id, 2).name, price: pick(storeDragon.id, 2).price, quantity: 1 },
      ],
      subtotal: pick(storeDragon.id, 0).price * 2 + pick(storeDragon.id, 2).price,
      deliveryFee: storeDragon.deliveryFee,
      total: pick(storeDragon.id, 0).price * 2 + pick(storeDragon.id, 2).price + storeDragon.deliveryFee,
      discountAmount: 0,
      createdAt: hoursAgo(3.5),
      updatedAt: hoursAgo(2.5),
    },
    // 5. PICKED_UP — cash/pending
    {
      customerId: customer1.id,
      driverId: driver2.id,
      restaurantId: storeJuices.id,
      restaurantName: storeJuices.name,
      status: "picked_up" as const,
      paymentMethod: "cash" as const,
      paymentStatus: "pending" as const,
      deliveryAddress: "Avenue des Sports, Lubumbashi",
      customerPhone: customer1.phone,
      items: [
        { menuItemId: pick(storeJuices.id, 0).id, name: pick(storeJuices.id, 0).name, price: pick(storeJuices.id, 0).price, quantity: 2 },
        { menuItemId: pick(storeJuices.id, 2).id, name: pick(storeJuices.id, 2).name, price: pick(storeJuices.id, 2).price, quantity: 1 },
      ],
      subtotal: pick(storeJuices.id, 0).price * 2 + pick(storeJuices.id, 2).price,
      deliveryFee: storeJuices.deliveryFee,
      total: pick(storeJuices.id, 0).price * 2 + pick(storeJuices.id, 2).price + storeJuices.deliveryFee,
      discountAmount: 0,
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(1),
    },
    // 6. DELIVERED — cash/paid (cashConfirmed: true)
    {
      customerId: customer1.id,
      driverId: driver1.id,
      restaurantId: storeMama.id,
      restaurantName: storeMama.name,
      status: "delivered" as const,
      paymentMethod: "cash" as const,
      paymentStatus: "paid" as const,
      cashConfirmed: true,
      deliveryAddress: "Avenue des Savonniers, Lubumbashi",
      customerPhone: customer1.phone,
      items: [
        { menuItemId: pick(storeMama.id, 1).id, name: pick(storeMama.id, 1).name, price: pick(storeMama.id, 1).price, quantity: 1 },
        { menuItemId: pick(storeMama.id, 3).id, name: pick(storeMama.id, 3).name, price: pick(storeMama.id, 3).price, quantity: 1 },
        { menuItemId: pick(storeMama.id, 4).id, name: pick(storeMama.id, 4).name, price: pick(storeMama.id, 4).price, quantity: 2 },
      ],
      subtotal: pick(storeMama.id, 1).price + pick(storeMama.id, 3).price + pick(storeMama.id, 4).price * 2,
      deliveryFee: storeMama.deliveryFee,
      total: pick(storeMama.id, 1).price + pick(storeMama.id, 3).price + pick(storeMama.id, 4).price * 2 + storeMama.deliveryFee,
      discountAmount: 0,
      createdAt: hoursAgo(25),
      updatedAt: hoursAgo(23),
    },
    // 7. DELIVERED — mobile_money/confirmed
    {
      customerId: customer2.id,
      driverId: driver2.id,
      restaurantId: storePoulet.id,
      restaurantName: storePoulet.name,
      status: "delivered" as const,
      paymentMethod: "mobile_money" as const,
      paymentStatus: "confirmed" as const,
      paymentProvider: "M-Pesa",
      paymentReference: "MPESA-2024-00789",
      paymentPhone: "+243810000020",
      paymentRequestedAt: hoursAgo(50),
      paymentConfirmedAt: hoursAgo(48),
      deliveryAddress: "Avenue Lumumba, Lubumbashi",
      customerPhone: customer2.phone,
      items: [
        { menuItemId: pick(storePoulet.id, 0).id, name: pick(storePoulet.id, 0).name, price: pick(storePoulet.id, 0).price, quantity: 1 },
        { menuItemId: pick(storePoulet.id, 5).id, name: pick(storePoulet.id, 5).name, price: pick(storePoulet.id, 5).price, quantity: 3 },
      ],
      subtotal: pick(storePoulet.id, 0).price + pick(storePoulet.id, 5).price * 3,
      deliveryFee: storePoulet.deliveryFee,
      total: pick(storePoulet.id, 0).price + pick(storePoulet.id, 5).price * 3 + storePoulet.deliveryFee,
      discountAmount: 0,
      createdAt: hoursAgo(52),
      updatedAt: hoursAgo(48),
    },
    // 8. CANCELLED — mobile_money/failed
    {
      customerId: customer2.id,
      restaurantId: storeBar.id,
      restaurantName: storeBar.name,
      status: "cancelled" as const,
      paymentMethod: "mobile_money" as const,
      paymentStatus: "failed" as const,
      paymentProvider: "Airtel Money",
      paymentReference: "AIRTEL-BAD-0001",
      paymentPhone: "+243810000020",
      paymentRequestedAt: hoursAgo(10),
      paymentConfirmedAt: hoursAgo(9),
      deliveryAddress: "Avenue Lumumba, Lubumbashi",
      customerPhone: customer2.phone,
      notes: "Paiement refusé — référence incorrecte",
      items: [
        { menuItemId: pick(storeBar.id, 0).id, name: pick(storeBar.id, 0).name, price: pick(storeBar.id, 0).price, quantity: 4 },
        { menuItemId: pick(storeBar.id, 4).id, name: pick(storeBar.id, 4).name, price: pick(storeBar.id, 4).price, quantity: 2 },
      ],
      subtotal: pick(storeBar.id, 0).price * 4 + pick(storeBar.id, 4).price * 2,
      deliveryFee: storeBar.deliveryFee,
      total: pick(storeBar.id, 0).price * 4 + pick(storeBar.id, 4).price * 2 + storeBar.deliveryFee,
      discountAmount: 0,
      createdAt: hoursAgo(11),
      updatedAt: hoursAgo(9),
    },
  ]).returning();

  console.log(`Created ${orders.length} orders`);

  // orders[5] = delivered cash, orders[6] = delivered mobile_money
  const deliveredCash = orders[5];
  const deliveredMM   = orders[6];

  // ── Reviews ────────────────────────────────────────────────────────────────

  await db.insert(reviewsTable).values([
    {
      orderId: deliveredCash.id,
      customerId: customer1.id,
      restaurantId: storeMama.id,
      driverId: driver1.id,
      restaurantRating: 5,
      driverRating: 5,
      comment: "Fufu excellent, poisson bien braisé ! Livreur très rapide et souriant. Je recommande vivement Chez Mama Ngozi.",
    },
    {
      orderId: deliveredMM.id,
      customerId: customer2.id,
      restaurantId: storePoulet.id,
      driverId: driver2.id,
      restaurantRating: 4,
      driverRating: 5,
      comment: "Poulet bien cuit et chaud à la livraison. Paiement M-Pesa sans problème. Juste un peu d'attente mais ça valait le coup.",
    },
  ]);

  console.log("Created 2 reviews");
  console.log("Seeding complete! ✓");
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
