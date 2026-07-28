# Deploy Concertivo na VPS

Zalecana komenda aktualizacji produkcji:

```bash
cd /var/www/concertivo && bash update.sh
```

Nie używamy już ręcznie `git pull` ani `bun run build` na VPS, bo:

- `git pull` potrafi zatrzymać deploy przez lokalnie wygenerowane pliki, np. `src/routeTree.gen.ts`,
- zwykłe `bun run build` tworzy inny build niż ten, który serwuje VPS,
- `update.sh` robi deterministycznie: `git fetch` → `git reset --hard origin/main` → `bun run build:vps` → `pm2 reload` → healthcheck.

Jeżeli lokalnie na VPS pojawiły się zmiany, skrypt zapisze ich kopię jako patch w `/tmp/concertivo-local-changes.<data>.patch`, ale produkcję nadpisze wersją z GitHub.

Po deployu w przeglądarce wykonaj twardy refresh: `Cmd/Ctrl + Shift + R`.