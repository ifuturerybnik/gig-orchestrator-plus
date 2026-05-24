import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOrganization } from "@/lib/organizations.functions";

export const Route = createFileRoute("/_authenticated/organizations/new")({
  component: NewOrganizationPage,
});

type OrgType = "band" | "stage_company" | "event_company";

function NewOrganizationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createFn = useServerFn(createOrganization);

  const [type, setType] = useState<OrgType>("band");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { type: OrgType; name: string; description?: string }) =>
      createFn({ data: input }),
    onSuccess: () => {
      toast.success(t("organizations.messages.created"));
      queryClient.invalidateQueries({ queryKey: ["my-organizations"] });
      navigate({ to: "/organizations" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({ type, name, description: description || undefined });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-3xl font-semibold text-foreground">{t("organizations.new")}</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>{t("organizations.type.label")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as OrgType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="band">{t("organizations.type.band")}</SelectItem>
                <SelectItem value="stage_company">
                  {t("organizations.type.stage_company")}
                </SelectItem>
                <SelectItem value="event_company">
                  {t("organizations.type.event_company")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">{t("organizations.form.name")}</Label>
            <Input
              id="name"
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">{t("organizations.form.description")}</Label>
            <Textarea
              id="desc"
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {t("organizations.form.submit")}
          </Button>
        </form>
      </main>
    </div>
  );
}
