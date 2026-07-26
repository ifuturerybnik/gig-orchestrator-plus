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
  UploadCloud,
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
  const certRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  const [label, setLabel] = useState(editing?.label ?? "");
  const [mailboxAddress, setMailboxAddress] = useState(editing?.mailboxAddress ?? "");
  const [clientId, setClientId] = useState(editing?.clientId ?? "");
  const [adeEnv, setAdeEnv] = useState<"prod" | "int">(editing?.adeEnv ?? "prod");
  const [apiBase, setApiBase] = useState(editing?.apiBase ?? "");
  const [oauthBase, setOauthBase] = useState(editing?.oauthBase ?? "");
  const [tokenPath, setTokenPath] = useState(editing?.tokenPath ?? "");
  const [passphrase, setPassphrase] = useState("");
  const [certPem, setCertPem] = useState("");
  const [keyPem, setKeyPem] = useState("");
  const [certName, setCertName] = useState<string | null>(null);
  const [keyName, setKeyName] = useState<string | null>(null);
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
    setCertPem("");
    setKeyPem("");
    setCertName(null);
    setKeyName(null);
  }, [editing]);

  async function readFile(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Błąd odczytu pliku"));
      reader.readAsText(f);
    });
  }

  async function handleCertFile(f: File | null | undefined) {
    if (!f) return;
    const text = await readFile(f);
    setCertPem(text);
    setCertName(f.name);
  }
  async function handleKeyFile(f: File | null | undefined) {
    if (!f) return;
    const text = await readFile(f);
    setKeyPem(text);
    setKeyName(f.name);
  }

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
        if (!certPem || !keyPem) {
          toast.error("Wybierz plik certyfikatu i klucza QWAC (PEM)");
          setSubmitting(false);
          return;
        }
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
            qwacCertPem: certPem,
            qwacKeyPem: keyPem,
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
            Wgraj certyfikat QWAC oraz odpowiadający mu klucz prywatny (pliki PEM). Certyfikat kupujesz w jednym z zaufanych centrów certyfikacji (CenCert, Sigillum).
          </DialogDescription>
        </DialogHeader>
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
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Certyfikat QWAC (PEM){editing ? " — zostaw puste, aby nie zmieniać" : ""}</Label>
              <input
                ref={certRef}
                type="file"
                accept=".pem,.crt,.cer,text/plain"
                className="hidden"
                onChange={(e) => handleCertFile(e.target.files?.[0])}
              />
              <Button type="button" variant="outline" onClick={() => certRef.current?.click()} className="w-full justify-start">
                <UploadCloud className="h-4 w-4 mr-2" />
                {certName ?? (editing ? "Wybierz plik (opcjonalnie)" : "Wybierz plik cert.pem")}
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Klucz prywatny (PEM){editing ? " — zostaw puste, aby nie zmieniać" : ""}</Label>
              <input
                ref={keyRef}
                type="file"
                accept=".pem,.key,text/plain"
                className="hidden"
                onChange={(e) => handleKeyFile(e.target.files?.[0])}
              />
              <Button type="button" variant="outline" onClick={() => keyRef.current?.click()} className="w-full justify-start">
                <UploadCloud className="h-4 w-4 mr-2" />
                {keyName ?? (editing ? "Wybierz plik (opcjonalnie)" : "Wybierz plik key.pem")}
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Passphrase klucza (opcjonalne)</Label>
            <Input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder={editing?.hasPassphrase ? "•••• (ustawione — zostaw puste, by nie zmieniać)" : ""} />
          </div>

          <details className="rounded-md border border-border bg-muted/20 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Zaawansowane (URL-e nadpisujące defaulty)</summary>
            <div className="mt-2 grid gap-2">
              <div><Label>API base (mTLS)</Label><Input value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="https://uaapi-ow.poczta-polska.pl" className="font-mono" /></div>
              <div><Label>OAuth base (KSDE)</Label><Input value={oauthBase} onChange={(e) => setOauthBase(e.target.value)} placeholder="https://ow.edoreczenia.gov.pl" className="font-mono" /></div>
              <div><Label>Token path</Label><Input value={tokenPath} onChange={(e) => setTokenPath(e.target.value)} placeholder="/auth/realms/EDOR/protocol/openid-connect/token" className="font-mono" /></div>
            </div>
          </details>

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
