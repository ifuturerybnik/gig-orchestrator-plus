// Strona statusu żądania usunięcia danych (Meta App Review).
// URL: /data-deletion/<confirmation_code>
// Użytkownik trafia tu z Facebook/Instagram "Apps and Websites" po
// żądaniu usunięcia danych z aplikacji Concertivo.
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { Footer } from "@/components/footer";

type Status = {
  found: boolean;
  status?: string;
  affected_accounts?: number;
  received_at?: string;
  processed_at?: string | null;
};

const getDeletionStatus = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) => data)
  .handler(async ({ data }): Promise<Status> => {
    const { data: row } = await supabaseAdmin
      .from("meta_data_deletion_requests")
      .select("status, affected_accounts, received_at, processed_at")
      .eq("confirmation_code", data.code)
      .maybeSingle();
    if (!row) return { found: false };
    const r = row as {
      status: string;
      affected_accounts: number;
      received_at: string;
      processed_at: string | null;
    };
    return {
      found: true,
      status: r.status,
      affected_accounts: r.affected_accounts,
      received_at: r.received_at,
      processed_at: r.processed_at,
    };
  });

function statusQuery(code: string) {
  return queryOptions({
    queryKey: ["meta-data-deletion", code],
    queryFn: () => getDeletionStatus({ data: { code } }),
  });
}

export const Route = createFileRoute("/data-deletion/$code")({
  head: () => ({
    meta: [
      { title: "Data Deletion Status — Concertivo" },
      {
        name: "description",
        content:
          "Status of your data deletion request from Concertivo (Meta / Facebook / Instagram integration).",
      },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(statusQuery(params.code)),
  component: DataDeletionStatusPage,
});

function DataDeletionStatusPage() {
  const { code } = Route.useParams();
  const { data } = useSuspenseQuery(statusQuery(code));

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold">Data Deletion Request</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Confirmation code: <code className="font-mono">{code}</code>
        </p>

        <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">
          {!data.found ? (
            <>
              <p className="font-medium">
                We could not find a deletion request with this confirmation code.
              </p>
              <p className="mt-2 text-muted-foreground">
                If you believe this is a mistake, please contact us at{" "}
                <a className="underline" href="mailto:kontakt@i-future.pl">
                  kontakt@i-future.pl
                </a>
                .
              </p>
            </>
          ) : (
            <>
              <p>
                <span className="font-medium">Status:</span>{" "}
                <span className="font-mono">{data.status}</span>
              </p>
              <p className="mt-1">
                <span className="font-medium">Linked Meta accounts removed:</span>{" "}
                {data.affected_accounts ?? 0}
              </p>
              <p className="mt-1 text-muted-foreground">
                Received: {data.received_at ? new Date(data.received_at).toLocaleString() : "—"}
                {data.processed_at
                  ? ` · Processed: ${new Date(data.processed_at).toLocaleString()}`
                  : ""}
              </p>
              <p className="mt-4 text-muted-foreground">
                Concertivo has disconnected the Meta (Facebook / Instagram) integration
                tied to your Facebook user ID. Any access and refresh tokens we held
                have been deleted. Aggregated content you may have published through
                Concertivo (e.g. organization posts) remains owned by the organization
                that created it; to request full account deletion of a Concertivo
                account, sign in to Concertivo and use Settings → Privacy → Delete my
                account, or email{" "}
                <a className="underline" href="mailto:kontakt@i-future.pl">
                  kontakt@i-future.pl
                </a>
                .
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          <Link to="/" className="underline">
            ← Back to Concertivo
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
