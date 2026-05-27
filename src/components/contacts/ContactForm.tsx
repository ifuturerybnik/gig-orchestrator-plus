import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Plus, X, Building2 } from 'lucide-react';
import {
  type Contact, type ContactScope, useUpsertContact,
} from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhoneInput } from '@/components/phone-input';
import { CountrySelect } from '@/components/country-select';
import { CounterpartyPicker } from '@/components/pickers/CounterpartyPicker';
import {
  CONTACT_CLASSIFICATIONS, PL_VOIVODESHIPS,
  type ContactClassification,
} from '@/lib/contactClassifications';
import {
  linkContactToCounterparty,
  listLinkedCounterpartiesForContact,
  unlinkContactCounterparty,
} from '@/lib/contact-counterparty-links.functions';
import {
  getContactOrgShares,
  setContactOrgShares,
} from '@/lib/org-sharing.functions';
import { MyOrgsShareSection } from '@/components/pickers/MyOrgsShareSection';

interface Props {
  scope: ContactScope;
  initial?: Contact | null;
  onSaved: (c: Contact) => void;
  onCancel?: () => void;
  /** Ukryj sekcję powiązanych kontrahentów (np. gdy formularz jest osadzony w dialogu kontrahenta). */
  hideLinksSection?: boolean;
}

function readNotesText(notes: unknown): string {
  if (!notes) return '';
  if (typeof notes === 'string') return notes;
  if (typeof notes === 'object' && notes !== null && 'text' in (notes as Record<string, unknown>)) {
    const v = (notes as Record<string, unknown>).text;
    return typeof v === 'string' ? v : '';
  }
  return '';
}

export function ContactForm({ scope, initial, onSaved, onCancel, hideLinksSection }: Props) {
  const { t } = useTranslation();
  const upsert = useUpsertContact();
  const getSharesFn = useServerFn(getContactOrgShares);
  const setSharesFn = useServerFn(setContactOrgShares);

  const [firstName, setFirstName] = useState(initial?.first_name ?? '');
  const [lastName, setLastName] = useState(initial?.last_name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [countryCode, setCountryCode] = useState(initial?.country_code ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [postalCode, setPostalCode] = useState(initial?.postal_code ?? '');
  const [street, setStreet] = useState(initial?.address_line1 ?? '');
  const [buildingNo, setBuildingNo] = useState(initial?.address_line2 ?? '');
  const [region, setRegion] = useState(initial?.region ?? '');
  const [classifications, setClassifications] = useState<ContactClassification[]>(
    (initial?.tags ?? []).filter((tag): tag is ContactClassification =>
      (CONTACT_CLASSIFICATIONS as readonly string[]).includes(tag),
    ),
  );
  const [notes, setNotes] = useState(readNotesText(initial?.notes));
  const [submitting, setSubmitting] = useState(false);
  const [shareOrgIds, setShareOrgIds] = useState<string[] | null>(null);

  const { data: sharesData } = useQuery({
    queryKey: ['contact-org-shares', initial?.id ?? null],
    queryFn: () => getSharesFn({ data: { contactId: initial!.id } }),
    enabled: scope.kind === 'user' && !!initial?.id,
  });

  const toggleClassification = (c: ContactClassification) => {
    setClassifications(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c],
    );
  };

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = t('contacts.form.errors.required');
    if (!lastName.trim()) e.lastName = t('contacts.form.errors.required');
    if (!email.trim() && !phone.trim()) e.contact = t('contacts.form.errors.email_or_phone');
    if (classifications.length === 0) e.classifications = t('contacts.form.errors.classification_required');
    return e;
  }, [firstName, lastName, email, phone, classifications, t]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0]);
      return;
    }
    setSubmitting(true);
    try {
      const saved = await upsert.mutateAsync({
        scope,
        id: initial?.id,
        kind: 'person',
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        country_code: countryCode || null,
        city: city.trim() || null,
        postal_code: postalCode.trim() || null,
        address_line1: street.trim() || null,
        address_line2: buildingNo.trim() || null,
        region: region || null,
        tags: classifications,
        notes: notes.trim() ? { text: notes.trim() } : null,
      });
      if (scope.kind === 'user' && shareOrgIds !== null) {
        try {
          await setSharesFn({ data: { contactId: saved.id, orgIds: shareOrgIds } });
        } catch (e) {
          toast.error((e as Error).message);
        }
      }
      toast.success(t('contacts.form.saved'));
      onSaved(saved);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const showLinks = !hideLinksSection && scope.kind === 'user' && !!initial?.id;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Imię + Nazwisko */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t('contacts.form.section_person')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">{t('contacts.form.first_name')} *</Label>
            <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} required maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">{t('contacts.form.last_name')} *</Label>
            <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} required maxLength={100} />
          </div>
        </div>
      </section>

      {/* Dane kontaktowe */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t('contacts.form.section_contact')} <span className="text-xs font-normal text-muted-foreground">— {t('contacts.form.email_or_phone_hint')}</span>
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('contacts.form.email')}</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={255} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t('contacts.form.phone')}</Label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>
        </div>
        {errors.contact && <p className="text-xs text-destructive">{errors.contact}</p>}
      </section>

      {/* Adres */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t('contacts.form.section_address')} <span className="text-xs font-normal text-muted-foreground">— {t('contacts.form.optional')}</span>
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="country">{t('contacts.form.country')}</Label>
            <CountrySelect id="country" value={countryCode} onChange={setCountryCode} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">{t('contacts.form.city')}</Label>
            <Input id="city" value={city} onChange={e => setCity(e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="postal">{t('contacts.form.postal_code')}</Label>
            <Input id="postal" value={postalCode} onChange={e => setPostalCode(e.target.value)} maxLength={20} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="region">{t('contacts.form.region')}</Label>
            <Select value={region || 'none'} onValueChange={v => setRegion(v === 'none' ? '' : v)}>
              <SelectTrigger id="region"><SelectValue placeholder={t('contacts.form.region_placeholder')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('contacts.form.region_none')}</SelectItem>
                {PL_VOIVODESHIPS.map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="street">{t('contacts.form.street')}</Label>
            <Input id="street" value={street} onChange={e => setStreet(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bno">{t('contacts.form.building_no')}</Label>
            <Input id="bno" value={buildingNo} onChange={e => setBuildingNo(e.target.value)} maxLength={20} />
          </div>
        </div>
      </section>

      {/* Klasyfikacja */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t('contacts.form.section_meta')} <span className="text-xs font-normal text-destructive">*</span>
        </h3>
        <p className="text-xs text-muted-foreground">{t('contacts.form.classification_hint')}</p>
        <div className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONTACT_CLASSIFICATIONS.map(c => {
            const checked = classifications.includes(c);
            return (
              <label key={c} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/40">
                <Checkbox checked={checked} onCheckedChange={() => toggleClassification(c)} />
                <span className="text-sm text-foreground">{t(`contacts.classification.${c}`)}</span>
              </label>
            );
          })}
        </div>
        {errors.classifications && <p className="text-xs text-destructive">{errors.classifications}</p>}

        <div className="space-y-1.5 pt-2">
          <Label htmlFor="notes">{t('contacts.form.notes')}</Label>
          <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} rows={4} />
        </div>
      </section>

      {/* Powiązani kontrahenci */}
      {!hideLinksSection && (
        showLinks ? (
          <ContactCounterpartiesSection contactId={initial!.id} />
        ) : scope.kind === 'user' && (
          <section className="rounded-md border border-dashed border-border p-3">
            <p className="text-xs text-muted-foreground">{t('contacts.links.save_first_hint')}</p>
          </section>
        )
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {t('common.cancel')}
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? t('common.saving', 'Zapisywanie...') : t('contacts.form.save')}
        </Button>
      </div>
    </form>
  );
}

function ContactCounterpartiesSection({ contactId }: { contactId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const listFn = useServerFn(listLinkedCounterpartiesForContact);
  const linkFn = useServerFn(linkContactToCounterparty);
  const unlinkFn = useServerFn(unlinkContactCounterparty);

  const { data } = useQuery({
    queryKey: ['contact-linked-counterparties', contactId],
    queryFn: () => listFn({ data: { contactId } }),
  });

  const items = data?.items ?? [];
  const excludeIds = items.map(i => i.organization?.id).filter(Boolean) as string[];

  const linkM = useMutation({
    mutationFn: (orgId: string) =>
      linkFn({ data: { contactId, counterpartyOrgId: orgId } }),
    onSuccess: (r) => {
      if (r.alreadyLinked) toast.info(t('contacts.links.already_linked'));
      else toast.success(t('contacts.links.linked'));
      qc.invalidateQueries({ queryKey: ['contact-linked-counterparties', contactId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const unlinkM = useMutation({
    mutationFn: (linkId: string) => unlinkFn({ data: { linkId } }),
    onSuccess: () => {
      toast.success(t('contacts.links.unlinked'));
      qc.invalidateQueries({ queryKey: ['contact-linked-counterparties', contactId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{t('contacts.links.contact_section_title')}</h3>
      <p className="text-xs text-muted-foreground">{t('contacts.links.contact_section_help')}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
        <Plus className="h-4 w-4" />
        {t('contacts.links.link_cp_btn')}
      </Button>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('contacts.links.empty_counterparties')}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(it => (
            <li key={it.linkId} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm">
              <span className="inline-flex items-center gap-2 min-w-0">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{it.organization?.name ?? '—'}</span>
                {it.organization?.is_shared && (
                  <Badge variant="outline" className="text-[10px]">
                    {t('organizations.counterparties.table.source_shared')}
                  </Badge>
                )}
              </span>
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6"
                onClick={() => unlinkM.mutate(it.linkId)}
                aria-label={t('contacts.links.unlink')}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <CounterpartyPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={excludeIds}
        onPick={(o) => linkM.mutate(o.id)}
      />
    </section>
  );
}
