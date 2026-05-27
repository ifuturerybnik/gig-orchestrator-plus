import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Mail, Phone, MapPin, User, Building2, X } from 'lucide-react';
import {
  useContacts, useDeleteContact,
  type Contact, type ContactScope,
} from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ContactForm } from './ContactForm';
import { CONTACT_CLASSIFICATIONS, PL_VOIVODESHIPS } from '@/lib/contactClassifications';
import { sortedCountries } from '@/lib/countries';
import { listMyContactCounterpartyLinks } from '@/lib/contact-counterparty-links.functions';

const ALL = '__all__';

interface Props { scope: ContactScope; }

export function ContactsList({ scope }: Props) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState<string>(ALL);
  const [city, setCity] = useState('');
  const [region, setRegion] = useState<string>(ALL);
  const [classification, setClassification] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [toDelete, setToDelete] = useState<Contact | null>(null);

  const { data, isLoading } = useContacts({ scope, kind: 'person' });
  const del = useDeleteContact();

  const fetchCcLinks = useServerFn(listMyContactCounterpartyLinks);
  const { data: ccLinksData } = useQuery({
    queryKey: ['my-contact-counterparty-links'],
    queryFn: () => fetchCcLinks(),
    enabled: scope.kind === 'user',
  });
  const linkedContactIds = useMemo(
    () => new Set((ccLinksData?.items ?? []).map((l) => l.contact_id)),
    [ccLinksData],
  );

  const countries = useMemo(() => sortedCountries(i18n.language || 'pl'), [i18n.language]);

  const persons = useMemo(() => {
    const rows = data ?? [];
    const q = search.trim().toLowerCase();
    const cityQ = city.trim().toLowerCase();
    return rows.filter(c => {
      if (q) {
        const hay = [
          c.display_name, c.first_name, c.last_name, c.middle_name,
          c.email, c.phone, c.city, c.address_line1, c.address_line2,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (country !== ALL && (c.country_code ?? '') !== country) return false;
      if (cityQ && !(c.city ?? '').toLowerCase().includes(cityQ)) return false;
      if (region !== ALL && (c.region ?? '') !== region) return false;
      if (classification !== ALL && !(c.tags ?? []).includes(classification)) return false;
      return true;
    });
  }, [data, search, country, city, region, classification]);

  const filtersActive =
    !!search || country !== ALL || !!city || region !== ALL || classification !== ALL;

  const openAdd = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: Contact) => { setEditing(c); setOpen(true); };

  const clearFilters = () => {
    setSearch(''); setCountry(ALL); setCity(''); setRegion(ALL); setClassification(ALL);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success(t('common.deleted', 'Usunięto'));
      setToDelete(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('contacts.list.search_placeholder')}
            className="pl-8"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd}><Plus className="mr-1 h-4 w-4" />{t('contacts.actions.add')}</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? t('contacts.actions.edit') : t('contacts.actions.add')}</DialogTitle>
            </DialogHeader>
            <ContactForm
              scope={scope}
              initial={editing}
              onSaved={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('contacts.list.filters')}
          </p>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-xs">
              <X className="mr-1 h-3 w-3" />
              {t('contacts.list.filters_clear')}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">{t('contacts.list.filter_country')}</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('contacts.list.filter_all_countries')}</SelectItem>
                {countries.map(c => (
                  <SelectItem key={c.code} value={c.code}>
                    {(i18n.language || 'pl').startsWith('pl') ? c.name_pl : c.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('contacts.list.filter_city')}</Label>
            <Input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder={t('contacts.list.filter_city_placeholder')}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('contacts.list.filter_region')}</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('contacts.list.filter_all_regions')}</SelectItem>
                {PL_VOIVODESHIPS.map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('contacts.list.filter_classification')}</Label>
            <Select value={classification} onValueChange={setClassification}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('contacts.list.filter_all_classifications')}</SelectItem>
                {CONTACT_CLASSIFICATIONS.map(cl => (
                  <SelectItem key={cl} value={cl}>{t(`contacts.classification.${cl}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('contacts.list.loading')}</p>
      ) : (data ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t('contacts.list.empty')}
        </p>
      ) : persons.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t('contacts.list.no_results')}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {persons.map(c => {
            const classifications = (c.tags ?? []).filter(t =>
              (CONTACT_CLASSIFICATIONS as readonly string[]).includes(t),
            );
            const addrParts = [
              c.address_line1 && c.address_line2 ? `${c.address_line1} ${c.address_line2}` : c.address_line1 || c.address_line2,
              c.postal_code,
              c.city,
              c.region,
            ].filter(Boolean);
            return (
              <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-accent/40">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="rounded-md bg-muted p-2 text-muted-foreground"><User className="h-4 w-4" /></span>
                    {linkedContactIds.has(c.id) && (
                      <span
                        className="rounded-md bg-muted p-1.5 text-muted-foreground"
                        title={t('contacts.links.has_linked_counterparties')}
                        aria-label={t('contacts.links.has_linked_counterparties')}
                      >
                        <Building2 className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-medium text-foreground">{c.display_name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                      {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                      {addrParts.length > 0 && (
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{addrParts.join(', ')}</span>
                      )}
                    </div>
                    {classifications.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {classifications.map(cl => (
                          <Badge key={cl} variant="secondary" className="text-[10px]">
                            {t(`contacts.classification.${cl}`)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label={t('contacts.actions.edit')}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setToDelete(c)} aria-label={t('contacts.actions.delete')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('contacts.form.delete_confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{toDelete?.display_name}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('contacts.actions.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
