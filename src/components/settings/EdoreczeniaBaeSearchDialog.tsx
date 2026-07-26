import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Search, UserPlus } from "lucide-react";
import {
  searchBaeAddresses,
  type BaeIdentifierType,
  type BaeRecipientType,
  type BaeSearchResultRow,
} from "@/lib/ade-inbox.functions";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (address: string) => void;
};

const RECIPIENT_LABELS: Record<BaeRecipientType, string> = {
  ALL: "Wszystkie",
  PUBLIC: "Podmiot publiczny",
  NON_PUBLIC: "Przedsiębiorca",
  KOMORNIK: "Komornik",
  OSOBA_FIZYCZNA: "Osoba fizyczna",
};

const IDENT_LABELS: Record<BaeIdentifierType, string> = {
  EDELIVERY_ADDRESS: "Adres do doręczeń elektronicznych",
  NIP: "NIP",
  REGON: "REGON",
  KRS: "Numer KRS",
  NAME: "Dane instytucji / nazwa",
};

export default function EdoreczeniaBaeSearchDialog({ open, onOpenChange, onPick }: Props) {
  const run = useServerFn(searchBaeAddresses);
  const [recipientType, setRecipientType] = useState<BaeRecipientType>("ALL");
  const [identifierType, setIdentifierType] = useState<BaeIdentifierType>("EDELIVERY_ADDRESS");
  const [value, setValue] = useState("");
  // Rozszerzone pola dla identyfikatora "Dane instytucji" (NAME)
  const [entityName, setEntityName] = useState("");
  const [countryCode, setCountryCode] = useState("PL");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [street, setStreet] = useState("");
  const [buildingNumber, setBuildingNumber] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BaeSearchResultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState<string[]>([]);

  const isName = identifierType === "NAME";

  const handleSearch = async () => {
    setError(null);
    setResults(null);
    if (isName) {
      if (!entityName.trim()) return setError("Podaj nazwę instytucji.");
      if (!city.trim()) return setError("Podaj miejscowość.");
      if (!buildingNumber.trim()) return setError("Podaj numer budynku.");
    } else if (!value.trim()) {
      return setError("Podaj wartość do wyszukania.");
    }
    setLoading(true);
    try {
      const res = await run({
        data: {
          recipientType,
          identifierType,
          value: isName ? entityName.trim() : value.trim(),
          address: isName
            ? {
                entityName: entityName.trim(),
                countryCode: countryCode.trim() || "PL",
                city: city.trim(),
                postalCode: postalCode.trim() || undefined,
                street: street.trim() || undefined,
                buildingNumber: buildingNumber.trim(),
                flatNumber: flatNumber.trim() || undefined,
              }
            : undefined,
        },
      });
      setTried(res.triedPaths);
      if (!res.ok) {
        setError(res.error ?? "Nie udało się przeszukać BAE");
        return;
      }
      setResults(res.results);
      if (res.results.length === 0) toast.info("Brak wyników w BAE");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePick = (row: BaeSearchResultRow) => {
    if (!row.address) return;
    onPick(row.address);
    toast.success(`Dodano adresata: ${row.name ?? row.address}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Adresaci — wyniki wyszukiwania</DialogTitle>
          <DialogDescription>
            Możesz wyszukać komornika lub instytucję publiczną posiadające adres do doręczeń
            elektronicznych.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Typ odbiorcy</Label>
            <Select
              value={recipientType}
              onValueChange={(v) => setRecipientType(v as BaeRecipientType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RECIPIENT_LABELS) as BaeRecipientType[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {RECIPIENT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Identyfikator instytucji</Label>
            <Select
              value={identifierType}
              onValueChange={(v) => setIdentifierType(v as BaeIdentifierType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(IDENT_LABELS) as BaeIdentifierType[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {IDENT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isName ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-2">
                <Label htmlFor="bae-name">
                  Nazwa instytucji <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="bae-name"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder="np. Sąd Rejonowy w Warszawie"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bae-city">
                    Miejscowość <span className="text-destructive">*</span>
                  </Label>
                  <Input id="bae-city" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bae-zip">Kod pocztowy</Label>
                  <Input
                    id="bae-zip"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="00-000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bae-country">Kraj</Label>
                  <Input
                    id="bae-country"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bae-street">Ulica</Label>
                  <Input
                    id="bae-street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bae-building">
                    Numer budynku <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="bae-building"
                    value={buildingNumber}
                    onChange={(e) => setBuildingNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bae-flat">Numer lokalu</Label>
                  <Input
                    id="bae-flat"
                    value={flatNumber}
                    onChange={(e) => setFlatNumber(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="bae-value">{IDENT_LABELS[identifierType]}</Label>
              <Input
                id="bae-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder={
                  identifierType === "EDELIVERY_ADDRESS" ? "AE:PL-XXXXX-XXXXX-XXXXX-YY" : ""
                }
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Szukaj
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Powrót
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Błąd wyszukiwania</AlertTitle>
              <AlertDescription className="font-mono text-xs break-all">
                {error}
                {tried.length > 0 && (
                  <div className="mt-2 opacity-70">Sprawdzone ścieżki: {tried.join(" · ")}</div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {results && results.length === 0 && !error && (
            <Alert>
              <AlertTitle>Brak wyników</AlertTitle>
              <AlertDescription>
                Nie znaleziono podmiotu w Bazie Adresów Elektronicznych (BAE) dla podanych danych.
                Sprawdź poprawność wpisanych informacji i spróbuj ponownie.
              </AlertDescription>
            </Alert>
          )}

          {results && results.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Znaleziono {results.length} {results.length === 1 ? "wynik" : "wyników"}
              </div>
              <ul className="space-y-2">
                {results.map((r, i) => (
                  <li
                    key={`${r.address}-${i}`}
                    className="rounded-md border p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold text-base uppercase">{r.name ?? "—"}</div>
                      <Button size="sm" onClick={() => handlePick(r)}>
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        Dodaj
                      </Button>
                    </div>

                    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">Adres do eDoręczeń:</dt>
                      <dd className="font-mono font-medium text-primary break-all">{r.address}</dd>

                      {r.correspondenceAddress && (
                        <>
                          <dt className="text-muted-foreground">Adres korespondencyjny:</dt>
                          <dd className="font-medium">{r.correspondenceAddress}</dd>
                        </>
                      )}

                      {r.headquartersAddress && (
                        <>
                          <dt className="text-muted-foreground">Adres siedziby:</dt>
                          <dd className="font-medium">{r.headquartersAddress}</dd>
                        </>
                      )}
                    </dl>

                    {(r.nip || r.regon || r.krs) && (
                      <div className="border-t pt-3 grid grid-cols-3 gap-3 text-sm">
                        {r.nip && (
                          <div>
                            <div className="text-xs text-muted-foreground uppercase">NIP</div>
                            <div className="font-semibold">{r.nip}</div>
                          </div>
                        )}
                        {r.regon && (
                          <div>
                            <div className="text-xs text-muted-foreground uppercase">REGON</div>
                            <div className="font-semibold">{r.regon}</div>
                          </div>
                        )}
                        {r.krs && (
                          <div>
                            <div className="text-xs text-muted-foreground uppercase">KRS</div>
                            <div className="font-semibold">{r.krs}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
