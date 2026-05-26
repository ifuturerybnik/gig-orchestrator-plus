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
    <div className="min-h-screen bg-background">
      <div
        className="relative w-full bg-cover bg-center bg-no-repeat aspect-[16/9]"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <Header />
        <main className="absolute inset-0 flex">
          <div className="ml-auto w-1/2 flex flex-col justify-center px-6 sm:px-10 text-right">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("landing.hero.title")}
            </h1>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">
              {t("landing.hero.subtitle")}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Link to="/register">
                <Button size="lg">{t("landing.hero.cta_primary")}</Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">
                  {t("landing.hero.cta_secondary")}
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

