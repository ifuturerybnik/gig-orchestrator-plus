#!/usr/bin/env bash
# Concertivo — wrapper dla aktualizacji VPS.
# Użycie na serwerze: cd /var/www/concertivo && ./update.sh

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/vps/update.sh" "$@"