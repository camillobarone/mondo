#!/usr/bin/env bash
#
# Manda l'ultima copia di sicurezza fuori dal server, su Google Drive.
#
# Gira ogni domenica da solo, tramite il cron scritto da scrivi_cron() in
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

registra() { echo "$(date -Iseconds)  $*" >> "$REGISTRO"; }

if ! command -v rclone >/dev/null 2>&1; then
  registra "rclone non è installato: copia esterna saltata."
  exit 0
fi

# Quale configurazione di rclone usare.
#
# Qui si e' gia' perso un mese di copie, dal 14 agosto al 17 settembre 2026: la
# guida fa collegare rclone da root, ma il cron girava come 'mondo', che
# /root/.config non puo' leggere. Risultato: 'rclone listremotes' vuoto, copia
# saltata ogni volta, e nel registro un generico "non e' ancora collegato" che
# sembrava un collegamento mai fatto invece di un file fuori portata.
#
# Adesso il file si cerca per nome, in ordine, e quando manca il registro dice
# dove ha guardato e con quale utente: basta leggere quella riga per capire.
CANDIDATE=(
  "${RCLONE_CONFIG:-}"                          # scelta esplicita di chi lancia
  /etc/mondo-crm-rclone.conf                    # posto dedicato al gestionale
  "${HOME:-/root}/.config/rclone/rclone.conf"   # l'utente che sta girando
  /root/.config/rclone/rclone.conf              # dove la guida la fa creare
)

CONFIG=""
CERCATE=()
for file in "${CANDIDATE[@]}"; do
  [[ -n "$file" ]] || continue
  # Niente doppioni nel registro quando HOME e' gia' /root.
  [[ " ${CERCATE[*]-} " == *" $file "* ]] && continue
  CERCATE+=("$file")
  [[ -r "$file" ]] || continue
  CONFIG="$file"
  break
done

if [[ -z "$CONFIG" ]]; then
  registra "configurazione di rclone non trovata da utente $(id -un). Cercata in: ${CERCATE[*]}. Copia esterna saltata."
  exit 0
fi
export RCLONE_CONFIG="$CONFIG"

if ! rclone listremotes 2>/dev/null | grep -q '^gdrive:'; then
  registra "in $CONFIG non c'è nessun collegamento chiamato 'gdrive': copia esterna saltata."
  exit 0
fi

# L'ultima copia notturna, non tutte e sessanta: qui basta la piu' recente,
# la settimana scorsa e' gia' su Drive dalla volta precedente.
#
# Il '|| true' non e' decorativo: quando in backup/ non c'e' ancora nessun .db
# il glob non si espande, 'ls' esce con errore e — fra 'set -e' e 'pipefail' —
# lo script moriva qui, senza scrivere niente nel registro. Proprio il caso in
# cui una riga servirebbe.
ULTIMA="$(ls -t backup/mondo-*.db 2>/dev/null | head -1 || true)"
if [[ -z "$ULTIMA" ]]; then
  registra "nessuna copia notturna trovata, niente da mandare."
  exit 0
fi

rclone copy "$ULTIMA" "$REMOTO/database/" --log-file="$REGISTRO" --log-level INFO
# Le foto non cambiano una volta scritte: --update manda solo quelle nuove
# dall'ultima volta, invece di ricaricare ogni volta tutto l'archivio.
if [[ -d backup/foto ]]; then
  rclone copy backup/foto "$REMOTO/foto/" --log-file="$REGISTRO" --log-level INFO --update
fi

registra "inviati $(basename "$ULTIMA") e le foto a $REMOTO"
