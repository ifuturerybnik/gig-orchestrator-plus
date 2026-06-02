import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Info,
  Loader2,
  ShieldCheck,
  Cloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  getOrgStorageSettings,
  setOrgStorageMode,
  setOrgOwnR2,
  clearOrgOwnR2,
  testOrgR2,
} from "@/lib/storage.functions";

function formatBytes(n: number) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 2)} ${u[i]}`;
}

export function OrgStorageSection({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getOrgStorageSettings);
  const setModeFn = useServerFn(setOrgStorageMode);
  const setOwnFn = useServerFn(setOrgOwnR2);
  const clearOwnFn = useServerFn(clearOrgOwnR2);
  const testFn = useServerFn(testOrgR2);

  const queryKey = ["org-storage-settings", orgId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchSettings({ data: { organization_id: orgId } }),
  });

  const [form, setForm] = useState({
    r2_account_id: "",
    r2_access_key_id: "",
    r2_secret_access_key: "",
    r2_bucket: "",
    r2_public_base_url: "",
  });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && data) {
      setForm({
        r2_account_id: data.r2_account_id ?? "",
        r2_access_key_id: "",
        r2_secret_access_key: "",
        r2_bucket: data.r2_bucket ?? "",
        r2_public_base_url: data.r2_public_base_url ?? "",
      });
      setInitialized(true);
    }
  }, [data, initialized]);

  const endpoint = useMemo(() => {
    const id = form.r2_account_id.trim();
    return id ? `https://${id}.r2.cloudflarestorage.com` : "";
  }, [form.r2_account_id]);

  const setMode = useMutation({
    mutationFn: (mode: "central" | "own") =>
      setModeFn({ data: { organization_id: orgId, mode } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Tryb storage zaktualizowany");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: (activate: boolean) =>
      setOwnFn({
        data: {
          organization_id: orgId,
          r2_account_id: form.r2_account_id.trim(),
          r2_access_key_id: form.r2_access_key_id.trim() || null,
          r2_secret_access_key: form.r2_secret_access_key.trim() || null,
          r2_bucket: form.r2_bucket.trim(),
          r2_endpoint: endpoint,
          r2_public_base_url: form.r2_public_base_url.trim(),
          activate,
        },
      }),
    onSuccess: () => {
      setForm((f) => ({ ...f, r2_access_key_id: "", r2_secret_access_key: "" }));
      qc.invalidateQueries({ queryKey });
      toast.success("Zapisano konfigurację R2");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testFn({ data: { organization_id: orgId } }),
    onSuccess: (r) => toast.success(`Połączenie OK (bucket: ${r.bucket})`),
    onError: (e: Error) => toast.error(`Test nieudany: ${e.message}`),
  });

  const clear = useMutation({
    mutationFn: () => clearOwnFn({ data: { organization_id: orgId } }),
    onSuccess: () => {
      setForm({
        r2_account_id: "",
        r2_access_key_id: "",
        r2_secret_access_key: "",
        r2_bucket: "",
        r2_public_base_url: "",
      });
      qc.invalidateQueries({ queryKey });
      toast.success("Wyczyszczono. Wróciliśmy do storage centralnego.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <section className="rounded-md border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Ładowanie ustawień storage…</p>
      </section>
    );
  }

  const q = data.quota;
  const pct = q.totalBytes > 0 ? Math.min(100, (q.usedBytes / q.totalBytes) * 100) : 0;

  return (
    <section className="space-y-6 rounded-md border border-border bg-card p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <HardDrive className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Storage organizacji (Cloudflare R2)</h2>
            <p className="text-sm text-muted-foreground">
              Wybierz, gdzie mają być przechowywane Twoje pliki (Dysk, media, załączniki).
            </p>
          </div>
        </div>
        <Badge variant={data.mode === "own" ? "default" : "secondary"}>
          {data.mode === "own" ? "Własne R2" : "Concertivo Storage"}
        </Badge>
      </header>

      {/* Privacy notice */}
      <div className="flex gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">Twoja prywatność</p>
          <p className="text-muted-foreground">
            Pliki przechowywane w <strong>Concertivo Storage</strong> nie są przeglądane,
            udostępniane ani wykorzystywane przez operatora aplikacji Concertivo.
            Dostęp do nich mają wyłącznie członkowie Twojej organizacji.
            Jeśli mimo to chcesz mieć <strong>absolutną kontrolę i pewność</strong> —
            załóż własne konto Cloudflare i podłącz swój bucket R2 poniżej.
            Wtedy pliki nigdy nie trafiają do naszej infrastruktury, a my nie mamy
            do nich żadnego dostępu.
          </p>
        </div>
      </div>

      {/* Mode toggle */}
      <div>
        <Label className="mb-2 block">Tryb przechowywania</Label>
        <RadioGroup
          value={data.mode}
          onValueChange={(v) => setMode.mutate(v as "central" | "own")}
          className="grid gap-2 sm:grid-cols-2"
        >
          <label
            htmlFor="mode-central"
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3 hover:bg-muted/40"
          >
            <RadioGroupItem id="mode-central" value="central" className="mt-0.5" />
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Cloud className="h-4 w-4" /> Concertivo Storage (centralny)
              </div>
              <p className="text-xs text-muted-foreground">
                Zero konfiguracji. Darmowy limit + opcjonalnie płatne dodatkowe GB.
              </p>
            </div>
          </label>
          <label
            htmlFor="mode-own"
            className={`flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3 hover:bg-muted/40 ${
              !data.r2_bucket ? "opacity-60" : ""
            }`}
          >
            <RadioGroupItem
              id="mode-own"
              value="own"
              className="mt-0.5"
              disabled={!data.r2_bucket}
            />
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <HardDrive className="h-4 w-4" /> Własne Cloudflare R2
              </div>
              <p className="text-xs text-muted-foreground">
                Pliki trafiają wyłącznie do Twojego konta. Najpierw uzupełnij dane poniżej i przetestuj.
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* Quota */}
      <div className="rounded-md border border-border bg-background p-3 text-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-medium">Zużycie</span>
          <span className="text-muted-foreground">
            {formatBytes(q.usedBytes)} / {q.totalGb} GB
          </span>
        </div>
        <Progress value={pct} />
        <p className="mt-1 text-xs text-muted-foreground">
          Tryb: <strong>{q.mode === "own" ? "Własne R2" : "Centralny"}</strong> •
          {" "}Free: {q.freeGb} GB • Bonus: {q.bonusGb} GB • Płatne: {q.paidGb} GB
        </p>
      </div>

      {/* Form for own R2 - collapsible */}
      {data.mode === "own" && (
        <>
          <div className="space-y-4 rounded-md border border-border bg-background p-4">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Dane Twojego Cloudflare R2</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="r2_account_id">Account ID</Label>
            <Input
              id="r2_account_id"
              placeholder="np. 1a2b3c4d5e6f7g8h9i0j"
              value={form.r2_account_id}
              onChange={(e) => setForm((f) => ({ ...f, r2_account_id: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Endpoint zostanie wyliczony automatycznie:{" "}
              <code className="rounded bg-muted px-1">{endpoint || "—"}</code>
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="r2_bucket">Nazwa bucketa</Label>
            <Input
              id="r2_bucket"
              placeholder="np. moja-org-media"
              value={form.r2_bucket}
              onChange={(e) => setForm((f) => ({ ...f, r2_bucket: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r2_public_base_url">Publiczny adres bazowy</Label>
            <Input
              id="r2_public_base_url"
              placeholder="https://pub-xxxxxxxx.r2.dev"
              value={form.r2_public_base_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, r2_public_base_url: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r2_access_key_id">Access Key ID</Label>
            <Input
              id="r2_access_key_id"
              autoComplete="off"
              placeholder={data.has_access_key ? "•••• (zapisany — wpisz nowy, aby zmienić)" : ""}
              value={form.r2_access_key_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, r2_access_key_id: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r2_secret_access_key">Secret Access Key</Label>
            <Input
              id="r2_secret_access_key"
              type="password"
              autoComplete="off"
              placeholder={data.has_secret_key ? "•••• (zapisany — wpisz nowy, aby zmienić)" : ""}
              value={form.r2_secret_access_key}
              onChange={(e) =>
                setForm((f) => ({ ...f, r2_secret_access_key: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => save.mutate(false)}
            disabled={save.isPending || !form.r2_account_id || !form.r2_bucket || !form.r2_public_base_url}
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Zapisz dane
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => test.mutate()}
            disabled={test.isPending || !data.r2_bucket}
          >
            {test.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Testuj połączenie
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => save.mutate(true)}
            disabled={save.isPending || !form.r2_account_id || !form.r2_bucket || !form.r2_public_base_url}
          >
            Zapisz i aktywuj tryb „własne R2"
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (confirm("Usunąć dane R2 organizacji i wrócić do storage centralnego?")) {
                clear.mutate();
              }
            }}
            disabled={clear.isPending || !data.r2_bucket}
          >
            Wyczyść i wróć do centralnego
          </Button>
        </div>

        <div className="flex gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-muted-foreground">
            Po zmianie trybu nowe uploady idą do nowej lokalizacji, ale{" "}
            <strong>istniejące pliki nie są przenoszone automatycznie</strong>.
            Migrację należy wykonać ręcznie (lub poprosić nas o pomoc).
          </p>
        </div>
      </div>

      {/* Step-by-step instructions */}
      <details className="rounded-md border border-border bg-background p-4 text-sm">
        <summary className="cursor-pointer font-semibold">
          <Info className="mr-2 inline h-4 w-4 text-primary" />
          Łopatologiczna instrukcja — jak podłączyć własne Cloudflare R2 (10 min)
        </summary>

        <ol className="mt-4 list-decimal space-y-4 pl-5">
          <li>
            <strong>Załóż konto Cloudflare</strong> na{" "}
            <a className="text-primary underline" href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noreferrer">
              dash.cloudflare.com/sign-up
            </a>
            . Konto jest darmowe.
          </li>

          <li>
            <strong>Włącz R2.</strong> W panelu Cloudflare wejdź w lewym menu w „R2 Object Storage"
            i kliknij „Enable R2". Wymagane jest podanie karty płatniczej — pierwsze
            10 GB/miesiąc i 1 mln operacji jest darmowe.
          </li>

          <li>
            <strong>Skopiuj „Account ID".</strong> Znajdziesz go po prawej stronie ekranu R2
            (lub na stronie głównej panelu). Wklej go do pola <em>Account ID</em> powyżej.
            Na tej podstawie wyliczymy endpoint automatycznie — nie musisz go nigdzie wklejać.
          </li>

          <li>
            <strong>Utwórz bucket.</strong> Kliknij „Create bucket" → podaj nazwę (np.
            <code className="mx-1 rounded bg-muted px-1">moja-org-media</code>),
            wybierz lokalizację (najlepiej EEUR — Europa) i zatwierdź. Nazwę wklej do pola
            <em> Nazwa bucketa</em>.
          </li>

          <li>
            <strong>Włącz publiczny dostęp do bucketa.</strong> Wejdź w bucket → zakładka
            „Settings" → sekcja „Public access" → „R2.dev subdomain" → „Allow Access".
            Cloudflare wygeneruje adres typu
            <code className="mx-1 rounded bg-muted px-1">https://pub-xxxxxxxx.r2.dev</code> —
            wklej go do pola <em>Publiczny adres bazowy</em>. (Opcjonalnie możesz później
            podpiąć własną domenę — wtedy wpisz ją zamiast adresu r2.dev.)
          </li>

          <li>
            <strong>Skonfiguruj CORS bucketa.</strong> W bucket → „Settings" → „CORS policy"
            → „Add CORS policy" i wklej:
            <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-xs">{`[
  {
    "AllowedOrigins": ["https://concertivo.eu", "https://*.lovable.app"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]`}</pre>
            Bez tego przeglądarka zablokuje upload plików.
          </li>

          <li>
            <strong>Utwórz API token R2.</strong> Wróć do głównej strony R2 → po prawej
            „Manage R2 API Tokens" → „Create API token". Ustaw:
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              <li>Token name: dowolny, np. „Concertivo"</li>
              <li>Permissions: <strong>Object Read & Write</strong></li>
              <li>Specify bucket(s): wybierz utworzony przed chwilą bucket</li>
              <li>TTL: bez wygaśnięcia (lub długi)</li>
            </ul>
            Po kliknięciu „Create" zobaczysz <strong>Access Key ID</strong> i{" "}
            <strong>Secret Access Key</strong> — pokazane są <em>tylko raz</em>.
            Skopiuj je natychmiast i wklej w pola powyżej.
          </li>

          <li>
            <strong>Kliknij „Zapisz dane".</strong> Potem „Testuj połączenie" — wgramy
            pojedynczy plik testowy i od razu go usuniemy. Jeśli OK — kliknij „Zapisz i aktywuj
            tryb własne R2". Od tej chwili wszystkie nowe pliki organizacji trafiają wyłącznie do Twojego konta.
          </li>
        </ol>

        <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Najczęstsze błędy (uniknij ich):</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>SignatureDoesNotMatch</strong> — zły Access/Secret Key albo Access Key
              utworzony dla innego konta. Wygeneruj nowy token i wklej oba klucze od nowa.
            </li>
            <li>
              <strong>CORS error w konsoli</strong> — pominięty krok 6. Dodaj politykę CORS.
            </li>
            <li>
              <strong>403 przy odczycie pliku</strong> — wyłączony „R2.dev public access" lub
              zły <em>Public base URL</em>. Skopiuj adres dokładnie z panelu bucketa.
            </li>
            <li>
              <strong>Spacja na końcu pól</strong> — zwłaszcza w kluczach. Wklejaj uważnie.
            </li>
          </ul>
        </div>
      </details>
      </>)}

      {data.mode === "central" && (
        <div className="flex gap-3 rounded-md border border-border bg-background p-4 text-sm">
          <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Storage centralny Concertivo</p>
            <p className="text-muted-foreground">
              Korzystasz z naszej infrastruktury. Jeśli chcesz przełączyć się na własne konto Cloudflare R2 — wybierz tryb „Własne Cloudflare R2" powyżej, a panel konfiguracji się rozwinie.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
