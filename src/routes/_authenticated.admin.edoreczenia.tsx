import { createFileRoute } from "@tanstack/react-router";
import IntegracjaEdoreczeniaTab from "@/components/settings/IntegracjaEdoreczeniaTab";

export const Route = createFileRoute("/_authenticated/admin/edoreczenia")({
  head: () => ({
    meta: [
      { title: "e-Doręczenia — Concertivo" },
      { name: "description", content: "Integracja z systemem e-Doręczeń (ADE) — test połączenia mTLS/OAuth2." },
    ],
  }),
  component: () => <IntegracjaEdoreczeniaTab />,
});
