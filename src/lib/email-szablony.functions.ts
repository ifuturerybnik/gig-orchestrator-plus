// CRUD szablonów email (tabela email_szablony). Scope: user lub organization.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SAFE =
  "id, scope, owner_user_id, organization_id, nazwa, kategoria, temat, body_html, body_text, zmienne, created_by, created_at, updated_at";

const ScopeEnum = z.enum(["user", "organization"]);

async function userIsMember(userId: string, orgId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export const listSzablony = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        scope: ScopeEnum,
        organizationId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    let q = supabaseAdmin.from("email_szablony").select(SAFE).eq("scope", data.scope);
    if (data.scope === "user") {
      q = q.eq("owner_user_id", userId);
    } else {
      if (!data.organizationId) throw new Error("organizationId required");
      if (!(await userIsMember(userId, data.organizationId))) throw new Error("Forbidden");
      q = q.eq("organization_id", data.organizationId);
    }
    const { data: rows, error } = await q.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { szablony: rows ?? [] };
  });

const upsertInput = z.object({
  id: z.string().uuid().optional(),
  scope: ScopeEnum,
  organizationId: z.string().uuid().nullable().optional(),
  nazwa: z.string().trim().min(1).max(160),
  kategoria: z.string().trim().max(80).nullable().optional(),
  temat: z.string().max(500).default(""),
  body_html: z.string().max(500_000).default(""),
  body_text: z.string().max(500_000).nullable().optional(),
});

export const upsertSzablon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.scope === "organization") {
      if (!data.organizationId) throw new Error("organizationId required");
      if (!(await userIsMember(userId, data.organizationId))) throw new Error("Forbidden");
    }
    const payload = {
      scope: data.scope,
      owner_user_id: data.scope === "user" ? userId : null,
      organization_id: data.scope === "organization" ? data.organizationId : null,
      nazwa: data.nazwa,
      kategoria: data.kategoria ?? null,
      temat: data.temat,
      body_html: data.body_html,
      body_text: data.body_text ?? null,
      created_by: userId,
    };

    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("email_szablony")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .select(SAFE)
        .single();
      if (error) throw new Error(error.message);
      return { szablon: row };
    }

    const { data: row, error } = await supabaseAdmin
      .from("email_szablony")
      .insert(payload)
      .select(SAFE)
      .single();
    if (error) throw new Error(error.message);
    return { szablon: row };
  });

export const deleteSzablon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("email_szablony").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
