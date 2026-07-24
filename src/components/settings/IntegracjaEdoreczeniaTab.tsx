import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, PlugZap, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { testAdeConnection, type AdeTestResult } from "@/lib/ade.functions";
import { toast } from "sonner";

export default function IntegracjaEdoreczeniaTab() {
  const runTest = useServerFn(testAdeConnection);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdeTestResult | null>(null);

  async function handleTest() {
    setLoading(true);
    setResult(null);
    try {
      const res = await runTest();
      setResult(res);
      if (res.ok) toast.success("Połączenie z ADE działa");
      else toast.error("Test wykrył problem — sprawdź szczegóły");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Integracja e-Doręczenia (UA API v.3)
          </CardTitle>
          <CardDescription>
            System Concertivo zarejestrowany w ADE z certyfikatem QWAC. Poniższy test weryfikuje mTLS oraz próbę pobrania tokenu OAuth2.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm">
            <ConfigRow label="ClientId" value={result?.config.clientId} />
            <ConfigRow label="Adres skrzynki" value={result?.config.mailboxAddress} />
            <ConfigRow label="UA API base (mTLS)" value={result?.config.apiBase} />
            <ConfigRow label="OAuth base (KSDE)" value={result?.config.oauthBase} />
            <ConfigRow label="Token endpoint" value={result?.config.tokenPath} />

          </div>

          <Button onClick={handleTest} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
            Testuj połączenie
          </Button>

          {result && (
            <div className="space-y-2">
              {result.steps.map((s, i) => (
                <Alert key={i} variant={s.ok ? "default" : "destructive"}>
                  <div className="flex items-start gap-2">
                    {s.ok ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <AlertTitle className="flex items-center gap-2">
                        {s.name}
                        <Badge variant={s.ok ? "default" : "destructive"}>{s.ok ? "OK" : "FAIL"}</Badge>
                      </AlertTitle>
                      <AlertDescription className="font-mono text-xs break-all">{s.detail}</AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-1 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs break-all text-right">{value ?? "—"}</span>
    </div>
  );
}
