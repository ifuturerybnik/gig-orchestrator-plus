import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Link2, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContactForm } from "@/components/contacts/ContactForm";
import { ContactPicker } from "@/components/pickers/ContactPicker";
import {
  linkContactToCounterparty,
  listLinkedContactsForCounterparty,
  unlinkContactCounterparty,
} from "@/lib/contact-counterparty-links.functions";

export type PendingContact = { id: string; display_name: string };

interface Props {
  /** Gdy podane → tryb "powiąż od razu" + lista z bazy. */
  counterpartyOrgId?: string | null;
  /** Tryb buforowania dla nowo tworzonego kontrahenta. */
  pending?: PendingContact[];
  onPendingChange?: (p: PendingContact[]) => void;
  /** Czy w ogóle pozwalać na dodawanie (np. readOnly w details). */
  disabled?: boolean;
}

export function LinkedContactsSection({
  counterpartyOrgId,
  pending,
  onPendingChange,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const listFn = useServerFn(listLinkedContactsForCounterparty);
  const linkFn = useServerFn(linkContactToCounterparty);
  const unlinkFn = useServerFn(unlinkContactCounterparty);

  const persisted = useQuery({
    queryKey: ["counterparty-linked-contacts", counterpartyOrgId],
    queryFn: () => listFn({ data: { counterpartyOrgId: counterpartyOrgId! } }),
    enabled: !!counterpartyOrgId,
  });

  const items = counterpartyOrgId
    ? (persisted.data?.items ?? []).map((it) => ({
        linkId: it.linkId,
        contactId: it.contact?.id ?? "",
        display_name: it.contact?.display_name ?? "—",
      }))
    : (pending ?? []).map((p) => ({
        linkId: null as string | null,
        contactId: p.id,
        display_name: p.display_name,
      }));

  const excludeIds = items.map((i) => i.contactId).filter(Boolean);

  const linkMutation = useMutation({
    mutationFn: (contactId: string) =>
      linkFn({
        data: {
          contactId,
          counterpartyOrgId: counterpartyOrgId!,
        },
      }),
    onSuccess: (r) => {
      if (r.alreadyLinked) {
        toast.info(t("contacts.links.already_linked"));
      } else {
        toast.success(t("contacts.links.linked"));
      }
      queryClient.invalidateQueries({
        queryKey: ["counterparty-linked-contacts", counterpartyOrgId],
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) => unlinkFn({ data: { linkId } }),
    onSuccess: () => {
      toast.success(t("contacts.links.unlinked"));
      queryClient.invalidateQueries({
        queryKey: ["counterparty-linked-contacts", counterpartyOrgId],
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const handlePickContact = (c: PendingContact) => {
    if (counterpartyOrgId) {
      linkMutation.mutate(c.id);
    } else if (onPendingChange) {
      if ((pending ?? []).some((p) => p.id === c.id)) return;
      onPendingChange([...(pending ?? []), c]);
    }
  };

  const handleRemove = (item: (typeof items)[number]) => {
    if (counterpartyOrgId && item.linkId) {
      unlinkMutation.mutate(item.linkId);
    } else if (!counterpartyOrgId && onPendingChange) {
      onPendingChange((pending ?? []).filter((p) => p.id !== item.contactId));
    }
  };

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {t("contacts.links.cp_section_title")}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {counterpartyOrgId
          ? t("contacts.links.cp_section_help")
          : t("contacts.links.cp_section_help_pending")}
      </p>

      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t("contacts.links.add_contact_btn")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
          >
            <Link2 className="h-4 w-4" />
            {t("contacts.links.link_contact_btn")}
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("contacts.links.empty_contacts")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, idx) => (
            <li
              key={(it.linkId ?? it.contactId) + "-" + idx}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{it.display_name}</span>
                {!counterpartyOrgId && (
                  <Badge variant="secondary" className="text-[10px]">
                    {t("contacts.links.pending_badge")}
                  </Badge>
                )}
              </span>
              {!disabled && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => handleRemove(it)}
                  aria-label={t("contacts.links.unlink")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Picker */}
      <ContactPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={excludeIds}
        onPick={handlePickContact}
      />

      {/* Inline create contact */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("contacts.actions.add")}</DialogTitle>
          </DialogHeader>
          <ContactForm
            scope={{ kind: "user" }}
            initial={null}
            hideLinksSection
            onSaved={(c) => {
              setAddOpen(false);
              handlePickContact({ id: c.id, display_name: c.display_name });
            }}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
