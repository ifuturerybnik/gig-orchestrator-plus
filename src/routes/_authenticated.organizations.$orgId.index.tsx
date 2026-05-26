import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { countryName } from "@/lib/countries";
import { getOrganizationDetails } from "@/lib/organizations.functions";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/")({
  component: OrganizationOverviewPage,
});

function OrganizationOverviewPage() {
  const { orgId } = Route.useParams();
  const { t, i18n } = useTranslation();

  const fetchDetails = useServerFn(getOrganizationDetails);
  const detailsQuery = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => fetchDetails({ data: { organizationId: orgId } }),
  });

  if (detailsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (detailsQuery.isError || !detailsQuery.data) {
    return (
      <p className="text-sm text-destructive">
        {detailsQuery.error instanceof Error
          ? detailsQuery.error.message
          : t("common.error")}
      </p>
    );
  }

  const { organization: org, canManage } = detailsQuery.data;

  const addressLine = [
    org.address_street,
    [org.address_postal_code, org.address_city].filter(Boolean).join(" "),
    countryName(org.address_country, i18n.language || "pl"),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">{org.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <OrgTypesText types={org.types as string[] | null} />
          </p>
        </div>
        {canManage && (
          <Link
            to="/organizations/$orgId/profile"
            params={{ orgId }}
          >
            <Button variant="outline" size="sm">
              {t("organizations.detail.edit")}
            </Button>
          </Link>
        )}
      </div>

      {org.status === "rejected" && org.rejection_reason && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <strong>{t("organizations.detail.rejection_reason")}:</strong>{" "}
          {org.rejection_reason}
        </p>
      )}

      {org.description && (
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {org.description}
        </p>
      )}

      {Array.isArray(org.types) && (org.types as string[]).includes("artist") && Array.isArray(org.genres) && org.genres.length > 0 && (
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("organizations.detail.genres.title")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {org.genres.map((g: string) => (
              <Badge key={g} variant="secondary">
                {t(`organizations.genres.${g}`, { defaultValue: g })}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {addressLine && (
        <p className="text-sm text-muted-foreground">
          <strong>{t("organizations.detail.address.title")}:</strong> {addressLine}
        </p>
      )}
    </div>
  );
}
