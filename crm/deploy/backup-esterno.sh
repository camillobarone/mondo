#!/usr/bin/env bash
#
# Manda l'ultima copia di sicurezza fuori dal server, su Google Drive.
#
# Gira una volta al mese da solo, tramite il cron scritto da scrivi_cron() in
# servizi.sh. Prende l'ultima copia notturna del database (quella di
# backup.mjs, gia' pronta in backup/) e le foto, e le manda con rclone.
#
# Rclone va collegato a Google Drive una volta sola, a mano:
#   guida in deploy/README.md, sezione "Copia fuori dal server".
# Finche' non e' collegato questo script esce senza fare danni: non tocca
# database ne' foto, si limita a scriverlo nel registro.

set -euo pipefail

CARTELLA="${CARTELLA:-/opt/mondo-crm}"
REMOTO="gdrive:mondo-crm-backup"
REGISTRO="$CARTELLA/backup/esterno.log"

cd "$CARTELLA"

if ! command -v rclone >/dev/null 2>&1; then
  echo "$(date -Iseconds)  rclone non è installato: copia esterna saltata." >> "$REGISTRO"
  exit 0
fi

if ! rclone listremotes 2>/dev/null | grep -q '^gdrive:'; then
  echo "$(date -Iseconds)  rclone non è ancora collegato a Google Drive: copia esterna saltata." >> "$REGISTRO"
  exit 0
fi

# L'ultima copia notturna, non tutte e sessanta: qui basta la piu' recente,
# il mese scorso e' gia' su Drive dalla volta precedente.
ULTIMA="$(ls -t backup/mondo-*.db 2>/dev/null | head -1)"
if [[ -z "$ULTIMA" ]]; then
  echo "$(date -Iseconds)  nessuna copia notturna trovata, niente da mandare." >> "$REGISTRO"
  exit 0
fi

rclone copy "$ULTIMA" "$REMOTO/database/" --log-file="$REGISTRO" --log-level INFO
# Le foto non cambiano una volta scritte: --update manda solo quelle nuove
# dall'ultima volta, invece di ricaricare ogni mese tutto l'archivio.
if [[ -d backup/foto ]]; then
  rclone copy backup/foto "$REMOTO/foto/" --log-file="$REGISTRO" --log-level INFO --update
fi

echo "$(date -Iseconds)  inviati $(basename "$ULTIMA") e le foto a $REMOTO" >> "$REGISTRO"
