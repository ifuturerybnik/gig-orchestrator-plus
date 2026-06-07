export default 
{
  "privacy": {
    "title": "Dane i prywatność",
    "subtitle": "Zgodnie z RODO masz prawo pobrać kopię swoich danych oraz trwale usunąć konto.",
    "export": {
      "title": "Pobierz moje dane",
      "help": "Otrzymasz plik JSON z profilem, zgodami, członkostwami w organizacjach i historią rozliczeń.",
      "button": "Pobierz JSON",
      "success": "Plik został pobrany."
    },
    "delete": {
      "title": "Usuń konto",
      "help": "Operacja nieodwracalna — usuwa profil, zgody, członkostwa i wszystkie dane osobowe.",
      "button": "Usuń konto",
      "confirm_title": "Czy na pewno chcesz usunąć konto?",
      "confirm_desc": "Tej operacji nie da się cofnąć. Wszystkie Twoje dane zostaną trwale usunięte. Jeśli jesteś jedynym właścicielem organizacji, najpierw musisz przekazać własność lub usunąć organizację.",
      "email_label": "Aby potwierdzić, wpisz swój email: {{email}}",
      "email_mismatch": "Email nie zgadza się.",
      "confirm_button": "Tak, usuń konto",
      "success": "Konto zostało usunięte."
    }
  },
  "consent_update": {
    "title": "Zaktualizowaliśmy nasze dokumenty",
    "subtitle": "Wprowadziliśmy zmiany w Regulaminie lub Polityce prywatności. Aby kontynuować korzystanie z Concertivo, prosimy o akceptację aktualnych wersji.",
    "accept_terms": "Akceptuję aktualny",
    "accept_privacy": "Zapoznałem/am się z aktualną",
    "alternative": "Jeśli nie akceptujesz zmian, możesz w każdej chwili usunąć konto w panelu profilu — Twoje dane zostaną trwale usunięte (z zastrzeżeniem danych wymaganych prawem, np. faktur).",
    "button": "Akceptuję i kontynuuję",
    "success": "Dziękujemy! Możesz dalej korzystać z aplikacji."
  },
  "app": {
    "name": "Concertivo",
    "tagline": "System zarządzania koncertami i organizacjami muzycznymi"
  },
  "nav": {
    "dashboard": "Pulpit",
    "organizations": "Organizacje",
    "contacts": "Kontakty",
    "profile": "Profil",
    "admin": "Administracja",
    "approvals": "Zatwierdzenia",
    "logout": "Wyloguj",
    "login": "Zaloguj",
    "register": "Załóż konto"
  },
  "address": {
    "street": "Ulica i numer",
    "city": "Miasto",
    "postal_code": "Kod pocztowy",
    "country": "Kraj"
  },
  "profile": {
    "title": "Mój profil",
    "subtitle": "Zarządzaj swoimi danymi osobistymi i adresem.",
    "basic": "Dane podstawowe",
    "saved": "Profil zapisany",
    "kinds": {
      "title": "Kim jestem",
      "help": "Wybierz wszystkie role, które Cię opisują. Możesz je zmieniać w dowolnym momencie. Oznaczenie nieprawidłowych opcji będzie powodowało błędy w organizacji."
    },
    "address": {
      "title": "Adres",
      "optional": "Opcjonalnie — możesz uzupełnić w dowolnym momencie.",
      "benefit_user": "💡 Uzupełnienie adresu pozwoli systemowi automatycznie optymalizować trasy koncertowe, planować dojazdy oraz inne kwestie logistyczne (noclegi, koszty przejazdów)."
    },
    "my_orgs": {
      "title": "Moje organizacje",
      "empty": "Nie jesteś jeszcze przypisany do żadnej organizacji."
    },
    "settlement": {
      "title": "Rozliczenia",
      "help": "Preferowana forma rozliczenia. Dane wykorzystamy do automatycznego generowania umów i faktur koncertowych.",
      "privacy_note": "🔒 Dane wrażliwe (PESEL, NIP, numer konta) są widoczne wyłącznie dla Ciebie, właścicieli organizacji, do których należysz, oraz administratora aplikacji Concertivo. Twoje dane wrażliwe są szyfrowane algorytmem AES-256-GCM (klucz przechowywany poza bazą danych). Szczegóły w Polityce prywatności.",
      "forms": {
        "employment": {
          "label": "Umowa o pracę z organizacją",
          "desc": "Jestem zatrudniony(a) bezpośrednio przez jedną z moich organizacji."
        },
        "business": {
          "label": "Własna działalność gospodarcza (B2B / faktura)",
          "desc": "Wystawiam fakturę z własnej firmy."
        },
        "mandate_contract": {
          "label": "Umowa zlecenie",
          "desc": "Rozliczam się na podstawie umowy zlecenia."
        },
        "work_contract": {
          "label": "Umowa o dzieło",
          "desc": "Rozliczam się na podstawie umowy o dzieło (np. z przeniesieniem praw autorskich, 50% KUP)."
        },
        "other": {
          "label": "Inna forma",
          "desc": "Kontrakt menedżerski lub inna forma — opisz poniżej."
        }
      },
      "employer_org": "Organizacja zatrudniająca",
      "employer_org_ph": "Wybierz organizację…",
      "no_orgs": "Nie należysz jeszcze do żadnej organizacji. Najpierw dołącz lub zarejestruj zespół/firmę.",
      "company_name": "Nazwa firmy",
      "tax_id": "NIP",
      "vat_payer": "Jestem płatnikiem VAT",
      "bank_account": "Numer konta (IBAN)",
      "pesel": "PESEL",
      "tax_office": "Urząd Skarbowy",
      "tax_office_ph": "np. Pierwszy US w Warszawie",
      "zus_title": "Tytuł do ubezpieczeń ZUS",
      "zus_titles": {
        "none": "Brak / nie dotyczy",
        "student": "Student do 26. roku życia",
        "employed_elsewhere": "Zatrudniony(a) gdzie indziej (etat ≥ minimalna)",
        "retired": "Emeryt / rencista",
        "own_business": "Prowadzę własną działalność",
        "other": "Inny"
      },
      "other_desc": "Opis formy rozliczenia",
      "default_rate": "Domyślna stawka (za koncert)",
      "default_currency": "Waluta"
    }
  },
  "security": {
    "password": {
      "title": "Zmiana hasła",
      "new": "Nowe hasło",
      "confirm": "Powtórz nowe hasło",
      "change": "Zmień hasło",
      "changed": "Hasło zostało zmienione"
    },
    "mfa": {
      "title": "Weryfikacja dwuetapowa (2FA)",
      "help": "Dodatkowe zabezpieczenie konta — przy logowaniu poprosimy o jednorazowy kod z aplikacji uwierzytelniającej (Google Authenticator, Authy, 1Password itp.).",
      "enable": "Włącz 2FA",
      "disable": "Wyłącz 2FA",
      "disable_confirm": "Czy na pewno wyłączyć weryfikację dwuetapową?",
      "enabled": "Weryfikacja dwuetapowa włączona",
      "disabled": "Weryfikacja dwuetapowa wyłączona",
      "enabled_state": "✓ Weryfikacja dwuetapowa jest aktywna",
      "scan_help": "Zeskanuj poniższy kod QR w aplikacji uwierzytelniającej, a następnie wpisz wygenerowany 6-cyfrowy kod.",
      "secret_label": "Klucz (wpisz ręcznie jeśli nie możesz zeskanować)",
      "code_label": "6-cyfrowy kod z aplikacji",
      "verify": "Zweryfikuj i włącz",
      "warning_aria": "Brak 2FA — zalecane włączenie",
      "warning_tooltip": "Twoje konto pełni odpowiedzialną rolę (administrator aplikacji lub właściciel organizacji), a nie ma włączonej weryfikacji dwuetapowej. Brak 2FA znacznie zwiększa ryzyko przejęcia konta i dostępu osób trzecich do danych Twoich i Twojej organizacji. Włącz 2FA w sekcji \"Profil → Bezpieczeństwo\".",
    }
  },


  "lang": {
    "label": "Język",
    "pl": "Polski",
    "en": "English"
  },
  "theme": {
    "label": "Motyw",
    "light": "Dzień",
    "dark": "Noc",
    "auto": "Auto"
  },
  "footer": {
    "operator": "Operator: i-Future",
    "privacy": "Polityka prywatności",
    "terms": "Regulamin",
    "contact": "Kontakt"
  },
  "common": {
    "loading": "Ładowanie…",
    "save": "Zapisz",
    "saving": "Zapisywanie…",
    "cancel": "Anuluj",
    "close": "Zamknij",
    "submit": "Wyślij",
    "back": "Wstecz",
    "next": "Dalej",
    "add": "Dodaj",
    "approve": "Zatwierdź",
    "reject": "Odrzuć",
    "edit": "Edytuj",
    "delete": "Usuń",
    "search": "Szukaj",
    "copy": "Kopiuj",
    "copied": "Skopiowano",
    "empty": "Brak danych",
    "error": "Coś poszło nie tak",
    "success": "Gotowe"
  },
  "stopki": {
    "title_user": "Moje stopki e-mail",
    "title_org": "Stopki e-mail organizacji",
    "add": "Dodaj stopkę",
    "empty": "Brak stopek. Kliknij \"Dodaj stopkę\", aby utworzyć pierwszą.",
    "default": "Domyślna",
    "set_default": "Ustaw jako domyślną",
    "set_default_ok": "Ustawiono jako domyślną",
    "saved": "Stopka zapisana",
    "deleted": "Stopka usunięta",
    "new_title": "Nowa stopka",
    "edit_title": "Edytuj stopkę",
    "delete_confirm_title": "Usunąć stopkę?",
    "delete_confirm_desc": "Tej operacji nie można cofnąć.",
    "preview": "Podgląd na żywo",
    "preview_help": "Tak stopka będzie wyglądać w wysłanym e-mailu.",
    "picker_label": "Stopka",
    "picker_placeholder": "Wybierz stopkę",
    "picker_none": "— bez stopki —",
    "scope_org": "firmowa",
    "f": {
      "name": "Nazwa stopki",
      "set_as_default": "Ustaw jako domyślną",
      "font": "Czcionka",
      "accent_color": "Kolor akcentu (separator, ikony)",
      "logo": "Logo (lewa kolumna)",
      "photo": "Zdjęcie (środkowa kolumna)",
      "full_name": "Imię i nazwisko",
      "role": "Rola / stanowisko",
      "phones": "Numery telefonów",
      "emails": "Adresy e-mail",
      "websites": "Strony internetowe",
      "address": "Adres firmy",
      "company_name": "Nazwa firmy (nad ikonami social mediów)",
      "social_links": "Linki do social mediów",
      "extra_text": "Tekst dodatkowy (np. RODO)",
      "extra_text_ph": "Klauzula RODO, dodatkowe informacje…",
      "label_opt": "etykieta (opc.)",
      "none_click_add": "Brak. Kliknij \"Dodaj\".",
      "none_social": "Brak. Wybierz platformę i kliknij \"Dodaj\".",
      "none": "brak",
      "upload": "Wgraj",
      "uploading": "Wgrywanie…",
      "change": "Zmień"
    },
    "upload_too_big": "Plik może mieć maksymalnie 5 MB",
    "uploaded": "Wgrano plik"
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
      "register_link": "Załóż konto",
      "remember_device": "Pamiętaj to urządzenie przez 30 dni"
    },
    "mfa": {
      "prompt": "Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej, aby dokończyć logowanie.",
      "code": "Kod weryfikacyjny",
      "verify": "Zweryfikuj",
      "invalid_code": "Nieprawidłowy kod"
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
      "check_email": "Wysłaliśmy link aktywacyjny od Concertivo. Sprawdź swoją pocztę e-mail. Jeśli nie widzisz wiadomości w folderze głównym, sprawdź w innych folderach oraz w SPAM.",
      "mfa_recommendation": "🔒 Zalecamy włączenie weryfikacji dwuetapowej (2FA) po założeniu konta — w sekcji \"Profil → Bezpieczeństwo\". Dodatkowy kod z aplikacji znacznie zwiększa bezpieczeństwo Twoich danych.",
      "accept_legal_prefix": "Akceptuję",
      "accept_legal_and": "oraz",
      "accept_marketing": "Chcę otrzymywać informacje o nowych funkcjach, wydarzeniach i ofertach (opcjonalnie — możesz wycofać w każdej chwili)."
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
      "select_at_least_one_kind": "Wybierz przynajmniej jedną rolę",
      "legal_required": "Aby kontynuować, musisz zaakceptować regulamin i politykę prywatności.",
      "email_already_registered": "Ten adres e-mail jest już zarejestrowany. Spróbuj się zalogować lub odzyskać hasło."
    },
    "oauth": {
      "google": "Zaloguj się przez Google",
      "apple": "Zaloguj się przez Apple",
      "or": "lub kontynuuj z hasłem"
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
    "title_help": "Zarejestruj swoją organizację, którą reprezentujesz — typu artysta, firma nagłośnieniowa, firma eventowa itp.",
    "title_help_aria": "Pomoc — Moje organizacje",
    "new": "Zarejestruj swoją organizację",
    "empty": "Nie masz jeszcze żadnej organizacji. Zarejestruj zespół lub firmę.",
    "delete": "Usuń organizację",
    "delete_confirm": "Usunąć organizację \"{{name}}\"? Tej operacji nie można cofnąć — usunięte zostaną też powiązane dane.",
    "deleted": "Organizacja usunięta.",
    "type": {
      "label": "Typ organizacji",
      "artist": "Artysta / Zespół",
      "event_company": "Firma eventowa",
      "event_organizer": "Organizator imprez",
      "stage_rental": "Wynajem scen",
      "lighting_rental": "Wynajem oświetlenia",
      "sound_rental": "Wynajem nagłośnienia",
      "led_rental": "Wynajem ekranów LED",
      "pyro": "Realizacja pirotechniki",
      "transport": "Firma transportowa",
      "band": "Zespół muzyczny",
      "stage_company": "Firma estradowa"
    },
    "artist_kind": {
      "label": "Rodzaj artysty",
      "band": "Zespół muzyczny",
      "solo": "Muzyk solowy",
      "cabaret": "Kabaret",
      "standup": "Stand-up",
      "dj": "DJ",
      "orchestra": "Orkiestra",
      "choir": "Chór",
      "dance": "Zespół taneczny",
      "fire_show": "Fire show",
      "illusionist": "Iluzjonista",
      "kids_show": "Spektakl dziecięcy",
      "host": "Konferansjer",
      "other": "Inne"
    },
    "dialog": {
      "title": "Zarejestruj swoją organizację",
      "subtitle": "Wybierz typ organizacji i uzupełnij dane. Wniosek trafi do administratora aplikacji.",
      "types_label": "Typ organizacji (możesz zaznaczyć kilka)",
      "artist_section": "Dane artysty / zespołu",
      "artist_name": "Nazwa artysty / zespołu",
      "artist_kind": "Rodzaj artysty",
      "genre": "Gatunek muzyczny",
      "company_section": "Dane firmy",
      "nip": "NIP",
      "nip_invalid": "Niepoprawny NIP (sprawdź sumę kontrolną).",
      "gus_fetch": "Pobierz dane z GUS",
      "gus_tooltip": "Integracja z GUS REGON — dostępna wkrótce.",
      "legal_name": "Nazwa firmy",
      "street": "Ulica",
      "building_no": "Numer",
      "description": "Opis (opcjonalnie)",
      "choose": "Wybierz…",
      "created": "Organizacja zgłoszona do zatwierdzenia.",
      "is_shared_label": "Zarejestruj również w bazie kontrahentów (widoczna dla innych użytkowników)",
      "is_shared_help": "Inni użytkownicy będą mogli znaleźć Twoją organizację podczas dodawania kontrahentów. Możesz to wyłączyć — wtedy organizacja pozostanie prywatna.",
      "dedup_title": "Znalazłem podobnych, zarejestrowanych kontrahentów w bazie",
      "dedup_subtitle": "Jeśli któryś z nich odpowiada Twoim preferencjom — wybierz go zamiast tworzyć duplikat.",
      "dedup_search_btn": "Szukaj w bazie kontrahentów",
      "dedup_match_nip": "Identyczny NIP",
      "dedup_claim": "To moja organizacja — poproś o dołączenie",
      "dedup_claim_msg_placeholder": "Wiadomość do administratora (opcjonalnie)",
      "dedup_claim_sent": "Prośba o dołączenie wysłana do administratora.",
      "dedup_no_match": "Brak dopasowań w bazie."
    },
    "counterparties": {
      "section_title": "Organizacje (kontrahenci)",
      "section_help": "Twoja prywatna lista kontrahentów. Wybieraj zarejestrowane organizacje z bazy współdzielonej, żeby nie tworzyć duplikatów.",
      "add_btn": "Dodaj kontrahenta",
      "empty": "Nie masz jeszcze żadnych kontrahentów. Dodaj pierwszego, wpisując nazwę firmy.",
      "remove": "Usuń",
      "remove_confirm": "Usunąć tego kontrahenta z Twojej listy?",
      "removed": "Kontrahent usunięty z listy.",
      "has_linked_contacts": "Powiązany z kontaktem",
      "filters": {
        "title": "Filtry",
        "search_placeholder": "Szukaj po nazwie, NIP, e-mailu, mieście, ulicy…",
        "type": "Typ organizacji",
        "country": "Kraj",
        "city": "Miejscowość",
        "city_placeholder": "Wpisz miejscowość…",
        "source": "Źródło",
        "linked": "Powiązanie z kontaktami",
        "all_types": "Wszystkie typy",
        "all_countries": "Wszystkie kraje",
        "all_sources": "Wszystkie",
        "source_shared": "Zarejestrowani",
        "source_private": "Prywatni",
        "all_linked": "Wszyscy",
        "linked_yes": "Z powiązanymi kontaktami",
        "linked_no": "Bez powiązanych kontaktów",
        "clear": "Wyczyść filtry",
        "no_results": "Brak kontrahentów spełniających filtry."
      },
      "table": {
        "name": "Nazwa",
        "types": "Typ organizacji",
        "tax_id": "NIP",
        "address": "Adres",
        "source": "Źródło",
        "source_shared": "Zarejestrowany",
        "source_private": "Prywatny",
        "shared_to_org": "Udostępniony do organizacji: {{name}}"
      },
      "details": {
        "view_title": "Dane kontrahenta",
        "view_subtitle": "Ten kontrahent jest zarejestrowany w bazie współdzielonej — dane są tylko do odczytu.",
        "edit_title": "Edycja kontrahenta",
        "edit_subtitle": "Twój prywatny wpis — zmiany widzisz tylko Ty.",
        "readonly_hint": "Aby zmienić dane zarejestrowanego kontrahenta, skontaktuj się z administratorem aplikacji.",
        "saved": "Zapisano zmiany."
      },
      "dialog": {
        "title": "Dodaj kontrahenta",
        "subtitle": "Wpisz nazwę firmy. Sprawdzimy, czy nie ma jej już w bazie zarejestrowanych kontrahentów.",
        "name_label": "Nazwa firmy / organizacji",
        "name_placeholder": "np. Akme Events sp. z o.o.",
        "name_help": "Porównanie ignoruje wielkość liter, polskie znaki, formy prawne (sp. z o.o., S.A. itp.) i nadmiarowe spacje.",
        "searching": "Szukam w bazie kontrahentów…",
        "found_exact": "Znaleziono kontrahenta o identycznej nazwie. Sprawdź dane i dodaj do swojej listy, zamiast tworzyć duplikat.",
        "found_similar": "Znaleziono podobnych kontrahentów. Sprawdź czy któryś nie jest tą samą firmą.",
        "no_matches": "Nie znaleziono w bazie. W kolejnym kroku będziesz mógł dodać nowego kontrahenta.",
        "not_matching_hint": "Żaden z powyższych nie pasuje? Pełny formularz dodania nowej organizacji pojawi się w kolejnym etapie.",
        "badge_exact": "Identyczna nazwa",
        "add_btn": "Dodaj do moich kontrahentów",
        "added": "Dodano kontrahenta do Twojej listy.",
        "continue_new": "Dalej — uzupełnij dane",
        "continue_soon_tooltip": "",
        "exact_blocks_new": "Istnieje już zarejestrowana organizacja o tej nazwie — dodaj ją z listy zamiast tworzyć duplikat.",
        "step2_title": "Dane kontrahenta",
        "step2_subtitle": "Uzupełnij dane dla: \"{{name}}\". To Twój prywatny kontrahent — zapiszemy go na Twojej liście.",
        "artist_name_hint": "Nazwa \"{{name}}\" zostanie zapisana jako nazwa artysty / zespołu.",
        "artist_name_label": "Nazwa artysty / zespołu",
        "company_name_hint": "Nazwa \"{{name}}\" zostanie zapisana jako nazwa firmy.",
        "company_name_label": "Nazwa firmy",
        "review_hint": "To Twój prywatny kontrahent — dane widzisz tylko Ty (i osoby, którym później udostępnisz tę listę). Administrator aplikacji nie zatwierdza tego wpisu.",
        "submitted_for_review": "Dodano kontrahenta do Twojej listy."
      }
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
      "initial_access": "Wstępny poziom dostępu",
      "invitation_sent": "Wysłano zaproszenie",
      "pending_invitations": "Zaproszenia oczekujące",
      "owner": "Właściciel",
      "member": "Członek",
      "remove": "Usuń",
      "remove_confirm": "Usunąć tego członka z organizacji?",
      "cancel_invitation": "Anuluj",
      "cancel_invitation_confirm": "Anulować to zaproszenie?",
      "invitation_cancelled": "Zaproszenie anulowane",
      "member_removed": "Członek usunięty",
      "no_name": "(bez imienia)",
      "expires": "Ważne do",
      "invite_as_owner": "Zaproś jako właściciel",
      "invite_as_owner_help": "Właściciele mają pełen dostęp, mogą zapraszać innych właścicieli oraz zaplanować usunięcie organizacji. Tylko obecny właściciel może wystawić takie zaproszenie."
    },
    "deletion": {
      "title": "Strefa niebezpieczna",
      "description": "Po kliknięciu poniżej organizacja zostanie zaplanowana do usunięcia za 7 dni. Wszyscy członkowie zostaną powiadomieni i będą mogli w tym czasie zarezerwować dane lub poprosić Cię o anulowanie.",
      "request": "Zaplanuj usunięcie organizacji (za 7 dni)",
      "request_confirm": "Zaplanować usunięcie organizacji za 7 dni? Możesz anulować w dowolnym momencie w tym okresie.",
      "requested": "Usunięcie zaplanowane",
      "cancel": "Anuluj zaplanowane usunięcie",
      "cancelled": "Usunięcie anulowane",
      "scheduled_banner": "Usunięcie zaplanowane na {{date}}.",
      "banner_title": "Ta organizacja zostanie usunięta",
      "banner_body": "Właściciel zaplanował usunięcie organizacji. Finalne usunięcie nastąpi {{date}}, chyba że właściciel anuluje operację.",
      "request_short": "Usuń organizację",
      "dialog_info": "Organizacja zostanie zaplanowana do usunięcia za 7 dni. W tym czasie możesz w każdej chwili anulować operację.",
      "dialog_members_info": "Wszyscy członkowie organizacji otrzymają powiadomienie o zaplanowanym usunięciu.",
      "password_label": "Aby potwierdzić, wpisz swoje hasło logowania:",
      "confirm": "Potwierdź usunięcie"
    },
    "permissions": {
      "edit": "Edytuj uprawnienia",
      "title": "Uprawnienia członka",
      "subtitle": "Skonfiguruj dostęp członka „{{name}}” do modułów organizacji.",
      "saved": "Zapisano uprawnienia",
      "org_admin": "Administrator organizacji",
      "org_admin_help": "Pełny dostęp do wszystkich modułów (jak właściciel).",
      "selective_modules": "Dostęp do wybranych modułów:",
      "budget": {
        "full": "Pełny dostęp do budżetu",
        "unrealized_only": "Tylko dodawanie pozycji niezrealizowanych",
        "help": "W trybie „niezrealizowane” członek dodaje wpisy zawsze ze statusem niezrealizowane i nie może oznaczać ich jako Zrealizowano. Może też dodawać pozycje w tabeli Przyszłe wydatki.",
        "cannot_complete": "Nie masz uprawnień do oznaczania pozycji jako Zrealizowano."
      },
      "events": {
        "full": "Pełny dostęp",
        "view_only": "Tylko podgląd",
        "view_confirmed_only": "Tylko podgląd wydarzeń potwierdzonych",
        "help": "„Pełny dostęp” pozwala dodawać, edytować i usuwać wydarzenia. „Tylko podgląd” – wyłącznie odczyt. „Tylko podgląd wydarzeń potwierdzonych” – widoczne są jedynie wydarzenia o statusie potwierdzonym."
      },
      "ai_studio": {
        "full": "Pełny dostęp",
        "create_only": "Tylko tworzenie i planowanie (Tworzenie, Kalendarz, Biblioteka)",
        "moderation_only": "Tylko moderacja (Skrzynka, Asystent AI)",
        "view_only": "Tylko podgląd (Dashboard, Biblioteka, Analityka)",
        "help": "Tryb pracy członka w module AI Studio. „Pełny dostęp” odblokowuje wszystkie zakładki: Dashboard, Tworzenie, Kalendarz, Skrzynka, Biblioteka, Analityka, Asystent AI."
      }
    },
    "detail": {
      "back": "← Wróć do listy",
      "edit": "Edytuj organizację",
      "save": "Zapisz zmiany",
      "saved": "Zapisano zmiany",
      "rejection_reason": "Powód odrzucenia",
      "basic": "Dane podstawowe",
      "address": {
        "title": "Adres siedziby / bazy",
        "optional": "Opcjonalnie — możesz uzupełnić w dowolnym momencie.",
        "benefit": "💡 Uzupełnienie adresu organizacji pozwoli systemowi automatycznie optymalizować trasy koncertowe, planować dojazdy z bazy oraz inne kwestie logistyczne (noclegi, koszty przejazdów, bookowanie ekipy)."
      },
      "genres": {
        "title": "Gatunek muzyczny",
        "help": "Wybierz wszystkie gatunki, w których gra zespół. Możesz zmienić w dowolnym momencie.",
        "help_single": "Wybierz główny gatunek, który najlepiej opisuje zespół. Możesz zmienić w dowolnym momencie."
      },
      "currency": {
        "title": "Waluta",
        "label": "Waluta domyślna",
        "help": "Waluta używana w module budżetu. Domyślnie ustawiana wg kraju adresu — możesz ją zmienić."
      },
      "company": {
        "title": "Dane firmowe (do umów)",
        "help": "Te dane będą wykorzystywane przy generowaniu umów koncertowych, faktur i innych dokumentów. Wszystkie pola są opcjonalne — uzupełnij te, których faktycznie używasz.",
        "legal_name": "Pełna nazwa prawna",
        "legal_name_placeholder": "np. ACME Music Sp. z o.o.",
        "tax_id": "NIP / VAT ID",
        "registration_number": "REGON",
        "court_register_number": "KRS",
        "bank_account": "Numer konta bankowego (IBAN)",
        "bank_name": "Nazwa banku",
        "signatory_name": "Osoba reprezentująca",
        "signatory_position": "Stanowisko reprezentanta",
        "signatory_position_placeholder": "np. Prezes Zarządu",
        "contact_email": "E-mail kontaktowy",
        "contact_phone": "Telefon kontaktowy",
        "website": "Strona WWW"
      }
    },
    "genres": {
      "pop_rock": "Pop / Rock",
      "metal_punk": "Metal / Punk",
      "indie_alternative": "Indie / Alternatywa",
      "hip_hop_rnb": "Hip-hop / R&B / Rap",
      "electronic": "Elektroniczna",
      "jazz_blues": "Jazz / Blues",
      "reggae_ska": "Reggae / Ska",
      "folk_country": "Folk / Country / Akustyczna",
      "world_latin": "Muzyka świata / Latino",
      "classical": "Klasyczna",
      "cover_wedding": "Cover / Weselna",
      "disco_dance": "Disco / Dance",
      "other": "Inne"
    },

    "sidebar": {
      "section": "Nawigacja",
      "overview": "Przegląd",
      "profile": "Profil",
      "members": "Członkowie",
      "contacts": "Kontakty",
      "counterparties": "Kontrahenci",
      "events": "Wydarzenia",
      "budget": "Budżet",
      "skrzynki": "Skrzynki pocztowe",
      "correspondence": "Korespondencja",
      "mail": "Poczta",
      "autokorespondencja": "Autokorespondencja",
      "back_to_list": "← Wszystkie organizacje",
      "pending_expenses": "Niezrealizowane wydatki: {{count}}",
      "social": "Organizacja SM",
      "media_web": "Media & Web",
      "web": "Web",
      "ai_studio": "AI Studio",
      "assistant": "Asystent AI",
      "dysk": "Dysk"
    },
    "events": {
      "title": "Występy",
      "subtitle": "Planuj i zarządzaj występami tej organizacji.",
      "empty": "Brak zaplanowanych występów.",
      "coming_soon": "Wkrótce"
    },
    "performances": {
      "title": "Wydarzenia",
      "subtitle": "Planuj i zarządzaj wydarzeniami tej organizacji.",
      "add": "Dodaj wydarzenie",
      "empty_title": "Brak wydarzeń",
      "empty": "Dodaj pierwsze wydarzenie klikając przycisk powyżej.",
      "col": {
        "date": "Data",
        "event_kind": "Rodzaj wydarzenia",
        "status": "Status",
        "name": "Nazwa",
        "city": "Miejscowość",
        "assignments": "Przypisania",
        "visibility": "Widoczność",
        "actions": "Akcje"
      },
      "status": {
        "inquiry": "Zapytanie",
        "tentative": "Wstępna rezerwacja",
        "confirmed": "Potwierdzony",
        "confirmed_signing": "Potwierdzony (w trakcie podpisywania umowy)",
        "confirmed_signed": "Potwierdzony (umowa podpisana)"
      },
      "visibility": {
        "private": "Tylko dla mnie",
        "members_date": "Pokaż członkom tylko datę",
        "members_full": "Pokaż członkom wszystko",
        "public_date": "Upublicznij na stronie tylko datę",
        "public_full": "Upublicznij na stronie wszystko"
      },
      "event_kind": {
        "concert": "Koncert",
        "tv_appearance": "Występ telewizyjny",
        "radio_interview": "Wywiad radiowy",
        "marketing": "Działania marketingowe",
        "cabaret": "Występ kabaretowy",
        "other": "Inne…"
      },
      "fields": {
        "date": "Data wydarzenia",
        "date_placeholder": "Wybierz datę",
        "event_kind": "Rodzaj wydarzenia",
        "event_kind_placeholder": "Wybierz rodzaj wydarzenia",
        "event_kind_custom_placeholder": "Wpisz własny rodzaj wydarzenia",
        "status": "Status",
        "status_placeholder": "Wybierz status",
        "visibility": "Widoczność",
        "visibility_hint": "\"Wszystko\" obejmuje datę, nazwę wydarzenia oraz miejsce.",
        "name": "Nazwa wydarzenia",
        "city": "Miejscowość",
        "postal_code": "Kod pocztowy",
        "street": "Ulica",
        "street_number": "Numer",
        "google_maps_url": "Pinezka Google (URL)",
        "google_maps_url_hint": "Wymagana tylko gdy widoczność = \"Upublicznij na stronie wszystko\".",
        "notes": "Notatki",
        "notes_placeholder": "Dodatkowe informacje o wydarzeniu…"
      },
      "assignments": {
        "title": "Przypisania",
        "contacts": "Kontakty",
        "counterparties": "Kontrahenci",
        "empty": "Brak przypisań",
        "assign_contact": "Przypisz kontakt",
        "assign_counterparty": "Przypisz kontrahenta",
        "add_contact": "Dodaj kontakt",
        "add_counterparty": "Dodaj kontrahenta",
        "suggestions_title": "Sugestie powiązań",
        "suggest_assign_cp": "Powiązany kontrahent: {{name}}",
        "suggest_assign_contact": "Powiązany kontakt: {{name}}",
        "dismiss": "Odrzuć"
      },
      "dialog": {
        "title": "Nowe wydarzenie",
        "title_edit": "Edytuj wydarzenie",
        "submit": "Zapisz wydarzenie",
        "submit_edit": "Zapisz zmiany"
      },
      "actions": {
        "assign": "Przypisz",
        "click_to_edit": "Kliknij, aby edytować",
        "open_details": "Otwórz szczegóły",
        "delete": "Usuń wydarzenie",
        "delete_confirm_title": "Usunąć wydarzenie?",
        "delete_confirm_desc": "Tej operacji nie można cofnąć. Wydarzenie wraz z przypisaniami zostanie trwale usunięte.",
        "delete_cancel": "Anuluj",
        "delete_confirm": "Usuń"
      },
      "toasts": {
        "created": "Wydarzenie zostało dodane",
        "updated": "Zmiany zostały zapisane",
        "deleted": "Wydarzenie usunięte",
        "linked_cp_suggest": "Powiązany kontrahent: {{name}} — przypisać też?",
        "linked_contact_suggest": "Powiązany kontakt: {{name}} — przypisać też?",
        "past_date_warning": "Wybrałeś datę wsteczną ({{date}}) — upewnij się, że to celowe."
      },
      "calendar": {
        "legend_past": "Data przeszła",
        "legend_event": "Zaplanowane wydarzenie",
        "day_events_title": "Wydarzenia w dniu {{date}}:"
      },
      "errors": {
        "date_required": "Data wydarzenia jest wymagana",
        "status_required": "Status jest wymagany",
        "event_kind_required": "Rodzaj wydarzenia jest wymagany",
        "required": "Pole wymagane",
        "cp_link_missing": "Nie można otworzyć szczegółów kontrahenta — brak powiązania w tej organizacji."
      }
    },
    "vacations": {
      "title": "Urlopy",
      "add": "Dodaj urlop",
      "fields": {
        "range": "Zakres dat urlopu",
        "description": "Opis (opcjonalnie)",
        "description_placeholder": "Np. urlop wypoczynkowy, wyjazd zagraniczny…"
      },
      "dialog": {
        "title": "Nowy urlop",
        "title_edit": "Edytuj urlop",
        "submit": "Zapisz urlop",
        "submit_edit": "Zapisz zmiany"
      },
      "actions": {
        "delete": "Usuń urlop",
        "delete_confirm_title": "Usunąć urlop?",
        "delete_confirm_desc": "Tej operacji nie można cofnąć."
      },
      "toasts": {
        "created": "Urlop dodany",
        "updated": "Zmiany zapisane",
        "deleted": "Urlop usunięty"
      },
      "errors": {
        "range_required": "Wybierz zakres dat urlopu"
      }
    },

    "budget": {
      "title": "Budżet",
      "intro": "Planuj swoje wydatki oraz budżet.",
      "subtitle": "Śledź wpływy i wydatki tej organizacji.",
      "add": "Dodaj pozycję",
      "added": "Pozycja dodana",
      "deleted": "Pozycja usunięta",
      "delete_confirm": "Usunąć tę pozycję budżetową?",
      "invalid_amount": "Nieprawidłowa kwota",
      "empty_list": "Brak pozycji budżetowych. Dodaj pierwszy wpływ lub wydatek.",
      "summary": "Podsumowanie",
      "currency_used": "Waluta organizacji: {{currency}}. Zmień ją w Profilu zespołu, aby używać innej.",
      "expand": "Pokaż więcej ({{count}})",
      "collapse": "Zwiń listę",
      "loading_more": "Wczytywanie kolejnych wpisów… (pozostało {{remaining}})",
      "col": {
        "date": "Data",
        "author": "Wpisał",
        "category": "Kategoria",
        "description": "Opis wpływu",
        "kind": "Rodzaj",
        "amount_gross": "Kwota brutto",
        "completed": "Zrealizowano",
        "completed_by": "zaznaczył(a) {{name}}"
      },
      "confirm_complete_title": "Oznaczyć jako zrealizowane?",
      "confirm_complete_description": "Tej operacji nie można cofnąć. Czy potwierdzasz oznaczenie jako zrealizowane?",
      "confirm_complete_yes": "Tak, oznacz",
      "confirm_complete_cancel": "Anuluj",
      "kind": {
        "income": "Zasilenie",
        "expense": "Wydatek"
      },
      "categories": {
        "placeholder": "Wybierz kategorię…",
        "fee": "Honorarium",
        "transport": "Transport",
        "accommodation": "Nocleg",
        "meals": "Wyżywienie",
        "equipment": "Sprzęt",
        "rental": "Wynajem",
        "marketing": "Marketing",
        "venue": "Sala / lokalizacja",
        "catering": "Catering",
        "ticket_sales": "Sprzedaż biletów",
        "sponsorship": "Sponsoring",
        "merch": "Merch",
        "music_videos": "Teledyski",
        "other": "Inne",
        "other_custom": "Inne (wpisz własną)…",
        "custom_placeholder": "Wpisz nazwę kategorii"
      },
      "filters": {
        "title": "Filtry",
        "date": "Data",
        "date_all": "Wszystkie daty",
        "date_this_month": "Ten miesiąc",
        "date_prev_month": "Poprzedni miesiąc",
        "date_this_year": "Ten rok",
        "date_prev_year": "Poprzedni rok",
        "date_custom": "Własny zakres",
        "author": "Wpisał",
        "author_all": "Wszyscy",
        "category": "Kategoria",
        "category_all": "Wszystkie kategorie",
        "completed": "Zrealizowano",
        "completed_all": "Wszystkie",
        "completed_yes": "Tylko zrealizowane",
        "completed_no": "Tylko niezrealizowane",
        "clear": "Wyczyść filtry",
        "pick_range": "Wybierz zakres",
        "results": "Pasujące pozycje: {{count}}"
      }
    },

    "planned": {
      "title": "Przyszłe wydatki",
      "subtitle": "Planowane wpływy i wydatki organizacji. Zaznacz \"Zrealizowano\", aby wykluczyć z podsumowania.",
      "add": "Dodaj pozycję",
      "added": "Pozycja dodana",
      "deleted": "Pozycja usunięta",
      "delete_confirm": "Usunąć tę pozycję?",
      "empty_list": "Brak zaplanowanych pozycji.",
      "summary": "Podsumowanie (niezrealizowane)",
      "expand": "Pokaż więcej ({{count}})",
      "collapse": "Zwiń listę",
      "pick_date": "Wybierz datę",
      "move_title": "Przenieść do budżetu?",
      "move_description": "Zaznaczyłeś pozycję jako zrealizowaną. Tej operacji nie można cofnąć. Czy przenieść ją do tabeli \"Budżet\" i uwzględnić w podsumowaniu?",
      "move_yes": "Tak, przenieś",
      "move_no": "Nie, tylko oznacz",
      "moved": "Przeniesiono do budżetu",
      "col": {
        "date": "Data",
        "author": "Wpisał",
        "category": "Kategoria",
        "description": "Opis wydatku",
        "planned_date": "Przewidywana data",
        "amount_gross": "Kwota brutto",
        "completed": "Zrealizowano"
      }

    },

    "messages": {
      "created": "Organizacja zgłoszona. Administrator ją zweryfikuje.",
      "approved": "Organizacja zatwierdzona.",
      "rejected": "Organizacja odrzucona."
    },
    "assistant": {
      "title": "Asystent Concertivo",
      "subtitle": "Zadawaj pytania o Concertivo i o swoją organizację. Asystent zna dokumentację, rozumie aplikację i sięga tylko po dane, do których masz dostęp.",
      "new_thread": "Nowa rozmowa",
      "no_threads": "Brak rozmów. Zacznij nową, by porozmawiać z asystentem.",
      "no_messages": "Napisz pierwsze pytanie, by zacząć rozmowę.",
      "composer_placeholder": "Zadaj pytanie asystentowi…",
      "send": "Wyślij",
      "sending": "Wysyłanie…",
      "thinking": "Asystent myśli…",
       "rename": "Zmień nazwę",
      "archive": "Archiwizuj",
      "delete": "Usuń rozmowę",
      "delete_confirm": "Usunąć tę rozmowę? Tej operacji nie da się cofnąć.",
      "cost": "Koszt rozmowy: {{cost}} USD",
      "limit": "Limit miesięczny: {{used}} / {{limit}} USD",
      "error": "Nie udało się wysłać wiadomości: {{msg}}",
      "disabled": "Asystent jest obecnie wyłączony dla tej organizacji.",
      "attach": "Dodaj załącznik (obraz lub PDF)",
      "attach_limit": "Maksymalnie {{max}} plików na wiadomość.",
      "attach_bad_type": "Nieobsługiwany typ pliku: {{name}}. Dozwolone: PNG, JPG, WEBP, PDF.",
      "attach_too_big": "Plik \"{{name}}\" przekracza limit 5 MB."
    }

  },
  "skrzynki": {
    "title": "Skrzynki pocztowe organizacji",
    "subtitle": "Współdzielone skrzynki IMAP/SMTP — wysyłka i synchronizacja przez nasze proxy mailowe. Hasła są szyfrowane.",
    "add": "Dodaj skrzynkę",
    "save": "Zapisz",
    "created": "Skrzynka dodana",
    "deleted": "Skrzynka usunięta",
    "delete_confirm": "Usunąć tę skrzynkę? Tej operacji nie da się cofnąć.",
    "empty": "Brak skrzynek. Tylko właściciel organizacji może je dodawać.",
    "sync": "Synchronizuj",
    "sync_started": "Synchronizacja uruchomiona",
    "form": {
      "nazwa": "Nazwa wewnętrzna",
      "nazwa_placeholder": "np. Sekretariat, Booking",
      "email": "Adres email",
      "host": "Host",
      "port": "Port",
      "login": "Login",
      "password": "Hasło",
      "ssl": "SSL/TLS"
    }
  },
  "admin": {
    "title": "Administracja",
    "nav": {
      "administrators": "Administratorzy",
      "approvals": "Zatwierdzenia",
      "ai": "Integracja AI",
      "assistant": "Asystent — baza wiedzy",
      "storage": "Storage (R2)"
    },
    "storage": {
      "title": "Cloudflare R2 — Storage",
      "subtitle": "Centralny bucket Concertivo oraz integracje per-organizacja (Model 3).",
      "global": {
        "title": "Konfiguracja globalna",
        "free_quota_gb": "Darmowy limit (GB) na organizację",
        "free_quota_gb_hint": "Każda organizacja domyślnie dostaje tyle miejsca w trybie centralnym.",
        "price_per_extra_gb_pln": "Cena za 1 GB nadwyżki (PLN / mies.)",
        "price_hint": "Wartość informacyjna — billing dorobimy w kolejnym kroku.",
        "max_image_mb": "Maks. rozmiar obrazu (MB)",
        "max_video_mb": "Maks. rozmiar wideo (MB)",
        "central_enabled": "Centralny storage włączony",
        "central_enabled_hint": "Gdy wyłączony — nowe organizacje muszą podłączyć własne R2.",
        "save": "Zapisz konfigurację globalną",
        "saved": "Konfiguracja zapisana"
      },
      "central": {
        "title": "Centralny Cloudflare R2 (konto Concertivo)",
        "subtitle": "Wpisz dane konta R2 bezpośrednio tutaj — klucze są szyfrowane przed zapisem. Jeśli pola sekretów zostawisz puste, zachowamy aktualnie zapisane wartości.",
        "status_ok": "Skonfigurowany",
        "status_missing": "Brakuje danych",
        "source_db": "Źródło: baza",
        "source_env": "Źródło: zmienne środowiskowe",
        "source_mixed": "Źródło: baza + env",
        "source_none": "Brak",
        "account_id": "Cloudflare Account ID",
        "account_id_hint": "Z R2 → Overview → Account Details → Account ID.",
        "access_key_id": "Access Key ID",
        "secret_access_key": "Secret Access Key",
        "bucket": "Bucket",
        "public_base_url": "Publiczny adres bazowy",
        "public_base_url_hint": "URL publiczny do plików — pub-xxx.r2.dev lub własna domena (np. https://media.concertivo.eu). Bez `/` na końcu.",
        "kept_secret": "•••••••• (zachowam aktualną wartość)",
        "save": "Zapisz dane R2",
        "saved": "Dane centralnego R2 zapisane",
        "test": "Testuj połączenie",
        "testing": "Testuję…",
        "test_ok": "OK — bucket: {{bucket}}",
        "clear": "Wyczyść",
        "clear_confirm": "Na pewno wyczyścić dane centralnego R2? Zostanie użyty fallback do EXT_R2_* (jeśli ustawione) lub upload będzie niedostępny.",
        "cleared": "Wyczyszczono dane centralnego R2"
      },

      "orgs": {
        "title": "Organizacje — kwoty i integracje",
        "filter_placeholder": "Filtruj po nazwie…",
        "count": "{{count}} org.",
        "col_name": "Organizacja",
        "col_mode": "Tryb",
        "col_used": "Zużycie",
        "col_free": "Free",
        "col_bonus": "Bonus",
        "col_paid": "Paid",
        "col_total": "Razem",
        "col_actions": "Akcje",
        "mode_central": "Centralny",
        "mode_own": "Własne R2",
        "action_bonus": "Bonus",
        "action_r2": "R2",
        "empty": "Brak organizacji."
      },
      "bonus": {
        "title": "Bonus darmowego miejsca — {{name}}",
        "description": "Przyznaj indywidualne dodatkowe GB darmowego limitu lub miejsce opłacone.",
        "bonus_free_gb": "Bonus darmowy (GB)",
        "bonus_hint": "Dodaje się do globalnego free limitu (np. 2 GB free + 10 GB bonus = 12 GB).",
        "paid_extra_gb": "Dodatkowo opłacone (GB)",
        "note": "Notatka (opcjonalnie)",
        "note_placeholder": "np. partner promocyjny, festiwal X 2026",
        "saved": "Zapisano kwotę"
      },
      "r2": {
        "title": "Integracja Cloudflare R2 — {{name}}",
        "description": "Wybierz tryb storage organizacji. W trybie 'własne R2' wpisz dane konta Cloudflare R2 — klucze są szyfrowane przed zapisem.",
        "mode_label": "Tryb storage",
        "mode_central_hint": "Pliki tej organizacji trafiają do centralnego bucketa Concertivo.",
        "mode_own_hint": "Pliki tej organizacji trafiają do JEJ konta Cloudflare R2 — nie obciąża to naszego limitu.",
        "save_mode": "Zapisz tryb",
        "mode_saved": "Tryb zapisany",
        "keys_title": "Dane Cloudflare R2 organizacji",
        "keys_present": "Klucze są już zapisane (wpisz nowe wartości aby je nadpisać).",
        "account_id": "Cloudflare Account ID",
        "bucket": "Bucket",
        "endpoint": "Endpoint (S3)",
        "access_key": "Access Key ID",
        "secret_key": "Secret Access Key",
        "public_base_url": "Publiczny adres bazowy",
        "public_base_url_hint": "URL publiczny do plików: r2.dev lub własna domena (np. https://media.org.pl).",
        "save_keys": "Zapisz klucze",
        "keys_saved": "Klucze R2 zapisane",
        "test": "Testuj połączenie",
        "test_ok": "OK — tryb: {{mode}}, bucket: {{bucket}}",
        "clear": "Wyczyść klucze",
        "cleared": "Wyczyszczono — organizacja wróciła na centralny storage"
      }
    },
    "ai": {
      "title": "Integracja AI (OpenAI)",
      "subtitle": "Domyślny dostawca AI dla całej aplikacji. Klucz API przechowywany jest jako sekret po stronie serwera.",
      "card_provider": "Dostawca AI: OpenAI",
      "provider_help": "Wywołania idą bezpośrednio do api.openai.com z kluczem z runtime secrets.",
      "enabled": "Włączone",
      "disabled": "Wyłączone",
      "test_connection": "Test połączenia",
      "testing": "Testuję…",
      "ping_ok": "Połączenie OK — dostępnych modeli: {{count}}",
      "usage_month": "Wykorzystanie w tym miesiącu",
      "of_limit": "z ${{limit}} limitu",
      "calls_errors": "{{calls}} wywołań · {{errors}} błędów",
      "near_limit": "Zbliżasz się do limitu — nowe wywołania zostaną zablokowane po jego przekroczeniu.",
      "config": "Konfiguracja",
      "monthly_limit": "Miesięczny limit (USD)",
      "monthly_limit_help": "Hard cap dla całej aplikacji — po przekroczeniu wywołania zwracają błąd.",
      "default_model": "Domyślny model",
      "default_model_help": "Używany, gdy scenariusz nie ma własnego mapowania.",
      "temperature": "Temperatura",
      "max_tokens": "Max tokens",
      "system_prompt": "Globalny system prompt",
      "system_prompt_placeholder": "np. Jesteś asystentem Concertivo. Odpowiadaj zwięźle po polsku.",
      "system_prompt_help": "Doklejany jako pierwsza wiadomość role=system do każdego wywołania.",
      "available_models": "Dostępne modele OpenAI",
      "no_models": "Brak modeli — dodaj poniżej.",
      "new_model_placeholder": "np. gpt-4o-mini",
      "add_model": "Dodaj model",
      "scen_model": "Model dla scenariusza",
      "scen_model_help": "Dla danego typu zadania nadpisuje model domyślny.",
      "scenario": "Scenariusz",
      "model": "Model",
      "model_override": "Model (nadpisanie)",
      "use_default": "(domyślny: {{model}})",
      "use_config": "(wg konfiguracji)",
      "new_scen_placeholder": "własny scenariusz (np. moj_use_case)",
      "add_scen": "Dodaj scenariusz",
      "save": "Zapisz konfigurację",
      "saving": "Zapisywanie…",
      "saved": "Zapisano konfigurację AI",
      "playground": "Playground — test wywołania",
      "prompt": "Treść (user)",
      "prompt_placeholder": "Napisz krótki wiersz o muzyce.",
      "send": "Wyślij",
      "sending": "Wysyłam…",
      "byUser": "Wg użytkownika",
      "byScen": "Wg scenariusza",
      "byModel": "Wg modelu",
      "byUser_label": "Użytkownik",
      "byScen_label": "Scenariusz",
      "byModel_label": "Model",
      "calls": "Wywołań",
      "cost": "Koszt",
      "no_data": "Brak danych",
      "recent": "Ostatnie wywołania",
      "time": "Czas",
      "user": "Użytkownik",
      "status": "Status",
      "no_calls": "Brak wywołań w tym miesiącu",
      "errors": {
        "bad_limit": "Nieprawidłowy limit miesięczny",
        "bad_temperature": "Temperatura musi być w zakresie 0–2",
        "bad_max_tokens": "Nieprawidłowa wartość max tokens",
        "bad_default_model": "Domyślny model musi być na liście dostępnych modeli",
        "model_exists": "Model już dodany",
        "scen_exists": "Scenariusz już istnieje"
      }
    },
    "administrators": {
      "title": "Administratorzy systemu",
      "subtitle": "Użytkownicy z dostępem do panelu administracyjnego.",
      "grant_title": "Nadaj rolę administratora",
      "list_title": "Aktualni administratorzy",
      "email": "Email użytkownika",
      "role": "Rola",
      "role_super_admin": "Super admin",
      "role_admin_staff": "Admin",
      "grant_btn": "Nadaj rolę",
      "revoke_btn": "Odbierz \"{{role}}\"",
      "granted": "Rola nadana.",
      "revoked": "Rola odebrana.",
      "empty": "Brak administratorów.",
      "no_name": "(bez imienia)"
    },
    "approvals": {
      "title": "Organizacje oczekujące na zatwierdzenie",
      "empty": "Brak zgłoszeń do zatwierdzenia.",
      "created_by": "Zgłosił:",
      "created_at": "Data zgłoszenia:",
      "tab_orgs": "Nowe organizacje",
      "tab_joins": "Prośby o dołączenie",
      "joins_empty": "Brak próśb o dołączenie.",
      "join_message": "Wiadomość:",
      "join_approved": "Zaakceptowano — użytkownik dodany jako członek.",
      "join_rejected": "Prośba odrzucona."
    },
    "assistant": {
      "title": "Asystent Concertivo — baza wiedzy",
      "subtitle": "Zarządzaj indeksem dokumentacji i kodu, z którego korzysta asystent AI w organizacjach.",
      "status": {
        "total": "Łącznie fragmentów",
        "docs": "Dokumentacja",
        "code": "Kod",
        "last_run": "Ostatni reindeks",
        "last_run_never": "nigdy",
        "stale_warning": "Minęło {{days}} dni od ostatniego reindeksu — rozważ aktualizację bazy wiedzy."
      },
      "reindex": "Reindeksuj teraz",
      "reindex_running": "Indeksowanie…",
      "reindex_done": "Zaindeksowano {{chunks}} fragmentów (koszt ~{{cost}} USD).",
      "reindex_error": "Reindeks nie powiódł się: {{msg}}",
      "hint": "Pełen reindeks usuwa istniejące fragmenty i zaczytuje wszystko od nowa. Tylko superadmin."
    }
  },
  "contacts": {
    "title": "Kontakty",
    "subtitle": "Baza osób — Twoje kontakty prywatne oraz wspólne z organizacjami, do których należysz.",
    "scope": { "user": "Moje kontakty", "org": "Kontakty organizacji" },
    "actions": {
      "add": "Dodaj kontakt", "edit": "Edytuj", "delete": "Usuń", "back": "Wróć do listy"
    },
    "list": {
      "search_placeholder": "Szukaj po imieniu, nazwisku, e-mailu, telefonie…",
      "all": "Wszystkie",
      "empty": "Brak kontaktów. Dodaj pierwszy, używając przycisku powyżej.",
      "no_results": "Brak kontaktów spełniających filtry.",
      "loading": "Ładowanie kontaktów...",
      "filters": "Filtry",
      "filter_country": "Kraj",
      "filter_city": "Miejscowość",
      "filter_city_placeholder": "Wpisz miejscowość…",
      "filter_region": "Województwo",
      "filter_classification": "Klasyfikacja",
      "filter_all_countries": "Wszystkie kraje",
      "filter_all_regions": "Wszystkie województwa",
      "filter_all_classifications": "Wszystkie klasyfikacje",
      "filters_clear": "Wyczyść filtry"
    },
    "form": {
      "section_person": "Dane osobowe",
      "section_contact": "Dane kontaktowe",
      "section_address": "Adres",
      "section_meta": "Klasyfikacja i notatki",
      "first_name": "Imię",
      "last_name": "Nazwisko",
      "email": "E-mail",
      "phone": "Numer telefonu",
      "email_or_phone_hint": "wymagane przynajmniej jedno",
      "optional": "opcjonalnie",
      "country": "Kraj",
      "city": "Miejscowość",
      "postal_code": "Kod pocztowy",
      "street": "Ulica",
      "building_no": "Numer",
      "region": "Województwo",
      "region_placeholder": "Wybierz województwo",
      "region_none": "— nie wybrano —",
      "classification_hint": "Zaznacz przynajmniej jedną kategorię.",
      "notes": "Notatka",
      "save": "Zapisz kontakt",
      "saved": "Kontakt zapisany",
      "delete_confirm": "Na pewno usunąć ten kontakt?",
      "errors": {
        "required": "Pole jest wymagane",
        "email_or_phone": "Podaj e-mail lub numer telefonu",
        "classification_required": "Zaznacz co najmniej jedną klasyfikację"
      }
    },
    "classification": {
      "artist_musician": "Artysta muzyk",
      "artist_cabaret": "Artysta kabareciarz",
      "actor": "Aktor",
      "manager": "Manager",
      "dancer": "Tancerz",
      "composer": "Kompozytor",
      "conductor": "Dyrygent",
      "lighting_engineer": "Realizator oświetlenia",
      "sound_engineer": "Realizator nagłośnienia",
      "multimedia_operator": "Operator multimediów",
      "stage_technician": "Technik estradowy",
      "photographer": "Fotograf",
      "pyrotechnician": "Pirotechnik",
      "radio_journalist": "Dziennikarz radiowy",
      "music_journalist": "Dziennikarz muzyczny",
      "organizer": "Organizator",
      "music_producer": "Producent muzyczny",
      "tv_producer": "Producent telewizyjny",
      "graphic_designer": "Grafik",
      "visuals_creator": "Twórca wizualizacji",
      "mayor_village": "Wójt gminy",
      "mayor_city": "Burmistrz / Prezydent",
      "dm_director": "Dyrektor DM",
      "um_ug_employee": "Pracownik UM / UG",
      "accountant": "Księgowy",
      "lawyer": "Prawnik",
      "security": "Ochrona",
      "paramedic": "Ratownik",
      "driver": "Kierowca"
    },
    "links": {
      "cp_section_title": "Powiązane kontakty",
      "cp_section_help": "Osoby z modułu Kontakty powiązane z tym kontrahentem.",
      "cp_section_help_pending": "Te kontakty zostaną powiązane po utworzeniu kontrahenta.",
      "contact_section_title": "Powiązani kontrahenci",
      "contact_section_help": "Kontrahenci, do których przypisana jest ta osoba.",
      "has_linked_counterparties": "Powiązany z kontrahentem",
      "add_contact_btn": "Dodaj kontakt",
      "link_contact_btn": "Powiąż z kontaktem",
      "link_cp_btn": "Powiąż z kontrahentem",
      "empty_contacts": "Brak powiązanych kontaktów.",
      "empty_counterparties": "Brak powiązanych kontrahentów.",
      "linked": "Powiązano.",
      "unlinked": "Usunięto powiązanie.",
      "already_linked": "Już powiązane.",
      "unlink": "Usuń powiązanie",
      "pending_badge": "Oczekuje",
      "save_first_hint": "Zapisz kontakt, aby móc go powiązać z kontrahentem.",
      "picker_title": "Wybierz kontakt",
      "picker_search": "Szukaj po imieniu i nazwisku…",
      "picker_empty": "Brak kontaktów do powiązania.",
      "cp_picker_title": "Wybierz kontrahenta",
      "cp_picker_search": "Szukaj po nazwie…",
      "cp_picker_empty": "Brak kontrahentów do powiązania."
    },
    "empty_orgs": "Nie należysz jeszcze do żadnej organizacji. Możesz dodawać kontakty prywatne lub utworzyć / dołączyć do organizacji."
  },
  "sharing": {
    "my_orgs_title": "Moje organizacje",
    "my_orgs_help": "Zaznacz organizacje, w których ten wpis ma być też widoczny. Odznacz, jeśli ma pozostać wyłącznie prywatny. Pamiętaj, że dostęp do kontaktów i kontrahentów w Twojej organizacji pozwala na pełną automatyzację komunikacji z nimi z wykorzystaniem AI oraz automatyzację przy podpisywaniu umów koncertowych oraz powiadomień. Zalecane jest, aby Twoje kontakty i kontrahenci byli również kontaktami i kontrahentami Twoich organizacji."
  },
  "correspondence": {
    "mail": {
      "title": "Poczta",
      "subtitle": "Skrzynki IMAP/SMTP organizacji — odbiór i wysyłka wiadomości.",
      "mailboxes": "Skrzynki",
      "no_mailboxes": "Brak skrzynek tej organizacji. Dodaj je w sekcji Profil → Skrzynki email.",
      "empty_folder": "Brak wiadomości w tym folderze.",
      "select_message": "Wybierz wiadomość, aby zobaczyć podgląd.",
      "loading_body": "Pobieram treść wiadomości…",
      "sync": "Synchronizuj",
      "synced": "Zsynchronizowano",
      "compose": "Nowa wiadomość",
      "reply": "Odpowiedz",
      "templates": "Szablony",
      "delete_confirm": "Usunąć wiadomość z serwera pocztowego i z bazy?",
      "deleted": "Usunięto wiadomość",
      "folders": {
        "label": "Foldery",
        "inbox": "Odebrane",
        "sent": "Wysłane",
        "drafts": "Robocze",
        "spam": "Spam"
      },
      "composer": {
        "title": "Nowa wiadomość",
        "reply_title": "Odpowiedź",
        "to": "Do",
        "subject": "Temat",
        "body": "Treść",
        "template": "Szablon",
        "pick_template": "— wybierz szablon —",
        "send": "Wyślij",
        "sent": "Wiadomość wysłana",
        "recipient_required": "Podaj przynajmniej jeden adres odbiorcy."
      }
    },
    "templates": {
      "title": "Szablony e-mail",
      "subtitle": "Szablony używane w Poczcie i Autokorespondencji. Możesz wstawiać pola dynamiczne.",
      "new": "Nowy szablon",
      "edit": "Edytuj szablon",
      "empty": "Brak szablonów. Dodaj pierwszy.",
      "name": "Nazwa",
      "name_required": "Podaj nazwę szablonu.",
      "category": "Kategoria (opcjonalnie)",
      "subject": "Temat",
      "body": "Treść",
      "variables": "Pola dynamiczne — kliknij, aby wstawić",
      "delete_confirm": "Usunąć szablon?"
    },
    "autokor": {
      "title": "Autokorespondencja",
      "subtitle": "Kampanie mailingowe do kontaktów i kontrahentów z harmonogramem i statystykami.",
      "new": "Nowa kampania",
      "empty": "Brak kampanii. Utwórz pierwszą.",
      "delete_confirm": "Usunąć kampanię i wszystkie zaplanowane wiadomości?",
      "recipients_one": "{{count}} odbiorca",
      "recipients_other": "{{count}} odbiorców",
      "recipients": "{{count}} odb.",
      "name_required": "Podaj nazwę kampanii.",
      "mailbox_required": "Wybierz skrzynkę nadawczą.",
      "status": {
        "draft": "Szkic",
        "scheduled": "Zaplanowana",
        "running": "Aktywna",
        "paused": "Wstrzymana",
        "done": "Zakończona",
        "cancelled": "Anulowana"
      },
      "wizard": {
        "new": "Nowa kampania",
        "edit": "Edytuj kampanię",
        "name": "Nazwa",
        "mailbox": "Skrzynka nadawcza",
        "template": "Szablon (opcjonalnie)",
        "subject": "Temat",
        "body": "Treść",
        "filters": "Filtry odbiorców",
        "sources": "Źródła",
        "types": "Typy kontaktów",
        "schedule": "Harmonogram",
        "hours_from": "Od godz.",
        "hours_to": "Do godz.",
        "rate": "Limit/min",
        "days": "Dni tygodnia",
        "source": {
          "user_contacts": "Moje kontakty",
          "org_contacts": "Kontakty organizacji",
          "org_counterparties": "Kontrahenci organizacji"
        },
        "type": {
          "person": "Osoby",
          "company": "Firmy",
          "artist": "Artyści"
        },
        "day": {
          "pn": "Pn", "wt": "Wt", "sr": "Śr", "cz": "Cz", "pt": "Pt", "sb": "Sb", "nd": "Nd"
        }
      }
    },
    "lists": {
      "button": "Listy wykluczeń",
      "title": "Rezygnacje i odbicia",
      "rezygnacje": "Rezygnacje",
      "odbicia": "Odbicia",
      "empty": "Brak wpisów."
    }
  },
  "ai_studio": {
    "title": "AI Studio",
    "subtitle": "Centrum tworzenia, planowania, moderacji i analityki wszystkich mediów organizacji — social media oraz strona WWW — w jednym miejscu.",
    "coming_soon": "Wkrótce dostępne w kolejnej iteracji.",
    "tabs": {
      "dashboard": "Dashboard",
      "create": "Tworzenie",
      "calendar": "Kalendarz",
      "inbox": "Skrzynka",
      "library": "Biblioteka",
      "analytics": "Analityka",
      "assistant": "Asystent AI"
    },
    "placeholders": {
      "dashboard": "Przegląd aktywności: nieodczytane komentarze, posty do akceptacji, zaplanowane publikacje na dziś, sentyment z 7 dni.",
      "library": "Wszystkie publikacje (posty SM + aktualności WWW + galerie + wydarzenia) z filtrami, wyszukiwarką i akcją 'duplikuj jako nowy post'.",
      "assistant": "Czat z asystentem AI mającym dostęp do narzędzi: raporty, propozycje kampanii, przepisywanie istniejących treści między kanałami."
    },
    "create": {
      "sm_title": "Posty w social media",
      "sm_subtitle": "Wygeneruj treść raz, dostosuj do każdej platformy i opublikuj w wybranych kanałach."
    },
    "web": {
      "title": "Aktualność na stronę WWW",
      "subtitle": "Szybka publikacja newsa na stronie organizacji. Pełna edycja wydarzeń i galerii pozostaje w module Web.",
      "topic": "Temat aktualności",
      "topic_placeholder": "np. Ogłaszamy nowy sezon koncertowy 2026/2027",
      "generate": "Wygeneruj treść z AI",
      "field_title": "Tytuł",
      "field_excerpt": "Zajawka (excerpt)",
      "field_content": "Treść",
      "publish_now": "Opublikuj od razu",
      "publish_now_hint": "Wyłącz, aby zapisać jako szkic widoczny tylko w panelu.",
      "cta_publish": "Publikuj",
      "cta_save_draft": "Zapisz szkic",
      "errors": {
        "no_topic": "Wpisz temat aktualności przed generowaniem.",
        "no_content": "Tytuł i treść są wymagane."
      },
      "toast": {
        "generated": "Wygenerowano treść aktualności.",
        "published": "Aktualność opublikowana na stronie WWW.",
        "saved_draft": "Szkic aktualności zapisany."
      }
    }
  },
  "social": {
    "title": "Organizacja SM",
    "subtitle": "Połącz konta w social mediach z tą organizacją i zarządzaj publikacjami w jednym miejscu.",
    "deprecated": {
      "title": "Ten moduł to teraz integracje i diagnostyka",
      "description": "Codzienna praca z social mediami i stronami WWW odbywa się w module AI Studio. Tutaj zostaje wyłącznie zarządzanie połączonymi kontami, podgląd techniczny i diagnostyka — dla adminów i integratorów.",
      "cta": "Przejdź do AI Studio"
    },
    "tabs": {
      "accounts": "Połączone konta",
      "inbox": "Skrzynka",
      "ai_studio": "AI Studio",
      "schedule": "Harmonogram",
      "stats": "Statystyki"
    },
    "inbox": {
      "title": "Skrzynka komentarzy i wiadomości",
      "subtitle": "Jedno miejsce na wszystkie komentarze pod postami i wiadomości DM z połączonych kont. Odpowiadaj, ukrywaj, moderuj — z pomocą AI.",
      "coming_soon_badge": "Aktywne po połączeniu kont",
      "empty_state": "Brak komentarzy i wiadomości. Po połączeniu konta i włączeniu synchronizacji pojawią się tu nowe pozycje z platform.",
      "features_title": "Co dostajesz w skrzynce",
      "features_subtitle": "Wszystkie funkcje uruchamiają się automatycznie po podłączeniu danej platformy (Tury 2–7).",
      "features": {
        "unified_inbox": { "title": "Wspólna skrzynka", "desc": "Komentarze i DM-y ze wszystkich platform w jednej liście, z filtrami: platforma, post, status." },
        "quick_reply": { "title": "Szybkie odpowiedzi", "desc": "Odpowiadaj na komentarze i wiadomości bezpośrednio w Concertivo — bez przełączania się między aplikacjami." },
        "moderation": { "title": "Moderacja", "desc": "Ukrywaj, usuwaj, oznaczaj jako spam, banuj użytkowników — wszystko z audytem akcji." },
        "ai_replies": { "title": "AI sugeruje odpowiedzi", "desc": "Trzy warianty odpowiedzi (formalny, ciepły, krótki) generowane na bazie kontekstu posta i tonu komentarza." },
        "ai_moderator": { "title": "AI moderator", "desc": "Automatyczne wykrywanie hejtu, spamu i pytań wymagających pilnej reakcji — z oznaczeniami i sentymentem." },
        "notifications": { "title": "Powiadomienia", "desc": "Powiadomienia e-mail i w aplikacji o nowych komentarzach i wiadomościach do obsługi." },
        "user_history": { "title": "Historia interakcji", "desc": "Zobacz kto często komentuje, jaki ma sentyment, kiedy ostatnio pisał — kontekst dla lepszej odpowiedzi." }
      },
      "platform_support_title": "Co da się zrobić na której platformie",
      "platform_support_subtitle": "Zakres operacji zależy od API dostawcy. Tabela pokazuje docelowe możliwości po połączeniu.",
      "table": {
        "platform": "Platforma",
        "read": "Czytanie",
        "reply": "Odpowiedź",
        "hide": "Ukrycie",
        "delete": "Usunięcie",
        "dm": "Wiadomości DM"
      },
      "support": {
        "yes": "Tak",
        "partial": "Częściowo",
        "no": "Brak"
      },
      "tura2_badge": "Tryb lokalny — OAuth od Tury 3",
      "seed_demo": "Wczytaj dane demo",
      "unknown_author": "Anonim",
      "select_hint": "Wybierz komentarz z listy po lewej, aby zobaczyć szczegóły i odpowiedzieć.",
      "open_original": "Otwórz oryginał",
      "status": {
        "new": "Nowe",
        "replied": "Odpowiedziane",
        "hidden": "Ukryte",
        "deleted": "Usunięte",
        "spam": "Spam",
        "archived": "Zarchiwizowane",
        "all": "Wszystkie"
      },
      "sentiment": {
        "positive": "Pozytywny",
        "neutral": "Neutralny",
        "negative": "Negatywny"
      },
      "actions": {
        "ai_moderate": "AI: oceń",
        "hide": "Ukryj",
        "spam": "Spam",
        "archive": "Archiwizuj",
        "delete": "Usuń"
      },
      "ai_panel": {
        "sentiment": "Sentyment",
        "flags": "Flagi"
      },
      "reply": {
        "title": "Odpowiedz",
        "ai_tone": "AI ton",
        "suggest": "Zaproponuj",
        "ai_variants": "Warianty AI — kliknij aby wstawić",
        "placeholder": "Napisz odpowiedź…",
        "pending_oauth_note": "Wysyłka do platformy aktywuje się po podłączeniu OAuth.",
        "send_failed": "Nie udało się wysłać odpowiedzi do platformy.",
        "send": "Wyślij"
      },
      "tones": {
        "warm": "Ciepły",
        "formal": "Formalny",
        "short": "Krótki"
      },
      "toast": {
        "seeded": "Wczytano {{count}} komentarzy demo.",
        "hide": "Komentarz ukryty.",
        "delete": "Komentarz usunięty.",
        "mark_spam": "Oznaczono jako spam.",
        "archive": "Zarchiwizowano.",
        "replied": "Odpowiedź zapisana.",
        "ai_moderated": "AI: sentyment {{sentiment}}."
      }
    },
    "intro": {
      "title": "Jak to działa?",
      "body": "Połącz konta swojej organizacji (Facebook, Instagram, LinkedIn itd.), generuj treści postów przez AI z kontekstem wydarzeń, planuj publikacje na najlepsze godziny i analizuj wyniki."
    },
    "status": {
      "connected": "Połączone",
      "coming_soon": "Wkrótce",
      "planned": "Planowane"
    },
    "caps": {
      "text": "Posty tekstowe",
      "images": "Zdjęcia",
      "video": "Wideo",
      "metrics": "Statystyki",
      "paid_api": "Wymaga płatnego API"
    },
    "actions": {
      "connect": "Połącz",
      "learn_more": "Dowiedz się więcej"
    },
    "info_dialog": {
      "title": "{{platform}} — jak to działa?",
      "tooltip": "Pokaż szczegóły integracji",
      "aria_open": "Pokaż informacje o integracji {{platform}}",
      "close": "Zamknij",
      "sections": {
        "description": "Co dostajesz",
        "benefits": "Korzyści",
        "how_it_looks": "Jak to wygląda w praktyce",
        "what_to_arrange": "Co trzeba załatwić",
        "checklist": "Checklist przed połączeniem",
        "time_estimate": "Realny czas oczekiwania"
      }
    },
    "connected_at": "Połączone",
    "account_details": {
      "subtitle": "Szczegóły połączonego konta i akcje zarządzające.",
      "publish_target": "Posty z Concertivo będą publikowane na:",
      "status": "Status",
      "status_ok": "Aktywne",
      "status_error": "Błąd",
      "connected_at": "Połączono",
      "last_sync": "Ostatnia synchronizacja",
      "token_expires": "Token wygasa",
      "no_expiry": "Długoterminowy (auto-odnawialny)",
      "scopes": "Przyznane uprawnienia (scopes)",
      "last_error": "Ostatni błąd",
      "what_now": "Co możesz teraz zrobić",
      "tip_ai_studio": "Wygenerować i zaplanować post w zakładce AI Studio.",
      "tip_schedule": "Zarządzać postami i ręcznie publikować w Harmonogramie.",
      "tip_inbox": "Odpowiadać na komentarze w Skrzynce.",
      "tip_stats": "Sprawdzać statystyki opublikowanych postów.",
      "open_external": "Otwórz na platformie",
      "open_link": "Kliknij, aby zobaczyć szczegóły",
      "disconnect": "Rozłącz konto",
      "disconnect_confirm_title": "Rozłączyć to konto?",
      "disconnect_confirm_desc": "Konto \"{{name}}\" zostanie odłączone od tej organizacji. Zaplanowane posty na tej platformie nie zostaną opublikowane. Możesz je ponownie połączyć w każdej chwili.",
      "disconnect_success": "Konto zostało rozłączone.",
      "import_title": "Importuj posty z platformy",
      "import_desc": "Pobiera ostatnie 25 postów opublikowanych bezpośrednio na platformie (poza Concertivo) i dodaje je do Harmonogramu jako „opublikowane\". Komentarze i metryki będą synchronizowane automatycznie.",
      "import_button": "Importuj 25 postów",
      "import_auto_note": "Aplikacja co 30 minut sama zaciąga nowe posty z tej platformy — ręczny import wymuszasz tylko, gdy chcesz odświeżyć teraz lub zaciągnąć historię.",
      "import_success": "Zaimportowano {{inserted}} nowych postów (sprawdzono: {{fetched}}).",
      "automation": {
        "title": "Automatyzacja",
        "subtitle": "Steruj, czy aplikacja sama pobiera dane z tego konta i czy AI moderuje komentarze.",
        "auto_sync_label": "Automatyczna synchronizacja",
        "auto_sync_desc": "Co kilkanaście minut aplikacja pobiera nowe komentarze, wiadomości i statystyki z tego konta. Wyłącz, jeśli chcesz robić to wyłącznie ręcznie.",
        "auto_ai_label": "Automatyczna moderacja AI",
        "auto_ai_desc": "Nowe komentarze są automatycznie analizowane przez AI pod kątem hejtu, spamu i tematu (wymaga skonfigurowanego klucza OpenAI w organizacji). Działa tylko gdy automatyczna synchronizacja jest włączona.",
        "pause_desc": "Tymczasowo wstrzymaj całą synchronizację tego konta na 24 godziny — przyda się np. przy przekraczaniu limitów platformy.",
        "pause_24h": "Wstrzymaj na 24h",
        "paused_until": "Synchronizacja wstrzymana do: {{time}}",
        "resume": "Wznów synchronizację",
        "saved": "Zapisano ustawienia automatyzacji."
      },
      "youtube_refresh": {
        "production_title": "Tryb Production — token bezterminowy",
        "production_body": "Twój projekt Google OAuth jest w trybie Production. Aplikacja odświeża access token automatycznie; nie musisz nic robić.",
        "testing_title": "Tryb Testing — pozostało {{days}} dni do ponownego połączenia",
        "testing_body": "Google wygasza refresh_token co 7 dni, gdy projekt OAuth jest w trybie Testing. Aplikacja przypomni Ci e-mailem / powiadomieniem na 2 dni przed.",
        "testing_expires_at": "Wygaśnięcie: {{date}}",
        "expired_title": "Refresh token wygasł — wymagane ponowne połączenie",
        "expired_body": "Aplikacja nie może już automatycznie odświeżać dostępu do YouTube. Rozłącz konto poniżej i połącz je ponownie."
      }
    },

    "post_status": {
      "draft": "Szkic",
      "scheduled": "Zaplanowany",
      "published": "Opublikowany",
      "failed": "Błąd"
    },
    "wizard": {
      "title": "Połącz {{platform}}",
      "step_indicator": "Krok {{current}} z {{total}}",
      "what_you_get": "Co zyskasz",
      "limits": "Ograniczenia",
      "requires_app_review": "Wymaga akceptacji dostawcy",
      "requires_paid_api": "Płatne API",
      "max_chars": "Maks. {{count}} znaków",
      "checklist_intro": "Zanim klikniesz \"Połącz\", upewnij się, że masz wszystko gotowe:",
      "permissions_intro": "Concertivo poprosi o następujące uprawnienia:",
      "scopes_requested": "Wymagane zakresy",
      "permissions_explanation": "Uprawnienia służą tylko publikowaniu i odczytowi statystyk Twoich treści. Nie czytamy prywatnych wiadomości ani danych innych użytkowników.",
      "ready_to_connect": "Wszystko gotowe — kliknij poniżej, aby przejść do okna logowania dostawcy.",
      "continue_to_provider": "Przejdź do {{platform}}",
      "not_ready_title": "Integracja jeszcze nieaktywna",
      "not_ready_body": "OAuth dla tej platformy zostanie uruchomiony po skonfigurowaniu klucza aplikacji ({{envKey}}) w sekretach środowiska.",
      "for_admin": "Dla administratora",
      "for_admin_body": "Załóż aplikację deweloperską {{platform}}, pobierz Client ID i Client Secret, a następnie dodaj je w Lovable jako sekrety {{envKey}}.",
      "not_ready_toast": "Integracja nie jest jeszcze gotowa.",
      "oauth_redirect_coming_soon": "Przekierowanie OAuth zostanie uruchomione w kolejnej turze.",
      "ready_title": "Wszystko gotowe",
      "not_ready_body_v2": "Brak skonfigurowanej aplikacji deweloperskiej dla tej platformy. Wróć do kroku \"Konfiguracja aplikacji\" i wklej Client ID + Client Secret.",
      "back_to_setup": "Wróć do konfiguracji",
      "platform_coming_soon_title": "Platforma w trakcie wdrożenia",
      "platform_coming_soon_body": "Integracja {{platform}} zostanie udostępniona w kolejnej iteracji. Na razie aktywny jest tylko X (Twitter).",
      "step_names": {
        "intro": "Wprowadzenie",
        "checklist": "Lista kontrolna",
        "setup": "Konfiguracja aplikacji",
        "permissions": "Uprawnienia",
        "connect": "Połączenie"
      }
    },
    "setup": {
      "already_configured": "Aplikacja jest już skonfigurowana",
      "delete_credentials": "Usuń klucze",
      "callback_url_label": "Callback URL (wklej w ustawieniach aplikacji u dostawcy)",
      "callback_url_hint": "Ten adres MUSI być wpisany w konfiguracji aplikacji u dostawcy jako dozwolony Callback / Redirect URI.",
      "callback_copied": "Skopiowano callback URL.",
      "instructions_title": "Instrukcja krok po kroku — jak utworzyć aplikację",
      "instructions_coming_soon": "Szczegółowa instrukcja dla tej platformy pojawi się wkrótce.",
      "update_title": "Zaktualizuj klucze",
      "enter_title": "Wklej Client ID i Client Secret",
      "update_hint": "Nadpisze obecne",
      "client_id_placeholder": "np. abc123XYZ...",
      "client_secret_placeholder": "Wklej Client Secret (pokazywany u dostawcy tylko raz)",
      "secret_hint": "Secret jest szyfrowany AES-256-GCM po stronie serwera. Nigdy nie jest pokazywany w aplikacji ponownie.",
      "save_new": "Zapisz klucze",
      "save_update": "Zaktualizuj klucze",
      "saved": "Klucze zostały zapisane.",
      "deleted": "Klucze zostały usunięte.",
      "youtube": {
        "testing_label": "Tryb OAuth: Testing",
        "testing_desc": "Zaznacz, jeśli w Google Cloud Console Twój projekt ma status OAuth = Testing (domyślny po utworzeniu).",
        "testing_warning": "W trybie Testing Google wymusza wygaśnięcie refresh_tokena po 7 dniach. Aplikacja przypomni Ci o ponownym połączeniu na 2 dni przed."
      },

      "x": {
        "intro": "Aby Concertivo mogło publikować w imieniu Twojej organizacji na X, musisz założyć własną aplikację deweloperską u X. Zajmuje to ~5 minut.",
        "open_portal": "Otwórz X Developer Portal",
        "tip_label": "Wskazówka",
        "tip_body": "Client Secret X pokazywany jest TYLKO RAZ podczas tworzenia. Jeśli go zgubisz, musisz wygenerować nowy (Regenerate) w ustawieniach aplikacji.",
        "steps": [
          "Zaloguj się na <strong>developer.x.com</strong> swoim kontem X. Jeśli nie masz konta developerskiego, kliknij \"Sign up\" i wypełnij formularz (poziom <strong>Free</strong> wystarczy do startu — testowanie i podstawowe funkcje).",
          "W panelu kliknij <strong>+ Create Project</strong>. Nazwa: np. \"Concertivo — [nazwa Twojej organizacji]\". Use case: wybierz <em>Making a bot</em> lub <em>Publishing tools</em>. Opis: \"Publikacja postów i odczyt komentarzy dla organizacji muzycznej\".",
          "Wewnątrz projektu utwórz <strong>App</strong> (np. \"concertivo-prod\"). Po utworzeniu zobaczysz <em>API Key</em>, <em>API Secret</em>, <em>Bearer Token</em> — <strong>ZIGNORUJ je</strong> (to OAuth 1.0a). Potrzebujemy OAuth 2.0.",
          "Wejdź w zakładkę <strong>Settings</strong> aplikacji → sekcja <strong>User authentication settings</strong> → kliknij <strong>Set up</strong> (lub Edit).",
          "<strong>App permissions</strong>: zaznacz <strong>Read and write and Direct message</strong>.<br/><strong>Type of App</strong>: wybierz <strong>Web App, Automated App or Bot</strong> (Confidential client).",
          "<strong>Callback URI / Redirect URL</strong>: wklej dokładnie ten adres: {CALLBACK_URL}<br/>Możesz dodać wiele callbacków (np. dev + prod) — każdy w osobnej linii.",
          "<strong>Website URL</strong>: wpisz adres strony Twojej organizacji (np. https://twoja-domena.pl). To wymagane pole.",
          "Kliknij <strong>Save</strong>. Pojawi się ekran z <strong>OAuth 2.0 Client ID</strong> i <strong>Client Secret</strong>. <strong>Skopiuj OBA</strong> — Client Secret pokazywany jest tylko raz!",
          "Wróć do tej karty w Concertivo i wklej skopiowane wartości w pola poniżej. Kliknij <strong>Zapisz klucze</strong>.",
          "Po zapisaniu przejdź do ostatniego kroku \"Połączenie\" i kliknij <strong>Przejdź do X</strong> — X poprosi Cię o autoryzację konta, a Concertivo automatycznie zapisze dane konta."
        ]
      },
      "linkedin": {
        "intro": "Aby Concertivo mogło publikować w Twoim imieniu na LinkedIn, musisz utworzyć własną aplikację w LinkedIn Developer Portal. Zajmuje to ~5 minut.",
        "open_portal": "Otwórz LinkedIn Developer Portal",
        "tip_label": "Wskazówka",
        "tip_body": "LinkedIn wymaga, aby aplikacja była przypisana do Strony firmowej (Company Page). Jeśli nie masz Strony — utwórz ją najpierw na linkedin.com/company/setup/new/.",
        "steps": [
          "Zaloguj się na <strong>linkedin.com/developers/apps</strong> swoim kontem LinkedIn (musi być właścicielem lub administratorem Strony firmowej).",
          "Kliknij <strong>Create app</strong>. <em>App name</em>: np. \"Concertivo — [nazwa Twojej organizacji]\". <em>LinkedIn Page</em>: wybierz Stronę firmową swojej organizacji. <em>App logo</em>: wgraj logo (min. 100×100 px).",
          "Zaakceptuj warunki i kliknij <strong>Create app</strong>. Zostaniesz przekierowany do panelu aplikacji.",
          "Wejdź w zakładkę <strong>Auth</strong>. Skopiuj <strong>Client ID</strong> i <strong>Client Secret</strong> (kliknij ikonę oka, aby pokazać Secret).",
          "Wciąż w zakładce <strong>Auth</strong>, w sekcji <strong>OAuth 2.0 settings → Authorized redirect URLs</strong>, kliknij <strong>+ Add redirect URL</strong> i wklej dokładnie ten adres: {CALLBACK_URL}",
          "Przejdź do zakładki <strong>Products</strong>. Kliknij <strong>Request access</strong> przy produkcie <strong>Sign In with LinkedIn using OpenID Connect</strong> (zatwierdzenie automatyczne, kilka sekund).",
          "Następnie kliknij <strong>Request access</strong> przy produkcie <strong>Share on LinkedIn</strong> (również automatyczne).",
          "Sprawdź w zakładce <strong>Auth → OAuth 2.0 scopes</strong>, czy widzisz aktywne: <code>openid</code>, <code>profile</code>, <code>email</code>, <code>w_member_social</code>. Jeśli któregoś brakuje — wróć do <em>Products</em>.",
          "Wróć do tej karty w Concertivo i wklej skopiowane wartości w pola poniżej. Kliknij <strong>Zapisz klucze</strong>.",
          "Po zapisaniu przejdź do ostatniego kroku \"Połączenie\" i kliknij <strong>Przejdź do LinkedIn</strong> — LinkedIn poprosi o autoryzację, a Concertivo automatycznie zapisze dane konta."
        ]
      }
    },

    "platforms": {
      "facebook": {
        "name": "Facebook",
        "tagline": "Strony firmowe (Pages)",
        "benefits": ["Publikuj posty na Stronie organizacji", "Planowanie wpisów z wyprzedzeniem", "Statystyki zasięgu i reakcji", "AI dopasuje długość i ton do FB"],
        "checklist": ["Mam rolę administratora Strony", "Strona jest opublikowana (nie tryb roboczy)", "Mam profil osobisty FB powiązany z rolą"],
        "info": {
          "description": "Bezpośrednie publikowanie postów (tekst, zdjęcia, wideo, linki) na Stronie firmowej Twojej organizacji. Statystyki zasięgu, reakcji, kliknięć i komentarzy spływają z powrotem do Concertivo. Komentarze pod postami pojawiają się w globalnej Skrzynce — możesz odpowiadać bez przełączania się do FB.",
          "how_it_looks": "1. Klikasz \"Połącz\" przy Facebooku.\n2. Otwiera się okno logowania Facebooka (Twoje prywatne konto).\n3. Facebook pyta, do których Stron chcesz dać dostęp Concertivo — zaznaczasz Stronę swojej organizacji.\n4. Wracasz do Concertivo z aktywnym połączeniem.\n5. Posty komponujesz w zakładce \"AI Studio\" lub \"Harmonogram\", wybierając Facebook jako platformę docelową.",
          "what_to_arrange": [
            "Strona firmowa na Facebooku (Pages) — jeśli nie masz, najpierw załóż na facebook.com/pages/create.",
            "Twoje prywatne konto FB musi mieć rolę \"Administrator\" tej Strony (Ustawienia Strony → Role na Stronie).",
            "Aplikacja Concertivo w Meta for Developers musi być w trybie \"Live\" z zatwierdzonymi minimalnymi uprawnieniami Facebook Pages: pages_show_list, pages_read_engagement.",
            "Strona musi być opublikowana — tryb roboczy uniemożliwia publikację przez API."
          ],
          "time_estimate": "Samo połączenie: ~2 minuty.\n\nJeśli aplikacja Concertivo w Meta jeszcze nie przeszła \"App Review\" Mety — w trybie deweloperskim działa od razu, ale tylko dla wskazanych testerów. Pełny App Review Mety dla advanced permissions: 3–14 dni roboczych po naszej stronie (jednorazowo dla całej platformy, nie dla każdego klienta)."
        }
      },
      "instagram": {
        "name": "Instagram",
        "tagline": "Konto firmowe / twórcy",
        "benefits": ["Publikuj zdjęcia i karuzele", "Statystyki zasięgu i zapisów", "AI generuje hashtagi i CTA"],
        "checklist": ["Konto IG jest typu Business/Creator", "Konto IG jest połączone ze Stroną FB", "Mam dostęp administratora do tej Strony FB"],
        "info": {
          "description": "Publikacja zdjęć, karuzel i Reels na firmowym Instagramie. MVP używa Instagram API with Instagram Login, dlatego wymaga konta IG typu Biznes/Twórca oraz uprawnień instagram_business_basic i instagram_business_content_publish.",
          "how_it_looks": "1. Klikasz \"Połącz\" przy Instagramie.\n2. Logujesz się przez Instagram Business Login.\n3. Autoryzujesz uprawnienia podstawowego profilu IG i publikacji treści.\n4. Wracasz do Concertivo z aktywnym połączeniem.\n5. Posty planujesz w \"Harmonogramie\", z podglądem przed publikacją.",
          "what_to_arrange": [
            "Konto IG przełączone na \"Biznes\" lub \"Twórca\" (w apce IG → Ustawienia → Konto → Przełącz na konto firmowe).",
            "Konto IG musi być POŁĄCZONE ze Stroną na Facebooku (w Ustawieniach IG → Połączone konta → Facebook).",
            "Musisz być administratorem tej Strony FB (jak przy integracji Facebook).",
            "Ta sama aplikacja Concertivo w Meta — jedna autoryzacja Mety daje dostęp i do FB, i do IG."
          ],
          "time_estimate": "Jeśli wszystko (konto firmowe IG + powiązanie ze Stroną FB) jest już ustawione: ~5 minut.\n\nKonfiguracja od zera: 15–30 minut (przełączenie IG na firmowe + utworzenie lub powiązanie Strony FB + dodanie roli)."
        }
      },
      "youtube": {
        "name": "YouTube",
        "tagline": "Kanał + filmy",
        "benefits": ["Zarządzaj opisami i tagami filmów", "Statystyki obejrzeń i subskrypcji", "AI proponuje tytuły i opisy SEO"],
        "checklist": ["Mam dostęp właściciela kanału", "Kanał jest zweryfikowany", "Konto Google ma włączone API"],
        "info": {
          "description": "Zarządzanie metadanymi filmów (tytuły, opisy, tagi, miniaturki), upload nowych filmów, czytanie statystyk obejrzeń, czasu oglądania i subskrypcji. AI proponuje SEO-friendly tytuły i opisy dopasowane do wydarzenia/koncertu. Komentarze pod filmami trafiają do Skrzynki.",
          "how_it_looks": "1. Klikasz \"Połącz\" przy YouTube.\n2. Przekierowanie do logowania Google — wybierasz konto powiązane z kanałem YT.\n3. Google pokazuje listę żądanych uprawnień YouTube Data API v3 — akceptujesz.\n4. Wracasz do Concertivo, kanał jest podpięty.\n5. Filmy zarządzasz w \"AI Studio\" / \"Harmonogramie\" wybierając YouTube jako platformę.",
          "what_to_arrange": [
            "Musisz być właścicielem kanału lub mieć rolę \"Manager\" w YouTube Studio → Ustawienia → Uprawnienia.",
            "Kanał musi być zweryfikowany numerem telefonu (jednorazowo w studio.youtube.com).",
            "Konto Google musi być w \"normalnym\" stanie — bez ograniczeń community guidelines.",
            "Aplikacja Concertivo musi mieć włączone YouTube Data API v3 + (dla uploadu) przejść Google API Audit — robimy to my, jednorazowo dla platformy."
          ],
          "time_estimate": "Czytanie statystyk i edycja istniejących filmów: od razu po połączeniu (~3 minuty).\n\nUpload nowych filmów wymaga przejścia Google API Audit — bez audytu działa tryb testowy (max 100 uploadów łącznie, filmy oznaczone jako \"prywatne\"). Pełny audyt Google YouTube API: 4–8 tygodni po naszej stronie (jednorazowo)."
        }
      },
      "linkedin": {
        "name": "LinkedIn",
        "tagline": "Strona firmowa (Company Page)",
        "benefits": ["Publikuj posty na Stronie firmowej", "Statystyki impresji i klików", "AI dostosuje ton do profesjonalnego B2B"],
        "checklist": ["Mam rolę Super Admin Strony firmowej", "Strona ma uzupełniony profil (logo, opis)", "Konto osobiste jest aktywne i powiązane"],
        "info": {
          "description": "Publikacja postów (tekst, obrazy, linki, dokumenty PDF) na Stronie firmowej LinkedIn. Statystyki impresji, kliknięć, zaangażowania, obserwujących. AI dostosowuje ton do profesjonalnego B2B i optymalizuje długość pod algorytm LinkedIn.",
          "how_it_looks": "1. Klikasz \"Połącz\" przy LinkedIn.\n2. Logujesz się przez LinkedIn swoim prywatnym kontem.\n3. Wybierasz Stronę firmową, którą chcesz podpiąć (musisz być jej Adminem).\n4. Autoryzujesz uprawnienia (w_organization_social, r_organization_social).\n5. Posty komponujesz w \"AI Studio\", planujesz w \"Harmonogramie\".",
          "what_to_arrange": [
            "Musisz mieć rolę \"Super Admin\" lub \"Content Admin\" Strony firmowej (Strona → Administracja → Zarządzaj administratorami).",
            "Strona firmowa musi mieć uzupełniony profil: logo, opis, branża (LinkedIn blokuje API dla niekompletnych stron).",
            "Aplikacja Concertivo musi mieć produkty \"Share on LinkedIn\" + \"Marketing Developer Platform\" zatwierdzone przez LinkedIn — robimy to my, jednorazowo."
          ],
          "time_estimate": "Samo połączenie: ~2 minuty.\n\nZatwierdzenie produktu \"Marketing Developer Platform\" przez LinkedIn (jednorazowo dla platformy): 2–4 tygodnie po naszej stronie. Bez zatwierdzenia działa tylko podstawowy \"Share on LinkedIn\" — wystarcza do publikacji."
        }
      },
      "twitter": {
        "name": "X (Twitter)",
        "tagline": "Konto firmowe",
        "benefits": ["Publikuj krótkie wpisy (do 280 znaków)", "Statystyki wyświetleń i zaangażowania", "AI skraca treści do limitu X"],
        "checklist": ["Mam konto deweloperskie X", "Mam aktywny plan Basic lub Pro (API jest płatne)", "Aplikacja ma uprawnienia Read+Write"],
        "info": {
          "description": "Publikacja krótkich wpisów (do 280 znaków), wątków, retweetów. Statystyki wyświetleń, lajków, retweetów, odpowiedzi. AI automatycznie skraca dłuższe treści do limitu znaków X bez utraty sensu. Odpowiedzi pod tweetami trafiają do Skrzynki.",
          "how_it_looks": "1. Klikasz \"Połącz\" przy X.\n2. Logujesz się przez X swoim kontem firmowym.\n3. Autoryzujesz aplikację Concertivo (OAuth 2.0 z PKCE).\n4. Wracasz, konto jest aktywne.\n5. Tweety piszesz w \"AI Studio\" — gdy treść przekracza 280 znaków, AI od razu proponuje skrócenie lub rozbicie na wątek.",
          "what_to_arrange": [
            "API X JEST PŁATNE od 2023 r. — to bezwzględny wymóg.",
            "Twoja organizacja musi mieć konto deweloperskie X (developer.x.com) z aktywnym planem: Basic (200 USD/mc, 100 tweetów/mc) lub Pro (5000 USD/mc, 1M tweetów/mc).",
            "Plan Free pozwala tylko na czytanie wybranych endpointów — publikacja jest niemożliwa.",
            "Aplikacja musi mieć włączone OAuth 2.0 i uprawnienia Read+Write (User authentication settings → Type of App: Web App).",
            "Trzeba ustawić Callback URL na adres Concertivo (podajemy konkretny URL przy konfiguracji)."
          ],
          "time_estimate": "Po opłaceniu planu i konfiguracji aplikacji w X Developer Portal: połączenie ~3 minuty.\n\nAktywacja konta deweloperskiego + plan Basic: ~1 dzień roboczy (X weryfikuje płatność)."
        }
      },
      "tiktok": {
        "name": "TikTok",
        "tagline": "Konto biznesowe",
        "benefits": ["Planowanie publikacji wideo", "Statystyki obejrzeń", "AI proponuje opisy i hashtagi"],
        "checklist": ["Mam konto TikTok Business", "Mam zatwierdzoną aplikację w TikTok Developers", "Mam dostęp do Content Posting API"],
        "info": {
          "description": "Planowanie i publikacja wideo (max 10 minut, MP4) na koncie biznesowym TikTok. Statystyki obejrzeń, polubień, udostępnień. AI proponuje opisy, hashtagi i CTA dopasowane do tiktokowego tonu i trendów.",
          "how_it_looks": "1. Klikasz \"Połącz\" przy TikTok.\n2. Logujesz się przez TikTok kontem biznesowym.\n3. TikTok pokazuje uprawnienia (video.upload, video.publish, user.info.basic) — akceptujesz.\n4. Wracasz do Concertivo.\n5. Filmy uploadujesz w \"AI Studio\" — pierwsza publikacja przez API jest oznaczona jako \"prywatna\" do czasu zatwierdzenia aplikacji przez TikTok (audyt).",
          "what_to_arrange": [
            "Konto TikTok musi być przełączone na \"Business\" (w apce → Ustawienia → Zarządzaj kontem → Przełącz na konto Biznes).",
            "Aplikacja Concertivo w TikTok for Developers musi mieć zatwierdzony dostęp do Content Posting API — robimy to my, jednorazowo.",
            "Wymagana weryfikacja domeny aplikacji (TikTok wysyła plik weryfikacyjny do umieszczenia na serwerze) — po naszej stronie.",
            "Niektóre kraje mają ograniczenia API (np. region UE — sprawdzamy przed publikacją)."
          ],
          "time_estimate": "Po zatwierdzeniu aplikacji: połączenie ~3 minuty.\n\nAudyt TikTok Developers dla Content Posting API: 2–6 tygodni po naszej stronie (jednorazowo). Do tego czasu pierwsze posty publikowane są jako \"prywatne\" — widoczne tylko dla autora."
        }
      },
      "spotify_artists": {
        "name": "Spotify",
        "tagline": "Profil artysty — tylko statystyki",
        "benefits": ["Liczba obserwujących profilu Spotify", "Popularność i gatunki wykonawcy", "AI analizuje trendy popularności"],
        "checklist": ["Mam konto Spotify powiązane z profilem artysty", "Założyłem aplikację w Spotify Developer Dashboard", "Dodałem moje konto w sekcji Users and Access"],
        "info": {
          "description": "WAŻNE: Spotify nie pozwala publikować muzyki przez API — uploadem zajmuje się dystrybutor (DistroKid, TuneCore, CD Baby, Believe). Concertivo czyta TYLKO publiczne statystyki profilu artysty: liczbę obserwujących, popularność (0–100), gatunki, top utwory, dane podstawowe. AI analizuje trendy popularności w czasie.",
          "how_it_looks": "1. Klikasz \"Połącz\" przy Spotify.\n2. Logujesz się przez Spotify (konto powiązane z profilem artysty).\n3. Wpisujesz Spotify Artist ID (znajdziesz w linku do swojego profilu: open.spotify.com/artist/XXXXX — XXXXX to ID).\n4. Wracasz do Concertivo.\n5. Statystyki widzisz w zakładce \"Statystyki\" — odświeżane co godzinę przez cron.",
          "what_to_arrange": [
            "Profil artysty na Spotify (czyli muzyka musi być już opublikowana przez dystrybutora i znajdować się w katalogu Spotify).",
            "Zweryfikowany dostęp do Spotify for Artists — przez dystrybutora muzyki (zwykle automatyczne po pierwszym wydaniu).",
            "Spotify Artist ID — skopiuj z URL swojego profilu (np. open.spotify.com/artist/4kI8Ie27vjvonwaB2ePh8T → 4kI8Ie27vjvonwaB2ePh8T).",
            "Concertivo używa Spotify Web API (Client Credentials) — nie wymaga OAuth użytkownika dla podstawowych statystyk publicznych."
          ],
          "time_estimate": "Połączenie i wpisanie Artist ID: ~2 minuty.\n\nJeśli nie masz jeszcze zweryfikowanego profilu Spotify for Artists: 1–7 dni po stronie Spotify (po opublikowaniu pierwszego utworu przez dystrybutora)."
        }
      }
    },
    "ai": {
      "form": {
        "title": "Generator treści AI",
        "subtitle": "Wybierz wydarzenie lub opisz temat, a AI przygotuje wersje postu pod każdą platformę.",
        "event": "Wydarzenie (opcjonalnie)",
        "no_event": "Brak — wpiszę temat ręcznie",
        "prompt": "Temat lub dodatkowe wskazówki",
        "prompt_placeholder": "Np. \"Zapowiedź jesiennej trasy koncertowej\"",
        "tone": "Ton wypowiedzi",
        "platforms": "Platformy docelowe"
      },
      "tones": {
        "informational": "Informacyjny",
        "promotional": "Promocyjny",
        "celebratory": "Świąteczny / okazjonalny",
        "behind_the_scenes": "Zza kulis"
      },
      "actions": {
        "generate": "Wygeneruj treści",
        "edit": "Edytuj",
        "save_draft": "Zapisz jako szkic"
      },
      "empty": "Wygenerowane treści pojawią się tutaj. Wybierz platformy i kliknij \"Wygeneruj treści\".",
      "best_time": "Sugerowany najlepszy czas publikacji",
      "edit_title": "Edytuj wersję dla: {{platform}}",
      "edit_subtitle": "Możesz dostosować treść i hashtagi przed zapisaniem.",
      "hashtags": "Hashtagi",
      "errors": {
        "no_platforms": "Wybierz co najmniej jedną platformę."
      },
      "toast": {
        "generated": "Treści wygenerowane.",
        "saved_draft": "Zapisano jako szkic."
      }
    },
    "schedule": {
      "calendar_title": "Kalendarz publikacji",
      "list_title": "Zaplanowane wpisy",
      "list_subtitle": "Lista postów oczekujących na publikację oraz historia.",
      "empty": "Brak zaplanowanych wpisów.",
      "cron_info": "Cron uruchamia publikację co minutę. Realne wysłanie do platformy aktywuje się po OAuth.",
      "publish_now": "Publikuj teraz",
      "publish_now_result": "Próba publikacji: {{summary}}",
      "source_imported": "Zaimportowany",
      "open_original": "Otwórz oryginał",
      "sync_now": "Synchronizuj",
      "sync_done": "Zsynchronizowano: metryki {{metrics}}, nowe komentarze {{comments}}",
      "sync_meta_limited": "Posty są zaimportowane. Meta może jeszcze blokować polubienia i komentarze do czasu zatwierdzenia pages_read_engagement lub Page Public Content Access w App Review.",
      "new_comments": "{{count}} nowych",
      "delete_local": "Usuń lokalnie",
      "delete_local_title": "Usunąć wpis tylko z aplikacji?",
      "delete_local_desc": "Usunie to zaimportowany wpis, metryki i komentarze wyłącznie z Concertivo. Oryginalny post w mediach społecznościowych nie zostanie usunięty.",
      "delete_local_confirm": "Usuń z aplikacji",
      "local_delete_done": "Wpis usunięty tylko z aplikacji.",
      "delete_imported": "Wyczyść importy",
      "delete_imported_title": "Usunąć wszystkie zaimportowane wpisy?",
      "delete_imported_desc": "Usunie to {{count}} zaimportowanych wpisów wraz z lokalnymi metrykami i komentarzami. Posty w mediach społecznościowych pozostaną bez zmian.",
      "delete_imported_confirm": "Wyczyść importy",
      "import_delete_done": "Usunięto lokalnie zaimportowane wpisy: {{count}}."
    },
    "post_details": {
      "title": "Szczegóły posta",
      "subtitle": "Treść, metryki, komentarze i odpowiedzi.",
      "not_found": "Nie znaleziono posta.",
      "no_results": "Post nie został jeszcze opublikowany na żadnej platformie.",
      "comments_title": "Komentarze ({{count}})",
      "no_comments": "Brak komentarzy. Kliknij „Synchronizuj”, aby pobrać najnowsze z platformy.",
      "reply": "Odpowiedz",
      "moderation": "Moderacja"
    },
    "stats": {
      "title": "Statystyki",
      "subtitle": "Zasięgi, reakcje i klikalność opublikowanych treści.",
      "empty_state": "Statystyki pojawią się po opublikowaniu pierwszych postów.",
      "ai_analysis_title": "Analiza AI",
      "ai_analysis_subtitle": "AI przeanalizuje wyniki i zaproponuje kierunki optymalizacji.",
      "run_analysis": "Uruchom analizę"
    }
  },
  "web": {
      "subtitle": "Publikuj treści (Aktualności, Wydarzenia, Galeria) na swojej stronie WWW.",
      "coming_in_next_step": "Pełen edytor pojawi się w kolejnym kroku — najpierw uruchamiamy Aktualności i konfigurację integracji.",
      "tabs": {
        "news": "Aktualności",
        "events": "Wydarzenia",
        "gallery": "Galeria",
        "integration": "Integracja WWW",
        "webhooks": "Webhooki"
      },
      "news": {
        "title": "Aktualności",
        "subtitle": "Wpisy publikowane na stronie organizacji.",
        "add": "Dodaj wpis",
        "edit": "Edytuj wpis",
        "empty": "Brak wpisów. Dodaj pierwszy klikając przycisk powyżej.",
        "published": "Opublikowane",
        "draft": "Szkic",
        "publish": "Opublikuj publicznie",
        "publish_help": "Po włączeniu wpis będzie widoczny przez publiczne API i embed.",
        "cover_url": "URL zdjęcia głównego",
        "slug": "Slug (URL)",
        "slug_placeholder": "auto z tytułu, jeśli puste",
        "author": "Autor (opcjonalnie)",
        "tags": "Tagi (po przecinku)",
        "tags_placeholder": "koncert, jazz, festiwal",
        "title_field": "Tytuł",
        "excerpt": "Lead / zajawka",
        "content": "Treść",
        "saved": "Wpis zapisany.",
        "deleted": "Wpis usunięty.",
        "delete_title": "Usunąć wpis?",
        "delete_desc": "Operacja jest nieodwracalna."
      },
      "events": {
        "title": "Wydarzenia",
        "subtitle": "Koncerty, spektakle, festiwale publikowane na stronie organizacji.",
        "add": "Dodaj wydarzenie",
        "edit": "Edytuj wydarzenie",
        "empty": "Brak wydarzeń. Dodaj pierwsze klikając przycisk powyżej.",
        "saved": "Wydarzenie zapisane.",
        "deleted": "Wydarzenie usunięte.",
        "delete_title": "Usunąć wydarzenie?",
        "delete_desc": "Operacja jest nieodwracalna.",
        "starts_at": "Początek",
        "ends_at": "Koniec (opcjonalnie)",
        "timezone": "Strefa czasowa",
        "status_label": "Status",
        "location_name": "Nazwa lokalizacji",
        "location_address": "Adres",
        "ticket_url": "Link do biletów",
        "ticket_price_from": "Cena biletu od",
        "description": "Opis",
        "performers": "Wykonawcy",
        "performer_name": "Nazwa wykonawcy",
        "add_performer": "Dodaj wykonawcę",
        "start_required": "Data rozpoczęcia jest wymagana.",
        "status": {
          "scheduled": "Zaplanowane",
          "cancelled": "Odwołane",
          "postponed": "Przełożone",
          "sold_out": "Wyprzedane"
        }
      },
      "gallery": {
        "title": "Galeria",
        "subtitle": "Albumy ze zdjęciami i filmami publikowane na stronie organizacji.",
        "add_album": "Nowy album",
        "edit_album": "Edytuj album",
        "empty": "Brak albumów. Dodaj pierwszy klikając przycisk powyżej.",
        "album": "Album",
        "album_saved": "Album zapisany.",
        "album_deleted": "Album usunięty.",
        "delete_album_title": "Usunąć album?",
        "delete_album_desc": "Wszystkie zdjęcia i filmy z albumu zostaną usunięte.",
        "cover_url": "URL okładki albumu",
        "description": "Opis",
        "add_item": "Dodaj plik",
        "item_added": "Plik dodany.",
        "item_deleted": "Plik usunięty.",
        "item_url_required": "URL pliku jest wymagany.",
        "no_items": "Album jest pusty. Dodaj pierwszy plik powyżej.",
        "kind": "Typ",
        "kind_image": "Zdjęcie",
        "kind_video": "Wideo",
        "item_url": "URL pliku",
        "thumb_url": "URL miniatury (opcjonalnie)",
        "credit": "Autor zdjęcia (opcjonalnie)",
        "caption": "Podpis"
      },
      "integration": {
        "title": "Integracja WWW",
        "subtitle": "Publikuj treści tej organizacji na własnej stronie poprzez JSON API, RSS, iCal lub embed.",
        "slug": "Publiczny slug organizacji",
        "slug_help": "Pojawi się w adresach API, np. /api/public/v1/orgs/<slug>/news",
        "publish": "Aktywuj publiczne API",
        "saved": "Ustawienia zapisane.",
        "endpoints": "Adresy API",
        "endpoints_help": "Wklej te adresy w kodzie strony lub do czytników RSS/kalendarza.",
        "lang_param_title": "Język treści",
        "lang_param_desc": "Dodaj ?lang=pl lub ?lang=en aby otrzymać treść w wybranym języku. Domyślnie pl.",
        "tokens": "Tokeny API",
        "tokens_help": "Tylko do odczytu. Token pokazujemy raz — zapisz go w bezpiecznym miejscu.",
        "create_token": "Wygeneruj",
        "token_name_placeholder": "Nazwa, np. Strona główna",
        "no_tokens": "Brak tokenów.",
        "revoked": "unieważniony",
        "token_revoked": "Token unieważniony.",
        "token_created_title": "Token wygenerowany",
        "token_created_desc": "Skopiuj token TERAZ — nie zobaczysz go ponownie.",
        "domains": "Dozwolone domeny (CORS)",
        "domains_help": "Domeny, z których można wywoływać API z przeglądarki. Puste = bez ograniczeń.",
        "add_domain": "Dodaj",
        "no_domains": "Brak ograniczeń domenowych.",
        "embed_snippet": "Snippet do wklejenia na stronę",
        "embed_snippet_help": "Wklej ten kod na stronę – wyświetli listę aktualności w lekkim widgecie (Shadow DOM).",
        "embed_gallery_help": "Tryb gallery dodaje siatkę albumów z lightboxem i odtwarzaniem wideo.",
        "sitemap_help": "Sitemap zawiera linki do aktualności, wydarzeń i albumów. Dodaj ?base=https://twoja-domena aby uzyskać absolutne URL-e.",
        "download_guide": "Pobierz instrukcję PDF"
      },
      "webhooks": {
        "title": "Webhooki",
        "subtitle": "Powiadamiaj zewnętrzne systemy (CMS, statyczny generator, n8n, Zapier) o zmianach treści.",
        "add": "Dodaj webhook",
        "empty": "Brak webhooków.",
        "inactive": "nieaktywny",
        "active": "Aktywny",
        "url": "Adres URL (POST)",
        "events": "Zdarzenia",
        "events_count": "zdarzeń",
        "form_help": "Każde żądanie podpisujemy nagłówkiem X-Concertivo-Signature: sha256=<hmac>. Sekret pokazujemy raz przy tworzeniu.",
        "secret_title": "Sekret webhooka",
        "secret_desc": "Zachowaj sekret w bezpiecznym miejscu. Użyj go do weryfikacji nagłówka X-Concertivo-Signature po stronie odbiorcy.",
        "show_secret": "Pokaż sekret",
        "deliveries": "Ostatnie dostarczenia",
        "no_deliveries": "Brak prób dostarczenia.",
        "download_guide": "Pobierz instrukcję PDF"
      },
      "instructions": {
        "news": {
          "title": "Jak działa moduł Aktualności – instrukcja",
          "intro": "Aktualności to wpisy publikowane przez API publiczne i embed na stronie organizacji. Każdy wpis ma tytuł, lead, treść (WYSIWYG), zdjęcie główne, opcjonalną galerię zdjęć, tagi oraz autora. Wpisy występują w dwóch językach (PL/EN) – w jednym wpisie wypełniasz oba lub tylko jeden (wtedy strona pokaże język zastępczy).",
          "sections": [
            {
              "heading": "Po co to jest",
              "body": "Aby utrzymywać sekcję „Aktualności / News” na stronie WWW organizacji bez ręcznego edytowania HTML. Treść tworzysz w Concertivo, a strona pobiera ją automatycznie."
            },
            {
              "heading": "Funkcje",
              "items": [
                "WYSIWYG (Tiptap) – pogrubienia, listy, linki, nagłówki, cytaty.",
                "Wersje językowe PL/EN obok siebie w jednym formularzu.",
                "Slug (adres URL) generowany automatycznie z tytułu PL – możesz nadpisać ręcznie.",
                "Status szkic ↔ opublikowane (toggle „Opublikuj publicznie”).",
                "Tagi do filtrowania na stronie, autor wpisu, galeria zdjęć poniżej treści.",
                "Wpis opublikowany jest natychmiast dostępny w JSON API, RSS i embed."
              ]
            },
            {
              "heading": "Jak utworzyć wpis – krok po kroku",
              "items": [
                "Kliknij „Dodaj wpis”.",
                "Wpisz tytuł PL i (opcjonalnie) EN.",
                "Uzupełnij lead/zajawkę i treść w WYSIWYG.",
                "Wgraj zdjęcie główne metodą drag & drop lub kliknij, aby wybrać plik z dysku – Concertivo automatycznie skonwertuje je do WebP, zmniejszy do max 2560 px po dłuższym boku i wygeneruje miniatury (1280 px i 400 px). Nie musisz już podawać URL-a.",
                "Dodaj tagi po przecinku (np. „koncert, jazz”).",
                "Zaznacz „Opublikuj publicznie” i zapisz."
              ]
            },
            {
              "heading": "Co musi być po stronie WWW",
              "items": [
                "Slug organizacji ustawiony w zakładce „Integracja WWW” i włączone publiczne API.",
                "Po stronie strony WWW – fetch endpointu /api/public/v1/orgs/<slug>/news?lang=pl lub gotowy snippet embed.js.",
                "Opcjonalnie: czytnik RSS lub statyczny generator (np. Astro/Next) pobierający JSON podczas budowania."
              ]
            },
            {
              "heading": "Dobre praktyki",
              "items": [
                "Trzymaj lead krótki (1–2 zdania) – pojawia się na liście i w meta description.",
                "Zdjęcia główne wgrywaj w jak największej rozdzielczości – system sam zrobi wersję optymalną i miniatury (idealny format ~1200×630 px lub większy, proporcja landscape dla podglądów społecznościowych).",
                "Slug ustawiaj raz – zmiana zepsuje istniejące linki zewnętrzne."
              ]
            }
          ]
        },
        "events": {
          "title": "Jak działa moduł Wydarzenia – instrukcja",
          "intro": "Wydarzenia to koncerty, spektakle, festiwale publikowane na stronie organizacji. Mają datę początku/końca, lokalizację, wykonawców, link do biletów i status (zaplanowane / odwołane / przełożone / wyprzedane).",
          "sections": [
            {
              "heading": "Po co to jest",
              "body": "Aby Twoja strona miała aktualny kalendarz wydarzeń, a użytkownicy mogli dodać wydarzenie do swojego kalendarza jednym kliknięciem (iCal)."
            },
            {
              "heading": "Funkcje",
              "items": [
                "Pełny opis WYSIWYG w PL/EN.",
                "Data, godzina, strefa czasowa (domyślnie Europe/Warsaw), opcjonalny koniec.",
                "Lokalizacja: nazwa miejsca (i18n), adres, opcjonalnie współrzędne (lat/lng).",
                "Lista wykonawców z linkami.",
                "Link do biletów + cena „od” i waluta.",
                "Statusy wpływają na wygląd na liście (np. „Odwołane” pokazuje się przekreślone).",
                "Plik iCal (.ics) – jeden plik dla całej organizacji, gotowy do subskrypcji w Google/Apple Calendar."
              ]
            },
            {
              "heading": "Jak dodać wydarzenie – krok po kroku",
              "items": [
                "Kliknij „Dodaj wydarzenie”.",
                "Tytuł PL/EN, data początku (i opcjonalnie końca).",
                "Lokalizacja – nazwa i adres; współrzędne tylko jeśli mapa na stronie ich potrzebuje.",
                "Dodaj wykonawców (przyciskiem „Dodaj wykonawcę”).",
                "Wgraj plakat wydarzenia z dysku (drag & drop lub klik) – system automatycznie skonwertuje obraz do WebP, zmniejszy i wygeneruje miniatury.",
                "Wklej link do biletów (Bilet24, eBilet, własny sklep).",
                "Wybierz status, zaznacz „Opublikuj publicznie”, zapisz."
              ]
            },
            {
              "heading": "Co musi być po stronie WWW",
              "items": [
                "Slug organizacji ustawiony w „Integracja WWW”.",
                "Fetch /api/public/v1/orgs/<slug>/events?lang=pl&filter=upcoming dla nadchodzących lub filter=past dla archiwum.",
                "Subskrypcja iCal: link /api/public/v1/orgs/<slug>/events.ics można udostępnić użytkownikom („Dodaj do kalendarza”)."
              ]
            },
            {
              "heading": "Dobre praktyki",
              "items": [
                "Ustawiaj datę zakończenia – pomaga oddzielić nadchodzące od archiwalnych.",
                "Status „Odwołane” zamiast usuwania – stare linki dalej działają i pokazują informację.",
                "Współrzędne wpisz, gdy używasz mapy (np. Google Maps embed)."
              ]
            }
          ]
        },
        "gallery": {
          "title": "Jak działa moduł Galeria – instrukcja",
          "intro": "Galeria składa się z albumów. Każdy album zawiera zdjęcia wgrywane bezpośrednio z dysku i/lub wideo (z URL). Albumy można powiązać z wydarzeniem – wtedy pojawiają się obok niego na stronie.",
          "sections": [
            {
              "heading": "Po co to jest",
              "body": "Aby wyświetlać relacje zdjęciowe i wideo z koncertów/wydarzeń w czystej galerii z lightboxem, bez pisania własnego komponentu od zera."
            },
            {
              "heading": "Funkcje",
              "items": [
                "Albumy z tytułem i opisem PL/EN, okładką (upload z dysku) i powiązaniem z wydarzeniem.",
                "Pozycje: zdjęcia wgrywane bezpośrednio z dysku (multi-upload, drag & drop) lub wideo (URL pliku MP4 / YouTube / Vimeo).",
                "Automatyczna konwersja każdego zdjęcia do WebP, max 2560 px po dłuższym boku, plus wersja średnia 1280 px i miniatura 400 px – wszystko trzymane na Cloudflare R2.",
                "Stripowanie metadanych EXIF (prywatność) i znaczne zmniejszenie rozmiaru (zwykle 30–70% w stosunku do oryginału).",
                "Podpisy i autor zdjęcia (© photo credit).",
                "Sortowanie pozycji w albumie (sort_order).",
                "Embed gallery: gotowy widget z siatką albumów + lightbox + odtwarzanie wideo, sterowanie klawiaturą (Esc / ← →)."
              ]
            },
            {
              "heading": "Jak utworzyć album – krok po kroku",
              "items": [
                "„Nowy album” → tytuł PL/EN, opis, wgraj okładkę z dysku, opcjonalnie wybierz wydarzenie.",
                "Zapisz album, wejdź w jego szczegóły.",
                "Aby dodać zdjęcia: użyj sekcji „Wgraj zdjęcia” – możesz przeciągnąć wiele plików naraz, każdy zostanie przetworzony (resize + WebP + miniatury) i zapisany na Twoim dysku organizacji.",
                "Aby dodać wideo: „Dodaj wideo” → wklej URL pliku .mp4 lub link YouTube/Vimeo.",
                "Zaznacz „Opublikuj publicznie”."
              ]
            },
            {
              "heading": "Co musi być po stronie WWW",
              "items": [
                "Slug organizacji aktywny w „Integracja WWW”.",
                "Albo embed.js z data-mode=\"gallery\" (najszybciej), albo własny fetch endpointu /api/public/v1/orgs/<slug>/gallery oraz /gallery/<albumSlug>.",
                "Hosting plików nie jest potrzebny po Twojej stronie – zdjęcia są serwowane z Cloudflare R2 (publiczny URL generowany automatycznie). Wideo z YouTube/Vimeo działa przez embed."
              ]
            },
            {
              "heading": "Dobre praktyki",
              "items": [
                "Wgrywaj zdjęcia w pełnej rozdzielczości z aparatu – system sam zrobi wersję optymalną i miniatury. Limit pojedynczego pliku to zwykle 25 MB.",
                "Dla wideo lokalnych użyj zewnętrznego CDN i wklej URL .mp4; dla YouTube/Vimeo wklej standardowy link do filmu.",
                "Powiąż album z wydarzeniem – strona może pokazać album bezpośrednio pod kartą wydarzenia."
              ]
            }
          ]
        },
        "integration": {
          "title": "Jak zintegrować ze stroną WWW – instrukcja",
          "intro": "Ta zakładka udostępnia treści (Aktualności, Wydarzenia, Galeria) na zewnątrz: przez JSON API, RSS, iCal, sitemap.xml i wklejany embed.js. Wybierasz metodę zależnie od tego, jak zbudowana jest strona organizacji.",
          "sections": [
            {
              "heading": "Krok 1 – konfiguracja podstawowa",
              "items": [
                "Ustaw „Publiczny slug organizacji” (np. filharmonia-szczecinska). Pojawi się w każdym adresie API.",
                "Włącz „Aktywuj publiczne API” – bez tego endpointy zwracają 404.",
                "Kliknij Zapisz."
              ]
            },
            {
              "heading": "Wybór metody integracji",
              "items": [
                "WordPress / CMS bez własnych szablonów → użyj embed.js (wklej snippet w blok HTML).",
                "Strona statyczna (Astro, Next, Hugo) → fetch JSON podczas builda + opcjonalnie webhook do automatycznego rebuilda.",
                "Aplikacja własna (React/Vue) → fetch JSON na froncie + ewentualnie sitemap.xml dla SEO.",
                "Czytniki / kalendarze → RSS (news/feed.xml) i iCal (events.ics)."
              ]
            },
            {
              "heading": "Embed (najprostsze)",
              "items": [
                "Skopiuj snippet ze stałej sekcji „Snippet do wklejenia”.",
                "Wklej go w kod strony tam, gdzie ma się pojawić lista (np. blok HTML w WordPressie).",
                "Widget renderuje się w Shadow DOM – nie konfliktuje ze stylami strony.",
                "Parametry: data-mode (news/events/gallery), data-lang (pl/en), data-limit (np. 6), data-target (selektor CSS kontenera)."
              ]
            },
            {
              "heading": "JSON API",
              "items": [
                "Wszystkie endpointy zaczynają się od /api/public/v1/orgs/<slug>/...",
                "Dodaj ?lang=pl albo ?lang=en aby otrzymać treść w konkretnym języku.",
                "Domyślny limit listy: 20, max 100 (?limit=...).",
                "Wymagają HTTPS i mogą być cachowane (cache 60 s przeglądarka, 5 min CDN)."
              ]
            },
            {
              "heading": "Co musi być po stronie strony WWW",
              "items": [
                "HTTPS (przeglądarki blokują mieszane treści).",
                "Jeśli używasz embed.js – nic więcej.",
                "Jeśli używasz fetch z przeglądarki na innej domenie – dodaj domenę strony w sekcji „Dozwolone domeny (CORS)” poniżej.",
                "Dla SEO: dodaj /sitemap.xml organizacji do swojego głównego sitemap.xml lub do Google Search Console (z parametrem ?base=https://twoja-domena)."
              ]
            },
            {
              "heading": "Tokeny API (na przyszłość)",
              "body": "Obecnie publiczne odczyty nie wymagają tokenu. Tokeny przydają się gdy w kolejnych etapach dodamy prywatne endpointy (np. odczyt szkiców). Token pokazujemy raz przy generowaniu – zapisz go bezpiecznie."
            }
          ]
        },
        "webhooks": {
          "title": "Jak działają webhooki – instrukcja",
          "intro": "Webhook to URL HTTP po Twojej stronie, pod który Concertivo wysyła POST z JSON-em za każdym razem, gdy zmienia się treść (publikacja, edycja, usunięcie). Pozwalają automatycznie odświeżyć stronę WWW, statyczny build, zewnętrzny CMS lub uruchomić workflow w n8n/Zapier.",
          "sections": [
            {
              "heading": "Po co to jest",
              "body": "Aby strona WWW była zawsze aktualna bez ręcznego odświeżania. Po opublikowaniu wpisu w Concertivo Twój system dostaje powiadomienie i może np. zbudować stronę od nowa albo wyczyścić cache."
            },
            {
              "heading": "Jakie zdarzenia wysyłamy",
              "items": [
                "news.published / news.updated / news.deleted",
                "event.published / event.updated / event.deleted",
                "album.published / album.updated / album.deleted"
              ]
            },
            {
              "heading": "Format żądania",
              "items": [
                "Metoda: POST, Content-Type: application/json.",
                "Nagłówki: X-Concertivo-Event: <nazwa>, X-Concertivo-Signature: sha256=<hmac_hex>.",
                "Body: { \"event\": \"news.published\", \"occurred_at\": \"ISO-8601\", \"data\": { \"id\": \"...\", \"slug\": \"...\", \"organization_id\": \"...\" } }.",
                "Timeout: 10 sekund. Każda próba trafia do logu „Ostatnie dostarczenia”."
              ]
            },
            {
              "heading": "Jak dodać webhook – krok po kroku",
              "items": [
                "Kliknij „Dodaj webhook”.",
                "Wpisz nazwę (np. „Rebuild Vercel” lub „n8n – kanał publikacji”).",
                "Wklej URL endpointu po Twojej stronie (musi obsługiwać POST i być publicznie dostępny przez HTTPS).",
                "Zaznacz interesujące zdarzenia (domyślnie wszystkie).",
                "Zapisz – zobaczysz JEDNORAZOWO sekret. Skopiuj go i zapisz po stronie odbiorcy."
              ]
            },
            {
              "heading": "Weryfikacja po Twojej stronie (BARDZO WAŻNE)",
              "items": [
                "Oblicz HMAC-SHA256 z całego raw body żądania, używając zapisanego sekretu.",
                "Porównaj wynik (hex) z wartością po „sha256=” z nagłówka X-Concertivo-Signature.",
                "Odrzuć żądanie, jeśli się nie zgadza – inaczej ktoś może podszywać się pod Concertivo."
              ]
            },
            {
              "heading": "Przykładowe użycie",
              "items": [
                "Vercel / Netlify deploy hook – wklej URL deploy hooka, każda publikacja triggeruje rebuild.",
                "n8n / Zapier – odbierz webhook, dalej rozprowadź (Slack, email, Discord).",
                "Własny serwer – endpoint który czyści cache strony lub re-fetchuje JSON."
              ]
            },
            {
              "heading": "Co musi być po Twojej stronie",
              "items": [
                "Publiczny URL HTTPS przyjmujący POST z JSON-em.",
                "Logika weryfikująca podpis HMAC (przykład: Node `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')`).",
                "Odpowiedź 2xx oznacza sukces; dowolny inny kod lub timeout = błąd w logu."
              ]
            }
          ]
        }
      }
  },
  "upload": {
    "drop_here": "Przeciągnij i upuść obraz lub kliknij, aby wybrać",
    "formats_hint": "JPG, PNG, WebP — automatyczna konwersja i miniaturki",
    "processing": "Przetwarzanie obrazu…",
    "uploading": "Wysyłanie do storage…",
    "done": "Gotowe",
    "failed": "Nie udało się wgrać",
    "not_an_image": "Wybrany plik nie jest obrazem"
  },
  "invitations": {
    "title": "Zaproszenie do organizacji",
    "description": "Zostałeś zaproszony do organizacji „{{org}}”.",
    "for_email": "Zaproszenie wystawione na: {{email}}",
    "need_login": "Aby przyjąć zaproszenie, zaloguj się lub załóż konto na ten sam adres email.",
    "email_mismatch": "Zaproszenie jest dla {{expected}}, a jesteś zalogowany jako {{current}}.",
    "accept": "Przyjmij",
    "decline": "Odrzuć",
    "accepted": "Zaproszenie przyjęte",
    "declined": "Zaproszenie odrzucone",
    "not_found": "Zaproszenie nie istnieje.",
    "already_processed": "To zaproszenie zostało już obsłużone.",
    "expired": "Zaproszenie wygasło.",
    "pending_title": "Oczekujące zaproszenia",
    "expires_at": "Ważne do {{date}}"
  }
} as const;

