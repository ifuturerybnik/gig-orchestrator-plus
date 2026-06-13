import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mail-env-diagnostic")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          hasExtMailEncryptionKey: !!process.env.EXT_MAIL_ENCRYPTION_KEY?.trim(),
          hasMailEncryptionKey: !!process.env.MAIL_ENCRYPTION_KEY?.trim(),
          hasExtSupabaseServiceRoleKey: !!process.env.EXT_SUPABASE_SERVICE_ROLE_KEY?.trim(),
        }),
    },
  },
});