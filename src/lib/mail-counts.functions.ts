// Liczniki nieprzeczytanej poczty + sumaryczna liczba zdarzeń (do badge'a PWA).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function fetchUnreadInboxCount(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  mailboxIds: string[],
): Promise<number> {
  if (mailboxIds.length === 0) return 0;
  const { count } = await supabaseAdmin
    .from("email_wiadomosci")
    .select("id", { count: "exact", head: true })
    .in("skrzynka_id", mailboxIds)
    .eq("przeczytana", false)
    .eq("folder", "INBOX");
  return count ?? 0;
}

export const countOrgUnreadMail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { userId } = context;

    const { data: mem } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("organization_id", data.organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem) throw new Error("Forbidden");

    const { data: boxes } = await supabaseAdmin
      .from("email_skrzynki")
      .select("id")
      .eq("organization_id", data.organizationId)
      .eq("typ", "wspolna");
    const ids = (boxes ?? []).map((b) => b.id as string);
    const unread = await fetchUnreadInboxCount(supabaseAdmin, ids);
    return { unread };
  });

export const getMyEventCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { userId } = context;

    const { count: notifCount } = await supabaseAdmin
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);

    const { data: mine } = await supabaseAdmin
      .from("email_skrzynki")
      .select("id")
      .eq("owner_user_id", userId)
      .eq("typ", "osobista");

    const { data: orgs } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId);
    const orgIds = (orgs ?? [])
      .map((o) => o.organization_id as string)
      .filter(Boolean);

    let sharedIds: string[] = [];
    if (orgIds.length > 0) {
      const { data: shared } = await supabaseAdmin
        .from("email_skrzynki")
        .select("id")
        .eq("typ", "wspolna")
        .in("organization_id", orgIds);
      sharedIds = (shared ?? []).map((s) => s.id as string);
    }

    const mailboxIds = [
      ...(mine ?? []).map((m) => m.id as string),
      ...sharedIds,
    ];
    const unreadMail = await fetchUnreadInboxCount(supabaseAdmin, mailboxIds);

    const notifications = notifCount ?? 0;
    return {
      total: notifications + unreadMail,
      notifications,
      unreadMail,
    };
  });
