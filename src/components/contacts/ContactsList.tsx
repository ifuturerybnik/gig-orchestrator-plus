import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Mail, Phone, MapPin, User, Building2 } from 'lucide-react';
import {
  useContacts, useDeleteContact,
  type Contact, type ContactScope,
} from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ContactForm } from './ContactForm';
import { CONTACT_CLASSIFICATIONS } from '@/lib/contactClassifications';
import { listMyContactCounterpartyLinks } from '@/lib/contact-counterparty-links.functions';

interface Props { scope: ContactScope; }

export function ContactsList({ scope }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [toDelete, setToDelete] = useState<Contact | null>(null);

  const { data, isLoading } = useContacts({ scope, kind: 'person', search });
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

  const persons = useMemo(() => (data ?? []), [data]);

  const openAdd = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: Contact) => { setEditing(c); setOpen(true); };

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
        <div className="relative flex-1 max-w-sm">
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

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('contacts.list.loading')}</p>
      ) : persons.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t('contacts.list.empty')}
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
