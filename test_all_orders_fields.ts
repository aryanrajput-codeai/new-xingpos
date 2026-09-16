import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uhvxkulqovkasewxfais.supabase.co";
const supabaseKey = "sb_publishable_935p_1HOmvJr1p9dhFlb2g_zMA957jI";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Querying all orders columns in a single select query...");
  const cols = [
    "id",
    "customer_name",
    "phone_number",
    "customer_phone",
    "email",
    "order_type",
    "table_number",
    "address",
    "items",
    "subtotal",
    "gst",
    "tax",
    "discount",
    "service_charge",
    "packaging_charge",
    "discount_amount",
    "applied_coupon",
    "grand_total",
    "payment_status",
    "order_status",
    "created_at",
    "payment_method",
    "kot_number",
    "restaurant_id"
  ];
  
  const queryStr = cols.join(",");
  const { data, error } = await supabase.from("orders").select(queryStr).limit(1);
  if (error) {
    console.error("Single select query FAILED with error:", error);
  } else {
    console.log("Single select query SUCCEEDED! Result:", data);
  }
}

run();
