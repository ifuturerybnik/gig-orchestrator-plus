import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Mail, Phone, Building2, User, Music } from 'lucide-react';
import {
  useContacts, useDeleteContact,
  type Contact, type ContactKind, type ContactCategory, type ContactScope,
} from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ContactForm } from './ContactForm';

interface Props { scope: ContactScope; }

const KINDS: ContactKind[] = ['person','company','artist'];
const CATS: ContactCategory[] = ['client','supplier','artist','partner','venue','media','other'];

const KIND_ICON: Record<ContactKind, React.ReactNode> = {
  person: <User className="h-4 w-4" />,
  company: <Building2 className="h-4 w-4" />,
  artist: <Music className="h-4 w-4" />,
};

export function ContactsList({ scope }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<ContactKind | 'all'>('all');
  const [category, setCategory] = useState<ContactCategory | 'all'>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [toDelete, setToDelete] = useState<Contact | null>(null);

  const { data, isLoading } = useContacts({
    scope,
    kind: kind === 'all' ? undefined : kind,
    category: category === 'all' ? undefined : category,
    search,
  });
  const del = useDeleteContact();

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
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('contacts.list.search_placeholder')}
              className="pl-8"
            />
          </div>
          <Select value={kind} onValueChange={v => setKind(v as typeof kind)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('contacts.list.all')}</SelectItem>
              {KINDS.map(k => (
                <SelectItem key={k} value={k}>{t(`contacts.kinds_plural.${k}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={v => setCategory(v as typeof category)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('contacts.list.all')}</SelectItem>
              {CATS.map(c => (
                <SelectItem key={c} value={c}>{t(`contacts.category.${c}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      ) : (data ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t('contacts.list.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {data!.map(c => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/40">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="rounded-md bg-muted p-2 text-muted-foreground">{KIND_ICON[c.kind]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-foreground">{c.display_name}</p>
                    {c.category && (
                      <Badge variant="secondary" className="text-[10px]">
                        {t(`contacts.category.${c.category}`)}
                      </Badge>
                    )}
                    {c.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                    ))}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {c.kind === 'person' && c.position && <span>{c.position}</span>}
                    {c.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />{c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />{c.phone}
                      </span>
                    )}
                  </div>
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
          ))}
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
