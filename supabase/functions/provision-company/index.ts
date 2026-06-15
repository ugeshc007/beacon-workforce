import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

// Super-admin only: provision a brand-new tenant company.
// - Creates the company row
// - Seeds company_features for selected modules
// - Creates a default branch
// - Creates an auth user for the company admin (or finds existing)
// - Creates the users row + assigns 'admin' role scoped to the new company
// - Sends an invite / password reset email so the admin can set their password
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();

    // ---- Auth: caller must be super_admin ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !caller) return errorResponse("Unauthorized", 401);

    const { data: callerUser } = await supabase
      .from("users").select("id").eq("auth_id", caller.id).single();
    if (!callerUser) return errorResponse("Caller not found", 403);

    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", callerUser.id).eq("role", "super_admin").maybeSingle();
    if (!roleRow) return errorResponse("Only super admins can provision companies", 403);

    // ---- Input ----
    const body = await req.json();
    const {
      name, slug, domain, contact_email, contact_phone,
      primary_color, accent_color, currency, timezone, locale, plan,
      logo_url, modules, admin_email, admin_name, branch_name,
      temp_password,
    } = body || {};


    if (!name || !slug || !admin_email) {
      return errorResponse("name, slug, and admin_email are required");
    }
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) {
      return errorResponse("Invalid slug format");
    }

    // ---- Create company ----
    const { data: company, error: cErr } = await supabase
      .from("companies")
      .insert({
        name, slug,
        domain: domain || null,
        contact_email: contact_email || admin_email,
        contact_phone: contact_phone || null,
        primary_color: primary_color || "#0EA5E9",
        accent_color: accent_color || "#0F172A",
        currency: currency || "AED",
        timezone: timezone || "Asia/Dubai",
        locale: locale || "en",
        plan: plan || "standard",
        logo_url: logo_url || null,
        is_active: true,
      })
      .select()
      .single();
    if (cErr) return errorResponse(cErr.message, 400);

    // ---- Seed company_features ----
    const allModules = ["dashboard","projects","maintenance","site_visits","employees","schedule","attendance","travel","timesheets","reports","settings"];
    const selected: string[] = Array.isArray(modules) && modules.length ? modules : allModules;
    const featureRows = allModules.map((m) => ({
      company_id: company.id,
      module: m,
      enabled: selected.includes(m),
    }));
    await supabase.from("company_features").insert(featureRows);

    // ---- Default branch ----
    const { data: branch } = await supabase
      .from("branches")
      .insert({
        company_id: company.id,
        name: branch_name || `${name} HQ`,
        timezone: timezone || "Asia/Dubai",
        is_active: true,
      })
      .select()
      .single();

    // ---- Create / find auth user for admin ----
    let authUserId: string | null = null;
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users?.find((u) => u.email?.toLowerCase() === admin_email.toLowerCase());
    if (found) {
      authUserId = found.id;
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: admin_email,
        password: temp_password || undefined,
        email_confirm: true,
        user_metadata: { full_name: admin_name || admin_email, company_id: company.id },
      });
      if (createErr) {
        // rollback company
        await supabase.from("companies").delete().eq("id", company.id);
        return errorResponse("Failed to create admin auth user: " + createErr.message, 400);
      }
      authUserId = created.user!.id;

    }

    // ---- Ensure users row, scoped to new company ----
    const { data: existingUserRow } = await supabase
      .from("users").select("id, company_id").eq("auth_id", authUserId!).maybeSingle();

    let userRowId: string;
    if (existingUserRow) {
      // Re-scope (super-admin override) to the new company so role + company match
      await supabase.from("users").update({
        company_id: company.id,
        name: admin_name || existingUserRow.id,
        branch_id: branch?.id ?? null,
      }).eq("id", existingUserRow.id);
      userRowId = existingUserRow.id;
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("users")
        .insert({
          auth_id: authUserId,
          email: admin_email,
          name: admin_name || admin_email.split("@")[0],
          company_id: company.id,
          branch_id: branch?.id ?? null,
        })
        .select("id")
        .single();
      if (insErr) return errorResponse(insErr.message, 500);
      userRowId = ins.id;
    }

    // ---- Assign admin role ----
    await supabase.from("user_roles").upsert(
      { user_id: userRowId, role: "admin" },
      { onConflict: "user_id,role" }
    );

    // ---- Create pending_invitation record (for audit) ----
    await supabase.from("pending_invitations").insert({
      company_id: company.id,
      email: admin_email,
      role: "admin",
      branch_id: branch?.id ?? null,
      invited_by: callerUser.id,
    });

    // ---- Send invite / recovery email so admin can set password ----
    // Determine redirect URL — host of caller, fall back to bebright domain
    const origin = req.headers.get("origin") ?? "https://planner.bebright.global";
    const redirectTo = `${origin.replace(/\/$/, "")}/auth`;

    let emailSent = false;
    try {
      const { error: linkErr } = await supabase.auth.admin.generateLink({
        type: found ? "recovery" : "invite",
        email: admin_email,
        options: { redirectTo },
      });
      if (!linkErr) emailSent = true;
    } catch (_) { /* non-fatal */ }

    return jsonResponse({
      success: true,
      company,
      branch,
      admin_user_id: userRowId,
      email_sent: emailSent,
    });
  } catch (e) {
    return errorResponse(e, 500);
  }
});
