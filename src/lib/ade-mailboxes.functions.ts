// CRUD skrzynek e-Doręczeń — multi-tenant.
// Certyfikaty QWAC (PEM cert + PEM key + passphrase) szyfrowane symetrycznie
// (AES-256-GCM, EXT_PII_ENCRYPTION_KEY) przed zapisem do DB.
//
// Autoryzacja:
// - kind='user'   → owner_user_id = context.userId
// - kind='org'    → member organizacji (RLS SELECT), właściciel dla mutacji
// - kind='system' → super_admin / admin_staff
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdeMailboxScope =
  | { kind: "user" }
  | { kind: "org"; orgId: string }
  | { kind: "system" };

export type AdeMailboxPublic = {
  id: string;
  ownerKind: "user" | "org" | "system";
  ownerUserId: string | null;
  ownerOrgId: string | null;
  label: string | null;
  mailboxAddress: string;
  clientId: string;
  adeEnv: "prod" | "int";
  apiBase: string | null;
  oauthBase: string | null;
  tokenPath: string | null;
  hasPassphrase: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdeMailboxInput = {
  scope: AdeMailboxScope;
  label?: string | null;
  mailboxAddress: string;
  clientId: string;
  adeEnv?: "prod" | "int";
  apiBase?: string | null;
  oauthBase?: string | null;
  tokenPath?: string | null;
  // Opcjonalne — jeśli nie podane, użyjemy systemowego QWAC Concertivo
  qwacCertPem?: string | null;
  qwacKeyPem?: string | null;
  qwacKeyPassphrase?: string | null;
};

export type AdeMailboxPatch = {
  id: string;
  label?: string | null;
  mailboxAddress?: string;
  clientId?: string;
  adeEnv?: "prod" | "int";
  apiBase?: string | null;
  oauthBase?: string | null;
  tokenPath?: string | null;
  isActive?: boolean;
  qwacCertPem?: string;
  qwacKeyPem?: string;
  qwacKeyPassphrase?: string | null;
};

function toPublicRow(row: Record<string, unknown>): AdeMailboxPublic {
  return {
    id: String(row.id),
    ownerKind: row.owner_kind as "user" | "org" | "system",
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    ownerOrgId: (row.owner_org_id as string | null) ?? null,
    label: (row.label as string | null) ?? null,
    mailboxAddress: String(row.mailbox_address ?? ""),
    clientId: String(row.client_id ?? ""),
    adeEnv: (row.ade_env as "prod" | "int") ?? "prod",
    apiBase: (row.api_base as string | null) ?? null,
    oauthBase: (row.oauth_base as string | null) ?? null,
    tokenPath: (row.token_path as string | null) ?? null,
    hasPassphrase: Boolean(row.qwac_key_passphrase_encrypted),
    isActive: Boolean(row.is_active ?? true),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

async function assertScopeAccess(
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
        };
      };
    };
    rpc?: unknown;
  },
  userId: string,
  scope: AdeMailboxScope,
  mode: "read" | "write",
): Promise<void> {
  if (scope.kind === "user") return; // każdy user zarządza własnym scope
  if (scope.kind === "system") {
    // sprawdź role
    const roles = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => { eq: (col: string, v: string) => Promise<{ data: Array<{ role: string }> | null; error: unknown }> };
        };
      }
    )
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const list = (roles.data ?? []).map((r) => r.role);
    const isAdmin = list.includes("super_admin") || (mode === "read" && list.includes("admin_staff"));
    if (!isAdmin) throw new Error("Brak uprawnień administratora systemu");
    return;
  }
  // org
  const res = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, v: string) => {
            eq: (col: string, v: string) => { maybeSingle: () => Promise<{ data: { role?: string } | null; error: unknown }> };
          };
        };
      };
    }
  )
    .from("organization_members")
    .select("role")
    .eq("organization_id", scope.orgId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = res.data?.role;
  if (!role) throw new Error("Brak dostępu do organizacji");
  if (mode === "write" && role !== "owner") throw new Error("Tylko właściciel organizacji może zmieniać integrację");
}

function scopeFilter(scope: AdeMailboxScope, userId: string) {
  if (scope.kind === "user") return { owner_kind: "user", owner_user_id: userId } as const;
  if (scope.kind === "org") return { owner_kind: "org", owner_org_id: scope.orgId } as const;
  return { owner_kind: "system" } as const;
}

/** Lista skrzynek dla scope. */
export const listAdeMailboxes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope: AdeMailboxScope }) => input)
  .handler(async ({ data, context }): Promise<AdeMailboxPublic[]> => {
    await assertScopeAccess(context.supabase as never, context.userId, data.scope, "read");
    const filter = scopeFilter(data.scope, context.userId);
    let q = context.supabase.from("ade_mailboxes").select("*").eq("owner_kind", filter.owner_kind);
    if ("owner_user_id" in filter) q = q.eq("owner_user_id", filter.owner_user_id);
    if ("owner_org_id" in filter) q = q.eq("owner_org_id", filter.owner_org_id);
    const { data: rows, error } = await q.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => toPublicRow(r as Record<string, unknown>));
  });

/** Utworzenie skrzynki — szyfruje PEM i zapisuje do DB. */
export const createAdeMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AdeMailboxInput) => input)
  .handler(async ({ data, context }): Promise<AdeMailboxPublic> => {
    await assertScopeAccess(context.supabase as never, context.userId, data.scope, "write");

    // Walidacja PEM-ów: opcjonalne. Jeśli podane — sprawdź format.
    if (data.qwacCertPem && !/-----BEGIN CERTIFICATE-----/.test(data.qwacCertPem)) {
      throw new Error("Certyfikat QWAC musi być w formacie PEM (nagłówek BEGIN CERTIFICATE)");
    }
    if (data.qwacKeyPem && !/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(data.qwacKeyPem)) {
      throw new Error("Klucz prywatny QWAC musi być w formacie PEM (nagłówek BEGIN PRIVATE KEY)");
    }
    if ((data.qwacCertPem && !data.qwacKeyPem) || (data.qwacKeyPem && !data.qwacCertPem)) {
      throw new Error("Podaj oba pliki: certyfikat QWAC i klucz prywatny, albo żaden (użyjemy systemowego).");
    }
    if (!data.mailboxAddress.startsWith("AE:PL-")) {
      throw new Error("Adres skrzynki powinien mieć format AE:PL-...");
    }
    if (!data.clientId) throw new Error("ClientId wymagany");

    const { encryptPii } = await import("@/lib/crypto.server");
    const certEnc = data.qwacCertPem ? encryptPii(data.qwacCertPem) : null;
    const keyEnc = data.qwacKeyPem ? encryptPii(data.qwacKeyPem) : null;
    const passEnc = data.qwacKeyPassphrase ? encryptPii(data.qwacKeyPassphrase) : null;

    const filter = scopeFilter(data.scope, context.userId);
    const row: Record<string, unknown> = {
      owner_kind: filter.owner_kind,
      owner_user_id: (filter as { owner_user_id?: string }).owner_user_id ?? null,
      owner_org_id: (filter as { owner_org_id?: string }).owner_org_id ?? null,
      label: data.label ?? null,
      mailbox_address: data.mailboxAddress,
      client_id: data.clientId,
      ade_env: data.adeEnv ?? "prod",
      api_base: data.apiBase ?? null,
      oauth_base: data.oauthBase ?? null,
      token_path: data.tokenPath ?? null,
      qwac_cert_pem_encrypted: certEnc,
      qwac_key_pem_encrypted: keyEnc,
      qwac_key_passphrase_encrypted: passEnc,
      is_active: true,
    };
    const { data: created, error } = await (context.supabase as unknown as {
      from: (t: string) => {
        insert: (r: Record<string, unknown>) => {
          select: (c: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
        };
      };
    })
      .from("ade_mailboxes")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toPublicRow(created as Record<string, unknown>);
  });

async function fetchMailboxWithScopeCheck(
  supabase: { from: (t: string) => { select: (c: string) => { eq: (col: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }> } } } },
  userId: string,
  id: string,
  mode: "read" | "write",
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from("ade_mailboxes").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error((error as Error).message);
  if (!data) throw new Error("Skrzynka nie istnieje");
  const scope: AdeMailboxScope =
    data.owner_kind === "user"
      ? { kind: "user" }
      : data.owner_kind === "org"
      ? { kind: "org", orgId: String(data.owner_org_id) }
      : { kind: "system" };
  await assertScopeAccess(supabase as never, userId, scope, mode);
  if (scope.kind === "user" && data.owner_user_id !== userId) {
    throw new Error("Brak dostępu do tej skrzynki");
  }
  return data;
}

export const updateAdeMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AdeMailboxPatch) => input)
  .handler(async ({ data, context }): Promise<AdeMailboxPublic> => {
    await fetchMailboxWithScopeCheck(context.supabase as never, context.userId, data.id, "write");
    const { encryptPii } = await import("@/lib/crypto.server");
    const patch: Record<string, unknown> = {};
    if (data.label !== undefined) patch.label = data.label;
    if (data.mailboxAddress !== undefined) patch.mailbox_address = data.mailboxAddress;
    if (data.clientId !== undefined) patch.client_id = data.clientId;
    if (data.adeEnv !== undefined) patch.ade_env = data.adeEnv;
    if (data.apiBase !== undefined) patch.api_base = data.apiBase;
    if (data.oauthBase !== undefined) patch.oauth_base = data.oauthBase;
    if (data.tokenPath !== undefined) patch.token_path = data.tokenPath;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (data.qwacCertPem) {
      if (!/-----BEGIN CERTIFICATE-----/.test(data.qwacCertPem)) throw new Error("Nieprawidłowy PEM cert");
      patch.qwac_cert_pem_encrypted = encryptPii(data.qwacCertPem);
    }
    if (data.qwacKeyPem) {
      if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(data.qwacKeyPem)) throw new Error("Nieprawidłowy PEM key");
      patch.qwac_key_pem_encrypted = encryptPii(data.qwacKeyPem);
    }
    if (data.qwacKeyPassphrase !== undefined) {
      patch.qwac_key_passphrase_encrypted = data.qwacKeyPassphrase ? encryptPii(data.qwacKeyPassphrase) : null;
    }
    const { data: updated, error } = await context.supabase
      .from("ade_mailboxes")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toPublicRow(updated as Record<string, unknown>);
  });

export const deleteAdeMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await fetchMailboxWithScopeCheck(context.supabase as never, context.userId, data.id, "write");
    const { error } = await context.supabase.from("ade_mailboxes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Test połączenia — mTLS + OAuth2 dla wskazanej skrzynki. */
export type AdeMailboxTestResult = {
  ok: boolean;
  steps: Array<{ name: string; ok: boolean; detail: string }>;
};

export const testAdeMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<AdeMailboxTestResult> => {
    await fetchMailboxWithScopeCheck(context.supabase as never, context.userId, data.id, "read");
    const { testAdeConnectionForMailbox } = await import("@/lib/ade-client.server");
    return await testAdeConnectionForMailbox(data.id);
  });
