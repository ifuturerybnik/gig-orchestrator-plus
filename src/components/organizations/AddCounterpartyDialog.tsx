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
import { Badge } from "@/components/ui/badge";
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
import { Building2 } from "lucide-react";
import { normalizeOrgName } from "@/lib/normalizeOrgName";
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
  checkOrgNameAvailability,
  addCounterpartyLink,
  createCounterpartyDraft,
} from "@/lib/counterparty-links.functions";
import { linkContactToCounterparty } from "@/lib/contact-counterparty-links.functions";
import { setCounterpartyOrgShares } from "@/lib/org-sharing.functions";
import {
  LinkedContactsSection,
  type PendingContact,
} from "@/components/pickers/LinkedContactsSection";
import { MyOrgsShareSection } from "@/components/pickers/MyOrgsShareSection";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCountry?: string;
  /** Gdy podane — kontrahent dodawany jest do tej organizacji (owner_kind='organization'). */
  ownerOrgId?: string;
}

type MatchOrg = {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  address_city: string | null;
  address_country: string | null;
  address_street: string | null;
  address_building_no: string | null;
  address_postal_code: string | null;
};

export function AddCounterpartyDialog({
  open,
  onOpenChange,
  defaultCountry,
  ownerOrgId,
}: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const checkFn = useServerFn(checkOrgNameAvailability);
  const addFn = useServerFn(addCounterpartyLink);
  const createDraftFn = useServerFn(createCounterpartyDraft);

  const langCountry = i18n.language?.toLowerCase().startsWith("pl") ? "PL" : "PL";
  const initialCountry = defaultCountry ?? langCountry;

  // step 1
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [debounced, setDebounced] = useState("");

  // step 2
  const [types, setTypes] = useState<OrgType[]>([]);
  const [artistKind, setArtistKind] = useState<ArtistKind | "">("");
  const [genre, setGenre] = useState<MusicGenre | "">("");
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState(initialCountry);
  const [nip, setNip] = useState("");
  const [postal, setPostal] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [buildingNo, setBuildingNo] = useState("");
  const [pendingContacts, setPendingContacts] = useState<PendingContact[]>([]);
  const [shareOrgIds, setShareOrgIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setName("");
      setDebounced("");
      setTypes([]);
      setArtistKind("");
      setGenre("");
      setDescription("");
      setCountry(initialCountry);
      setNip("");
      setPostal("");
      setCity("");
      setStreet("");
      setBuildingNo("");
      setPendingContacts([]);
      setShareOrgIds(null);
    }
  }, [open, initialCountry]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(name.trim()), 350);
    return () => clearTimeout(id);
  }, [name]);

  const normalizedPreview = useMemo(() => normalizeOrgName(name), [name]);
  const canSearch = step === 1 && debounced.length >= 2 && normalizedPreview.length >= 2;

  const { data, isFetching } = useQuery({
    queryKey: ["org-name-availability", debounced],
    queryFn: () => checkFn({ data: { name: debounced } }),
    enabled: open && canSearch,
    staleTime: 30_000,
  });

  const linkContactFn = useServerFn(linkContactToCounterparty);

  const setSharesFn = useServerFn(setCounterpartyOrgShares);

  const flushPendingContacts = async (orgId: string) => {
    for (const c of pendingContacts) {
      try {
        await linkContactFn({ data: { contactId: c.id, counterpartyOrgId: orgId } });
      } catch (e) {
        toast.error(
          `${c.display_name}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  };

  const flushOrgShares = async (orgId: string) => {
    if (shareOrgIds === null) return;
    try {
      await setSharesFn({ data: { counterpartyOrgId: orgId, orgIds: shareOrgIds } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const invalidateLists = () => {
    if (ownerOrgId) {
      queryClient.invalidateQueries({ queryKey: ["org-counterparties", ownerOrgId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["my-counterparties"] });
    }
  };

  const addMutation = useMutation({
    mutationFn: (counterpartyOrgId: string) =>
      addFn({ data: { counterpartyOrgId, ownerOrgId } }),
    onSuccess: async (_r, counterpartyOrgId) => {
      await flushPendingContacts(counterpartyOrgId);
      if (!ownerOrgId) await flushOrgShares(counterpartyOrgId);
      toast.success(t("organizations.counterparties.dialog.added"));
      invalidateLists();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : String(err));
    },
  });

  const exact = data?.exact ?? [];
  const similar = data?.similar ?? [];
  const hasMatches = exact.length > 0 || similar.length > 0;
  const hasExact = exact.length > 0;

  const showArtist = useMemo(() => hasArtistType(types), [types]);
  const showCompany = useMemo(() => hasAnyCompanyType(types), [types]);
  const showGenre =
    showArtist && artistKindNeedsGenre(artistKind as ArtistKind);

  const toggleType = (typeId: OrgType, checked: boolean) => {
    setTypes((prev) =>
      checked ? Array.from(new Set([...prev, typeId])) : prev.filter((x) => x !== typeId),
    );
  };

  const createDraft = useMutation({
    mutationFn: () =>
      createDraftFn({
        data: {
          ownerOrgId,
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
    onSuccess: async (r) => {
      await flushPendingContacts(r.organizationId);
      if (!ownerOrgId) await flushOrgShares(r.organizationId);
      toast.success(t("organizations.counterparties.dialog.submitted_for_review"));
      invalidateLists();
      onOpenChange(false);
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : String(err)),
  });

  const canGoStep2 = name.trim().length >= 2 && !hasExact;
  const canSubmitStep2 = (() => {
    if (types.length === 0) return false;
    if (showArtist && !artistKind) return false;
    if (showArtist && artistKindNeedsGenre(artistKind as ArtistKind) && !genre) return false;
    if (showCompany && nip && !looksLikeValidNip(normalizeNip(nip))) return false;
    return true;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1
              ? t("organizations.counterparties.dialog.title")
              : t("organizations.counterparties.dialog.step2_title")}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? t("organizations.counterparties.dialog.subtitle")
              : t("organizations.counterparties.dialog.step2_subtitle", {
                  name: name.trim(),
                })}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="cp-name">
                {t("organizations.counterparties.dialog.name_label")}
              </Label>
              <Input
                id="cp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("organizations.counterparties.dialog.name_placeholder")}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {t("organizations.counterparties.dialog.name_help")}
              </p>
            </div>

            {canSearch && (
              <div className="space-y-3">
                {isFetching ? (
                  <p className="text-sm text-muted-foreground">
                    {t("organizations.counterparties.dialog.searching")}
                  </p>
                ) : hasMatches ? (
                  <>
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                      {hasExact
                        ? t("organizations.counterparties.dialog.found_exact")
                        : t("organizations.counterparties.dialog.found_similar")}
                    </div>
                    <ul className="space-y-2 max-h-[40vh] overflow-y-auto">
                      {[...exact, ...similar].map((org) => (
                        <MatchRow
                          key={org.id}
                          org={org as MatchOrg}
                          isExact={exact.some((e) => e.id === org.id)}
                          busy={addMutation.isPending}
                          onAdd={() => addMutation.mutate(org.id)}
                        />
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                    {t("organizations.counterparties.dialog.no_matches")}
                  </div>
                )}
              </div>
            )}

            {canSearch && hasMatches && !ownerOrgId && (
              <MyOrgsShareSection
                selectedOrgIds={shareOrgIds}
                onChange={setShareOrgIds}
              />
            )}
          </>
        )}

        {step === 2 && (
          <div className="space-y-5">
            {/* Typ organizacji */}
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
                  <Label htmlFor="cp-artist-name">
                    {t("organizations.counterparties.dialog.artist_name_label")} *
                  </Label>
                  <Input
                    id="cp-artist-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cp-artist-kind">
                    {t("organizations.dialog.artist_kind")} *
                  </Label>
                  <Select
                    value={artistKind}
                    onValueChange={(v) => {
                      setArtistKind(v as ArtistKind);
                      if (!artistKindNeedsGenre(v as ArtistKind)) setGenre("");
                    }}
                  >
                    <SelectTrigger id="cp-artist-kind">
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
                          htmlFor={`cp-rg-${g}`}
                          className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-2 text-sm hover:bg-muted/50"
                        >
                          <RadioGroupItem id={`cp-rg-${g}`} value={g} />
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
                <div className="space-y-2">
                  <Label htmlFor="cp-company-name">
                    {t("organizations.counterparties.dialog.company_name_label")} *
                  </Label>
                  <Input
                    id="cp-company-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={200}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cp-country">{t("address.country")}</Label>
                    <CountrySelect
                      id="cp-country"
                      value={country}
                      onChange={setCountry}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cp-nip">
                      {t("organizations.dialog.nip")}
                    </Label>
                    <Input
                      id="cp-nip"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      onBlur={() => setNip((v) => normalizeNip(v))}
                      placeholder="1234567890"
                      maxLength={20}
                    />
                    {nip && !looksLikeValidNip(normalizeNip(nip)) && (
                      <p className="text-xs text-destructive">
                        {t("organizations.dialog.nip_invalid")}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cp-postal">{t("address.postal_code")}</Label>
                    <Input
                      id="cp-postal"
                      value={postal}
                      onChange={(e) => setPostal(e.target.value)}
                      maxLength={20}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cp-city">{t("address.city")}</Label>
                    <Input
                      id="cp-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cp-street">
                      {t("organizations.dialog.street")}
                    </Label>
                    <Input
                      id="cp-street"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cp-bno">
                      {t("organizations.dialog.building_no")}
                    </Label>
                    <Input
                      id="cp-bno"
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
              <Label htmlFor="cp-desc">
                {t("organizations.dialog.description")}
              </Label>
              <Textarea
                id="cp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
              />
            </section>

            <LinkedContactsSection
              pending={pendingContacts}
              onPendingChange={setPendingContacts}
            />

            {!ownerOrgId && (
              <MyOrgsShareSection
                selectedOrgIds={shareOrgIds}
                onChange={setShareOrgIds}
              />
            )}

            <p className="text-xs text-muted-foreground">
              {t("organizations.counterparties.dialog.review_hint")}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!canGoStep2}
                title={
                  hasExact
                    ? t("organizations.counterparties.dialog.exact_blocks_new")
                    : undefined
                }
              >
                {t("organizations.counterparties.dialog.continue_new")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                {t("common.back")}
              </Button>
              <Button
                onClick={() => createDraft.mutate()}
                disabled={!canSubmitStep2 || createDraft.isPending}
              >
                {t("organizations.counterparties.add_btn")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MatchRow({
  org,
  isExact,
  busy,
  onAdd,
}: {
  org: MatchOrg;
  isExact: boolean;
  busy: boolean;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const addressLine = [
    [org.address_postal_code, org.address_city].filter(Boolean).join(" "),
    [org.address_street, org.address_building_no].filter(Boolean).join(" "),
    org.address_country,
  ]
    .filter((s) => s && s.length > 0)
    .join(" · ");
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="font-medium text-foreground truncate">{org.name}</p>
          {isExact && (
            <Badge variant="default" className="text-[10px]">
              {t("organizations.counterparties.dialog.badge_exact")}
            </Badge>
          )}
        </div>
        {org.legal_name && org.legal_name !== org.name && (
          <p className="text-xs text-muted-foreground truncate">
            {org.legal_name}
          </p>
        )}
        {org.tax_id && (
          <p className="text-xs text-muted-foreground">NIP: {org.tax_id}</p>
        )}
        {addressLine && (
          <p className="text-xs text-muted-foreground truncate">{addressLine}</p>
        )}
      </div>
      <Button size="sm" onClick={onAdd} disabled={busy}>
        {t("organizations.counterparties.dialog.add_btn")}
      </Button>
    </li>
  );
}
