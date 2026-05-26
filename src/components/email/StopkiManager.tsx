// Concertivo — Manager stopek e-mail (zakres: user lub org).
// Port z CRM Hub, zaadaptowany do modelu hybrydowego (scope = user|org).

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Star, Pencil, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { EyedropperButton } from '@/components/ui/eyedropper-button';
import {
  useMojeStopki,
  useOrgStopki,
  useUpsertStopka,
  useDeleteStopka,
  useSetDomyslnaStopka,
  uploadStopkaPlik,
  type EmailStopkaPelna,
  type StopkaPole,
  type StopkaPoleTyp,
  type StopkaScope,
  type UpsertStopkaInput,
} from '@/hooks/useEmailStopki';
import {
  renderStopkaHtml,
  stopkaGrafikaUrl,
  SOCIAL_PLATFORMS,
  type SocialPlatformKey,
} from '@/lib/emailStopkaRender';
import { defaultStopkaIconKey } from '@/lib/emailStopkaIcons';

const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
];

const COLOR_PRESETS = ['#1e40af', '#0f766e', '#b91c1c', '#9333ea', '#ea580c', '#0891b2', '#374151', '#000000'];

const SOCIAL_PLATFORM_KEYS = Object.keys(SOCIAL_PLATFORMS) as SocialPlatformKey[];

function iconKeyForPoleTyp(typ: StopkaPoleTyp): string {
  if (typ === 'social') return '';
  return defaultStopkaIconKey(typ);
}

export type StopkaEditorState = {
  id?: string;
  nazwa: string;
  domyslna: boolean;
  kolor_akcent: string;
  czcionka: string;
  imie_nazwisko: string;
  rola: string;
  adres_firmy: string;
  adres_ikona: string;
  nazwa_firmy: string;
  tekst_dodatkowy: string;
  logo_path: string | null;
  zdjecie_path: string | null;
  facebook_url: string;
  instagram_url: string;
  linkedin_url: string;
  youtube_url: string;
  x_url: string;
  tiktok_url: string;
  pola: Array<Omit<StopkaPole, 'id' | 'stopka_id'>>;
};

export function emptyStopkaForm(domyslna = false): StopkaEditorState {
  return {
    nazwa: 'Nowa stopka',
    domyslna,
    kolor_akcent: '#1e40af',
    czcionka: 'Arial, sans-serif',
    imie_nazwisko: '',
    rola: '',
    adres_firmy: '',
    adres_ikona: defaultStopkaIconKey('adres'),
    nazwa_firmy: '',
    tekst_dodatkowy: '',
    logo_path: null,
    zdjecie_path: null,
    facebook_url: '',
    instagram_url: '',
    linkedin_url: '',
    youtube_url: '',
    x_url: '',
    tiktok_url: '',
    pola: [],
  };
}

export function stopkaPelnaToEditorState(s: EmailStopkaPelna): StopkaEditorState {
  const hasSocialPola = s.pola.some(p => p.typ === 'social');
  const legacy: Array<{ key: SocialPlatformKey; url: string | null }> = [
    { key: 'facebook', url: s.facebook_url },
    { key: 'instagram', url: s.instagram_url },
    { key: 'linkedin', url: s.linkedin_url },
    { key: 'youtube', url: s.youtube_url },
    { key: 'x', url: s.x_url },
    { key: 'tiktok', url: s.tiktok_url },
  ];
  const polaZBaz = s.pola.map(p => ({
    typ: p.typ,
    wartosc: p.wartosc,
    etykieta: p.etykieta,
    ikona: p.ikona ?? iconKeyForPoleTyp(p.typ),
    kolejnosc: p.kolejnosc,
  }));
  const polaFinal = [...polaZBaz];
  if (!hasSocialPola) {
    let k = polaFinal.length;
    legacy.forEach(({ key, url }) => {
      if (url && url.trim()) {
        polaFinal.push({ typ: 'social', wartosc: url, etykieta: key, ikona: '', kolejnosc: k++ });
      }
    });
  }
  return {
    id: s.id,
    nazwa: s.nazwa,
    domyslna: s.domyslna,
    kolor_akcent: s.kolor_akcent,
    czcionka: s.czcionka,
    imie_nazwisko: s.imie_nazwisko ?? '',
    rola: s.rola ?? '',
    adres_firmy: s.adres_firmy ?? '',
    adres_ikona: s.adres_ikona ?? defaultStopkaIconKey('adres'),
    nazwa_firmy: s.nazwa_firmy ?? '',
    tekst_dodatkowy: s.tekst_dodatkowy ?? '',
    logo_path: s.logo_path,
    zdjecie_path: s.zdjecie_path,
    facebook_url: '',
    instagram_url: '',
    linkedin_url: '',
    youtube_url: '',
    x_url: '',
    tiktok_url: '',
    pola: polaFinal,
  };
}

export function stopkaStateToUpsertInput(s: StopkaEditorState, scope: StopkaScope): UpsertStopkaInput {
  return {
    id: s.id,
    scope,
    nazwa: s.nazwa.trim() || 'Stopka',
    domyslna: s.domyslna,
    kolor_akcent: s.kolor_akcent,
    czcionka: s.czcionka,
    imie_nazwisko: s.imie_nazwisko.trim() || null,
    rola: s.rola.trim() || null,
    adres_firmy: s.adres_firmy.trim() || null,
    adres_ikona: s.adres_ikona || defaultStopkaIconKey('adres'),
    nazwa_firmy: s.nazwa_firmy.trim() || null,
    tekst_dodatkowy: s.tekst_dodatkowy.trim() || null,
    logo_path: s.logo_path,
    zdjecie_path: s.zdjecie_path,
    facebook_url: s.facebook_url.trim() || null,
    instagram_url: s.instagram_url.trim() || null,
    linkedin_url: s.linkedin_url.trim() || null,
    youtube_url: s.youtube_url.trim() || null,
    x_url: s.x_url.trim() || null,
    tiktok_url: s.tiktok_url.trim() || null,
    pola: s.pola,
  };
}

interface StopkiManagerProps {
  scope: StopkaScope;
}

export function StopkiManager({ scope }: StopkiManagerProps) {
  const { t } = useTranslation();
  const moja = useMojeStopki();
  const org = useOrgStopki(scope.kind === 'org' ? scope.organizationId : null);
  const query = scope.kind === 'user' ? moja : org;
  const lista = query.data;
  const isLoading = query.isLoading;

  const upsert = useUpsertStopka();
  const del = useDeleteStopka();
  const setDef = useSetDomyslnaStopka();

  const [editing, setEditing] = useState<StopkaEditorState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function startNew() {
    setEditing(emptyStopkaForm((lista?.length ?? 0) === 0));
  }

  function handleSave() {
    if (!editing) return;
    upsert.mutate(stopkaStateToUpsertInput(editing, scope), {
      onSuccess: () => {
        toast.success(t('stopki.saved'));
        setEditing(null);
      },
      onError: e => toast.error((e as Error).message),
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">
            {scope.kind === 'user' ? t('stopki.title_user') : t('stopki.title_org')}
          </CardTitle>
          <Button size="sm" onClick={startNew}>
            <Plus className="h-4 w-4 mr-1" /> {t('stopki.add')}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (lista?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t('stopki.empty')}
            </p>
          ) : (
            <div className="space-y-2">
              {lista!.map(s => (
                <div key={s.id} className="flex items-center gap-3 rounded-md border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{s.nazwa}</span>
                      {s.domyslna && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Star className="h-3 w-3 fill-current" /> {t('stopki.default')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.imie_nazwisko || '—'}
                      {s.rola ? ` · ${s.rola}` : ''}
                    </p>
                  </div>
                  {!s.domyslna && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDef.mutate(s.id, {
                        onSuccess: () => toast.success(t('stopki.set_default_ok')),
                        onError: e => toast.error((e as Error).message),
                      })}
                      title={t('stopki.set_default')}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(stopkaPelnaToEditorState(s))}
                    title={t('common.edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(s.id)}
                    title={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? t('stopki.edit_title') : t('stopki.new_title')}</DialogTitle>
          </DialogHeader>
          {editing && (
            <StopkaEditor value={editing} onChange={setEditing} scope={scope} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stopki.delete_confirm_title')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('stopki.delete_confirm_desc')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirmDelete) return;
                del.mutate(confirmDelete, {
                  onSuccess: () => { toast.success(t('stopki.deleted')); setConfirmDelete(null); },
                  onError: e => toast.error((e as Error).message),
                });
              }}
              disabled={del.isPending}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- Editor -------------------- */

export function StopkaEditor({
  value,
  onChange,
  scope,
}: {
  value: StopkaEditorState;
  onChange: (v: StopkaEditorState) => void;
  scope: StopkaScope;
}) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState<'logo' | 'zdjecie' | null>(null);

  function set<K extends keyof StopkaEditorState>(key: K, v: StopkaEditorState[K]) {
    onChange({ ...value, [key]: v });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, prefix: 'logo' | 'zdjecie') {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('stopki.upload_too_big'));
      return;
    }
    setUploading(prefix);
    try {
      const path = await uploadStopkaPlik(scope, file, prefix);
      set(prefix === 'logo' ? 'logo_path' : 'zdjecie_path', path);
      toast.success(t('stopki.uploaded'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  }

  function addPole(typ: StopkaPoleTyp, etykieta: string | null = null) {
    onChange({
      ...value,
      pola: [...value.pola, { typ, wartosc: '', etykieta, ikona: iconKeyForPoleTyp(typ), kolejnosc: value.pola.length }],
    });
  }
  function updatePole(idx: number, patch: Partial<Omit<StopkaPole, 'id' | 'stopka_id'>>) {
    const next = [...value.pola];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...value, pola: next });
  }
  function removePole(idx: number) {
    onChange({ ...value, pola: value.pola.filter((_, i) => i !== idx) });
  }

  const previewHtml = useMemo(() => {
    const fake: EmailStopkaPelna = {
      id: value.id ?? 'preview',
      owner_user_id: scope.kind === 'user' ? 'preview' : null,
      organization_id: scope.kind === 'org' ? scope.organizationId : null,
      created_by: null,
      nazwa: value.nazwa,
      domyslna: value.domyslna,
      kolor_akcent: value.kolor_akcent,
      czcionka: value.czcionka,
      imie_nazwisko: value.imie_nazwisko || null,
      rola: value.rola || null,
      adres_firmy: value.adres_firmy || null,
      adres_ikona: value.adres_ikona || defaultStopkaIconKey('adres'),
      nazwa_firmy: value.nazwa_firmy || null,
      tekst_dodatkowy: value.tekst_dodatkowy || null,
      logo_path: value.logo_path,
      zdjecie_path: value.zdjecie_path,
      facebook_url: value.facebook_url || null,
      instagram_url: value.instagram_url || null,
      linkedin_url: value.linkedin_url || null,
      youtube_url: value.youtube_url || null,
      x_url: value.x_url || null,
      tiktok_url: value.tiktok_url || null,
      created_at: '',
      updated_at: '',
      pola: value.pola.map((p, i) => ({ ...p, id: String(i), stopka_id: '' })),
    };
    return renderStopkaHtml(fake, { preview: true });
  }, [value, scope]);

  const telefony = value.pola.filter(p => p.typ === 'telefon');
  const emaile = value.pola.filter(p => p.typ === 'email');
  const wwwy = value.pola.filter(p => p.typ === 'www');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{t('stopki.f.name')}</Label>
            <Input value={value.nazwa} onChange={e => set('nazwa', e.target.value)} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={value.domyslna}
                onChange={e => set('domyslna', e.target.checked)}
                className="h-4 w-4"
              />
              {t('stopki.f.set_as_default')}
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{t('stopki.f.font')}</Label>
            <Select value={value.czcionka} onValueChange={v => set('czcionka', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map(f => (
                  <SelectItem key={f.value} value={f.value}>
                    <span style={{ fontFamily: f.value }}>{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t('stopki.f.accent_color')}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value.kolor_akcent}
                onChange={e => set('kolor_akcent', e.target.value)}
                className="h-9 w-12 rounded border border-input cursor-pointer"
              />
              <Input
                value={value.kolor_akcent}
                onChange={e => set('kolor_akcent', e.target.value)}
                className="font-mono text-xs"
              />
              <EyedropperButton onPick={(c) => set('kolor_akcent', c)} />
            </div>
            <div className="flex gap-1 mt-1">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('kolor_akcent', c)}
                  className="h-5 w-5 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FileUploadField
            label={t('stopki.f.logo')}
            currentPath={value.logo_path}
            uploading={uploading === 'logo'}
            onChange={e => handleUpload(e, 'logo')}
            onClear={() => set('logo_path', null)}
            shape="square"
          />
          <FileUploadField
            label={t('stopki.f.photo')}
            currentPath={value.zdjecie_path}
            uploading={uploading === 'zdjecie'}
            onChange={e => handleUpload(e, 'zdjecie')}
            onClear={() => set('zdjecie_path', null)}
            shape="circle"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{t('stopki.f.full_name')}</Label>
            <Input value={value.imie_nazwisko} onChange={e => set('imie_nazwisko', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t('stopki.f.role')}</Label>
            <Input value={value.rola} onChange={e => set('rola', e.target.value)} />
          </div>
        </div>

        <MultiPolaSection title={t('stopki.f.phones')} items={telefony} all={value.pola} update={updatePole} remove={removePole} add={() => addPole('telefon')} placeholder="+48 123 456 789" />
        <MultiPolaSection title={t('stopki.f.emails')} items={emaile} all={value.pola} update={updatePole} remove={removePole} add={() => addPole('email')} placeholder="jan@example.com" />
        <MultiPolaSection title={t('stopki.f.websites')} items={wwwy} all={value.pola} update={updatePole} remove={removePole} add={() => addPole('www')} placeholder="https://example.com" />

        <div>
          <Label className="text-xs">{t('stopki.f.address')}</Label>
          <Textarea value={value.adres_firmy} onChange={e => set('adres_firmy', e.target.value)} rows={2} placeholder="ul. Przykładowa 1, 00-000 Warszawa" />
        </div>

        <div>
          <Label className="text-xs">{t('stopki.f.company_name')}</Label>
          <Input
            value={value.nazwa_firmy}
            onChange={e => set('nazwa_firmy', e.target.value)}
            placeholder="np. Acme Sp. z o.o."
          />
        </div>

        <SocialPolaSection all={value.pola} update={updatePole} remove={removePole} add={(platform) => addPole('social', platform)} />

        <div>
          <Label className="text-xs">{t('stopki.f.extra_text')}</Label>
          <Textarea
            value={value.tekst_dodatkowy}
            onChange={e => set('tekst_dodatkowy', e.target.value)}
            rows={4}
            placeholder={t('stopki.f.extra_text_ph')}
          />
        </div>
      </div>

      <div className="space-y-2 lg:sticky lg:top-2 lg:self-start">
        <Label className="text-xs">{t('stopki.preview')}</Label>
        <div className="rounded-md border bg-white p-4 overflow-auto">
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
        <p className="text-xs text-muted-foreground">{t('stopki.preview_help')}</p>
      </div>
    </div>
  );
}

function MultiPolaSection({
  title,
  items,
  all,
  update,
  remove,
  add,
  placeholder,
}: {
  title: string;
  items: Array<Omit<StopkaPole, 'id' | 'stopka_id'>>;
  all: Array<Omit<StopkaPole, 'id' | 'stopka_id'>>;
  update: (idx: number, patch: Partial<Omit<StopkaPole, 'id' | 'stopka_id'>>) => void;
  remove: (idx: number) => void;
  add: () => void;
  placeholder: string;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs">{title}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={add} className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" /> {t('common.add')}
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((p) => {
          const idx = all.indexOf(p);
          return (
            <div key={idx} className="flex gap-2">
              <Input value={p.wartosc} onChange={e => update(idx, { wartosc: e.target.value })} placeholder={placeholder} className="flex-1" />
              <Input value={p.etykieta ?? ''} onChange={e => update(idx, { etykieta: e.target.value || null })} placeholder={t('stopki.f.label_opt')} className="w-32" />
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground italic">{t('stopki.f.none_click_add')}</p>
        )}
      </div>
    </div>
  );
}

function SocialPolaSection({
  all,
  update,
  remove,
  add,
}: {
  all: Array<Omit<StopkaPole, 'id' | 'stopka_id'>>;
  update: (idx: number, patch: Partial<Omit<StopkaPole, 'id' | 'stopka_id'>>) => void;
  remove: (idx: number) => void;
  add: (platform: SocialPlatformKey) => void;
}) {
  const { t } = useTranslation();
  const items = all.filter(p => p.typ === 'social');
  const [nextPlatform, setNextPlatform] = useState<SocialPlatformKey>('facebook');

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2">
        <Label className="text-xs">{t('stopki.f.social_links')}</Label>
        <div className="flex items-center gap-1">
          <Select value={nextPlatform} onValueChange={(v) => setNextPlatform(v as SocialPlatformKey)}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOCIAL_PLATFORM_KEYS.map(k => (
                <SelectItem key={k} value={k} className="text-xs">{SOCIAL_PLATFORMS[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="sm" onClick={() => add(nextPlatform)} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> {t('common.add')}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((p) => {
          const idx = all.indexOf(p);
          const platform = (p.etykieta || 'facebook') as SocialPlatformKey;
          const meta = SOCIAL_PLATFORMS[platform] ?? SOCIAL_PLATFORMS.facebook;
          return (
            <div key={idx} className="flex gap-2">
              <Select value={platform} onValueChange={(v) => update(idx, { etykieta: v })}>
                <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORM_KEYS.map(k => (
                    <SelectItem key={k} value={k} className="text-xs">{SOCIAL_PLATFORMS[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={p.wartosc} onChange={e => update(idx, { wartosc: e.target.value })} placeholder={meta.placeholder} className="flex-1" />
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground italic">{t('stopki.f.none_social')}</p>
        )}
      </div>
    </div>
  );
}

function FileUploadField({
  label,
  currentPath,
  uploading,
  onChange,
  onClear,
  shape,
}: {
  label: string;
  currentPath: string | null;
  uploading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  shape: 'square' | 'circle';
}) {
  const { t } = useTranslation();
  const url = stopkaGrafikaUrl(currentPath);
  return (
    <div>
      <Label className="text-xs mb-1 block">{label}</Label>
      <div className="flex items-center gap-3">
        {url ? (
          <img src={url} alt="" className={`h-16 w-16 object-cover border ${shape === 'circle' ? 'rounded-full' : 'rounded-md'}`} />
        ) : (
          <div className={`h-16 w-16 bg-muted border flex items-center justify-center text-xs text-muted-foreground ${shape === 'circle' ? 'rounded-full' : 'rounded-md'}`}>
            {t('stopki.f.none')}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="cursor-pointer">
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
              <span><Upload className="h-3 w-3 mr-1" /> {uploading ? t('stopki.f.uploading') : currentPath ? t('stopki.f.change') : t('stopki.f.upload')}</span>
            </Button>
            <input type="file" accept="image/*" className="hidden" onChange={onChange} />
          </label>
          {currentPath && (
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onClear}>
              <Trash2 className="h-3 w-3 mr-1" /> {t('common.delete')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
