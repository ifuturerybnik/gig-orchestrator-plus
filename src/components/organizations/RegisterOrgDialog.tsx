import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { createOrganization } from "@/lib/organizations.functions";
import {
  searchSharedOrganizations,
  requestJoinOrganization,
} from "@/lib/counterparties.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCountry?: string;
  /** Po sukcesie — np. odświeżenie listy. */
  onCreated?: () => void;
}

export function RegisterOrgDialog({
  open,
  onOpenChange,
  defaultCountry = "PL",
  onCreated,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const createFn = useServerFn(createOrganization);
  const searchFn = useServerFn(searchSharedOrganizations);
  const joinFn = useServerFn(requestJoinOrganization);

  const [types, setTypes] = useState<OrgType[]>([]);
  const [name, setName] = useState("");
  const [artistKind, setArtistKind] = useState<ArtistKind | "">("");
  const [genre, setGenre] = useState<MusicGenre | "">("");
  const [description, setDescription] = useState("");
  const [isShared, setIsShared] = useState(true);

  type Match = {
    id: string;
    name: string;
    types: string[] | null;
    tax_id: string | null;
    legal_name: string | null;
    address_city: string | null;
  };
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Dane firmy
  const [country, setCountry] = useState(defaultCountry);
  const [nip, setNip] = useState("");
  const [legalName, setLegalName] = useState("");
  const [postal, setPostal] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [buildingNo, setBuildingNo] = useState("");

  const showArtist = useMemo(() => hasArtistType(types), [types]);
  const showCompany = useMemo(() => hasAnyCompanyType(types), [types]);
  const showGenre = showArtist && artistKindNeedsGenre(artistKind as ArtistKind);

  // Reset gdy zamykane
  useEffect(() => {
    if (!open) {
      setTypes([]);
      setName("");
      setArtistKind("");
      setGenre("");
      setDescription("");
      setCountry(defaultCountry);
      setNip("");
      setLegalName("");
      setPostal("");
      setCity("");
      setStreet("");
      setBuildingNo("");
      setIsShared(true);
      setMatches(null);
    }
  }, [open, defaultCountry]);

  const toggleType = (typeId: OrgType, checked: boolean) => {
    setTypes((prev) =>
      checked ? Array.from(new Set([...prev, typeId])) : prev.filter((x) => x !== typeId),
    );
  };

  const mutation = useMutation({
    mutationFn: () => {
      const displayName = showArtist ? name : (legalName || name);
      return createFn({
        data: {
          types,
          name: displayName.trim(),
          description: description.trim() || undefined,
          artist_kind: showArtist && artistKind ? (artistKind as ArtistKind) : null,
          genres: showGenre && genre ? [genre as MusicGenre] : undefined,
          legal_name: showCompany ? (legalName || undefined) : undefined,
          tax_id: showCompany ? (nip ? normalizeNip(nip) : undefined) : undefined,
          address_country: showCompany ? country : undefined,
          address_postal_code: showCompany ? (postal || undefined) : undefined,
          address_city: showCompany ? (city || undefined) : undefined,
          address_street: showCompany ? (street || undefined) : undefined,
          address_building_no: showCompany ? (buildingNo || undefined) : undefined,
          is_shared: isShared,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("organizations.dialog.created"));
      queryClient.invalidateQueries({ queryKey: ["my-organizations"] });
      onCreated?.();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = (() => {
    if (types.length === 0) return false;
    if (showArtist && (!name.trim() || !artistKind)) return false;
    if (showArtist && artistKindNeedsGenre(artistKind as ArtistKind) && !genre) return false;
    if (showCompany) {
      if (!legalName.trim()) return false;
      if (nip && !looksLikeValidNip(nip)) return false;
    }
    if (!showArtist && !legalName.trim() && !name.trim()) return false;
    return true;
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("organizations.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("organizations.dialog.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Multi-select typów */}
          <section className="space-y-3">
            <Label className="text-sm font-semibold">
              {t("organizations.dialog.types_label")}
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {ORG_TYPES.map((typeId) => (
                <label
                  key={typeId}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-2 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={types.includes(typeId)}
                    onCheckedChange={(c) => toggleType(typeId, c === true)}
                  />
                  <span>{t(`organizations.type.${typeId}`)}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Artysta */}
          {showArtist && (
            <section className="space-y-4 rounded-md border border-primary/30 bg-primary/5 p-4">
              <h3 className="text-sm font-semibold">
                {t("organizations.dialog.artist_section")}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="org-artist-name">
                  {t("organizations.dialog.artist_name")} *
                </Label>
                <Input
                  id="org-artist-name"
                  required={showArtist}
                  maxLength={200}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-artist-kind">
                  {t("organizations.dialog.artist_kind")} *
                </Label>
                <Select
                  value={artistKind}
                  onValueChange={(v) => {
                    setArtistKind(v as ArtistKind);
                    if (!artistKindNeedsGenre(v as ArtistKind)) setGenre("");
                  }}
                >
                  <SelectTrigger id="org-artist-kind">
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
                  <Label>{t("organizations.dialog.genre")} *</Label>
                  <RadioGroup
                    value={genre}
                    onValueChange={(v) => setGenre(v as MusicGenre)}
                    className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                  >
                    {MUSIC_GENRES.filter((g) => g !== "other").map((g) => (
                      <label
                        key={g}
                        htmlFor={`rg-${g}`}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-2 text-sm hover:bg-muted/50"
                      >
                        <RadioGroupItem id={`rg-${g}`} value={g} />
                        <span>{t(`organizations.genres.${g}`)}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </section>
          )}

          {/* Firma */}
          {showCompany && (
            <section className="space-y-4 rounded-md border border-primary/30 bg-primary/5 p-4">
              <h3 className="text-sm font-semibold">
                {t("organizations.dialog.company_section")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="org-country">{t("address.country")}</Label>
                  <CountrySelect
                    id="org-country"
                    value={country}
                    onChange={setCountry}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="org-nip">
                    {t("organizations.dialog.nip")}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="org-nip"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      onBlur={() => setNip((v) => normalizeNip(v))}
                      placeholder="1234567890"
                      maxLength={20}
                    />
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              type="button"
                              variant="outline"
                              disabled
                            >
                              {t("organizations.dialog.gus_fetch")}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("organizations.dialog.gus_tooltip")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {nip && !looksLikeValidNip(nip) && (
                    <p className="text-xs text-destructive">
                      {t("organizations.dialog.nip_invalid")}
                    </p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="org-legal-name">
                    {t("organizations.dialog.legal_name")} *
                  </Label>
                  <Input
                    id="org-legal-name"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    maxLength={200}
                    required={showCompany}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-postal">{t("address.postal_code")}</Label>
                  <Input
                    id="org-postal"
                    value={postal}
                    onChange={(e) => setPostal(e.target.value)}
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-city">{t("address.city")}</Label>
                  <Input
                    id="org-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-street">
                    {t("organizations.dialog.street")}
                  </Label>
                  <Input
                    id="org-street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-bno">
                    {t("organizations.dialog.building_no")}
                  </Label>
                  <Input
                    id="org-bno"
                    value={buildingNo}
                    onChange={(e) => setBuildingNo(e.target.value)}
                    maxLength={40}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Opis */}
          <section className="space-y-2">
            <Label htmlFor="org-desc">
              {t("organizations.dialog.description")}
            </Label>
            <Textarea
              id="org-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
            />
          </section>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit || mutation.isPending}>
              {t("organizations.form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
