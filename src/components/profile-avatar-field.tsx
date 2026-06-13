import { useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fileToAvatarDataUrl } from "@/lib/image-to-avatar";
import { updateMyAvatar } from "@/lib/profile.functions";

export function ProfileAvatarField({ value }: { value: string | null | undefined }) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateMyAvatar);

  const mutation = useMutation({
    mutationFn: (avatar_url: string | null) => updateFn({ data: { avatar_url } }),
    onSuccess: () => {
      toast.success(t("profile.saved"));
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("profile.avatar.only_images", "Wybierz plik graficzny."));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("profile.avatar.too_big", "Maksymalny rozmiar to 2 MB."));
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file, 128);
      await mutation.mutateAsync(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="space-y-2 rounded-md border border-border bg-card p-4">
      <Label className="text-sm font-semibold">
        {t("profile.avatar.title", "Zdjęcie profilowe")}
      </Label>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
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
              disabled={busy || mutation.isPending}
            >
              {value
                ? t("profile.avatar.change", "Zmień")
                : t("profile.avatar.upload", "Wgraj obraz")}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => mutation.mutate(null)}
                disabled={busy || mutation.isPending}
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
          "profile.avatar.hint",
          "Awatar pojawia się obok logo Concertivo oraz w komunikatorach wewnątrz aplikacji.",
        )}
      </p>
    </section>
  );
}
