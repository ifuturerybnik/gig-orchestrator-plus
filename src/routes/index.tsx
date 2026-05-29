import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
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
        <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
          <ThemeSwitcher />
          <LanguageSwitcher />
          <Link to="/login">
            <Button variant="ghost" size="sm">
              {t("nav.login")}
            </Button>
          </Link>
          <Link to="/register">
            <Button size="sm">{t("nav.register")}</Button>
          </Link>
        </div>
        <main className="absolute inset-x-0 top-1/2 bottom-0 flex items-start justify-center px-4">
          <div className="mt-4 max-w-2xl w-full rounded-xl bg-white/70 backdrop-blur-sm px-6 sm:px-10 py-6 text-center shadow-lg">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("landing.hero.title")}
            </h1>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">
              {t("landing.hero.subtitle")}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

