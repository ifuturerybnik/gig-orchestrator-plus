import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountrySelect } from "@/components/country-select";
import {
  ORG_TYPES,
  ARTIST_KINDS,
  hasArtistType,
  hasAnyCompanyType,
  artistKindNeedsGenre,
  type OrgType,
  type ArtistKind,
} from "@/lib/orgTypes";
import { MUSIC_GENRES, type MusicGenre } from "@/lib/genres";
import { normalizeNip, looksLikeValidNip } from "@/lib/nip";
import {
  getCounterpartyDetails,
  updateMyCounterparty,
} from "@/lib/counterparty-links.functions";

interface Props {
  linkId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function CounterpartyDetailsDialog({ linkId, onOpenChange }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const getFn = useServerFn(getCounterpartyDetails);
  const updateFn = useServerFn(updateMyCounterparty);

  const open = !!linkId;

  const { data, isLoading } = useQuery({
    queryKey: ["counterparty-details", linkId],
    queryFn: () => getFn({ data: { linkId: linkId! } }),
    enabled: open,
  });

  const [name, setName] = useState("");
  const [types, setTypes] = useState<OrgType[]>([]);
  const [artistKind, setArtistKind] = useState<ArtistKind | "">("");
  const [genre, setGenre] = useState<MusicGenre | "">("");
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState("PL");
  const [nip, setNip] = useState("");
  const [postal, setPostal] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [buildingNo, setBuildingNo] = useState("");

  useEffect(() => {
    if (!data?.organization) return;
    const o = data.organization;
    setName(o.name ?? "");
    setTypes((o.types ?? []) as OrgType[]);
    setArtistKind((o.artist_kind as ArtistKind | null) ?? "");
    setGenre(((o.genres ?? [])[0] as MusicGenre | undefined) ?? "");
    setDescription(o.description ?? "");
    setCountry(o.address_country ?? "PL");
    setNip(o.tax_id ?? "");
    setPostal(o.address_postal_code ?? "");
    setCity(o.address_city ?? "");
    setStreet(o.address_street ?? "");
    setBuildingNo(o.address_building_no ?? "");
  }, [data?.organization]);

  const canEdit = data?.canEdit ?? false;
  const readOnly = !canEdit;

  const showArtist = useMemo(() => hasArtistType(types), [types]);
  const showCompany = useMemo(() => hasAnyCompanyType(types), [types]);
  const showGenre =
    showArtist && artistKindNeedsGenre(artistKind as ArtistKind);

  const toggleType = (typeId: OrgType, checked: boolean) => {
    if (readOnly) return;
    setTypes((prev) =>
      checked ? Array.from(new Set([...prev, typeId])) : prev.filter((x) => x !== typeId),
    );
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          linkId: linkId!,
          name: name.trim(),
          types,
          description: description.trim() || undefined,
          artist_kind: showArtist && artistKind ? (artistKind as ArtistKind) : null,
          genres: showGenre && genre ? [genre as MusicGenre] : undefined,
          tax_id: showCompany && nip ? normalizeNip(nip) : undefined,
          address_country: showCompany ? country : undefined,
          address_postal_code: showCompany ? postal || undefined : undefined,
          address_city: showCompany ? city || undefined : undefined,
          address_street: showCompany ? street || undefined : undefined,
          address_building_no: showCompany ? buildingNo || undefined : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("organizations.counterparties.details.saved"));
      queryClient.invalidateQueries({ queryKey: ["my-counterparties"] });
      queryClient.invalidateQueries({ queryKey: ["counterparty-details", linkId] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const canSubmit = (() => {
    if (!canEdit) return false;
    if (name.trim().length < 2) return false;
    if (types.length === 0) return false;
    if (showArtist && !artistKind) return false;
    if (showArtist && artistKindNeedsGenre(artistKind as ArtistKind) && !genre) return false;
    if (showCompany && nip && !looksLikeValidNip(normalizeNip(nip))) return false;
    return true;
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {readOnly
              ? t("organizations.counterparties.details.view_title")
              : t("organizations.counterparties.details.edit_title")}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? t("organizations.counterparties.details.view_subtitle")
              : t("organizations.counterparties.details.edit_subtitle")}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cpd-name">
                {t("organizations.counterparties.dialog.name_label")}
              </Label>
              <Input
                id="cpd-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={readOnly}
                maxLength={200}
              />
            </div>

            <section className="space-y-3">
              <Label className="text-sm font-semibold">
                {t("organizations.dialog.types_label")}
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ORG_TYPES.map((typeId) => (
                  <label
                    key={typeId}
                    className={`flex items-center gap-2 rounded-md border border-border bg-background p-2 text-sm ${
                      readOnly ? "opacity-80" : "cursor-pointer hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={types.includes(typeId)}
                      onCheckedChange={(c) => toggleType(typeId, c === true)}
                      disabled={readOnly}
                    />
                    <span>{t(`organizations.type.${typeId}`)}</span>
                  </label>
                ))}
              </div>
            </section>

            {showArtist && (
              <section className="space-y-4 rounded-md border border-primary/30 bg-primary/5 p-4">
                <h3 className="text-sm font-semibold">
                  {t("organizations.dialog.artist_section")}
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="cpd-artist-kind">
                    {t("organizations.dialog.artist_kind")}
                  </Label>
                  <Select
                    value={artistKind}
                    onValueChange={(v) => {
                      setArtistKind(v as ArtistKind);
                      if (!artistKindNeedsGenre(v as ArtistKind)) setGenre("");
                    }}
                    disabled={readOnly}
                  >
                    <SelectTrigger id="cpd-artist-kind">
                      <SelectValue placeholder={t("organizations.dialog.choose")} />
                    </SelectTrigger>
                    <SelectContent>
                      {ARTIST_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {t(`organizations.artist_kind.${k}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {showGenre && (
                  <div className="space-y-2">
                    <Label>{t("organizations.dialog.genre")}</Label>
                    <RadioGroup
                      value={genre}
                      onValueChange={(v) => !readOnly && setGenre(v as MusicGenre)}
                      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                      disabled={readOnly}
                    >
                      {MUSIC_GENRES.filter((g) => g !== "other").map((g) => (
                        <label
                          key={g}
                          htmlFor={`cpd-rg-${g}`}
                          className={`flex items-center gap-2 rounded-md border border-border bg-background p-2 text-sm ${
                            readOnly ? "opacity-80" : "cursor-pointer hover:bg-muted/50"
                          }`}
                        >
                          <RadioGroupItem id={`cpd-rg-${g}`} value={g} disabled={readOnly} />
                          <span>{t(`organizations.genres.${g}`)}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                )}
              </section>
            )}

            {showCompany && (
              <section className="space-y-4 rounded-md border border-primary/30 bg-primary/5 p-4">
                <h3 className="text-sm font-semibold">
                  {t("organizations.dialog.company_section")}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cpd-country">{t("address.country")}</Label>
                    <CountrySelect
                      id="cpd-country"
                      value={country}
                      onChange={setCountry}
                      disabled={readOnly}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cpd-nip">{t("organizations.dialog.nip")}</Label>
                    <Input
                      id="cpd-nip"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      onBlur={() => setNip((v) => normalizeNip(v))}
                      disabled={readOnly}
                      maxLength={20}
                    />
                    {nip && !looksLikeValidNip(normalizeNip(nip)) && (
                      <p className="text-xs text-destructive">
                        {t("organizations.dialog.nip_invalid")}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpd-postal">{t("address.postal_code")}</Label>
                    <Input
                      id="cpd-postal"
                      value={postal}
                      onChange={(e) => setPostal(e.target.value)}
                      disabled={readOnly}
                      maxLength={20}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpd-city">{t("address.city")}</Label>
                    <Input
                      id="cpd-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      disabled={readOnly}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpd-street">{t("organizations.dialog.street")}</Label>
                    <Input
                      id="cpd-street"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      disabled={readOnly}
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpd-bno">{t("organizations.dialog.building_no")}</Label>
                    <Input
                      id="cpd-bno"
                      value={buildingNo}
                      onChange={(e) => setBuildingNo(e.target.value)}
                      disabled={readOnly}
                      maxLength={40}
                    />
                  </div>
                </div>
              </section>
            )}

            <section className="space-y-2">
              <Label htmlFor="cpd-desc">{t("organizations.dialog.description")}</Label>
              <Textarea
                id="cpd-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={readOnly}
                rows={4}
                maxLength={2000}
              />
            </section>

            {readOnly && (
              <p className="text-xs text-muted-foreground">
                {t("organizations.counterparties.details.readonly_hint")}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? t("common.close") : t("common.cancel")}
          </Button>
          {!readOnly && (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!canSubmit || saveMutation.isPending}
            >
              {saveMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
