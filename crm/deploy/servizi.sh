#!/usr/bin/env bash
#
# Il servizio di avvio automatico, il cron e il file della posta.
#
# Sta in un pezzo a parte perche' lo usano sia installa.sh sia aggiorna.sh:
# quando qui dentro cambia qualcosa — un fuso orario, un lavoro schedulato —
# un aggiornamento deve applicarlo, non solo un'installazione da zero.
#
# Si aspetta gia' impostate: CARTELLA, UTENTE, DOMINIO.

scrivi_servizio() {
  cat > /etc/systemd/system/mondo-crm.service <<SERVICE
[Unit]
Description=Mondo Immobiliare - gestionale clienti
After=network.target

[Service]
Type=simple
User=$UTENTE
WorkingDirectory=$CARTELLA
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
# Il fuso orario del programma. Un server appena installato sta su UTC, e gli
# appuntamenti si leggerebbero con due ore di scarto.
Environment=TZ=Europe/Rome
Environment=CRM_BASE_URL=https://$DOMINIO
# Configurazione della posta per l'avviso 30 minuti prima. Sta fuori dalla
# cartella del programma per non essere sovrascritta a ogni aggiornamento.
# Finche' e' vuota l'avviso per email non parte: il resto funziona lo stesso.
EnvironmentFile=-/etc/mondo-crm.env
ExecStart=$CARTELLA/node_modules/.bin/next start
Restart=always
RestartSec=5

# Il programma vede solo la propria cartella.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$CARTELLA/data $CARTELLA/backup $CARTELLA/.next

[Install]
WantedBy=multi-user.target
SERVICE
  systemctl daemon-reload
}

scrivi_posta() {
  # Se c'e' gia' non si tocca: dentro ci sono le credenziali della casella, e
  # riscriverlo a ogni aggiornamento le cancellerebbe.
  [[ -f /etc/mondo-crm.env ]] && return 0

  cat > /etc/mondo-crm.env <<'POSTA'
# Avviso per email 30 minuti prima degli appuntamenti.
# Compila queste righe con i dati della tua casella, poi:
#   systemctl restart mondo-crm
# Finche' restano vuote l'avviso non parte, e il resto funziona lo stesso.
#
# Se la password contiene spazi, apici o il simbolo del dollaro, mettila fra
# apici singoli:  SMTP_PASS='pa$$word con spazi'
#
# Esempio con la posta Aruba:
#   SMTP_HOST=smtps.aruba.it
#   SMTP_PORT=465
#   SMTP_USER=info@tuodominio.it
#   SMTP_PASS=la-password-della-casella
#   SMTP_FROM=info@tuodominio.it
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
POSTA

  # Ci finisce una password: la leggono solo root e il programma.
  chmod 640 /etc/mondo-crm.env
  chown root:"$UTENTE" /etc/mondo-crm.env
}

scrivi_cron() {
  cat > /etc/cron.d/mondo-crm <<CRON
TZ=Europe/Rome
# Copia dell'archivio ogni notte alle 2. Le copie oltre i 60 giorni si
# cancellano da sole.
0 2 * * * $UTENTE cd $CARTELLA && /usr/bin/node scripts/backup.mjs >> $CARTELLA/backup/backup.log 2>&1
# Copia fuori dal server, il primo di ogni mese alle 3 — un'ora dopo quella
# notturna, cosi' trova sempre una copia fresca pronta da mandare. Finche'
# rclone non e' installato e collegato a Google Drive non fa nulla di male.
0 3 1 * * $UTENTE cd $CARTELLA && bash deploy/backup-esterno.sh
# Avviso per email 30 minuti prima degli appuntamenti. Gira ogni 5 minuti;
# senza la configurazione della posta esce subito senza fare niente.
*/5 * * * * $UTENTE set -a; . /etc/mondo-crm.env; set +a; cd $CARTELLA && CRM_BASE_URL=https://$DOMINIO /usr/bin/node scripts/promemoria.mjs >> $CARTELLA/backup/promemoria.log 2>&1
CRON
  chmod 644 /etc/cron.d/mondo-crm
}
