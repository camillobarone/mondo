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
REPO="git@github.com:camillobarone/mondo-crm.git"
RAMO="main"
# Chiave di SOLA LETTURA per questo solo archivio. Si crea una volta sola:
# istruzioni in deploy/CHIAVE-GITHUB.md. Sta qui e non un token in un file
# perche' una chiave non scade e non serve a nient'altro che a leggere questo.
CHIAVE="/root/.ssh/mondo_crm_deploy"

if [[ $EUID -ne 0 ]]; then
  echo "Serve eseguirlo come amministratore: anteponi 'sudo'."
  exit 1
fi

if [[ ! -f "$CHIAVE" ]]; then
  echo "Manca la chiave di sola lettura per GitHub: $CHIAVE"
  echo "Si crea una volta sola, le istruzioni sono in $CARTELLA/deploy/CHIAVE-GITHUB.md"
  exit 1
fi
export GIT_SSH_COMMAND="ssh -i $CHIAVE -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

command -v git >/dev/null || { apt-get update -qq && apt-get install -y -qq git; }

echo "== 1/4  Copia di sicurezza prima di toccare qualsiasi cosa =================="
sudo -u "$UTENTE" bash -c "cd '$CARTELLA' && node scripts/backup.mjs" | tail -2

echo "== 2/4  Scarico l'ultima versione =========================================="
TEMP="$(mktemp -d)"
if ! git clone --quiet --depth 1 --branch "$RAMO" "$REPO" "$TEMP"; then
  echo "   Non riesco a leggere l'archivio su GitHub."
  echo "   Di solito e' la chiave non ancora aggiunta fra le Deploy keys del progetto."
  echo "   Prova: GIT_SSH_COMMAND=\"ssh -i $CHIAVE\" ssh -T git@github.com"
  rm -rf "$TEMP"
  exit 1
fi
# Le esclusioni sono ancorate alla radice (/data, non data): senza la sbarra
# varrebbero per qualsiasi cartella con quel nome dentro il programma, comprese
# eventuali pagine, che verrebbero cancellate dal server a ogni aggiornamento.
rsync -a --delete --exclude /data --exclude /backup --exclude /node_modules \
  --exclude /.git "$TEMP/" "$CARTELLA/"
rm -rf "$TEMP"
chown -R "$UTENTE:$UTENTE" "$CARTELLA"

echo "== 3/4  Compilo ============================================================"
REGISTRO=/tmp/mondo-aggiornamento.log
if ! sudo -u "$UTENTE" bash -c "cd '$CARTELLA' && npm install --no-audit --no-fund && npm run build" > "$REGISTRO" 2>&1; then
  echo "   NON RIUSCITA. Ultime righe:"
  tail -25 "$REGISTRO" | sed 's/^/   /'
  echo "   Il gestionale sta ancora girando con la versione precedente."
  exit 1
fi

echo "== 4/4  Servizio, avvisi e riavvio ========================================="
# Anche il servizio e il cron vanno riallineati: quando una versione nuova
# aggiunge un lavoro schedulato o cambia il fuso orario, aggiornare solo il
# programma lo lascerebbe fuori. Il file della posta, se c'e' gia', non si tocca.
DOMINIO="$(awk '/server_name/ {print $2}' /etc/nginx/sites-available/mondo-crm | tr -d ';' | head -1)"
if [[ -n "$DOMINIO" ]]; then
  # shellcheck source=servizi.sh
  source "$CARTELLA/deploy/servizi.sh"
  scrivi_servizio
  scrivi_posta
  scrivi_cron
else
  echo "   Dominio non ricavabile da nginx: servizio e cron lasciati come sono."
fi

systemctl restart mondo-crm
sleep 3
systemctl is-active --quiet mondo-crm && echo "   Il gestionale e' ripartito." || {
  echo "   NON e' ripartito. Cosa dice:"
  journalctl -u mondo-crm -n 30 --no-pager
  exit 1
}
