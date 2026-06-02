import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Copy, Check, Trash2, KeyRound, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getWebSettings,
  upsertWebSettings,
  listWebTokens,
  createWebToken,
  revokeWebToken,
  listWebDomains,
  addWebDomain,
  removeWebDomain,
} from "@/lib/web.functions";
import { WebTabInstructions } from "@/components/web/WebTabInstructions";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function WebIntegrationTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const fetchSettings = useServerFn(getWebSettings);
  const saveSettings = useServerFn(upsertWebSettings);
  const fetchTokens = useServerFn(listWebTokens);
  const createToken = useServerFn(createWebToken);
  const revokeToken = useServerFn(revokeWebToken);
  const fetchDomains = useServerFn(listWebDomains);
  const addDomain = useServerFn(addWebDomain);
  const removeDomain = useServerFn(removeWebDomain);

  const settingsQuery = useQuery({
    queryKey: ["web-settings", orgId],
    queryFn: () => fetchSettings({ data: { organizationId: orgId } }),
  });
  const tokensQuery = useQuery({
    queryKey: ["web-tokens", orgId],
    queryFn: () => fetchTokens({ data: { organizationId: orgId } }),
  });
  const domainsQuery = useQuery({
    queryKey: ["web-domains", orgId],
    queryFn: () => fetchDomains({ data: { organizationId: orgId } }),
  });

  const s = settingsQuery.data?.settings as
    | { public_slug: string | null; is_published: boolean; default_lang: string }
    | null
    | undefined;

  const [slug, setSlug] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [initialized, setInitialized] = useState(false);
  if (!initialized && settingsQuery.data !== undefined) {
    setSlug(s?.public_slug ?? "");
    setIsPublished(Boolean(s?.is_published));
    setInitialized(true);
  }

  const saveSettingsMut = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          organizationId: orgId,
          publicSlug: slug.trim(),
          isPublished,
          defaultLang: "pl",
          availableLangs: ["pl", "en"],
        },
      }),
    onSuccess: () => {
      toast.success(t("web.integration.saved"));
      qc.invalidateQueries({ queryKey: ["web-settings", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Tokens
  const [newTokenName, setNewTokenName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createTokenMut = useMutation({
    mutationFn: () =>
      createToken({ data: { organizationId: orgId, name: newTokenName.trim() } }),
    onSuccess: (res) => {
      setCreatedToken(res.token);
      setNewTokenName("");
      qc.invalidateQueries({ queryKey: ["web-tokens", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeTokenMut = useMutation({
    mutationFn: (id: string) => revokeToken({ data: { tokenId: id } }),
    onSuccess: () => {
      toast.success(t("web.integration.token_revoked"));
      qc.invalidateQueries({ queryKey: ["web-tokens", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Domains
  const [newDomain, setNewDomain] = useState("");
  const addDomainMut = useMutation({
    mutationFn: () =>
      addDomain({ data: { organizationId: orgId, domain: newDomain.trim() } }),
    onSuccess: () => {
      setNewDomain("");
      qc.invalidateQueries({ queryKey: ["web-domains", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeDomainMut = useMutation({
    mutationFn: (id: string) => removeDomain({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["web-domains", orgId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://concertivo.eu";
  const publicSlug = s?.public_slug ?? slug;
  const newsEndpoint = `${baseUrl}/api/public/v1/orgs/${publicSlug || "<slug>"}/news`;
  const eventsEndpoint = `${baseUrl}/api/public/v1/orgs/${publicSlug || "<slug>"}/events`;
  const galleryEndpoint = `${baseUrl}/api/public/v1/orgs/${publicSlug || "<slug>"}/gallery`;
  const rssEndpoint = `${baseUrl}/api/public/v1/orgs/${publicSlug || "<slug>"}/news/feed.xml`;
  const icalEndpoint = `${baseUrl}/api/public/v1/orgs/${publicSlug || "<slug>"}/events.ics`;
  const sitemapEndpoint = `${baseUrl}/api/public/v1/orgs/${publicSlug || "<slug>"}/sitemap.xml`;
  const embedJsUrl = `${baseUrl}/api/public/v1/embed.js`;
  const embedSnippet = `<div id="concertivo-feed"></div>\n<script async src="${embedJsUrl}"\n  data-org="${publicSlug || "<slug>"}" data-mode="news" data-lang="pl" data-limit="6"\n  data-target="#concertivo-feed"></script>`;
  const embedGallerySnippet = `<div id="concertivo-gallery"></div>\n<script async src="${embedJsUrl}"\n  data-org="${publicSlug || "<slug>"}" data-mode="gallery" data-lang="pl" data-limit="12"\n  data-target="#concertivo-gallery"></script>`;

  const tokens = tokensQuery.data?.tokens ?? [];
  const domains = domainsQuery.data?.domains ?? [];

  return (
    <div className="space-y-6">
      <WebTabInstructions tab="integration" />
      {/* SETTINGS */}

      <section className="space-y-4 rounded-md border border-border bg-card p-4">
        <div>
          <h2 className="text-lg font-semibold">{t("web.integration.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("web.integration.subtitle")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr,auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="public-slug">{t("web.integration.slug")}</Label>
            <Input
              id="public-slug"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="filharmonia-szczecinska"
            />
            <p className="text-xs text-muted-foreground">
              {t("web.integration.slug_help")}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            <Label className="text-sm">{t("web.integration.publish")}</Label>
          </div>
        </div>
        <Button onClick={() => saveSettingsMut.mutate()} disabled={saveSettingsMut.isPending}>
          {t("common.save")}
        </Button>
      </section>

      {/* ENDPOINTS */}
      <section className="space-y-3 rounded-md border border-border bg-card p-4">
        <h3 className="font-semibold">{t("web.integration.endpoints")}</h3>
        <p className="text-sm text-muted-foreground">{t("web.integration.endpoints_help")}</p>
        <div className="space-y-2 text-sm">
          <EndpointRow label="News (JSON)" url={newsEndpoint} />
          <EndpointRow label="Events (JSON)" url={eventsEndpoint} />
          <EndpointRow label="Gallery (JSON)" url={galleryEndpoint} />
          <EndpointRow label="RSS (news)" url={rssEndpoint} />
          <EndpointRow label="iCal (events)" url={icalEndpoint} />
          <EndpointRow label="Sitemap (SEO)" url={sitemapEndpoint} />
          <EndpointRow label="embed.js" url={embedJsUrl} />
        </div>
        <Alert>
          <Globe className="h-4 w-4" />
          <AlertTitle>{t("web.integration.lang_param_title")}</AlertTitle>
          <AlertDescription>{t("web.integration.lang_param_desc")}</AlertDescription>
        </Alert>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t("web.integration.embed_snippet")}</p>
          <p className="text-xs text-muted-foreground">{t("web.integration.embed_snippet_help")}</p>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
{embedSnippet}
          </pre>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(embedSnippet);
              toast.success(t("common.copied"));
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> {t("common.copy")}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Gallery embed</p>
          <p className="text-xs text-muted-foreground">{t("web.integration.embed_gallery_help")}</p>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
{embedGallerySnippet}
          </pre>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(embedGallerySnippet);
              toast.success(t("common.copied"));
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> {t("common.copy")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{t("web.integration.sitemap_help")}</p>
      </section>


      {/* TOKENS */}
      <section className="space-y-3 rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{t("web.integration.tokens")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("web.integration.tokens_help")}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder={t("web.integration.token_name_placeholder")}
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
          />
          <Button
            onClick={() => createTokenMut.mutate()}
            disabled={!newTokenName.trim() || createTokenMut.isPending}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("web.integration.create_token")}
          </Button>
        </div>

        {tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("web.integration.no_tokens")}
          </p>
        ) : (
          <div className="space-y-2">
            {tokens.map((tok) => (
              <div
                key={tok.id}
                className="flex items-center gap-3 rounded-md border border-border p-2"
              >
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{tok.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tok.token_prefix}…
                    {tok.revoked_at && ` · ${t("web.integration.revoked")}`}
                  </p>
                </div>
                {!tok.revoked_at && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revokeTokenMut.mutate(tok.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* DOMAINS */}
      <section className="space-y-3 rounded-md border border-border bg-card p-4">
        <div>
          <h3 className="font-semibold">{t("web.integration.domains")}</h3>
          <p className="text-sm text-muted-foreground">{t("web.integration.domains_help")}</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
          />
          <Button
            onClick={() => addDomainMut.mutate()}
            disabled={!newDomain.trim() || addDomainMut.isPending}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("web.integration.add_domain")}
          </Button>
        </div>
        {domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("web.integration.no_domains")}</p>
        ) : (
          <div className="space-y-2">
            {domains.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-md border border-border p-2"
              >
                <Globe className="h-4 w-4 text-muted-foreground" />
                <p className="flex-1 font-mono text-sm">{d.domain}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeDomainMut.mutate(d.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Created token dialog (shown once) */}
      <Dialog open={!!createdToken} onOpenChange={(o) => !o && setCreatedToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("web.integration.token_created_title")}</DialogTitle>
            <DialogDescription>
              {t("web.integration.token_created_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
            <code className="flex-1 break-all font-mono text-xs">{createdToken}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (createdToken) {
                  navigator.clipboard.writeText(createdToken);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedToken(null)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EndpointRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border p-2">
      <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <code className="flex-1 truncate font-mono text-xs">{url}</code>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}
