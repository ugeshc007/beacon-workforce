import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

// One-shot seed: provision Everfresh tenant. Idempotent.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const supabase = createSupabaseAdmin();

    const name = "Everfresh";
    const slug = "everfresh";
    const domain = "planner.everfresh.ae";
    const admin_email = "info@everfresh.ae";
    const admin_name = "Everfresh Admin";
    const temp_password = "Everfresh@2026";

    // company
    let { data: company } = await supabase
      .from("companies").select("*").eq("slug", slug).maybeSingle();
    if (!company) {
      const ins = await supabase.from("companies").insert({
        name, slug, domain,
        contact_email: admin_email,
        primary_color: "#0EA5E9",
        accent_color: "#0F172A",
        currency: "AED",
        timezone: "Asia/Dubai",
        locale: "en",
        plan: "standard",
        is_active: true,
      }).select().single();
      if (ins.error) return errorResponse("company: " + ins.error.message, 400);
      company = ins.data;
    }

    // features
    const allModules = ["dashboard","projects","maintenance","site_visits","employees","schedule","attendance","travel","timesheets","reports","settings"];
    const { data: existingFeatures } = await supabase
      .from("company_features").select("module").eq("company_id", company.id);
    const existingMods = new Set((existingFeatures ?? []).map((f: any) => f.module));
    const newFeatures = allModules.filter((m) => !existingMods.has(m))
      .map((m) => ({ company_id: company.id, module: m, enabled: true }));
    if (newFeatures.length) await supabase.from("company_features").insert(newFeatures);

    // branch
    let { data: branch } = await supabase
      .from("branches").select("*").eq("company_id", company.id).limit(1).maybeSingle();
    if (!branch) {
      const ins = await supabase.from("branches").insert({
        company_id: company.id,
        name: `${name} HQ`,
        timezone: "Asia/Dubai",
        is_active: true,
      }).select().single();
      branch = ins.data;
    }

    // auth user
    let authUserId: string | null = null;
    const { data: list } = await supabase.auth.admin.listUsers();
    const found = list?.users?.find((u) => u.email?.toLowerCase() === admin_email);
    if (found) {
      authUserId = found.id;
      // reset password to temp
      await supabase.auth.admin.updateUserById(found.id, { password: temp_password, email_confirm: true });
    } else {
      const created = await supabase.auth.admin.createUser({
        email: admin_email,
        password: temp_password,
        email_confirm: true,
        user_metadata: { full_name: admin_name, company_id: company.id },
      });
      if (created.error) return errorResponse("auth: " + created.error.message, 400);
      authUserId = created.data.user!.id;
    }

    // users row
    const { data: existingUserRow } = await supabase
      .from("users").select("id").eq("auth_id", authUserId).maybeSingle();
    let userRowId: string;
    if (existingUserRow) {
      await supabase.from("users").update({
        company_id: company.id, name: admin_name, branch_id: branch?.id ?? null, email: admin_email,
      }).eq("id", existingUserRow.id);
      userRowId = existingUserRow.id;
    } else {
      const ins = await supabase.from("users").insert({
        auth_id: authUserId, email: admin_email, name: admin_name,
        company_id: company.id, branch_id: branch?.id ?? null,
      }).select("id").single();
      if (ins.error) return errorResponse("users: " + ins.error.message, 500);
      userRowId = ins.data.id;
    }

    // admin role
    await supabase.from("user_roles").upsert(
      { user_id: userRowId, role: "admin" }, { onConflict: "user_id,role" }
    );

    return jsonResponse({
      success: true,
      company,
      branch,
      admin_user_id: userRowId,
      admin_email,
      temp_password,
      login_url: `https://${domain}/auth`,
    });
  } catch (e) {
    return errorResponse(String(e), 500);
  }
});
