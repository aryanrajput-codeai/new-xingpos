import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uhvxkulqovkasewxfais.supabase.co";
const supabaseKey = "sb_publishable_935p_1HOmvJr1p9dhFlb2g_zMA957jI";
const supabase = createClient(supabaseUrl, supabaseKey);

function stringToNumericId(str: string): number {
  if (!str) return 0;
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash) % 9007199254740991;
}

async function run() {
  console.log("Detecting menu_items table columns dynamically...");
  const candidateColumns = [
    "id", "name", "item_name", "price", "category", "description", 
    "is_veg", "is_bestseller", "is_chef_special", "image", "image_url", 
    "spiciness", "rating", "rating_count"
  ];
  
  const supported: string[] = [];
  for (const col of candidateColumns) {
    try {
      const { error } = await supabase.from("menu_items").select(col).limit(1);
      if (!error || error.code !== "42703") {
        supported.push(col);
      }
    } catch (e) {
      // ignore
    }
  }
  console.log("Supported columns:", supported);

  const testItem = {
    id: "item-test-dynamic-999",
    name: "Robust Paneer Tikka Masala",
    price: 345.50,
    category: "Main Course",
    description: "Incredibly delicious, dynamic, and robustly mapped!",
    isVeg: true,
    isBestseller: true,
    isChefSpecial: true,
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500",
    spiciness: 2,
    rating: 4.9,
    ratingCount: 42
  };

  const numericId = stringToNumericId(testItem.id);
  const payload: any = { id: numericId };
  
  if (supported.includes("name")) payload.name = testItem.name;
  if (supported.includes("item_name")) payload.item_name = testItem.name;
  if (supported.includes("price")) payload.price = Number(testItem.price || 0);
  if (supported.includes("category")) payload.category = testItem.category;
  if (supported.includes("description")) payload.description = testItem.description;
  if (supported.includes("is_veg")) payload.is_veg = testItem.isVeg;
  if (supported.includes("is_bestseller")) payload.is_bestseller = !!testItem.isBestseller;
  if (supported.includes("is_chef_special")) payload.is_chef_special = !!testItem.isChefSpecial;
  if (supported.includes("image")) payload.image = testItem.image;
  if (supported.includes("image_url")) payload.image_url = testItem.image;
  if (supported.includes("spiciness")) payload.spiciness = Number(testItem.spiciness || 0);
  if (supported.includes("rating")) payload.rating = Number(testItem.rating || 4.5);
  if (supported.includes("rating_count")) payload.rating_count = Number(testItem.ratingCount || 10);

  console.log("Saving test item to Supabase with mapped ID:", numericId, "Payload:", payload);
  const { data, error } = await supabase.from("menu_items").upsert([payload]);
  
  if (error) {
    console.error("TEST FAILED:", error);
  } else {
    console.log("TEST PASSED! Dynamic menu catalog upsert is fully operational!");
    
    console.log("Attempting fetch to verify...");
    const { data: fetched, error: fetchErr } = await supabase.from("menu_items").select("*").eq("id", numericId);
    if (fetchErr) {
      console.error("Fetch verification failed:", fetchErr);
    } else {
      console.log("Fetch verification succeeded! Record:", fetched);
    }
  }
}

run();
