import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerEmail = process.env.OWNER_EMAIL;

if (!url || !serviceRoleKey || !ownerEmail) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY u OWNER_EMAIL.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await supabase.rpc("bootstrap_system_owner", {
  p_email: ownerEmail,
  p_display_name: "Lilith D'Amico",
});

if (error) {
  console.error(`No fue posible crear el propietario: ${error.message}`);
  process.exit(1);
}

console.log(`Propietario configurado correctamente (${data}).`);
