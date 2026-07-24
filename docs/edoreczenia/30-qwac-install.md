# Instalacja certyfikatu QWAC na VPS — integracja e-Doręczenia (ADE)

Certyfikat QWAC służy **wyłącznie** jako certyfikat klienta (mTLS) dla połączeń wychodzących z aplikacji Concertivo do API e-Doręczeń. Nie ma wpływu na HTTPS strony `concertivo.eu` — tam nadal działa Let's Encrypt zarządzany przez Caddy.

Docelowe pliki na serwerze (już istnieją klucz i CSR):

| Plik | Ścieżka | Uwagi |
|------|---------|-------|
| Klucz prywatny | `/etc/ssl/concertivo/concertivo-qwac.key` | NIGDY nie wysyłaj nikomu, chmod `600` |
| CSR | `/etc/ssl/concertivo/concertivo-qwac.csr` | Publiczny, można wygenerować ponownie z klucza |
| Certyfikat od CenCert | `/etc/ssl/concertivo/concertivo-qwac.crt` | Do utworzenia teraz |

---

## 1. Zapisz certyfikat na serwerze

Skopiuj **cały** tekst, który przysłał CenCert — od linii:

```text
-----BEGIN CERTIFICATE-----
```

do:

```text
-----END CERTIFICATE-----
```

Wklej go w web terminalu Hostingera jako plik:

```bash
sudo tee /etc/ssl/concertivo/concertivo-qwac.crt <<'EOF'
-----BEGIN CERTIFICATE-----
<wklej tu całą zawartość certyfikatu CenCert, wiersz po wierszu>
-----END CERTIFICATE-----
EOF

sudo chown root:root /etc/ssl/concertivo/concertivo-qwac.crt
sudo chmod 644 /etc/ssl/concertivo/concertivo-qwac.crt
```

> **Wskazówka:** zamiast `<<'EOF'` możesz też użyć edytora `nano`:
> ```bash
> sudo nano /etc/ssl/concertivo/concertivo-qwac.crt
> ```
> i wkleić certyfikat, potem `Ctrl+O`, `Enter`, `Ctrl+X`.

---

## 2. Zweryfikuj, że certyfikat jest poprawny

Sprawdź dane w certyfikacie:

```bash
sudo openssl x509 -in /etc/ssl/concertivo/concertivo-qwac.crt -noout -text | head -40
```

W wyniku powinieneś zobaczyć m.in.:

```text
Subject: ... CN = concertivo.eu, serialNumber = NTRPL-6423129046 ...
Subject Alternative Name: DNS:concertivo.eu, DNS:www.concertivo.eu
Issuer: ... CenCert ...
```

---

## 3. Sprawdź, czy certyfikat pasuje do klucza prywatnego

To najważniejszy krok — upewnij się, że CenCert wydał certyfikat dla właściwego klucza, który masz na serwerze.

```bash
# Modulus z certyfikatu
sudo openssl x509 -in /etc/ssl/concertivo/concertivo-qwac.crt -noout -modulus | openssl md5

# Modulus z klucza prywatnego
sudo openssl rsa -in /etc/ssl/concertivo/concertivo-qwac.key -noout -modulus | openssl md5
```

**Oba wyniki muszą być identyczne.** Jeśli się różnią, certyfikat nie pasuje do klucza i integracja nie zadziała.

---

## 4. Sprawdź daty ważności

```bash
sudo openssl x509 -in /etc/ssl/concertivo/concertivo-qwac.crt -noout -dates
```

Zapisz datę `notAfter` w kalendarzu — certyfikat trzeba będzie odnowić przed jej upływem (zazwyczaj co 1–2 lata).

---

## 5. Uprawnienia i bezpieczeństwo plików

Upewnij się, że klucz jest dobrze zabezpieczony:

```bash
sudo chown root:root /etc/ssl/concertivo/concertivo-qwac.key
sudo chmod 600 /etc/ssl/concertivo/concertivo-qwac.key

sudo ls -la /etc/ssl/concertivo/
```

Oczekiwany wynik:

```text
-rw-r--r-- 1 root root ... concertivo-qwac.crt
-rw------- 1 root root ... concertivo-qwac.key
-rw-r--r-- 1 root root ... concertivo-qwac.csr
```

---

## 6. Dodaj zmienne środowiskowe dla aplikacji

Edytuj plik sekretów na VPS:

```bash
sudo nano /var/www/concertivo/.env.production
```

Dodaj na końcu:

```bash
# QWAC client cert for e-Doręczenia (ADE) API
ADE_QWAC_CERT_PATH=/etc/ssl/concertivo/concertivo-qwac.crt
ADE_QWAC_KEY_PATH=/etc/ssl/concertivo/concertivo-qwac.key
```

Jeśli klucz był chroniony hasłem przy generowaniu (w naszym przypadku nie był), dodaj też:

```bash
ADE_QWAC_KEY_PASSPHRASE=...
```

Zapisz plik (`Ctrl+O`, `Enter`, `Ctrl+X`) i zabezpiecz go:

```bash
sudo chmod 600 /var/www/concertivo/.env.production
```

> **Uwaga:** PM2 musi zostać przeładowany, żeby nowe zmienne zostały wczytane. Zrobimy to w kroku 8.

---

## 7. Zarejestruj certyfikat w panelu e-Doręczeń

Certyfikat publiczny (`concertivo-qwac.crt`) musisz wgrać do skrzynki e-Doręczenia, żeby system ADE zaufał aplikacji Concertivo.

Kroki w panelu biznes.gov.pl:

1. Zaloguj się i wejdź w **Moje konto → e-Doręczenia**.
2. Wybierz swoją skrzynkę (np. `AE:PL-...`).
3. Wejdź w zakładkę **Uprawnienia** → **Systemy**.
4. Kliknij **Dodaj system**.
5. Wypełnij:
   - **Nazwa systemu:** `Concertivo` (lub jak chcesz)
   - **Opis:** opcjonalnie
   - **Kwalifikowany środek uwierzytelniania:** wybierz plik `/etc/ssl/concertivo/concertivo-qwac.crt` lub wklej jego zawartość.
6. Zapisz.

---

## 8. Przeładuj aplikację, aby wczytała nowe env

Po dodaniu zmiennych do `.env.production` wykonaj:

```bash
cd /var/www/concertivo
pm2 reload concertivo --update-env
```

Sprawdź, czy aplikacja nadal działa:

```bash
curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/
```

Powinien pojawić się kod `200` (lub `401`/`403`, jeśli strona główna jest chroniona — też oznacza, że serwer żyje).

---

## 9. Przygotowanie kodu aplikacji (krok następny)

Aby Concertivo faktycznie używało certyfikatu przy wywołaniach do API ADE, w kodzie serwerowym trzeba będzie użyć klienta HTTPS z podpiętym certyfikatem. Przykład w Node.js:

```javascript
import { readFileSync } from "fs";
import https from "https";

const agent = new https.Agent({
  cert: readFileSync(process.env.ADE_QWAC_CERT_PATH!),
  key: readFileSync(process.env.ADE_QWAC_KEY_PATH!),
});

// fetch do API ADE z użyciem agenta
const res = await fetch("https://api.e-doręczenia.gov.pl/...", { agent });
```

To zaimplementujemy w kolejnym kroku, kiedy będziemy podłączać konkretne endpointy (np. wysyłka / odbiór).

---

## 10. Test certyfikatu (po wdrożeniu kodu)

Po zaimplementowaniu kodu przetestujemy połączenie z sandboxem/produkcją API ADE. Przedtem można sprawdzić, czy certyfikat jest technicznie poprawny:

```bash
# Test mTLS do serwera ADE (zastąp URL, gdy podamy adres endpointu)
openssl s_client -connect api.e-doręczenia.gov.pl:443 \
  -cert /etc/ssl/concertivo/concertivo-qwac.crt \
  -key /etc/ssl/concertivo/concertivo-qwac.key \
  -showcerts
```

Jeśli połączenie się zestawi i nie zwróci błędu `verify error`, certyfikat działa.

---

## Podsumowanie — co już musi być gotowe

- [ ] Certyfikat CenCert zapisany jako `/etc/ssl/concertivo/concertivo-qwac.crt`
- [ ] Certyfikat pasuje do klucza prywatnego (`-modulus` daje ten sam hash)
- [ ] Klucz prywatny ma `chmod 600` i jest w `/etc/ssl/concertivo/concertivo-qwac.key`
- [ ] Dodane env vars `ADE_QWAC_CERT_PATH` i `ADE_QWAC_KEY_PATH` w `.env.production`
- [ ] Aplikacja przeładowana przez `pm2 reload concertivo --update-env`
- [ ] Certyfikat publiczny wgrany do panelu e-Doręczenia (Uprawnienia → Systemy)
- [ ] Kopia zapasowa klucza prywatnego w bezpiecznym miejscu (menedżer haseł / zaszyfrowany dysk)

Gdy powyższe kroki będą gotowe, przejdziemy do implementacji wywołań API ADE (wysyłka / odbiór e-Doręczeń).
