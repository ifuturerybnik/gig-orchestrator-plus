import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/landing-hero.jpg";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const { t } = useTranslation();
  return (
    <div
      className="min-h-screen bg-background bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${heroBg})` }}
    >
      <div className="min-h-screen bg-background/60 backdrop-blur-[1px]">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {t("landing.hero.title")}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">{t("landing.hero.subtitle")}</p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link to="/register">
              <Button size="lg">{t("landing.hero.cta_primary")}</Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline">
                {t("landing.hero.cta_secondary")}
              </Button>
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
