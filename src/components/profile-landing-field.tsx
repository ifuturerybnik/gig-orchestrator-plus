import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listMyOrganizations } from "@/lib/organizations.functions";
import { updateMyLandingPath } from "@/lib/profile.functions";
import { ORG_MODULES, type OrgModuleId } from "@/lib/org-modules";

type Kind = "" | "profile" | "organization";

const PROFILE_PAGES: { path: string; labelKey: string }[] = [
  { path: "/profile", labelKey: "profile.landing.profile_pages.main" },
];

// Mapowanie modułu organizacji → segment ścieżki w /organizations/<id>/...
// Pomijamy moduły bez własnej strony (tu nie ma "overview").
const ORG_PAGES: { module: OrgModuleId; segment: string; labelKey: string }[] = [
  { module: "events", segment: "events", labelKey: "organizations.sidebar.events" },
  { module: "budget", segment: "budget", labelKey: "organizations.sidebar.budget" },
  { module: "contacts", segment: "contacts", labelKey: "organizations.sidebar.contacts" },
  { module: "counterparties", segment: "counterparties", labelKey: "organizations.sidebar.counterparties" },
  { module: "mail", segment: "mail", labelKey: "organizations.sidebar.mail" },
  { module: "autokorespondencja", segment: "autokorespondencja", labelKey: "organizations.sidebar.autokorespondencja" },
  { module: "ai_studio", segment: "ai-studio", labelKey: "organizations.sidebar.ai_studio" },
  { module: "social", segment: "social", labelKey: "organizations.sidebar.social" },
  { module: "web", segment: "web", labelKey: "organizations.sidebar.web" },
  { module: "assistant", segment: "assistant", labelKey: "organizations.sidebar.assistant" },
  { module: "dysk", segment: "dysk", labelKey: "organizations.sidebar.dysk" },
  { module: "profile", segment: "profile", labelKey: "organizations.sidebar.edit_organization" },
  { module: "members", segment: "members", labelKey: "organizations.sidebar.members" },
];

export function LandingPreferenceField({ currentPath }: { currentPath: string | null | undefined }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchOrgs = useServerFn(listMyOrganizations);
  const updateFn = useServerFn(updateMyLandingPath);

  const orgsQuery = useQuery({
    queryKey: ["my-organizations"],
    queryFn: () => fetchOrgs(),
  });
  const orgs = orgsQuery.data?.organizations ?? [];

  // Parsuj zapisaną ścieżkę → stan formularza.
  const parsed = useMemo(() => {
    const p = (currentPath ?? "").trim();
    if (p.startsWith("/organizations/")) {
      const parts = p.split("/").filter(Boolean); // ["organizations", "<id>", "<seg>"]
      const id = parts[1] ?? "";
      const seg = parts[2] ?? "events";
      return { kind: "organization" as Kind, orgId: id, segment: seg, profilePath: "/profile" };
    }
    if (p === "/profile" || p.startsWith("/profile")) {
      return { kind: "profile" as Kind, orgId: "", segment: "events", profilePath: p || "/profile" };
    }
    return { kind: "" as Kind, orgId: "", segment: "events", profilePath: "/profile" };
  }, [currentPath]);

  const [kind, setKind] = useState<Kind>(parsed.kind);
  const [orgId, setOrgId] = useState<string>(parsed.orgId);
  const [segment, setSegment] = useState<string>(parsed.segment);
  const [profilePath, setProfilePath] = useState<string>(parsed.profilePath);

  useEffect(() => {
    setKind(parsed.kind);
    setOrgId(parsed.orgId);
    setSegment(parsed.segment);
    setProfilePath(parsed.profilePath);
  }, [parsed]);

  const targetPath = useMemo<string | null>(() => {
    if (kind === "profile") return profilePath || "/profile";
    if (kind === "organization" && orgId && segment) {
      return `/organizations/${orgId}/${segment}`;
    }
    return null;
  }, [kind, profilePath, orgId, segment]);

  const mutation = useMutation({
    mutationFn: (path: string | null) => updateFn({ data: { landing_path: path } }),
    onSuccess: () => {
      toast.success(t("profile.landing.saved"));
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Lista dostępnych modułów dla wybranej organizacji — po prostu wszystkie,
  // które mają własną stronę. Ograniczenia uprawnień rozstrzygnie sam routing.
  const availableSegments = ORG_PAGES.filter((p) =>
    ORG_MODULES.some((m) => m.id === p.module),
  );

  return (
    <section className="space-y-4 rounded-md border border-primary/30 bg-primary/5 p-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t("profile.landing.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("profile.landing.help")}
        </p>
      </div>

      <RadioGroup
        value={kind}
        onValueChange={(v) => setKind(v as Kind)}
        className="grid gap-2 sm:grid-cols-2"
      >
        <label
          htmlFor="land-profile"
          className="flex items-start gap-3 rounded-md border border-border bg-background p-3 hover:bg-accent"
        >
          <RadioGroupItem id="land-profile" value="profile" className="mt-0.5" />
          <div>
            <p className="text-sm font-medium">{t("profile.landing.kind.profile")}</p>
            <p className="text-xs text-muted-foreground">
              {t("profile.landing.kind.profile_desc")}
            </p>
          </div>
        </label>
        <label
          htmlFor="land-org"
          className="flex items-start gap-3 rounded-md border border-border bg-background p-3 hover:bg-accent"
        >
          <RadioGroupItem id="land-org" value="organization" className="mt-0.5" />
          <div>
            <p className="text-sm font-medium">{t("profile.landing.kind.organization")}</p>
            <p className="text-xs text-muted-foreground">
              {t("profile.landing.kind.organization_desc")}
            </p>
          </div>
        </label>
      </RadioGroup>

      {kind === "profile" && (
        <div className="space-y-2">
          <Label>{t("profile.landing.profile_page")}</Label>
          <Select value={profilePath} onValueChange={setProfilePath}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROFILE_PAGES.map((p) => (
                <SelectItem key={p.path} value={p.path}>
                  {t(p.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {kind === "organization" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("profile.landing.choose_org")}</Label>
            {orgsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
            ) : orgs.length === 0 ? (
              <p className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
                {t("profile.my_orgs.empty")}
              </p>
            ) : (
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("profile.landing.choose_org_ph")} />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t("profile.landing.choose_page")}</Label>
            <Select value={segment} onValueChange={setSegment} disabled={!orgId}>
              <SelectTrigger>
                <SelectValue placeholder={t("profile.landing.choose_page_ph")} />
              </SelectTrigger>
              <SelectContent>
                {availableSegments.map((p) => (
                  <SelectItem key={p.segment} value={p.segment}>
                    {t(p.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button
          type="button"
          size="sm"
          disabled={mutation.isPending || !targetPath}
          onClick={() => targetPath && mutation.mutate(targetPath)}
        >
          {t("common.save")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={mutation.isPending || !currentPath}
          onClick={() => mutation.mutate(null)}
        >
          {t("profile.landing.reset")}
        </Button>
        {currentPath && (
          <span className="text-xs text-muted-foreground">
            {t("profile.landing.current")}: <code>{currentPath}</code>
          </span>
        )}
      </div>
    </section>
  );
}
