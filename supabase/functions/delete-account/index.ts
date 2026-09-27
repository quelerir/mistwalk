// Called by the client (with the signed-in user's JWT) when they choose "Delete account" in
// the app. Deletes the auth user, which Postgres cascades through player_profiles,
// visited_points, discovered_places, follows and feedback (all `on delete cascade`), then
// best-effort removes the user's avatar file from the `avatars` storage bucket, which is not
// covered by any foreign key.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response("Unauthorized", { status: 401, headers: CORS });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("delete-account: failed to delete user", user.id, deleteError);
    return new Response("Could not delete account", { status: 500, headers: CORS });
  }

  const { data: avatarFiles } = await adminClient.storage.from("avatars").list(user.id);
  if (avatarFiles && avatarFiles.length > 0) {
    const paths = avatarFiles.map((f) => `${user.id}/${f.name}`);
    const { error: storageError } = await adminClient.storage.from("avatars").remove(paths);
    if (storageError) {
      // The account is already gone; a leftover avatar file is not worth failing the request over.
      console.error("delete-account: failed to remove avatar files for", user.id, storageError);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
