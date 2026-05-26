// Concertivo — hooki do stopek e-mail (model HYBRYDOWY).
//
// Stopki mają dwa zakresy:
//   • osobiste — owner_user_id = auth.uid()  (jeden zestaw na konto, cross-org)
//   • firmowe  — organization_id = org.id    (wspólne dla wszystkich członków)
//
// Hooki:
//   useMojeStopki()                  — własne osobiste
//   useOrgStopki(orgId)              — stopki konkretnej organizacji
//   useDostepneStopki(orgId?)        — wszystkie do których user ma SELECT
//                                       (osobiste + firmowe org-ów do których należy)
//   useUpsertStopka()                — INSERT/UPDATE; scope określa payload
//   useDeleteStopka(), useSetDomyslnaStopka(), useKopiujStopka()
//   uploadStopkaPlik()               — upload do bucketu `stopki-grafiki`

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type StopkaPoleTyp = 'telefon' | 'email' | 'www' | 'social';

export interface StopkaPole {
  id: string;
  stopka_id: string;
  typ: StopkaPoleTyp;
  wartosc: string;
  etykieta: string | null;
  ikona: string | null;
  kolejnosc: number;
}

export interface EmailStopka {
  id: string;
  owner_user_id: string | null;
  organization_id: string | null;
  created_by: string | null;
  nazwa: string;
  domyslna: boolean;
  kolor_akcent: string;
  czcionka: string;
  imie_nazwisko: string | null;
  rola: string | null;
  adres_firmy: string | null;
  adres_ikona: string | null;
  nazwa_firmy: string | null;
  tekst_dodatkowy: string | null;
  logo_path: string | null;
  zdjecie_path: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  tiktok_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailStopkaPelna extends EmailStopka {
  pola: StopkaPole[];
  /** Wyliczane po stronie hooka — komu „należy" stopka (do labela w UI). */
  owner_label?: string | null;
}

export type StopkaScope =
  | { kind: 'user' }
  | { kind: 'org'; organizationId: string };

const TBL = 'email_stopki' as never;
const TBL_POLA = 'email_stopki_pola' as never;
const STORAGE_BUCKET = 'stopki-grafiki';

async function fetchStopkiWithPola(query: ReturnType<typeof supabase.from>): Promise<EmailStopkaPelna[]> {
  const { data: stopki, error } = await query;
  if (error) throw new Error(error.message);
  const arr = (stopki as unknown as EmailStopka[]) || [];
  if (arr.length === 0) return [];
  const ids = arr.map(s => s.id);
  const { data: polaData, error: polaErr } = await supabase
    .from(TBL_POLA)
    .select('*')
    .in('stopka_id', ids)
    .order('kolejnosc', { ascending: true });
  if (polaErr) throw new Error(polaErr.message);
  const pola = (polaData as unknown as StopkaPole[]) || [];
  return arr.map(s => ({ ...s, pola: pola.filter(p => p.stopka_id === s.id) }));
}

/** Własne stopki osobiste (owner_user_id = auth.uid()). */
export function useMojeStopki() {
  return useQuery({
    queryKey: ['email-stopki', 'moje'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [];
      return fetchStopkiWithPola(
        supabase
          .from(TBL)
          .select('*')
          .eq('owner_user_id', uid)
          .order('created_at', { ascending: true }) as never
      );
    },
  });
}

/** Stopki konkretnej organizacji (organization_id = orgId). */
export function useOrgStopki(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ['email-stopki', 'org', orgId],
    enabled: !!orgId,
    queryFn: () => fetchStopkiWithPola(
      supabase
        .from(TBL)
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: true }) as never
    ),
  });
}

/**
 * Wszystkie stopki dostępne dla użytkownika w danym kontekście:
 *  • własne osobiste
 *  • + jeśli podano orgId — firmowe tej organizacji
 *  RLS gwarantuje, że nie zwróci innych.
 */
export function useDostepneStopki(orgId?: string | null) {
  return useQuery({
    queryKey: ['email-stopki', 'dostepne', orgId ?? null],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [];
      const filter = orgId
        ? `owner_user_id.eq.${uid},organization_id.eq.${orgId}`
        : `owner_user_id.eq.${uid}`;
      return fetchStopkiWithPola(
        supabase
          .from(TBL)
          .select('*')
          .or(filter)
          .order('domyslna', { ascending: false })
          .order('created_at', { ascending: true }) as never
      );
    },
  });
}

export interface UpsertStopkaInput {
  id?: string;
  scope: StopkaScope;
  nazwa: string;
  domyslna: boolean;
  kolor_akcent: string;
  czcionka: string;
  imie_nazwisko: string | null;
  rola: string | null;
  adres_firmy: string | null;
  adres_ikona: string | null;
  nazwa_firmy: string | null;
  tekst_dodatkowy: string | null;
  logo_path: string | null;
  zdjecie_path: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  tiktok_url: string | null;
  pola: Array<Omit<StopkaPole, 'id' | 'stopka_id'>>;
}

export function useUpsertStopka() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertStopkaInput): Promise<EmailStopka> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Brak zalogowanego użytkownika');

      const ownerUserId = input.scope.kind === 'user' ? uid : null;
      const organizationId = input.scope.kind === 'org' ? input.scope.organizationId : null;

      // Tylko jedna domyślna na (scope)
      if (input.domyslna) {
        const q = supabase.from(TBL).update({ domyslna: false } as never);
        if (ownerUserId) {
          await q.eq('owner_user_id', ownerUserId).neq('id', input.id ?? '00000000-0000-0000-0000-000000000000');
        } else if (organizationId) {
          await q.eq('organization_id', organizationId).neq('id', input.id ?? '00000000-0000-0000-0000-000000000000');
        }
      }

      const payload = {
        ...(input.id ? { id: input.id } : {}),
        owner_user_id: ownerUserId,
        organization_id: organizationId,
        created_by: uid,
        nazwa: input.nazwa,
        domyslna: input.domyslna,
        kolor_akcent: input.kolor_akcent,
        czcionka: input.czcionka,
        imie_nazwisko: input.imie_nazwisko,
        rola: input.rola,
        adres_firmy: input.adres_firmy,
        adres_ikona: input.adres_ikona,
        nazwa_firmy: input.nazwa_firmy,
        tekst_dodatkowy: input.tekst_dodatkowy,
        logo_path: input.logo_path,
        zdjecie_path: input.zdjecie_path,
        facebook_url: input.facebook_url,
        instagram_url: input.instagram_url,
        linkedin_url: input.linkedin_url,
        youtube_url: input.youtube_url,
        x_url: input.x_url,
        tiktok_url: input.tiktok_url,
      };

      const { data: saved, error } = await supabase
        .from(TBL)
        .upsert(payload as never, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw new Error(error.message);
      const savedId = (saved as unknown as EmailStopka).id;

      // Replace pola
      await supabase.from(TBL_POLA).delete().eq('stopka_id', savedId);
      const polaToInsert = input.pola
        .filter(p => p.wartosc.trim())
        .map((p, idx) => ({
          stopka_id: savedId,
          typ: p.typ,
          wartosc: p.wartosc.trim(),
          etykieta: p.etykieta?.trim() || null,
          ikona: p.ikona,
          kolejnosc: idx,
        }));
      if (polaToInsert.length > 0) {
        const { error: polaErr } = await supabase
          .from(TBL_POLA)
          .insert(polaToInsert as never);
        if (polaErr) throw new Error(polaErr.message);
      }
      return saved as unknown as EmailStopka;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-stopki'] }),
  });
}

export function useDeleteStopka() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TBL).delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-stopki'] }),
  });
}

export function useSetDomyslnaStopka() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Pobierz stopkę żeby znać scope
      const { data, error } = await supabase
        .from(TBL)
        .select('owner_user_id, organization_id')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      const row = data as unknown as { owner_user_id: string | null; organization_id: string | null };

      const q = supabase.from(TBL).update({ domyslna: false } as never).neq('id', id);
      if (row.owner_user_id) {
        await q.eq('owner_user_id', row.owner_user_id);
      } else if (row.organization_id) {
        await q.eq('organization_id', row.organization_id);
      }

      const { error: upErr } = await supabase
        .from(TBL)
        .update({ domyslna: true } as never)
        .eq('id', id);
      if (upErr) throw new Error(upErr.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-stopki'] }),
  });
}

/**
 * Kopiuje istniejącą stopkę do wskazanego zakresu.
 * Pliki (logo/zdjęcie) zostają jako ten sam storage path — bucket jest publiczny,
 * więc obrazy nadal działają. Użytkownik może podmienić je w edytorze.
 */
export function useKopiujStopka() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ zrodlowaId, targetScope }: { zrodlowaId: string; targetScope: StopkaScope }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Brak zalogowanego użytkownika');

      const { data: src, error } = await supabase.from(TBL).select('*').eq('id', zrodlowaId).single();
      if (error) throw new Error(error.message);
      const s = src as unknown as EmailStopka;

      const { data: pola } = await supabase
        .from(TBL_POLA)
        .select('*')
        .eq('stopka_id', zrodlowaId)
        .order('kolejnosc', { ascending: true });

      const { data: nowa, error: insErr } = await supabase
        .from(TBL)
        .insert({
          owner_user_id: targetScope.kind === 'user' ? uid : null,
          organization_id: targetScope.kind === 'org' ? targetScope.organizationId : null,
          created_by: uid,
          nazwa: `${s.nazwa} (kopia)`,
          domyslna: false,
          kolor_akcent: s.kolor_akcent,
          czcionka: s.czcionka,
          imie_nazwisko: s.imie_nazwisko,
          rola: s.rola,
          adres_firmy: s.adres_firmy,
          adres_ikona: s.adres_ikona,
          nazwa_firmy: s.nazwa_firmy,
          tekst_dodatkowy: s.tekst_dodatkowy,
          logo_path: s.logo_path,
          zdjecie_path: s.zdjecie_path,
          facebook_url: s.facebook_url,
          instagram_url: s.instagram_url,
          linkedin_url: s.linkedin_url,
          youtube_url: s.youtube_url,
          x_url: s.x_url,
          tiktok_url: s.tiktok_url,
        } as never)
        .select()
        .single();
      if (insErr) throw new Error(insErr.message);
      const nowaId = (nowa as unknown as EmailStopka).id;

      const polaArr = (pola as unknown as StopkaPole[]) || [];
      if (polaArr.length > 0) {
        await supabase.from(TBL_POLA).insert(
          polaArr.map((p, i) => ({
            stopka_id: nowaId,
            typ: p.typ,
            wartosc: p.wartosc,
            etykieta: p.etykieta,
            ikona: p.ikona,
            kolejnosc: i,
          })) as never
        );
      }
      return nowa as unknown as EmailStopka;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-stopki'] }),
  });
}

/**
 * Upload pliku do bucketu `stopki-grafiki`. Ścieżka:
 *   • dla osobistej:   `<auth.uid()>/<prefix>-<ts>.<ext>`
 *   • dla firmowej:    `org/<organizationId>/<prefix>-<ts>.<ext>`
 * (RLS storage egzekwuje, że tylko właściciel/owner może wgrać.)
 */
export async function uploadStopkaPlik(
  scope: StopkaScope,
  file: File,
  prefix: 'logo' | 'zdjecie'
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('Brak zalogowanego użytkownika');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const folder = scope.kind === 'user' ? uid : `org/${scope.organizationId}`;
  const path = `${folder}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/png',
  });
  if (error) throw new Error(error.message);
  return path;
}
