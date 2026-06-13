// Wspólny formularz skrzynki e-mail (create + edit) używany przez
// MyMailboxesSection (osobista) i OrgMailboxesSection (wspolna).
// JEDEN mechanizm — zob. mem://features/unified-mail-mechanism.
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  MailConfigAiAssistant,
  applyMailSuggestion,
  type MailFormSuggestion,
} from "@/components/mail/MailConfigAiAssistant";

export type MailboxFormState = {
  nazwa: string;
  nazwa_wyswietlana: string;
  ikona_url: string;
  email: string;
  imap_host: string;
  imap_port: string;
  imap_login: string;
  imap_haslo: string;
  imap_use_ssl: boolean;
  smtp_host: string;
  smtp_port: string;
  smtp_login: string;
  smtp_haslo: string;
  smtp_use_ssl: boolean;
};

export const emptyMailboxForm: MailboxFormState = {
  nazwa: "",
  nazwa_wyswietlana: "",
  ikona_url: "",
  email: "",
  imap_host: "",
  imap_port: "993",
  imap_login: "",
  imap_haslo: "",
  imap_use_ssl: true,
  smtp_host: "",
  smtp_port: "465",
  smtp_login: "",
  smtp_haslo: "",
  smtp_use_ssl: true,
};

// Wczytuje plik graficzny, skaluje do max 128px i zwraca data URL (PNG).
// Awatar jest mały więc data URL w bazie jest OK.
async function fileToAvatarDataUrl(file: File, maxSize = 128): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("read error"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}


type Props = {
  mode: "create" | "edit";
  initial?: MailboxFormState;
  submitting?: boolean;
  onSubmit: (form: MailboxFormState) => void;
  onCancel: () => void;
};

export function MailboxForm({ mode, initial, submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<MailboxFormState>(initial ?? emptyMailboxForm);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const passwordPlaceholder =
    mode === "edit" ? t("skrzynki.form.password_keep", "Pozostaw puste, aby nie zmieniać") : "";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-border bg-background p-4"
    >
      <MailConfigAiAssistant
        currentEmail={form.email}
        onApply={(s: MailFormSuggestion) =>
          setForm((prev) => applyMailSuggestion(prev, s))
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("skrzynki.form.nazwa")}>
          <Input
            required
            value={form.nazwa}
            onChange={(e) => setForm({ ...form, nazwa: e.target.value })}
            placeholder={t("skrzynki.form.nazwa_placeholder")}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "skrzynki.form.nazwa_hint",
              'Etykieta widoczna tylko w aplikacji (np. „Sekretariat").',
            )}
          </p>
        </Field>
        <Field label={t("skrzynki.form.nazwa_wyswietlana", "Nazwa wyświetlana (Od)")}>
          <Input
            value={form.nazwa_wyswietlana}
            onChange={(e) => setForm({ ...form, nazwa_wyswietlana: e.target.value })}
            placeholder={t(
              "skrzynki.form.nazwa_wyswietlana_placeholder",
              "np. Jan Kowalski / Concertivo Booking",
            )}
            maxLength={160}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "skrzynki.form.nazwa_wyswietlana_hint",
              'Pojawia się u odbiorcy w polu „Od:" obok adresu e-mail.',
            )}
          </p>
        </Field>
      </div>

      <IkonaField
        value={form.ikona_url}
        onChange={(v) => setForm((prev) => ({ ...prev, ikona_url: v }))}
      />


      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("skrzynki.form.email")}>
          <Input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
      </div>

      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">IMAP</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("skrzynki.form.host")}>
            <Input
              required
              value={form.imap_host}
              onChange={(e) => setForm({ ...form, imap_host: e.target.value })}
              placeholder="imap.example.com"
            />
          </Field>
          <Field label={t("skrzynki.form.port")}>
            <Input
              required
              type="number"
              min={1}
              max={65535}
              value={form.imap_port}
              onChange={(e) => setForm({ ...form, imap_port: e.target.value })}
            />
          </Field>
          <Field label={t("skrzynki.form.login")}>
            <Input
              required
              value={form.imap_login}
              onChange={(e) => setForm({ ...form, imap_login: e.target.value })}
            />
          </Field>
          <Field label={t("skrzynki.form.password")}>
            <Input
              required={mode === "create"}
              type="password"
              value={form.imap_haslo}
              onChange={(e) => setForm({ ...form, imap_haslo: e.target.value })}
              placeholder={passwordPlaceholder}
            />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <Switch
            checked={form.imap_use_ssl}
            onCheckedChange={(v) => setForm({ ...form, imap_use_ssl: v })}
          />
          {t("skrzynki.form.ssl")}
        </label>
      </fieldset>

      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">SMTP</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("skrzynki.form.host")}>
            <Input
              required
              value={form.smtp_host}
              onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
              placeholder="smtp.example.com"
            />
          </Field>
          <Field label={t("skrzynki.form.port")}>
            <Input
              required
              type="number"
              min={1}
              max={65535}
              value={form.smtp_port}
              onChange={(e) => setForm({ ...form, smtp_port: e.target.value })}
            />
          </Field>
          <Field label={t("skrzynki.form.login")}>
            <Input
              required
              value={form.smtp_login}
              onChange={(e) => setForm({ ...form, smtp_login: e.target.value })}
            />
          </Field>
          <Field label={t("skrzynki.form.password")}>
            <Input
              required={mode === "create"}
              type="password"
              value={form.smtp_haslo}
              onChange={(e) => setForm({ ...form, smtp_haslo: e.target.value })}
              placeholder={passwordPlaceholder}
            />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <Switch
            checked={form.smtp_use_ssl}
            onCheckedChange={(v) => setForm({ ...form, smtp_use_ssl: v })}
          />
          {t("skrzynki.form.ssl")}
        </label>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={submitting}>
          {mode === "edit" ? t("common.save", "Zapisz") : t("skrzynki.save")}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function IkonaField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("skrzynki.form.ikona_only_images", "Wybierz plik graficzny."));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("skrzynki.form.ikona_too_big", "Maksymalny rozmiar to 2 MB."));
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file, 128);
      onChange(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <Label className="text-xs">
        {t("skrzynki.form.ikona", "Awatar skrzynki (wewnętrzny)")}
      </Label>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              {value
                ? t("skrzynki.form.ikona_change", "Zmień")
                : t("skrzynki.form.ikona_upload", "Wgraj obraz")}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange("")}
                disabled={busy}
              >
                <X className="h-3.5 w-3.5" />
                {t("common.remove", "Usuń")}
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "skrzynki.form.ikona_hint",
          "Awatar jest widoczny tylko w Concertivo (np. na liście skrzynek i w wątkach). Awatar widoczny u adresatów w ich poczcie (Gmail, Outlook itp.) musi być skonfigurowany po stronie serwera pocztowego — przez Gravatar (zarejestrowany na ten sam adres e-mail) lub BIMI (rekord DNS + logo SVG).",
        )}
      </p>
    </div>
  );
}

