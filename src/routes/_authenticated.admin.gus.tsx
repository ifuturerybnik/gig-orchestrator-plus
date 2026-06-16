import { createFileRoute } from "@tanstack/react-router";
import IntegracjaGusTab from "@/components/settings/IntegracjaGusTab";

export const Route = createFileRoute("/_authenticated/admin/gus")({
  component: () => <IntegracjaGusTab />,
});
