import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12 border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row">
        <p>
          © {year} {t("app.name")} · {t("footer.operator")}
        </p>
        <nav className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-foreground">
            {t("footer.privacy")}
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            {t("footer.terms")}
          </Link>
          <a href="mailto:support@i-future.pl" className="hover:text-foreground">
            {t("footer.contact")}
          </a>
        </nav>
      </div>
    </footer>
  );
}
