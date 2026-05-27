import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { listLinkableContacts } from "@/lib/contact-counterparty-links.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds?: string[];
  onPick: (contact: { id: string; display_name: string }) => void;
}

export function ContactPicker({ open, onOpenChange, excludeIds, onPick }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const fetchFn = useServerFn(listLinkableContacts);

  const { data, isFetching } = useQuery({
    queryKey: ["linkable-contacts", search],
    queryFn: () => fetchFn({ data: { search: search.trim() || undefined } }),
    enabled: open,
    staleTime: 30_000,
  });

  const items = (data?.items ?? []).filter(
    (c) => !excludeIds || !excludeIds.includes(c.id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>{t("contacts.links.picker_title")}</DialogTitle>
        </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t("contacts.links.picker_search")}
          />
          <CommandList>
            {isFetching && items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : items.length === 0 ? (
              <CommandEmpty>{t("contacts.links.picker_empty")}</CommandEmpty>
            ) : (
              items.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    onPick({ id: c.id, display_name: c.display_name });
                    onOpenChange(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{c.display_name}</span>
                    {(c.email || c.phone) && (
                      <span className="text-xs text-muted-foreground">
                        {[c.email, c.phone].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
