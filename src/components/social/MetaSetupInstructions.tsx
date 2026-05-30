import { useTranslation } from "react-i18next";

/**
 * Instrukcje konfiguracji aplikacji Meta dla integracji Facebook + Instagram.
 * Wspólny App ID dla obu platform (Meta Graph API).
 */
export function MetaSetupInstructions({ callbackUrl }: { callbackUrl: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium">{t("social.meta.setupTitle", "Konfiguracja aplikacji Meta (Facebook + Instagram)")}</p>
      <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
        <li>
          Wejdź na{" "}
          <a className="underline" href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">
            developers.facebook.com/apps
          </a>{" "}
          i utwórz nową aplikację typu <b>Business</b>.
        </li>
        <li>
          W panelu aplikacji dodaj produkt <b>Facebook Login for Business</b>.
        </li>
        <li>
          W sekcji <b>Use cases → Instagram</b> skonfiguruj <b>Business Login for Instagram</b> i dodaj ten sam Redirect URL.
        </li>
        <li>
          W <b>App Settings → Basic → App domains</b> dodaj domenę aplikacji, np. <code>concertivo.eu</code>
          (bez <code>https://</code> i bez ścieżki).
        </li>
        <li>
          W ustawieniach Facebook Login → <b>Valid OAuth Redirect URIs</b> wklej dokładnie:
          <code className="block bg-muted px-2 py-1 mt-1 rounded text-xs break-all">{callbackUrl}</code>
        </li>
        <li>
          W <b>App Settings → Basic</b> skopiuj <b>App ID</b> i <b>App Secret</b> — wklej je w polach powyżej.
        </li>
        <li>
          Aby publikować na Instagramie: konto IG musi być <b>Business</b> lub <b>Creator</b> i powiązane ze stroną Facebook,
          której właścicielem jest osoba autoryzująca aplikację.
        </li>
        <li>
          Dla MVP Instagram prosimy tylko o minimalne uprawnienia: publikacja na IG + odczyt Strony FB powiązanej z kontem IG.
          W trybie deweloperskim działa dla administratorów/testerów aplikacji; dla użytkowników zewnętrznych Meta wymaga App Review.
        </li>
        <li>
          Kliknij <b>„Połącz z Meta"</b> — wybierzesz, które strony Facebook udostępniasz; my zapiszemy pierwszą stronę i
          powiązany z nią profil IG (jeśli istnieje).
        </li>
      </ol>
      <p className="text-xs text-muted-foreground">
        Wymagane uprawnienia (scopes): <code>pages_show_list, pages_read_engagement, instagram_basic, instagram_content_publish</code>
      </p>
    </div>
  );
}
