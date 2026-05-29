import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createInput = z
  .object({
    organizationId: z.string().uuid(),
    startDate: dateStr,
    endDate: dateStr,
    description: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    path: ["endDate"],
    message: "endDate must be >= startDate",
  });

const updateInput = createInput.innerType().extend({
  vacationId: z.string().uuid(),
});

export const listVacations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("vacations")
      .select("id, start_date, end_date, description, created_by, created_at")
      .eq("organization_id", data.organizationId)
      .order("start_date", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const createVacation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("vacations")
      .insert({
        organization_id: data.organizationId,
        created_by: userId,
        start_date: data.startDate,
        end_date: data.endDate,
        description: data.description?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateVacation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("vacations")
      .update({
        start_date: data.startDate,
        end_date: data.endDate,
        description: data.description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.vacationId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVacation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        vacationId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("vacations")
      .delete()
      .eq("id", data.vacationId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
