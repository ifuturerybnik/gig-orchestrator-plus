import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  HardDrive,
  CheckCircle2,
  XCircle,
  Settings2,
  Coins,
  Cloud,
  Trash2,
  PlugZap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getMyProfile } from "@/lib/profile.functions";
import {
  getStorageGlobalConfig,
  updateStorageGlobalConfig,
  listAdminOrgStorage,
  grantOrgStorageBonus,
  setOrgStorageMode,
  setOrgOwnR2,
  clearOrgOwnR2,
  testOrgR2,
  type AdminOrgStorageRow,
} from "@/lib/storage.functions";

export const Route = createFileRoute("/_authenticated/admin/storage")({
  component: StoragePage,
});

function fmtBytes(b: number): string {
  if (!b) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(k)), units.length - 1);
  return `${(b / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function StoragePage() {
  const { t } = useTranslation();
  const fetchProfile = useServerFn(getMyProfile);
  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const isAdmin = profileQuery.data?.isAdmin === true;
  const isSuper = profileQuery.data?.isSuperAdmin === true;

  if (profileQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <HardDrive className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{t("admin.storage.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.storage.subtitle")}
          </p>
        </div>
      </div>

      <GlobalConfigSection canEdit={isSuper} />
      <OrgsTableSection canSuper={isSuper} />
    </div>
  );
}

// =====================================================================
// Konfiguracja globalna R2
// =====================================================================

function GlobalConfigSection({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchCfg = useServerFn(getStorageGlobalConfig);
  const updateCfg = useServerFn(updateStorageGlobalConfig);

  const q = useQuery({
    queryKey: ["storage-global-config"],
    queryFn: () => fetchCfg(),
  });

  const [freeGb, setFreeGb] = useState("2");
  const [price, setPrice] = useState("0.25");
  const [maxImage, setMaxImage] = useState("50");
  const [maxVideo, setMaxVideo] = useState("200");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!q.data) return;
    setFreeGb(String(q.data.cfg.free_quota_gb));
    setPrice(String(q.data.cfg.price_per_extra_gb_pln));
    setMaxImage(String(q.data.cfg.max_image_mb));
    setMaxVideo(String(q.data.cfg.max_video_mb));
    setEnabled(q.data.cfg.central_enabled);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      updateCfg({
        data: {
          free_quota_gb: Number(freeGb),
          price_per_extra_gb_pln: Number(price),
          max_image_mb: Math.round(Number(maxImage)),
          max_video_mb: Math.round(Number(maxVideo)),
          central_enabled: enabled,
        },
      }),
    onSuccess: () => {
      toast.success(t("admin.storage.global.saved"));
      queryClient.invalidateQueries({ queryKey: ["storage-global-config"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : String(e)),
  });

  const secrets = q.data?.secrets;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          {t("admin.storage.global.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium">
            {t("admin.storage.global.secrets_title")}
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {secrets &&
              Object.entries(secrets).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
                >
                  <code className="text-xs">{k}</code>
                  {v ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" /> OK
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-4 w-4" />{" "}
                      {t("admin.storage.global.secret_missing")}
                    </span>
                  )}
                </div>
              ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("admin.storage.global.secrets_hint")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>{t("admin.storage.global.free_quota_gb")}</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={freeGb}
              onChange={(e) => setFreeGb(e.target.value)}
              disabled={!canEdit}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("admin.storage.global.free_quota_gb_hint")}
            </p>
          </div>
          <div>
            <Label>{t("admin.storage.global.price_per_extra_gb_pln")}</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={!canEdit}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("admin.storage.global.price_hint")}
            </p>
          </div>
          <div>
            <Label>{t("admin.storage.global.max_image_mb")}</Label>
            <Input
              type="number"
              min="1"
              value={maxImage}
              onChange={(e) => setMaxImage(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label>{t("admin.storage.global.max_video_mb")}</Label>
            <Input
              type="number"
              min="1"
              value={maxVideo}
              onChange={(e) => setMaxVideo(e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">
              {t("admin.storage.global.central_enabled")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("admin.storage.global.central_enabled_hint")}
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!canEdit}
          />
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending
                ? t("common.saving")
                : t("admin.storage.global.save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================================
// Tabela organizacji
// =====================================================================

function OrgsTableSection({ canSuper }: { canSuper: boolean }) {
  const { t } = useTranslation();
  const fetchList = useServerFn(listAdminOrgStorage);
  const q = useQuery({
    queryKey: ["admin-storage-orgs"],
    queryFn: () => fetchList(),
  });

  const [filter, setFilter] = useState("");
  const [bonusFor, setBonusFor] = useState<AdminOrgStorageRow | null>(null);
  const [r2For, setR2For] = useState<AdminOrgStorageRow | null>(null);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const rows = q.data ?? [];
    return f ? rows.filter((r) => r.name.toLowerCase().includes(f)) : rows;
  }, [q.data, filter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-4 w-4" />
          {t("admin.storage.orgs.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center gap-2">
          <Input
            placeholder={t("admin.storage.orgs.filter_placeholder")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-xs"
          />
          <span className="text-xs text-muted-foreground">
            {t("admin.storage.orgs.count", { count: filtered.length })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.storage.orgs.col_name")}</TableHead>
                <TableHead>{t("admin.storage.orgs.col_mode")}</TableHead>
                <TableHead>{t("admin.storage.orgs.col_used")}</TableHead>
                <TableHead>{t("admin.storage.orgs.col_free")}</TableHead>
                <TableHead>{t("admin.storage.orgs.col_bonus")}</TableHead>
                <TableHead>{t("admin.storage.orgs.col_paid")}</TableHead>
                <TableHead>{t("admin.storage.orgs.col_total")}</TableHead>
                <TableHead className="text-right">
                  {t("admin.storage.orgs.col_actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-sm text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((row) => {
                const used =
                  row.mode === "central"
                    ? row.used_bytes_central
                    : row.used_bytes_own;
                return (
                  <TableRow key={row.organization_id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      {row.mode === "own" ? (
                        <Badge variant="outline">
                          {t("admin.storage.orgs.mode_own")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {t("admin.storage.orgs.mode_central")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{fmtBytes(used)}</TableCell>
                    <TableCell>{row.free_gb} GB</TableCell>
                    <TableCell>{row.bonus_free_gb} GB</TableCell>
                    <TableCell>{row.paid_extra_gb} GB</TableCell>
                    <TableCell className="font-medium">
                      {row.total_gb} GB
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setR2For(row)}
                        >
                          <PlugZap className="mr-1 h-3.5 w-3.5" />
                          {t("admin.storage.orgs.action_r2")}
                        </Button>
                        {canSuper && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setBonusFor(row)}
                          >
                            <Coins className="mr-1 h-3.5 w-3.5" />
                            {t("admin.storage.orgs.action_bonus")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!q.isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-sm text-muted-foreground">
                    {t("admin.storage.orgs.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {bonusFor && (
        <BonusDialog
          row={bonusFor}
          onClose={() => setBonusFor(null)}
        />
      )}
      {r2For && (
        <OwnR2Dialog
          row={r2For}
          onClose={() => setR2For(null)}
        />
      )}
    </Card>
  );
}

// =====================================================================
// Dialog: Bonus
// =====================================================================

function BonusDialog({
  row,
  onClose,
}: {
  row: AdminOrgStorageRow;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const grantFn = useServerFn(grantOrgStorageBonus);
  const [bonus, setBonus] = useState(String(row.bonus_free_gb));
  const [paid, setPaid] = useState(String(row.paid_extra_gb));
  const [note, setNote] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      grantFn({
        data: {
          organization_id: row.organization_id,
          bonus_free_gb: Number(bonus),
          paid_extra_gb: Number(paid),
          bonus_note: note || null,
        },
      }),
    onSuccess: () => {
      toast.success(t("admin.storage.bonus.saved"));
      queryClient.invalidateQueries({ queryKey: ["admin-storage-orgs"] });
      onClose();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("admin.storage.bonus.title", { name: row.name })}
          </DialogTitle>
          <DialogDescription>
            {t("admin.storage.bonus.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("admin.storage.bonus.bonus_free_gb")}</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("admin.storage.bonus.bonus_hint")}
            </p>
          </div>
          <div>
            <Label>{t("admin.storage.bonus.paid_extra_gb")}</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("admin.storage.bonus.note")}</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("admin.storage.bonus.note_placeholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================================
// Dialog: Własne R2 organizacji (Model 3)
// =====================================================================

function OwnR2Dialog({
  row,
  onClose,
}: {
  row: AdminOrgStorageRow;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setModeFn = useServerFn(setOrgStorageMode);
  const setKeysFn = useServerFn(setOrgOwnR2);
  const clearFn = useServerFn(clearOrgOwnR2);
  const testFn = useServerFn(testOrgR2);

  const [mode, setMode] = useState<"central" | "own">(row.mode);
  const [accountId, setAccountId] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [bucket, setBucket] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState("");

  const saveMode = useMutation({
    mutationFn: () =>
      setModeFn({ data: { organization_id: row.organization_id, mode } }),
    onSuccess: () => {
      toast.success(t("admin.storage.r2.mode_saved"));
      queryClient.invalidateQueries({ queryKey: ["admin-storage-orgs"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : String(e)),
  });

  const saveKeys = useMutation({
    mutationFn: () =>
      setKeysFn({
        data: {
          organization_id: row.organization_id,
          r2_account_id: accountId,
          r2_access_key_id: accessKeyId,
          r2_secret_access_key: secretAccessKey,
          r2_bucket: bucket,
          r2_endpoint: endpoint,
          r2_public_base_url: publicBaseUrl,
        },
      }),
    onSuccess: () => {
      toast.success(t("admin.storage.r2.keys_saved"));
      queryClient.invalidateQueries({ queryKey: ["admin-storage-orgs"] });
      // wyczyść pola wrażliwe
      setAccessKeyId("");
      setSecretAccessKey("");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : String(e)),
  });

  const testMut = useMutation({
    mutationFn: () =>
      testFn({ data: { organization_id: row.organization_id } }),
    onSuccess: (r) =>
      toast.success(
        t("admin.storage.r2.test_ok", { mode: r.mode, bucket: r.bucket }),
      ),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : String(e)),
  });

  const clearMut = useMutation({
    mutationFn: () =>
      clearFn({ data: { organization_id: row.organization_id } }),
    onSuccess: () => {
      toast.success(t("admin.storage.r2.cleared"));
      queryClient.invalidateQueries({ queryKey: ["admin-storage-orgs"] });
      onClose();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : String(e)),
  });

  // autouzupełnij endpoint po wpisaniu account id
  useEffect(() => {
    if (accountId && !endpoint) {
      setEndpoint(`https://${accountId}.r2.cloudflarestorage.com`);
    }
  }, [accountId, endpoint]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("admin.storage.r2.title", { name: row.name })}
          </DialogTitle>
          <DialogDescription>
            {t("admin.storage.r2.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Tryb */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">
                {t("admin.storage.r2.mode_label")}
              </p>
              <p className="text-xs text-muted-foreground">
                {mode === "own"
                  ? t("admin.storage.r2.mode_own_hint")
                  : t("admin.storage.r2.mode_central_hint")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs">
                {t("admin.storage.orgs.mode_central")}
              </span>
              <Switch
                checked={mode === "own"}
                onCheckedChange={(v) => setMode(v ? "own" : "central")}
              />
              <span className="text-xs">
                {t("admin.storage.orgs.mode_own")}
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => saveMode.mutate()}
              disabled={saveMode.isPending}
            >
              {t("admin.storage.r2.save_mode")}
            </Button>
          </div>

          {/* Klucze własnego R2 */}
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">
              {t("admin.storage.r2.keys_title")}
            </p>
            {row.has_own_r2 && (
              <p className="text-xs text-emerald-600">
                {t("admin.storage.r2.keys_present")}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>{t("admin.storage.r2.account_id")}</Label>
                <Input
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="abcd1234..."
                />
              </div>
              <div>
                <Label>{t("admin.storage.r2.bucket")}</Label>
                <Input
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  placeholder="my-org-media"
                />
              </div>
              <div className="md:col-span-2">
                <Label>{t("admin.storage.r2.endpoint")}</Label>
                <Input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://<account>.r2.cloudflarestorage.com"
                />
              </div>
              <div>
                <Label>{t("admin.storage.r2.access_key")}</Label>
                <Input
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <Label>{t("admin.storage.r2.secret_key")}</Label>
                <Input
                  type="password"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="md:col-span-2">
                <Label>{t("admin.storage.r2.public_base_url")}</Label>
                <Input
                  value={publicBaseUrl}
                  onChange={(e) => setPublicBaseUrl(e.target.value)}
                  placeholder="https://pub-xxx.r2.dev"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("admin.storage.r2.public_base_url_hint")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                onClick={() => saveKeys.mutate()}
                disabled={
                  saveKeys.isPending ||
                  !accountId ||
                  !accessKeyId ||
                  !secretAccessKey ||
                  !bucket ||
                  !endpoint ||
                  !publicBaseUrl
                }
              >
                {t("admin.storage.r2.save_keys")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => testMut.mutate()}
                disabled={testMut.isPending}
              >
                {t("admin.storage.r2.test")}
              </Button>
              {row.has_own_r2 && (
                <Button
                  variant="destructive"
                  onClick={() => clearMut.mutate()}
                  disabled={clearMut.isPending}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {t("admin.storage.r2.clear")}
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
