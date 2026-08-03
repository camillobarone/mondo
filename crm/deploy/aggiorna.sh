#!/usr/bin/env bash
#
# Aggiornamento del gestionale gia' installato.
#
#   sudo bash /opt/mondo-crm/deploy/aggiorna.sh
#
# Scarica l'ultima versione, ricompila e riavvia. I dati non vengono toccati:
# prima di ogni aggiornamento ne viene comunque fatta una copia.

set -euo pipefail

CARTELLA="/opt/mondo-crm"
UTENTE="mondo"
ARCHIVIO="https://github.com/camillobarone/mondo/archive/refs/heads/claude/real-estate-client-management-app-xl7dnx.tar.gz"

if [[ $EUID -ne 0 ]]; then
  echo "Serve eseguirlo come amministratore: anteponi 'sudo'."
  exit 1
fi

echo "== 1/4  Copia di sicurezza prima di toccare qualsiasi cosa =================="
sudo -u "$UTENTE" bash -c "cd '$CARTELLA' && node scripts/backup.mjs" | tail -2

echo "== 2/4  Scarico l'ultima versione =========================================="
TEMP="$(mktemp -d)"
curl -fsSL "$ARCHIVIO" | tar xz -C "$TEMP" --strip-components=1
rsync -a --delete --exclude data --exclude backup --exclude node_modules \
  "$TEMP/crm/" "$CARTELLA/"
rm -rf "$TEMP"
chown -R "$UTENTE:$UTENTE" "$CARTELLA"

echo "== 3/4  Compilo ============================================================"
sudo -u "$UTENTE" bash -c "cd '$CARTELLA' && npm install --no-audit --no-fund --silent && npm run build >/dev/null"

echo "== 4/4  Riavvio ============================================================"
systemctl restart mondo-crm
sleep 3
systemctl is-active --quiet mondo-crm && echo "   Il gestionale e' ripartito." || {
  echo "   NON e' ripartito. Cosa dice:"
  journalctl -u mondo-crm -n 30 --no-pager
  exit 1
}
