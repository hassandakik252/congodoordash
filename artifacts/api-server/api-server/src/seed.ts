import { db } from "@workspace/db";
import { restaurantsTable, menuItemsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding demo restaurants...");

  const existing = await db.select().from(restaurantsTable).limit(1);
  if (existing.length > 0) {
    console.log("Data already seeded. Skipping.");
    return;
  }

  // Create a system owner user
  const hash = await bcrypt.hash("admin1234", 10);
  const [owner] = await db.insert(usersTable).values({
    email: "owner@deliverlbh.com",
    passwordHash: hash,
    name: "Admin Owner",
    phone: "+243810000000",
    role: "restaurant_owner",
  }).returning();
  console.log(`Created system owner: ${owner.email}`);

  // Create restaurants
  const restaurants = await db.insert(restaurantsTable).values([
    {
      ownerId: owner.id,
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
      ownerId: owner.id,
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
      ownerId: owner.id,
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
      ownerId: owner.id,
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
      ownerId: owner.id,
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
      ownerId: owner.id,
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
  ]).returning();

  console.log(`Created ${restaurants.length} restaurants`);

  // Seed menu items per restaurant
  const menuData: Array<{
    restaurantId: number;
    items: Array<{
      name: string;
      description: string;
      price: number;
      category: string;
      isAvailable: boolean;
    }>;
  }> = [
    {
      restaurantId: restaurants[0].id,
      items: [
        { name: "Fufu + Saka-Saka", description: "Fufu de manioc avec saka-saka aux crevettes", price: 8000, category: "Plats", isAvailable: true },
        { name: "Poisson Braisé", description: "Poisson du lac braisé avec bananes plantains", price: 12000, category: "Plats", isAvailable: true },
        { name: "Pondu Complet", description: "Feuilles de manioc avec viande et riz", price: 9000, category: "Plats", isAvailable: true },
        { name: "Brochettes de Chèvre", description: "6 brochettes marinées et grillées", price: 10000, category: "Grillades", isAvailable: true },
        { name: "Jus de Bissap", description: "Jus d'hibiscus frais, sucré ou nature", price: 2000, category: "Boissons", isAvailable: true },
      ],
    },
    {
      restaurantId: restaurants[1].id,
      items: [
        { name: "Poulet Entier Grillé", description: "Poulet entier mariné aux épices africaines", price: 18000, category: "Poulet", isAvailable: true },
        { name: "Demi-Poulet + Frites", description: "Demi-poulet grillé avec frites maison", price: 12000, category: "Poulet", isAvailable: true },
        { name: "Ailes de Poulet (6 pièces)", description: "Ailes croustillantes épicées", price: 7000, category: "Poulet", isAvailable: true },
        { name: "Cuisse de Poulet Frite", description: "Cuisse dorée, servie avec riz", price: 9000, category: "Poulet", isAvailable: true },
        { name: "Sandwich Poulet", description: "Poulet grillé, laitue, tomate, mayo", price: 5000, category: "Sandwichs", isAvailable: true },
        { name: "Coca-Cola 33cl", description: "", price: 1500, category: "Boissons", isAvailable: true },
      ],
    },
    {
      restaurantId: restaurants[2].id,
      items: [
        { name: "Pizza Margherita", description: "Sauce tomate, mozzarella, basilic frais", price: 15000, category: "Pizzas", isAvailable: true },
        { name: "Pizza Tropicale", description: "Jambon, ananas, mozzarella", price: 18000, category: "Pizzas", isAvailable: true },
        { name: "Pizza 4 Fromages", description: "Mozzarella, gorgonzola, emmental, chèvre", price: 20000, category: "Pizzas", isAvailable: true },
        { name: "Pizza Poulet BBQ", description: "Poulet, poivrons, oignons, sauce BBQ", price: 19000, category: "Pizzas", isAvailable: true },
        { name: "Lasagnes", description: "Lasagnes à la bolognaise maison", price: 14000, category: "Pâtes", isAvailable: true },
        { name: "Tiramisu", description: "Dessert classique au café et mascarpone", price: 5000, category: "Desserts", isAvailable: true },
      ],
    },
    {
      restaurantId: restaurants[3].id,
      items: [
        { name: "Riz Cantonnais", description: "Riz sauté aux légumes, œufs et sauce soja", price: 8000, category: "Riz", isAvailable: true },
        { name: "Chow Mein Poulet", description: "Nouilles sautées au poulet et légumes", price: 10000, category: "Nouilles", isAvailable: true },
        { name: "Raviolis Frits (8 pièces)", description: "Dumplings frits au porc", price: 7000, category: "Entrées", isAvailable: true },
        { name: "Bœuf à la Sauce d'Huître", description: "Tranches de bœuf, brocolis, sauce d'huître", price: 14000, category: "Viandes", isAvailable: true },
        { name: "Soupe de Wontons", description: "Wontons au porc en bouillon clair", price: 6000, category: "Soupes", isAvailable: true },
        { name: "Thé au Jasmin", description: "Thé vert au jasmin, chaud ou glacé", price: 2000, category: "Boissons", isAvailable: true },
      ],
    },
    {
      restaurantId: restaurants[4].id,
      items: [
        { name: "Burger Classic", description: "Bœuf 150g, cheddar, salade, tomate, oignons", price: 8000, category: "Burgers", isAvailable: true },
        { name: "Double Cheese Burger", description: "Double steak, double cheddar", price: 12000, category: "Burgers", isAvailable: true },
        { name: "Burger Poulet Crispy", description: "Filet de poulet croustillant, sauce sriracha", price: 9000, category: "Burgers", isAvailable: true },
        { name: "Frites Maison", description: "Frites croustillantes, sauce au choix", price: 3000, category: "Accompagnements", isAvailable: true },
        { name: "Milkshake Chocolat", description: "Milkshake épais au chocolat belge", price: 4000, category: "Boissons", isAvailable: false },
      ],
    },
    {
      restaurantId: restaurants[5].id,
      items: [
        { name: "Jus d'Ananas Frais", description: "100% ananas frais, sans sucre ajouté", price: 2500, category: "Jus Frais", isAvailable: true },
        { name: "Jus de Mangue", description: "Mangues locales mixées avec une touche de citron", price: 2500, category: "Jus Frais", isAvailable: true },
        { name: "Bissap (Gingembre)", description: "Hibiscus infusé au gingembre frais", price: 2000, category: "Boissons Locales", isAvailable: true },
        { name: "Cocktail Tropical", description: "Mélange maison ananas, fruit de la passion, gingembre", price: 3500, category: "Cocktails", isAvailable: true },
        { name: "Smoothie Avocat-Citron", description: "Avocat, citron vert, lait de coco", price: 3000, category: "Smoothies", isAvailable: true },
        { name: "Eau Minérale 1L", description: "Eau minérale fraîche", price: 1000, category: "Eau", isAvailable: true },
      ],
    },
  ];

  for (const { restaurantId, items } of menuData) {
    const toInsert = items.map(item => ({ restaurantId, ...item }));
    await db.insert(menuItemsTable).values(toInsert);
  }

  const totalItems = menuData.reduce((s, r) => s + r.items.length, 0);
  console.log(`Created ${totalItems} menu items`);
  console.log("Seeding complete!");
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
