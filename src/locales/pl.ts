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
      "verify": "Zweryfikuj i włącz"
    }
  },


  "lang": {
    "label": "Język",
    "pl": "Polski",
    "en": "English"
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
    "submit": "Wyślij",
    "back": "Wstecz",
    "next": "Dalej",
    "add": "Dodaj",
    "approve": "Zatwierdź",
    "reject": "Odrzuć",
    "edit": "Edytuj",
    "delete": "Usuń",
    "search": "Szukaj",
    "empty": "Brak danych",
    "error": "Coś poszło nie tak",
    "success": "Gotowe"
  },
  "stopki": {
    "title_user": "Moje stopki e-mail",
    "title_org": "Stopki e-mail organizacji",
    "add": "Dodaj stopkę",
    "empty": "Brak stopek. Kliknij „Dodaj stopkę”, aby utworzyć pierwszą.",
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
      "none_click_add": "Brak. Kliknij „Dodaj”.",
      "none_social": "Brak. Wybierz platformę i kliknij „Dodaj”.",
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
      "check_email": "Sprawdź email — wysłaliśmy link aktywacyjny.",
      "mfa_recommendation": "🔒 Zalecamy włączenie weryfikacji dwuetapowej (2FA) po założeniu konta — w sekcji „Profil → Bezpieczeństwo”. Dodatkowy kod z aplikacji znacznie zwiększa bezpieczeństwo Twoich danych.",
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
      "legal_required": "Aby kontynuować, musisz zaakceptować regulamin i politykę prywatności."
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
      "expires": "Ważne do"
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
      "events": "Koncerty",
      "budget": "Budżet",
      "skrzynki": "Skrzynki pocztowe",
      "back_to_list": "← Wszystkie organizacje",
      "pending_expenses": "Niezrealizowane wydatki: {{count}}"
    },
    "events": {
      "title": "Koncerty",
      "subtitle": "Planuj i zarządzaj koncertami tej organizacji.",
      "empty": "Brak zaplanowanych koncertów. Moduł zarządzania koncertami pojawi się tutaj wkrótce.",
      "coming_soon": "Wkrótce"
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
      "approvals": "Zatwierdzenia"
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
      "revoke_btn": "Odbierz „{{role}}\"",
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
    }
  },
  "contacts": {
    "title": "Kontakty",
    "subtitle": "Baza osób, firm i artystów. Możesz prowadzić własne, prywatne kontakty oraz wspólne z organizacjami, do których należysz.",
    "scope": { "user": "Moje kontakty", "org": "Kontakty organizacji" },
    "kinds": { "person": "Osoba", "company": "Firma / Instytucja", "artist": "Artysta / Zespół" },
    "kinds_plural": { "person": "Osoby", "company": "Firmy", "artist": "Artyści" },
    "category": {
      "label": "Kategoria",
      "client": "Klient", "supplier": "Dostawca", "artist": "Artysta", "partner": "Partner",
      "venue": "Obiekt / Miejsce", "media": "Media", "other": "Inne"
    },
    "artist_type": {
      "label": "Typ artysty",
      "solo": "Solo", "band": "Zespół", "ensemble": "Ensemble / Orkiestra", "dj": "DJ"
    },
    "actions": {
      "add": "Dodaj kontakt", "edit": "Edytuj", "delete": "Usuń",
      "import_csv": "Import CSV", "back": "Wróć do listy"
    },
    "list": {
      "search_placeholder": "Szukaj po nazwie...",
      "filter_kind": "Typ", "filter_category": "Kategoria", "all": "Wszystkie",
      "empty": "Brak kontaktów. Dodaj pierwszy, używając przycisku powyżej.",
      "loading": "Ładowanie kontaktów..."
    },
    "form": {
      "section_kind": "Typ kontaktu",
      "section_person": "Dane osobowe",
      "section_company": "Dane firmy",
      "section_artist": "Dane artysty",
      "section_contact": "Dane kontaktowe",
      "section_address": "Adres",
      "section_meta": "Klasyfikacja i notatki",
      "first_name": "Imię", "last_name": "Nazwisko", "middle_name": "Drugie imię",
      "position": "Stanowisko", "birth_date": "Data urodzenia",
      "company_name": "Nazwa firmy", "legal_name": "Nazwa pełna / prawna",
      "tax_id": "NIP / VAT ID", "registration_no": "KRS / REGON",
      "artist_name": "Nazwa artysty / zespołu",
      "genres": "Gatunki (oddzielone przecinkami)",
      "rider_url": "Link do ridera", "tech_rider_url": "Link do rideru technicznego",
      "email": "E-mail", "phone": "Telefon", "website": "Strona WWW",
      "tags": "Tagi (oddzielone przecinkami)", "source": "Źródło pozyskania",
      "preferred_language": "Preferowany język", "notes": "Notatki",
      "save": "Zapisz kontakt", "saved": "Kontakt zapisany",
      "delete_confirm": "Na pewno usunąć ten kontakt?"
    },
    "empty_orgs": "Nie należysz jeszcze do żadnej organizacji. Możesz dodawać kontakty prywatne lub utworzyć / dołączyć do organizacji."
  }
} as const;
