import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Paperclip, Plus, Save, Search, Send, Trash2, X } from "lucide-react";
import { sendAdeMessage, saveAdeDraft } from "@/lib/ade-inbox.functions";
import EdoreczeniaBaeSearchDialog from "./EdoreczeniaBaeSearchDialog";
import { toast } from "sonner";


type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromLabel?: string;
  fromAddress?: string;
  onSent?: () => void;
  initialRecipients?: string[];
  initialSubject?: string;
  initialBody?: string;
};

const ADE_ADDRESS_RE = /^AE:PL-\d{5}-\d{5}-[A-Z0-9]+-\d{2}$/i;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const s = String(r.result ?? "");
      resolve(s.includes(",") ? s.split(",", 2)[1] : s);
    };
    r.readAsDataURL(file);
  });
}

export default function EdoreczeniaComposeDialog({
  open,
  onOpenChange,
  fromLabel,
  fromAddress,
  onSent,
  initialRecipients,
  initialSubject,
  initialBody,
}: Props) {
  const send = useServerFn(sendAdeMessage);
  const saveDraft = useServerFn(saveAdeDraft);
  const [saving, setSaving] = useState(false);
  const [recipients, setRecipients] = useState<string[]>(initialRecipients ?? []);
  const [recipientInput, setRecipientInput] = useState("");
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [body, setBody] = useState(initialBody ?? "");
  const [caseNumber, setCaseNumber] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baeOpen, setBaeOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);


  const reset = useCallback(() => {
    setRecipients([]);
    setRecipientInput("");
    setSubject("");
    setBody("");
    setCaseNumber("");
    setFiles([]);
    setError(null);
  }, []);

  useEffect(() => {
    if (open) {
      setRecipients(initialRecipients ?? []);
      setSubject(initialSubject ?? "");
      setBody(initialBody ?? "");
      setRecipientInput("");
      setCaseNumber("");
      setFiles([]);
      setError(null);
    }
  }, [open, initialRecipients, initialSubject, initialBody]);

  const addRecipient = useCallback(() => {
    const v = recipientInput.trim().toUpperCase();
    if (!v) return;
    if (!ADE_ADDRESS_RE.test(v)) {
      toast.error("Nieprawidłowy format adresu (AE:PL-XXXXX-XXXXX-XXXXX-YY)");
      return;
    }
    if (recipients.includes(v)) {
      setRecipientInput("");
      return;
    }
    setRecipients((r) => [...r, v]);
    setRecipientInput("");
  }, [recipientInput, recipients]);

  const removeRecipient = (v: string) => setRecipients((r) => r.filter((x) => x !== v));

  const addRecipientAddress = useCallback((raw: string) => {
    const v = raw.trim().toUpperCase();
    if (!v) return;
    if (!ADE_ADDRESS_RE.test(v)) {
      toast.error(`Nieprawidłowy adres: ${v}`);
      return;
    }
    setRecipients((r) => (r.includes(v) ? r : [...r, v]));
  }, []);


  const onFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  const handleSend = async () => {
    setError(null);
    if (!recipients.length) {
      setError("Dodaj przynajmniej jednego adresata.");
      return;
    }
    if (!subject.trim()) {
      setError("Temat jest wymagany.");
      return;
    }
    if (totalSize > 500 * 1024 * 1024) {
      setError("Sumaryczny rozmiar załączników przekracza 500 MB.");
      return;
    }
    setSending(true);
    try {
      const attachments = await Promise.all(
        files.map(async (f) => ({
          filename: f.name,
          mimeType: f.type || "application/octet-stream",
          contentBase64: await fileToBase64(f),
        })),
      );
      const res = await send({
        data: {
          recipients,
          subject: subject.trim(),
          bodyText: body,
          caseNumber: caseNumber.trim() || undefined,
          attachments,
        },
      });
      if (!res.ok) {
        setError(res.error ?? "Nie udało się wysłać wiadomości");
        return;
      }
      toast.success("Wiadomość wysłana");
      reset();
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !sending) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Nowa wiadomość</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div>
            <div className="text-sm mb-2">
              <span className="text-muted-foreground">Od: </span>
              <span className="font-medium">{fromLabel ?? "—"}</span>{" "}
              {fromAddress && <span className="font-mono text-xs">&lt;{fromAddress}&gt;</span>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>DO:</Label>
            <div className="rounded-md border p-2 min-h-[44px] flex flex-wrap gap-1.5">
              {recipients.map((r) => (
                <Badge key={r} variant="secondary" className="gap-1 font-mono">
                  {r}
                  <button
                    type="button"
                    onClick={() => removeRecipient(r)}
                    className="hover:text-destructive"
                    aria-label={`Usuń ${r}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <div className="flex gap-2 flex-1 min-w-[220px]">
                <Input
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === " ") {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                  placeholder="AE:PL-XXXXX-XXXXX-XXXXX-YY"
                  className="border-0 shadow-none focus-visible:ring-0 h-8 font-mono text-xs"
                />
                <Button type="button" size="sm" variant="outline" onClick={addRecipient}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Wpisz adresata
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setBaeOpen(true)}
                >
                  <Search className="h-3.5 w-3.5 mr-1" /> Szukaj w BAE
                </Button>

              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Naciśnij Enter, spację lub przecinek, aby dodać adres.
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edor-subject">
              Temat <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edor-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edor-body">Treść</Label>
            <Textarea
              id="edor-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Treść wiadomości"
              rows={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edor-case">Numer sprawy</Label>
            <Input
              id="edor-case"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Załączniki</Label>
            <div className="text-xs text-muted-foreground">Maksymalny rozmiar załączników 500 MB</div>
            <div className="flex items-center gap-2">
              <Input
                ref={fileRef}
                type="file"
                multiple
                onChange={(e) => onFiles(e.target.files)}
                className="cursor-pointer"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
            {files.length > 0 && (
              <ul className="space-y-1 mt-2">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1"
                  >
                    <span className="truncate">
                      {f.name}{" "}
                      <span className="text-muted-foreground">
                        · {Math.round(f.size / 1024)} kB
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Nie udało się wysłać</AlertTitle>
              <AlertDescription className="font-mono text-xs break-all">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSend} disabled={sending}>
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Wyślij
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!sending) {
                  reset();
                  onOpenChange(false);
                }
              }}
              disabled={sending}
            >
              Anuluj
            </Button>
          </div>
        </div>
      </DialogContent>
      <EdoreczeniaBaeSearchDialog
        open={baeOpen}
        onOpenChange={setBaeOpen}
        onPick={addRecipientAddress}
      />
    </Dialog>
  );

}
