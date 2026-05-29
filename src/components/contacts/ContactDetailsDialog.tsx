import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useContact, type ContactScope } from "@/hooks/useContacts";
import { ContactForm } from "./ContactForm";

interface Props {
  contactId: string | null;
  scope: ContactScope;
  onOpenChange: (open: boolean) => void;
}

export function ContactDetailsDialog({ contactId, scope, onOpenChange }: Props) {
  const { t } = useTranslation();
  const open = !!contactId;
  const { data: contact, isLoading } = useContact(contactId ?? undefined);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {contact?.display_name ?? t("common.loading")}
          </DialogTitle>
        </DialogHeader>
        {isLoading || !contact ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <ContactForm
            scope={scope}
            initial={contact}
            onSaved={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
