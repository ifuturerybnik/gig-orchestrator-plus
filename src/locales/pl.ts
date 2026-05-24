export default 
{
  "app": {
    "name": "Concertivo",
    "tagline": "System zarządzania koncertami i organizacjami muzycznymi"
  },
  "nav": {
    "dashboard": "Pulpit",
    "organizations": "Organizacje",
    "admin": "Panel administratora",
    "approvals": "Zatwierdzenia",
    "logout": "Wyloguj",
    "login": "Zaloguj",
    "register": "Załóż konto"
  },
  "lang": {
    "label": "Język",
    "pl": "Polski",
    "en": "English"
  },
  "common": {
    "loading": "Ładowanie…",
    "save": "Zapisz",
    "cancel": "Anuluj",
    "submit": "Wyślij",
    "back": "Wstecz",
    "next": "Dalej",
    "approve": "Zatwierdź",
    "reject": "Odrzuć",
    "edit": "Edytuj",
    "delete": "Usuń",
    "search": "Szukaj",
    "empty": "Brak danych",
    "error": "Coś poszło nie tak",
    "success": "Gotowe"
  },
  "landing": {
    "hero": {
      "title": "Zarządzaj koncertami, zespołami i wydarzeniami w jednym miejscu",
      "subtitle": "Concertivo to system dla agencji koncertowych, firm estradowych, eventowych i zespołów muzycznych. Planuj, koordynuj i rozliczaj występy.",
      "cta_primary": "Zacznij za darmo",
      "cta_secondary": "Mam już konto"
    }
  },
  "auth": {
    "login": {
      "title": "Zaloguj się",
      "email": "Adres email",
      "password": "Hasło",
      "submit": "Zaloguj",
      "forgot": "Nie pamiętasz hasła?",
      "no_account": "Nie masz konta?",
      "register_link": "Załóż konto"
    },
    "register": {
      "title": "Załóż konto",
      "step_account": "Konto",
      "step_profile": "Profil",
      "step_kinds": "Kim jesteś",
      "first_name": "Imię",
      "last_name": "Nazwisko",
      "phone": "Telefon (opcjonalnie)",
      "email": "Adres email",
      "password": "Hasło",
      "password_confirm": "Powtórz hasło",
      "kinds_help": "Wybierz wszystkie role, które Cię opisują. Możesz później je zmienić.",
      "submit": "Załóż konto",
      "have_account": "Masz już konto?",
      "login_link": "Zaloguj się",
      "check_email": "Sprawdź email — wysłaliśmy link aktywacyjny."
    },
    "reset": {
      "title": "Reset hasła",
      "request_subtitle": "Wpisz email — wyślemy link do ustawienia nowego hasła.",
      "set_subtitle": "Ustaw nowe hasło.",
      "email": "Adres email",
      "new_password": "Nowe hasło",
      "send": "Wyślij link",
      "set": "Ustaw hasło",
      "sent": "Wysłano. Sprawdź skrzynkę."
    },
    "errors": {
      "passwords_mismatch": "Hasła nie są takie same",
      "weak_password": "Hasło musi mieć minimum 8 znaków",
      "invalid_credentials": "Nieprawidłowy email lub hasło",
      "select_at_least_one_kind": "Wybierz przynajmniej jedną rolę"
    }
  },
  "user_kinds": {
    "team_manager": "Manager zespołu",
    "musician": "Muzyk",
    "sound_engineer": "Realizator dźwięku",
    "lighting_engineer": "Realizator oświetlenia",
    "visual_engineer": "Realizator wizualizacji scenicznych",
    "driver": "Kierowca",
    "stage_technician": "Technik sceniczny",
    "stage_company_owner": "Właściciel firmy estradowej",
    "event_company_owner": "Właściciel firmy eventowej",
    "concert_organizer": "Organizator koncertów"
  },
  "organizations": {
    "title": "Moje organizacje",
    "new": "Zarejestruj organizację",
    "empty": "Nie masz jeszcze żadnej organizacji. Zarejestruj zespół lub firmę.",
    "type": {
      "label": "Typ organizacji",
      "band": "Zespół muzyczny",
      "stage_company": "Firma estradowa",
      "event_company": "Firma eventowa"
    },
    "status": {
      "label": "Status",
      "pending": "Oczekuje na zatwierdzenie",
      "approved": "Zatwierdzona",
      "rejected": "Odrzucona"
    },
    "form": {
      "name": "Nazwa organizacji",
      "description": "Opis (opcjonalnie)",
      "submit": "Wyślij do zatwierdzenia"
    },
    "members": {
      "title": "Członkowie",
      "invite": "Zaproś",
      "email_placeholder": "email@example.com",
      "invitation_sent": "Wysłano zaproszenie",
      "pending_invitations": "Zaproszenia oczekujące"
    },
    "messages": {
      "created": "Organizacja zgłoszona. Administrator ją zweryfikuje.",
      "approved": "Organizacja zatwierdzona.",
      "rejected": "Organizacja odrzucona."
    }
  },
  "admin": {
    "approvals": {
      "title": "Organizacje oczekujące na zatwierdzenie",
      "empty": "Brak zgłoszeń do zatwierdzenia.",
      "created_by": "Zgłosił:",
      "created_at": "Data zgłoszenia:"
    }
  }
} as const;
