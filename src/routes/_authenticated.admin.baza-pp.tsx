import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Download, Upload, ChevronDown, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PhoneInput } from "@/components/phone-input";
import { getMyProfile } from "@/lib/profile.functions";
import {
  PUBLIC_ENTITY_TYPES,
  type PublicEntityType,
  listPublicEntities,
  createPublicEntity,
  updatePublicEntity,
  deletePublicEntity,
  bulkDeletePublicEntities,
  commitPublicEntitiesImport,
} from "@/lib/public-entities.functions";
import {
  parseImportFile,
  exportToXlsx,
  exportToCsv,
  type ImportSource,
  type ParsedRow,
} from "@/lib/public-entities-io";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScannerDialog, type ScannerSource, type ScannerScope } from "@/components/baza-pp/ScannerDialog";


export const Route = createFileRoute("/_authenticated/admin/baza-pp")({
  component: BazaPpPage,
});

const WOJEWODZTWA = [
  "dolnośląskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "łódzkie",
  "małopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "śląskie",
  "świętokrzyskie",
  "warmińsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie",
];

type Entity = {
  id: string;
  entity_type: PublicEntityType;
  name: string;
  short_name: string | null;
  teryt_code: string | null;
  jst_type_raw: string | null;
  wojewodztwo: string | null;
  powiat: string | null;
  miejscowosc: string | null;
  kod_pocztowy: string | null;
  poczta: string | null;
  ulica: string | null;
  nr_domu: string | null;
  phone: string | null;
  phone_ext: string | null;
  nip: string | null;
  regon: string | null;
  email: string | null;
  www: string | null;
  epuap_address: string | null;
  edoreczenia_ade: string | null;
};

type FormState = Omit<Entity, "id">;

const EMPTY_FORM: FormState = {
  entity_type: "jst_gmina",
  name: "",
  short_name: "",
  teryt_code: "",
  jst_type_raw: "",
  wojewodztwo: "",
  powiat: "",
  miejscowosc: "",
  kod_pocztowy: "",
  poczta: "",
  ulica: "",
  nr_domu: "",
  phone: "",
  phone_ext: "",
  nip: "",
  regon: "",
  email: "",
  www: "",
  epuap_address: "",
  edoreczenia_ade: "",
};

function BazaPpPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const fetchProfile = useServerFn(getMyProfile);
  const fetchList = useServerFn(listPublicEntities);
  const createFn = useServerFn(createPublicEntity);
  const updateFn = useServerFn(updatePublicEntity);
  const deleteFn = useServerFn(deletePublicEntity);
  const bulkDeleteFn = useServerFn(bulkDeletePublicEntities);
  const commitImport = useServerFn(commitPublicEntitiesImport);

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const isAdmin = profileQuery.data?.isAdmin === true;
  const isSuper = profileQuery.data?.isSuperAdmin === true;

  const [entityType, setEntityType] = useState<PublicEntityType | "all">("all");
  const [wojewodztwo, setWojewodztwo] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [extendedView, setExtendedView] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [scanner, setScanner] = useState<{
    source: ScannerSource;
    scope: ScannerScope;
  } | null>(null);


  const listQuery = useQuery({
    queryKey: ["public-entities", entityType, wojewodztwo, search, page],
    queryFn: () =>
      fetchList({
        data: {
          entityType: entityType === "all" ? null : entityType,
          wojewodztwo: wojewodztwo === "all" ? null : wojewodztwo,
          search: search || null,
          page,
          pageSize,
        },
      }),
    enabled: isAdmin,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importSource, setImportSource] = useState<ImportSource>("jst");
  const [importRows, setImportRows] = useState<ParsedRow[]>([]);
  const [importSkipped, setImportSkipped] = useState(0);
  const [importFileName, setImportFileName] = useState("");
  const [importBusy, setImportBusy] = useState(false);

  const onPickImportFile = async (file: File) => {
    try {
      setImportBusy(true);
      const { rows, skipped, rawCount } = await parseImportFile(file, importSource);
      setImportRows(rows);
      setImportSkipped(skipped);
      setImportFileName(file.name);
      if (rawCount === 0) toast.error(t("admin.bazaPp.import.emptyFile"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImportBusy(false);
    }
  };

  const runImport = async () => {
    if (importRows.length === 0) return;
    try {
      setImportBusy(true);
      const res = await commitImport({
        data: {
          rows: importRows,
          source: `import:${importSource}:${new Date().toISOString().slice(0, 10)}`,
        },
      });
      toast.success(
        t("admin.bazaPp.import.done", {
          inserted: res.inserted,
          updated: res.updated,
          errors: res.errors.length,
        }),
      );
      if (res.errors.length > 0) {
        console.warn("Import errors", res.errors);
      }
      setImportOpen(false);
      setImportRows([]);
      setImportFileName("");
      qc.invalidateQueries({ queryKey: ["public-entities"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImportBusy(false);
    }
  };

  const runExport = async (format: "xlsx" | "csv") => {
    try {
      const res = await fetchList({
        data: {
          entityType: entityType === "all" ? null : entityType,
          wojewodztwo: wojewodztwo === "all" ? null : wojewodztwo,
          search: search || null,
          page: 1,
          pageSize: 50000,
        },
      });
      const rows = (res.rows ?? []) as Array<Record<string, unknown>>;
      if (rows.length === 0) {
        toast.error(t("admin.bazaPp.empty"));
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "xlsx") exportToXlsx(rows, `baza-pp-${stamp}.xlsx`);
      else exportToCsv(rows, `baza-pp-${stamp}.csv`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };
  const openEdit = (row: Entity) => {
    setEditingId(row.id);
    const { id: _id, ...rest } = row;
    setForm({
      ...EMPTY_FORM,
      ...Object.fromEntries(
        Object.entries(rest).map(([k, v]) => [k, v ?? ""]),
      ),
    } as FormState);
    setDialogOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        short_name: form.short_name || null,
        teryt_code: form.teryt_code || null,
        jst_type_raw: form.jst_type_raw || null,
        wojewodztwo: form.wojewodztwo || null,
        powiat: form.powiat || null,
        miejscowosc: form.miejscowosc || null,
        kod_pocztowy: form.kod_pocztowy || null,
        poczta: form.poczta || null,
        ulica: form.ulica || null,
        nr_domu: form.nr_domu || null,
        phone: form.phone || null,
        phone_ext: form.phone_ext || null,
        nip: form.nip || null,
        regon: form.regon || null,
        email: form.email || null,
        www: form.www || null,
        epuap_address: form.epuap_address || null,
        edoreczenia_ade: form.edoreczenia_ade || null,
      };
      if (editingId) {
        await updateFn({ data: { id: editingId, patch: payload } });
      } else {
        await createFn({ data: payload });
      }
    },
    onSuccess: () => {
      toast.success(t("admin.bazaPp.saved"));
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["public-entities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await deleteFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success(t("admin.bazaPp.deleted"));
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["public-entities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await bulkDeleteFn({ data: { ids } });
      return res;
    },
    onSuccess: (res) => {
      toast.success(t("admin.bazaPp.selection.bulkDeleted", { count: res.deleted }));
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      qc.invalidateQueries({ queryKey: ["public-entities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (listQuery.data?.rows ?? []) as Entity[];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const allSelectedOnPage =
    rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const toggleAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const typeLabel = useMemo(
    () => (typ: PublicEntityType) => t(`admin.bazaPp.types.${typ}`),
    [t],
  );

  if (profileQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("admin.bazaPp.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.bazaPp.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                {t("admin.bazaPp.export.button")}
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => runExport("xlsx")}>
                {t("admin.bazaPp.export.xlsx")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => runExport("csv")}>
                {t("admin.bazaPp.export.csv")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isSuper && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                {t("admin.bazaPp.import.button")}
              </Button>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                {t("admin.bazaPp.addNew")}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <Label>{t("admin.bazaPp.filters.type")}</Label>
          <Select
            value={entityType}
            onValueChange={(v) => {
              setEntityType(v as PublicEntityType | "all");
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.bazaPp.filters.all")}</SelectItem>
              {PUBLIC_ENTITY_TYPES.map((typ) => (
                <SelectItem key={typ} value={typ}>
                  {typeLabel(typ)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("admin.bazaPp.filters.wojewodztwo")}</Label>
          <Select
            value={wojewodztwo}
            onValueChange={(v) => {
              setWojewodztwo(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.bazaPp.filters.all")}</SelectItem>
              {WOJEWODZTWA.map((w) => (
                <SelectItem key={w} value={w}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>{t("admin.bazaPp.filters.search")}</Label>
          <Input
            placeholder={t("admin.bazaPp.filters.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={extendedView ? "default" : "outline"}
            onClick={() => setExtendedView((v) => !v)}
          >
            {extendedView ? t("admin.bazaPp.view.compact") : t("admin.bazaPp.view.extended")}
          </Button>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{t("admin.bazaPp.pageSize")}</Label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {isSuper && selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("admin.bazaPp.selection.selected", { count: selectedIds.size })}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              {t("admin.bazaPp.selection.clear")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("admin.bazaPp.selection.bulkDelete")}
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isSuper && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelectedOnPage}
                      onCheckedChange={toggleAllOnPage}
                      aria-label={t("admin.bazaPp.selection.selectAll")}
                    />
                  </TableHead>
                )}
                <TableHead>{t("admin.bazaPp.cols.type")}</TableHead>
                <TableHead>{t("admin.bazaPp.cols.name")}</TableHead>
                {extendedView && <TableHead>{t("admin.bazaPp.cols.shortName")}</TableHead>}
                {extendedView && <TableHead>{t("admin.bazaPp.cols.teryt")}</TableHead>}
                {extendedView && <TableHead>{t("admin.bazaPp.cols.jstTypeRaw")}</TableHead>}
                <TableHead>{t("admin.bazaPp.cols.wojewodztwo")}</TableHead>
                {extendedView && <TableHead>{t("admin.bazaPp.cols.powiat")}</TableHead>}
                <TableHead>{t("admin.bazaPp.cols.miejscowosc")}</TableHead>
                {extendedView && <TableHead>{t("admin.bazaPp.cols.kodPocztowy")}</TableHead>}
                {extendedView && <TableHead>{t("admin.bazaPp.cols.poczta")}</TableHead>}
                {extendedView && <TableHead>{t("admin.bazaPp.cols.ulica")}</TableHead>}
                {extendedView && <TableHead>{t("admin.bazaPp.cols.nrDomu")}</TableHead>}
                <TableHead>{t("admin.bazaPp.cols.phone")}</TableHead>
                {extendedView && <TableHead>{t("admin.bazaPp.cols.phoneExt")}</TableHead>}
                <TableHead>{t("admin.bazaPp.cols.nip")}</TableHead>
                {extendedView && <TableHead>{t("admin.bazaPp.cols.regon")}</TableHead>}
                <TableHead>{t("admin.bazaPp.cols.email")}</TableHead>
                {extendedView && <TableHead>{t("admin.bazaPp.cols.www")}</TableHead>}
                {extendedView && <TableHead>{t("admin.bazaPp.cols.epuap")}</TableHead>}
                {extendedView && <TableHead>{t("admin.bazaPp.cols.edoreczenia")}</TableHead>}
                <TableHead className="w-24 text-right">{t("admin.bazaPp.cols.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const baseCols = isSuper ? 7 : 6;
                const extraCols = extendedView ? 13 : 0;
                const colSpan = baseCols + extraCols;
                if (listQuery.isLoading) {
                  return (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
                        {t("common.loading")}
                      </TableCell>
                    </TableRow>
                  );
                }
                if (rows.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
                        {t("admin.bazaPp.empty")}
                      </TableCell>
                    </TableRow>
                  );
                }
                return rows.map((r) => (
                  <TableRow key={r.id} data-state={selectedIds.has(r.id) ? "selected" : undefined}>
                    {isSuper && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(r.id)}
                          onCheckedChange={() => toggleOne(r.id)}
                          aria-label="Select row"
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {typeLabel(r.entity_type)}
                    </TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    {extendedView && <TableCell>{r.short_name ?? ""}</TableCell>}
                    {extendedView && <TableCell className="whitespace-nowrap">{r.teryt_code ?? ""}</TableCell>}
                    {extendedView && <TableCell>{r.jst_type_raw ?? ""}</TableCell>}
                    <TableCell>{r.wojewodztwo ?? ""}</TableCell>
                    {extendedView && <TableCell>{r.powiat ?? ""}</TableCell>}
                    <TableCell>{r.miejscowosc ?? ""}</TableCell>
                    {extendedView && <TableCell className="whitespace-nowrap">{r.kod_pocztowy ?? ""}</TableCell>}
                    {extendedView && <TableCell>{r.poczta ?? ""}</TableCell>}
                    {extendedView && <TableCell>{r.ulica ?? ""}</TableCell>}
                    {extendedView && <TableCell>{r.nr_domu ?? ""}</TableCell>}
                    <TableCell className="whitespace-nowrap">
                      {r.phone ?? ""}
                      {!extendedView && r.phone_ext ? ` wew. ${r.phone_ext}` : ""}
                    </TableCell>
                    {extendedView && <TableCell>{r.phone_ext ?? ""}</TableCell>}
                    <TableCell className="whitespace-nowrap">{r.nip ?? ""}</TableCell>
                    {extendedView && <TableCell className="whitespace-nowrap">{r.regon ?? ""}</TableCell>}
                    <TableCell>{r.email ?? ""}</TableCell>
                    {extendedView && <TableCell className="max-w-[200px] truncate">{r.www ?? ""}</TableCell>}
                    {extendedView && <TableCell className="max-w-[200px] truncate">{r.epuap_address ?? ""}</TableCell>}
                    {extendedView && <TableCell className="max-w-[200px] truncate">{r.edoreczenia_ade ?? ""}</TableCell>}
                    <TableCell>
                      {isSuper && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteId(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {t("admin.bazaPp.totalCount", { count: total })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ←
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </Button>
        </div>
      </div>


      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("admin.bazaPp.editTitle") : t("admin.bazaPp.addTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>{t("admin.bazaPp.cols.type")} *</Label>
              <Select
                value={form.entity_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, entity_type: v as PublicEntityType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUBLIC_ENTITY_TYPES.map((typ) => (
                    <SelectItem key={typ} value={typ}>
                      {typeLabel(typ)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>{t("admin.bazaPp.cols.name")} *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.form.shortName")}</Label>
              <Input
                value={form.short_name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, short_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.form.teryt")}</Label>
              <Input
                value={form.teryt_code ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, teryt_code: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.cols.wojewodztwo")}</Label>
              <Select
                value={form.wojewodztwo || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, wojewodztwo: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {WOJEWODZTWA.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("admin.bazaPp.form.powiat")}</Label>
              <Input
                value={form.powiat ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, powiat: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.cols.miejscowosc")}</Label>
              <Input
                value={form.miejscowosc ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, miejscowosc: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.form.kodPocztowy")}</Label>
              <Input
                value={form.kod_pocztowy ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, kod_pocztowy: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.form.poczta")}</Label>
              <Input
                value={form.poczta ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, poczta: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.form.ulica")}</Label>
              <Input
                value={form.ulica ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, ulica: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.form.nrDomu")}</Label>
              <Input
                value={form.nr_domu ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, nr_domu: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.cols.phone")}</Label>
              <PhoneInput
                value={form.phone ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                defaultCountry="PL"
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.form.phoneExt")}</Label>
              <Input
                value={form.phone_ext ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phone_ext: e.target.value }))}
                placeholder="451"
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.cols.nip")}</Label>
              <Input
                value={form.nip ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, nip: e.target.value }))}
                placeholder="1234563218"
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.cols.regon")}</Label>
              <Input
                value={form.regon ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, regon: e.target.value }))}
                placeholder="000000000"
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.cols.email")}</Label>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.form.www")}</Label>
              <Input
                value={form.www ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, www: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.form.epuap")}</Label>
              <Input
                value={form.epuap_address ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, epuap_address: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("admin.bazaPp.form.edoreczenia")}</Label>
              <Input
                value={form.edoreczenia_ade ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, edoreczenia_ade: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !form.name.trim()}
            >
              {saveMut.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportRows([]); setImportFileName(""); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("admin.bazaPp.import.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("admin.bazaPp.import.help")}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>{t("admin.bazaPp.import.source")}</Label>
                <Select value={importSource} onValueChange={(v) => { setImportSource(v as ImportSource); setImportRows([]); setImportFileName(""); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jst">{t("admin.bazaPp.import.sources.jst")}</SelectItem>
                    <SelectItem value="osrodki_kultury">{t("admin.bazaPp.import.sources.osrodki_kultury")}</SelectItem>
                    <SelectItem value="generic">{t("admin.bazaPp.import.sources.generic")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("admin.bazaPp.import.file")}</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  disabled={importBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onPickImportFile(f);
                  }}
                />
                {importFileName && (
                  <p className="mt-1 text-xs text-muted-foreground">{importFileName}</p>
                )}
              </div>
            </div>

            {importRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm">
                  {t("admin.bazaPp.import.summary", {
                    count: importRows.length,
                    skipped: importSkipped,
                  })}
                </p>
                <div className="max-h-80 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Typ</TableHead>
                        <TableHead>Nazwa</TableHead>
                        <TableHead>Nazwa skr.</TableHead>
                        <TableHead>TERYT</TableHead>
                        <TableHead>Woj.</TableHead>
                        <TableHead>Powiat</TableHead>
                        <TableHead>Miejscowość</TableHead>
                        <TableHead>Kod</TableHead>
                        <TableHead>Poczta</TableHead>
                        <TableHead>Ulica</TableHead>
                        <TableHead>Nr</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>Wewn.</TableHead>
                        <TableHead>NIP</TableHead>
                        <TableHead>REGON</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>WWW</TableHead>
                        <TableHead>ePUAP</TableHead>
                        <TableHead>ADE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.slice(0, 20).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs whitespace-nowrap">{r.entity_type}</TableCell>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>{r.short_name ?? ""}</TableCell>
                          <TableCell>{r.teryt_code ?? ""}</TableCell>
                          <TableCell>{r.wojewodztwo ?? ""}</TableCell>
                          <TableCell>{r.powiat ?? ""}</TableCell>
                          <TableCell>{r.miejscowosc ?? ""}</TableCell>
                          <TableCell>{r.kod_pocztowy ?? ""}</TableCell>
                          <TableCell>{r.poczta ?? ""}</TableCell>
                          <TableCell>{r.ulica ?? ""}</TableCell>
                          <TableCell>{r.nr_domu ?? ""}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.phone ?? ""}</TableCell>
                          <TableCell>{r.phone_ext ?? ""}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.nip ?? ""}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.regon ?? ""}</TableCell>
                          <TableCell>{r.email ?? ""}</TableCell>
                          <TableCell>{r.www ?? ""}</TableCell>
                          <TableCell>{r.epuap_address ?? ""}</TableCell>
                          <TableCell>{r.edoreczenia_ade ?? ""}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {importRows.length > 20 && (
                  <p className="text-xs text-muted-foreground">
                    {t("admin.bazaPp.import.preview20", { total: importRows.length })}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importBusy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={runImport} disabled={importBusy || importRows.length === 0}>
              {importBusy ? t("common.saving") : t("admin.bazaPp.import.confirm", { count: importRows.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.bazaPp.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.bazaPp.deleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.bazaPp.selection.bulkDeleteConfirmTitle", { count: selectedIds.size })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.bazaPp.selection.bulkDeleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMut.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMut.mutate(Array.from(selectedIds))}
              disabled={bulkDeleteMut.isPending}
            >
              {bulkDeleteMut.isPending ? t("common.saving") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
