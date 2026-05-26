// Concertivo — hooki kontaktów (hybrid scope: user OR organization)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ContactKind = 'person' | 'company' | 'artist';
export type ContactCategory =
  | 'client' | 'supplier' | 'artist' | 'partner' | 'venue' | 'media' | 'other';
export type ContactArtistType = 'solo' | 'band' | 'ensemble' | 'dj';

export type ContactScope =
  | { kind: 'user' }
  | { kind: 'org'; organizationId: string };

export interface Contact {
  id: string;
  owner_user_id: string | null;
  organization_id: string | null;
  created_by: string | null;
  kind: ContactKind;
  category: ContactCategory | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  country_code: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  region: string | null;
  notes: unknown | null;
  tags: string[];
  source: string | null;
  preferred_language: string | null;
  assigned_to_user_id: string | null;
  custom_fields: Record<string, unknown>;
  // person
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  position: string | null;
  company_contact_id: string | null;
  birth_date: string | null;
  social: Record<string, string> | null;
  // company
  legal_name: string | null;
  tax_id: string | null;
  registration_no: string | null;
  // artist
  artist_type: ContactArtistType | null;
  genres: string[] | null;
  rider_url: string | null;
  tech_rider_url: string | null;
  created_at: string;
  updated_at: string;
}

const TBL = 'contacts' as never;

export interface ListContactsParams {
  scope: ContactScope;
  kind?: ContactKind;
  category?: ContactCategory;
  search?: string;
  tag?: string;
}

export function useContacts(params: ListContactsParams) {
  const { scope, kind, category, search, tag } = params;
  return useQuery({
    queryKey: ['contacts', scope, kind ?? null, category ?? null, search ?? '', tag ?? ''],
    queryFn: async (): Promise<Contact[]> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [];
      let q = supabase.from(TBL).select('*');
      if (scope.kind === 'user') q = q.eq('owner_user_id', uid).is('organization_id', null);
      else q = q.eq('organization_id', scope.organizationId);
      if (kind) q = q.eq('kind', kind);
      if (category) q = q.eq('category', category);
      if (search && search.trim()) q = q.ilike('display_name', `%${search.trim()}%`);
      if (tag) q = q.contains('tags', [tag]);
      const { data, error } = await q
        .order('display_name', { ascending: true })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data as unknown as Contact[]) || [];
    },
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ['contacts', 'one', id ?? null],
    enabled: !!id,
    queryFn: async (): Promise<Contact | null> => {
      const { data, error } = await supabase.from(TBL).select('*').eq('id', id!).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as unknown as Contact) || null;
    },
  });
}

export type UpsertContactInput = Partial<Contact> & {
  scope: ContactScope;
  kind: ContactKind;
};

export function useUpsertContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertContactInput): Promise<Contact> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Brak zalogowanego użytkownika');
      const ownerUserId = input.scope.kind === 'user' ? uid : null;
      const organizationId = input.scope.kind === 'org' ? input.scope.organizationId : null;
      const { scope: _s, id, ...rest } = input;
      // strip undefined to let DB defaults kick in
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) if (v !== undefined) clean[k] = v;
      const payload = {
        ...(id ? { id } : {}),
        ...clean,
        owner_user_id: ownerUserId,
        organization_id: organizationId,
        created_by: uid,
      };
      const { data, error } = await supabase
        .from(TBL)
        .upsert(payload as never, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as unknown as Contact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TBL).delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}
