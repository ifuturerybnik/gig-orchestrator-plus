// Wspólny komponent konfiguracji skrzynek e-Doręczeń dla wszystkich scope
// (user / org / system). Wgrywanie certyfikatu QWAC (PEM), client_id,
// adresu skrzynki i test połączenia.
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  PlugZap,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createAdeMailbox,
  deleteAdeMailbox,
  listAdeMailboxes,
  testAdeMailbox,
  updateAdeMailbox,
  type AdeMailboxPublic,
  type AdeMailboxScope,
  type AdeMailboxTestResult,
} from "@/lib/ade-mailboxes.functions";
import EdoreczeniaSetupGuide from "./EdoreczeniaSetupGuide";

type Props = { scope: AdeMailboxScope };

export default function EdoreczeniaSetup({ scope }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdeMailboxes);
  const deleteFn = useServerFn(deleteAdeMailbox);
  const testFn = useServerFn(testAdeMailbox);

  const scopeKey = useMemo(() => JSON.stringify(scope), [scope]);
  const listQuery = useQuery({
    queryKey: ["ade-mailboxes", scopeKey],
    queryFn: () => listFn({ data: { scope } }),
  });

  const [testResult, setTestResult] = useState<Record<string, AdeMailboxTestResult>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdeMailboxPublic | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Skrzynka usunięta");
      qc.invalidateQueries({ queryKey: ["ade-mailboxes", scopeKey] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const res = await testFn({ data: { id } });
      setTestResult((prev) => ({ ...prev, [id]: res }));
      if (res.ok) toast.success("Połączenie z ADE działa");
      else toast.error("Test wykrył problem — sprawdź szczegóły");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTestingId(null);
    }
  }

  const mailboxes = listQuery.data ?? [];

  return (
    <div className="space-y-4">
      <EdoreczeniaSetupGuide />
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Skrzynki e-Doręczeń
              </CardTitle>
              <CardDescription>
                Wpisz adres skrzynki i ClientId — Concertivo połączy się z e-Doręczeniami przy użyciu własnego certyfikatu QWAC. Nie musisz kupować własnego certyfikatu.
              </CardDescription>
            </div>
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj skrzynkę
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {listQuery.isLoading && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie…
            </div>
          )}
          {!listQuery.isLoading && mailboxes.length === 0 && (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Brak skonfigurowanych skrzynek. Kliknij „Dodaj skrzynkę", aby podać adres AE:PL-… oraz ClientId.
            </div>
          )}
          {mailboxes.map((mb) => (
            <div key={mb.id} className="rounded-md border border-border bg-card p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium">{mb.label || mb.mailboxAddress}</div>
                {mb.label && (
                  <span className="text-xs text-muted-foreground font-mono">{mb.mailboxAddress}</span>
                )}
                <Badge variant={mb.isActive ? "default" : "secondary"}>{mb.isActive ? "Aktywna" : "Wyłączona"}</Badge>
                <Badge variant="outline">{mb.adeEnv}</Badge>
                <div className="ml-auto flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleTest(mb.id)} disabled={testingId === mb.id}>
                    {testingId === mb.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                    <span className="ml-1">Test</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(mb); setDialogOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`Usunąć skrzynkę ${mb.mailboxAddress}?`)) deleteMutation.mutate(mb.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-1 text-xs text-muted-foreground font-mono">
                <div>ClientId: {mb.clientId}</div>
                {mb.apiBase && <div>API base: {mb.apiBase}</div>}
                {mb.oauthBase && <div>OAuth base: {mb.oauthBase}</div>}
              </div>
              {testResult[mb.id] && (
                <div className="space-y-1 pt-1">
                  {testResult[mb.id].steps.map((s, i) => (
                    <Alert key={i} variant={s.ok ? "default" : "destructive"} className="py-2">
                      <div className="flex items-start gap-2">
                        {s.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" /> : <XCircle className="h-4 w-4 mt-0.5" />}
                        <div className="flex-1">
                          <AlertTitle className="text-xs">{s.name} <Badge variant={s.ok ? "default" : "destructive"}>{s.ok ? "OK" : "FAIL"}</Badge></AlertTitle>
                          <AlertDescription className="font-mono text-[11px] break-all">{s.detail}</AlertDescription>
                        </div>
                      </div>
                    </Alert>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <MailboxDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        scope={scope}
        editing={editing}
        onSaved={() => {
          setDialogOpen(false);
          qc.invalidateQueries({ queryKey: ["ade-mailboxes", scopeKey] });
        }}
      />
    </div>
  );
}

function MailboxDialog({
  open,
  onOpenChange,
  scope,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scope: AdeMailboxScope;
  editing: AdeMailboxPublic | null;
  onSaved: () => void;
}) {
  const createFn = useServerFn(createAdeMailbox);
  const updateFn = useServerFn(updateAdeMailbox);

  const [label, setLabel] = useState(editing?.label ?? "");
  const [mailboxAddress, setMailboxAddress] = useState(editing?.mailboxAddress ?? "");
  const [clientId, setClientId] = useState(editing?.clientId ?? "");
  const [adeEnv, setAdeEnv] = useState<"prod" | "int">(editing?.adeEnv ?? "prod");
  const [apiBase, setApiBase] = useState(editing?.apiBase ?? "");
  const [oauthBase, setOauthBase] = useState(editing?.oauthBase ?? "");
  const [tokenPath, setTokenPath] = useState(editing?.tokenPath ?? "");
  const [passphrase, setPassphrase] = useState("");
  const certPem = "";
  const keyPem = "";
  const [submitting, setSubmitting] = useState(false);

  // Re-inicjalizuj przy zmianie editing
  useMemo(() => {
    setLabel(editing?.label ?? "");
    setMailboxAddress(editing?.mailboxAddress ?? "");
    setClientId(editing?.clientId ?? "");
    setAdeEnv(editing?.adeEnv ?? "prod");
    setApiBase(editing?.apiBase ?? "");
    setOauthBase(editing?.oauthBase ?? "");
    setTokenPath(editing?.tokenPath ?? "");
    setPassphrase("");
  }, [editing]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await updateFn({
          data: {
            id: editing.id,
            label: label || null,
            mailboxAddress,
            clientId,
            adeEnv,
            apiBase: apiBase || null,
            oauthBase: oauthBase || null,
            tokenPath: tokenPath || null,
            qwacCertPem: certPem || undefined,
            qwacKeyPem: keyPem || undefined,
            qwacKeyPassphrase: passphrase || null,
          },
        });
        toast.success("Skrzynka zaktualizowana");
      } else {
        await createFn({
          data: {
            scope,
            label: label || null,
            mailboxAddress,
            clientId,
            adeEnv,
            apiBase: apiBase || null,
            oauthBase: oauthBase || null,
            tokenPath: tokenPath || null,
            qwacCertPem: certPem || null,
            qwacKeyPem: keyPem || null,
            qwacKeyPassphrase: passphrase || null,
          },
        });
        toast.success("Skrzynka dodana");
      }
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edytuj skrzynkę e-Doręczeń" : "Nowa skrzynka e-Doręczeń"}</DialogTitle>
          <DialogDescription>
            Podaj adres skrzynki (AE:PL-…) oraz ClientId. Concertivo łączy się z e-Doręczeniami swoim certyfikatem QWAC — nie musisz go kupować ani wgrywać.
          </DialogDescription>
        </DialogHeader>

        {!editing && (
          <Alert>
            <AlertTitle>Jak podłączyć skrzynkę — 3 kroki</AlertTitle>
            <AlertDescription className="text-xs space-y-2 mt-1">
              <div>
                1. <b>Pobierz certyfikat QWAC Concertivo</b> (plik publiczny .crt):{" "}
                <a
                  href="/api/public/concertivo-qwac.crt"
                  download="concertivo-qwac.crt"
                  className="inline-flex items-center gap-1 underline font-medium"
                >
                  concertivo-qwac.crt
                </a>
                . Klucz prywatny pozostaje po naszej stronie — nie musisz nic kupować.
              </div>
              <div>2. Zaloguj się na <span className="font-mono">biznes.gov.pl</span> → e-Doręczenia → Ustawienia skrzynki → Systemy zewnętrzne. Dodaj Concertivo jako system zewnętrzny, wgraj pobrany plik <span className="font-mono">concertivo-qwac.crt</span>, wpisz ClientId Concertivo: <span className="font-mono">AE:PL-75293-86443-CJWRC-25.SYSTEM.CONCERTIVO</span> i nadaj uprawnienia (odczyt, wysyłka).</div>
              <div>3. Wróć tutaj i wypełnij pola poniżej: <b>Adres skrzynki</b> (AE:PL-… Twojej skrzynki) oraz <b>ClientId</b> (ten sam ClientId Concertivo).</div>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Nazwa (opcjonalnie)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="np. Skrzynka główna" />
            </div>
            <div className="space-y-1">
              <Label>Środowisko</Label>
              <Select value={adeEnv} onValueChange={(v) => setAdeEnv(v as "prod" | "int")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prod">Produkcyjne (prod)</SelectItem>
                  <SelectItem value="int">Integracyjne (int)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Adres skrzynki (AE:PL-…)</Label>
            <Input
              required
              value={mailboxAddress}
              onChange={(e) => setMailboxAddress(e.target.value)}
              placeholder="AE:PL-XXXXX-XXXXX-XXXXX-XX"
              className="font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label>ClientId (KSDE)</Label>
            <Input
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="AE:PL-…"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Domyślnie: ClientId Concertivo autoryzowany w Twojej skrzynce. Podaj własny ClientId tylko jeśli masz zarejestrowany osobny system w KSDE.
            </p>
          </div>


          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Anuluj</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Zapisz zmiany" : "Dodaj skrzynkę"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
