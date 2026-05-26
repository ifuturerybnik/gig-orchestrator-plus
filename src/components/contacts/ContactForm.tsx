import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  type Contact, type ContactKind, type ContactCategory, type ContactArtistType,
  type ContactScope, useUpsertContact,
} from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhoneInput } from '@/components/phone-input';
import { CountrySelect } from '@/components/country-select';
import { WysiwygEditor } from '@/components/ui/wysiwyg-editor';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface Props {
  scope: ContactScope;
  initial?: Contact | null;
  defaultKind?: ContactKind;
  onSaved: (c: Contact) => void;
  onCancel?: () => void;
}

const CATS: ContactCategory[] = ['client','supplier','artist','partner','venue','media','other'];
const ARTIST_TYPES: ContactArtistType[] = ['solo','band','ensemble','dj'];

function parseCsv(v: string): string[] {
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

export function ContactForm({ scope, initial, defaultKind = 'person', onSaved, onCancel }: Props) {
  const { t } = useTranslation();
  const upsert = useUpsertContact();

  const [kind, setKind] = useState<ContactKind>(initial?.kind ?? defaultKind);
  const [category, setCategory] = useState<ContactCategory | ''>(initial?.category ?? '');
  // person
  const [firstName, setFirstName] = useState(initial?.first_name ?? '');
  const [lastName, setLastName] = useState(initial?.last_name ?? '');
  const [middleName, setMiddleName] = useState(initial?.middle_name ?? '');
  const [position, setPosition] = useState(initial?.position ?? '');
  const [birthDate, setBirthDate] = useState(initial?.birth_date ?? '');
  // company / artist name (we use display_name on save when not person)
  const [name, setName] = useState(initial?.kind !== 'person' ? (initial?.display_name ?? '') : '');
  const [legalName, setLegalName] = useState(initial?.legal_name ?? '');
  const [taxId, setTaxId] = useState(initial?.tax_id ?? '');
  const [regNo, setRegNo] = useState(initial?.registration_no ?? '');
  // artist
  const [artistType, setArtistType] = useState<ContactArtistType | ''>(initial?.artist_type ?? '');
  const [genres, setGenres] = useState((initial?.genres ?? []).join(', '));
  const [riderUrl, setRiderUrl] = useState(initial?.rider_url ?? '');
  const [techRiderUrl, setTechRiderUrl] = useState(initial?.tech_rider_url ?? '');
  // contact info
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [website, setWebsite] = useState(initial?.website ?? '');
  // address
  const [addressLine1, setAddressLine1] = useState(initial?.address_line1 ?? '');
  const [addressLine2, setAddressLine2] = useState(initial?.address_line2 ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [postalCode, setPostalCode] = useState(initial?.postal_code ?? '');
  const [region, setRegion] = useState(initial?.region ?? '');
  const [countryCode, setCountryCode] = useState(initial?.country_code ?? '');
  // meta
  const [tagsStr, setTagsStr] = useState((initial?.tags ?? []).join(', '));
  const [source, setSource] = useState(initial?.source ?? '');
  const [preferredLanguage, setPreferredLanguage] = useState(initial?.preferred_language ?? '');
  const [notesHtml, setNotesHtml] = useState<string>(() => {
    const n = initial?.notes as { html?: string } | null | undefined;
    return n?.html ?? '';
  });

  useEffect(() => { if (initial) setKind(initial.kind); }, [initial]);

  const handleSave = async () => {
    try {
      const base: Record<string, unknown> = {
        kind,
        category: category || null,
        email: email.trim() || null,
        phone: phone || null,
        website: website.trim() || null,
        country_code: countryCode || null,
        address_line1: addressLine1.trim() || null,
        address_line2: addressLine2.trim() || null,
        city: city.trim() || null,
        postal_code: postalCode.trim() || null,
        region: region.trim() || null,
        tags: parseCsv(tagsStr),
        source: source.trim() || null,
        preferred_language: preferredLanguage.trim() || null,
        notes: notesHtml ? { html: notesHtml } : null,
      };
      if (kind === 'person') {
        Object.assign(base, {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          middle_name: middleName.trim() || null,
          position: position.trim() || null,
          birth_date: birthDate || null,
          legal_name: null, tax_id: null, registration_no: null,
          artist_type: null, genres: null, rider_url: null, tech_rider_url: null,
        });
      } else if (kind === 'company') {
        Object.assign(base, {
          display_name: name.trim(),
          legal_name: legalName.trim() || null,
          tax_id: taxId.trim() || null,
          registration_no: regNo.trim() || null,
          first_name: null, last_name: null, middle_name: null, position: null, birth_date: null,
          artist_type: null, genres: null, rider_url: null, tech_rider_url: null,
        });
      } else {
        Object.assign(base, {
          display_name: name.trim(),
          artist_type: artistType || null,
          genres: parseCsv(genres),
          rider_url: riderUrl.trim() || null,
          tech_rider_url: techRiderUrl.trim() || null,
          first_name: null, last_name: null, middle_name: null, position: null, birth_date: null,
          legal_name: null, tax_id: null, registration_no: null,
        });
      }
      const saved = await upsert.mutateAsync({
        scope, kind, ...(initial?.id ? { id: initial.id } : {}), ...base,
      } as never);
      toast.success(t('contacts.form.saved'));
      onSaved(saved);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Typ kontaktu */}
      {!initial && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">{t('contacts.form.section_kind')}</h3>
          <Tabs value={kind} onValueChange={v => setKind(v as ContactKind)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="person">{t('contacts.kinds.person')}</TabsTrigger>
              <TabsTrigger value="company">{t('contacts.kinds.company')}</TabsTrigger>
              <TabsTrigger value="artist">{t('contacts.kinds.artist')}</TabsTrigger>
            </TabsList>
            <TabsContent value={kind} />
          </Tabs>
        </section>
      )}

      {/* Sekcja zależna od typu */}
      {kind === 'person' && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t('contacts.form.section_person')}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t('contacts.form.first_name')}>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
            </Field>
            <Field label={t('contacts.form.middle_name')}>
              <Input value={middleName} onChange={e => setMiddleName(e.target.value)} />
            </Field>
            <Field label={t('contacts.form.last_name')}>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('contacts.form.position')}>
              <Input value={position} onChange={e => setPosition(e.target.value)} />
            </Field>
            <Field label={t('contacts.form.birth_date')}>
              <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
            </Field>
          </div>
        </section>
      )}

      {kind === 'company' && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t('contacts.form.section_company')}</h3>
          <Field label={t('contacts.form.company_name')}>
            <Input value={name} onChange={e => setName(e.target.value)} required />
          </Field>
          <Field label={t('contacts.form.legal_name')}>
            <Input value={legalName} onChange={e => setLegalName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('contacts.form.tax_id')}>
              <Input value={taxId} onChange={e => setTaxId(e.target.value)} />
            </Field>
            <Field label={t('contacts.form.registration_no')}>
              <Input value={regNo} onChange={e => setRegNo(e.target.value)} />
            </Field>
          </div>
        </section>
      )}

      {kind === 'artist' && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t('contacts.form.section_artist')}</h3>
          <Field label={t('contacts.form.artist_name')}>
            <Input value={name} onChange={e => setName(e.target.value)} required />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('contacts.artist_type.label')}>
              <Select value={artistType} onValueChange={v => setArtistType(v as ContactArtistType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ARTIST_TYPES.map(a => (
                    <SelectItem key={a} value={a}>{t(`contacts.artist_type.${a}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('contacts.form.genres')}>
              <Input value={genres} onChange={e => setGenres(e.target.value)} placeholder="rock, jazz" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('contacts.form.rider_url')}>
              <Input value={riderUrl} onChange={e => setRiderUrl(e.target.value)} />
            </Field>
            <Field label={t('contacts.form.tech_rider_url')}>
              <Input value={techRiderUrl} onChange={e => setTechRiderUrl(e.target.value)} />
            </Field>
          </div>
        </section>
      )}

      {/* Kontakt */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t('contacts.form.section_contact')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('contacts.form.email')}>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </Field>
          <Field label={t('contacts.form.phone')}>
            <PhoneInput value={phone} onChange={setPhone} />
          </Field>
        </div>
        <Field label={t('contacts.form.website')}>
          <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" />
        </Field>
      </section>

      {/* Adres */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t('contacts.form.section_address')}</h3>
        <Field label={t('address.street')}>
          <Input value={addressLine1} onChange={e => setAddressLine1(e.target.value)} />
        </Field>
        <Field label="">
          <Input value={addressLine2} onChange={e => setAddressLine2(e.target.value)} placeholder="cd. adresu" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t('address.postal_code')}>
            <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} />
          </Field>
          <Field label={t('address.city')}>
            <Input value={city} onChange={e => setCity(e.target.value)} />
          </Field>
          <Field label="Województwo / Region">
            <Input value={region} onChange={e => setRegion(e.target.value)} />
          </Field>
        </div>
        <Field label={t('address.country')}>
          <CountrySelect value={countryCode} onChange={setCountryCode} />
        </Field>
      </section>

      {/* Meta */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t('contacts.form.section_meta')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('contacts.category.label')}>
            <Select value={category} onValueChange={v => setCategory(v as ContactCategory)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {CATS.map(c => (
                  <SelectItem key={c} value={c}>{t(`contacts.category.${c}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('contacts.form.source')}>
            <Input value={source} onChange={e => setSource(e.target.value)} />
          </Field>
        </div>
        <Field label={t('contacts.form.tags')}>
          <Input value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="vip, lokalny" />
        </Field>
        <Field label={t('contacts.form.preferred_language')}>
          <Input value={preferredLanguage} onChange={e => setPreferredLanguage(e.target.value)} placeholder="pl, en, de..." />
        </Field>
        <Field label={t('contacts.form.notes')}>
          <WysiwygEditor value={notesHtml} onChange={setNotesHtml} minHeight="160px" hideHeadings />
        </Field>
      </section>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        {onCancel && <Button variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>}
        <Button onClick={handleSave} disabled={upsert.isPending}>
          {upsert.isPending ? t('common.saving') : t('contacts.form.save')}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs">{label}</Label>}
      {children}
    </div>
  );
}
