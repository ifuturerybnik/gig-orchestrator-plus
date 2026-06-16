import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Search, Building2, AlertCircle, CheckCircle2, RefreshCw, Info, CalendarDays, Briefcase, Phone, Globe, Mail, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTimePL } from '@/lib/datetime';
import { toast } from 'sonner';

type GusPelny = {
  data_powstania: string | null;
  data_rozpoczecia: string | null;
  data_wpisu: string | null;
  data_zawieszenia: string | null;
  data_wznowienia: string | null;
  data_zakonczenia: string | null;
  data_skreslenia: string | null;
  data_upadlosci: string | null;
  numer_w_rejestrze: string | null;
  forma_prawna: string | null;
  forma_szczegolna: string | null;
  forma_finansowania: string | null;
  forma_wlasnosci: string | null;
  organ_rejestrowy: string | null;
  rodzaj_rejestru: string | null;
  email: string | null;
  www: string | null;
  telefon: string | null;
  liczba_jedn_lokalnych: string | null;
};

type GusPkd = {
  kod: string;
  nazwa: string;
  przewazajace: boolean;
};

type GusDane = {
  typ: string;
  typ_label: string;
  nazwa: string;
  nip: string;
  regon: string;
  krs: string;
  adres: {
    ulica: string;
    kod_pocztowy: string;
    miejscowosc: string;
    gmina: string;
    powiat: string;
    wojewodztwo: string;
  };
  data_zakonczenia: string | null;
  silosID: string | null;
  pelny_raport: GusPelny | null;
  pkd: GusPkd[];
};

type Wynik =
  | { source: 'gus' | 'cache'; pobrano?: string; dane: GusDane | null; raw?: Record<string, string>; error?: string }
  | { error: string };

export default function IntegracjaGusTab() {
  const [tryb, setTryb] = useState<'nip' | 'regon' | 'krs'>('nip');
  const [value, setValue] = useState('');
  const [skipCache, setSkipCache] = useState(false);
  const [scope, setScope] = useState<'basic' | 'full'>('full');
  const [loading, setLoading] = useState(false);
  const [wynik, setWynik] = useState<Wynik | null>(null);

  async function handleSearch(forceFresh = false) {
    if (!value.trim()) {
      toast.error('Wprowadź identyfikator');
      return;
    }
    setLoading(true);
    setWynik(null);
    try {
      const payload: Record<string, unknown> = { skipCache: forceFresh || skipCache, scope };
      payload[tryb] = value.trim();
      const { data, error } = await supabase.functions.invoke('gus-lookup', { body: payload });
      if (error) throw new Error(error.message);
      setWynik(data as Wynik);
    } catch (e) {
      const msg = (e as Error).message;
      setWynik({ error: msg });
      toast.error('Błąd zapytania: ' + msg);
    } finally {
      setLoading(false);
    }
  }

  const dane = wynik && 'dane' in wynik ? wynik.dane : null;

  return (
    <div className="space-y-4 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Integracja z GUS (REGON)</CardTitle>
          </div>
          <CardDescription>
            Wyszukiwanie danych firm w bazie GUS po numerach NIP, REGON lub KRS. Środowisko produkcyjne (BIR1.1).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={tryb} onValueChange={(v) => setTryb(v as 'nip' | 'regon' | 'krs')}>
            <TabsList>
              <TabsTrigger value="nip">NIP</TabsTrigger>
              <TabsTrigger value="regon">REGON</TabsTrigger>
              <TabsTrigger value="krs">KRS</TabsTrigger>
            </TabsList>
            <TabsContent value={tryb} className="mt-4 space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="gus-input">
                    {tryb === 'nip' ? 'Numer NIP (10 cyfr)' : tryb === 'regon' ? 'Numer REGON (9 lub 14 cyfr)' : 'Numer KRS (10 cyfr)'}
                  </Label>
                  <Input
                    id="gus-input"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={tryb === 'nip' ? '1234567890' : tryb === 'regon' ? '123456789' : '0000123456'}
                    disabled={loading}
                  />
                </div>
                <Button onClick={() => handleSearch()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Szukaj
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Zakres danych</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={scope === 'basic' ? 'default' : 'outline'}
                    onClick={() => setScope('basic')}
                    disabled={loading}
                  >
                    Podstawowy (1 zapytanie)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={scope === 'full' ? 'default' : 'outline'}
                    onClick={() => setScope('full')}
                    disabled={loading}
                  >
                    Pełny (+ PKD, daty, forma prawna — 3 zapytania)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {scope === 'basic'
                    ? 'Nazwa, adres, NIP/REGON/KRS — szybko, minimalne obciążenie GUS. Dobre do walidacji.'
                    : 'Pełny raport: daty rejestracji/zakończenia, forma prawna, organ rejestrowy, kontakt, kody PKD.'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <input
                  id="skip-cache"
                  type="checkbox"
                  checked={skipCache}
                  onChange={(e) => setSkipCache(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="skip-cache" className="text-muted-foreground cursor-pointer">
                  Pomiń cache (zawsze pobierz świeże dane z GUS)
                </label>
              </div>
            </TabsContent>
          </Tabs>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Częstotliwość zapytań</AlertTitle>
            <AlertDescription className="text-xs">
              GUS nie definiuje twardego limitu, ale zaleca rozsądne tempo (max ~1 zapytanie/s przy masowych operacjach).
              Sesja logowania jest cache'owana na ~55 min, wyniki na 7 dni — kolejne zapytanie o tę samą firmę nie obciąża GUS.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {wynik && 'error' in wynik && wynik.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Błąd</AlertTitle>
          <AlertDescription>{wynik.error}</AlertDescription>
        </Alert>
      )}

      {wynik && 'dane' in wynik && !dane && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Brak wyników</AlertTitle>
          <AlertDescription>{(wynik as any).error || 'Nie znaleziono podmiotu w rejestrze GUS.'}</AlertDescription>
        </Alert>
      )}

      {dane && wynik && 'source' in wynik && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-base">{dane.nazwa}</CardTitle>
                <CardDescription>{dane.typ_label}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={wynik.source === 'cache' ? 'secondary' : 'default'}>
                  {wynik.source === 'cache' ? (
                    <>Cache · {wynik.pobrano ? formatDateTimePL(wynik.pobrano) : ''}</>
                  ) : (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> GUS · live</>
                  )}
                </Badge>
                {wynik.source === 'cache' && (
                  <Button size="sm" variant="ghost" onClick={() => handleSearch(true)} disabled={loading}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Odśwież
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <Field label="NIP" value={dane.nip} />
              <Field label="REGON" value={dane.regon} />
              <Field label="KRS" value={dane.krs || '—'} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Adres</Label>
              <div className="text-sm">
                {dane.adres.ulica && <div>{dane.adres.ulica}</div>}
                <div>{dane.adres.kod_pocztowy} {dane.adres.miejscowosc}</div>
                <div className="text-muted-foreground text-xs">
                  {[dane.adres.gmina, dane.adres.powiat, dane.adres.wojewodztwo].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
            {dane.data_zakonczenia && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Działalność zakończona</AlertTitle>
                <AlertDescription>Data zakończenia: {dane.data_zakonczenia}</AlertDescription>
              </Alert>
            )}

            {dane.pelny_raport && (
              <div className="border rounded-lg p-3 space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Pełne dane rejestrowe
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {dane.pelny_raport.data_powstania && <Field label="Data powstania" value={dane.pelny_raport.data_powstania} />}
                  {dane.pelny_raport.data_rozpoczecia && <Field label="Data rozpoczęcia działalności" value={dane.pelny_raport.data_rozpoczecia} />}
                  {dane.pelny_raport.data_wpisu && <Field label="Data wpisu do rejestru" value={dane.pelny_raport.data_wpisu} />}
                  {dane.pelny_raport.data_zawieszenia && <Field label="Data zawieszenia" value={dane.pelny_raport.data_zawieszenia} />}
                  {dane.pelny_raport.data_wznowienia && <Field label="Data wznowienia" value={dane.pelny_raport.data_wznowienia} />}
                  {dane.pelny_raport.data_skreslenia && <Field label="Data skreślenia z REGON" value={dane.pelny_raport.data_skreslenia} />}
                  {dane.pelny_raport.data_upadlosci && <Field label="Data orzeczenia upadłości" value={dane.pelny_raport.data_upadlosci} />}
                  {dane.pelny_raport.numer_w_rejestrze && <Field label="Numer w rejestrze" value={dane.pelny_raport.numer_w_rejestrze} />}
                  {dane.pelny_raport.forma_prawna && <Field label="Forma prawna" value={dane.pelny_raport.forma_prawna} />}
                  {dane.pelny_raport.forma_szczegolna && <Field label="Forma szczegółowa" value={dane.pelny_raport.forma_szczegolna} />}
                  {dane.pelny_raport.forma_finansowania && <Field label="Forma finansowania" value={dane.pelny_raport.forma_finansowania} />}
                  {dane.pelny_raport.forma_wlasnosci && <Field label="Forma własności" value={dane.pelny_raport.forma_wlasnosci} />}
                  {dane.pelny_raport.organ_rejestrowy && <Field label="Organ rejestrowy" value={dane.pelny_raport.organ_rejestrowy} />}
                  {dane.pelny_raport.rodzaj_rejestru && <Field label="Rodzaj rejestru" value={dane.pelny_raport.rodzaj_rejestru} />}
                  {dane.pelny_raport.liczba_jedn_lokalnych && <Field label="Liczba jednostek lokalnych" value={dane.pelny_raport.liczba_jedn_lokalnych} />}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm pt-1">
                  {dane.pelny_raport.telefon && <Field label="Telefon" value={dane.pelny_raport.telefon} />}
                  {dane.pelny_raport.email && <Field label="E-mail" value={dane.pelny_raport.email} />}
                  {dane.pelny_raport.www && <Field label="Strona WWW" value={dane.pelny_raport.www} />}
                </div>
              </div>
            )}

            {dane.pkd.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2">
                <h4 className="text-sm font-medium">Kody PKD</h4>
                <div className="space-y-1.5">
                  {dane.pkd.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Badge variant={p.przewazajace ? 'default' : 'secondary'} className="shrink-0 mt-0.5">
                        {p.kod}
                      </Badge>
                      <span className={p.przewazajace ? 'font-medium' : ''}>{p.nazwa}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}