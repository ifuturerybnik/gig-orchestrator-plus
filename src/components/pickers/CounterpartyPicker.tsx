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
import { listLinkableCounterparties } from "@/lib/contact-counterparty-links.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds?: string[];
  onPick: (org: { id: string; name: string }) => void;
}

export function CounterpartyPicker({ open, onOpenChange, excludeIds, onPick }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const fetchFn = useServerFn(listLinkableCounterparties);

  const { data, isFetching } = useQuery({
    queryKey: ["linkable-counterparties", search],
    queryFn: () => fetchFn({ data: { search: search.trim() || undefined } }),
    enabled: open,
    staleTime: 30_000,
  });

  const items = (data?.items ?? []).filter(
    (o) => !excludeIds || !excludeIds.includes(o.id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>{t("contacts.links.cp_picker_title")}</DialogTitle>
        </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t("contacts.links.cp_picker_search")}
          />
          <CommandList>
            {isFetching && items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : items.length === 0 ? (
              <CommandEmpty>{t("contacts.links.cp_picker_empty")}</CommandEmpty>
            ) : (
              items.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  onSelect={() => {
                    onPick({ id: o.id, name: o.name });
                    onOpenChange(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{o.name}</span>
                    {o.tax_id && (
                      <span className="text-xs text-muted-foreground">
                        NIP: {o.tax_id}
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
