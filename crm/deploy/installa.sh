#!/usr/bin/env bash
#
# Installazione del gestionale su un server Ubuntu appena creato.
#
#   sudo bash installa.sh gestionale.tuodominio.it tua@email.it
#
# Al termine il programma e' raggiungibile in HTTPS, riparte da solo a ogni
# riavvio del server e fa una copia di sicurezza ogni notte.
#
# Lo script si puo' rilanciare: i passi gia' fatti vengono saltati e i dati
# non vengono mai toccati.

set -euo pipefail

DOMINIO="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMINIO" || -z "$EMAIL" ]]; then
  echo "Uso: sudo bash installa.sh <dominio> <email>"
  echo "Esempio: sudo bash installa.sh gestionale.mondoimmobiliarelecce.it info@mondoimmobiliarelecce.it"
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "Serve eseguirlo come amministratore: anteponi 'sudo'."
  exit 1
fi

ARCHIVIO="https://github.com/camillobarone/mondo/archive/refs/heads/claude/real-estate-client-management-app-xl7dnx.tar.gz"
CARTELLA="/opt/mondo-crm"
UTENTE="mondo"

echo
echo "== 1/9  Aggiornamento del sistema =========================================="
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
# build-essential e python3 servono a compilare i componenti nativi quando per
# la piattaforma non esiste un binario gia' pronto: senza, l'installazione si
# ferma con "not found: make".
apt-get install -y -qq curl ca-certificates gnupg rsync nginx ufw cron \
  build-essential python3 >/dev/null

echo "== 2/9  Node.js 22 ========================================================="
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "   Node $(node -v)"

echo "== 3/9  Memoria di scambio ================================================="
# La compilazione arriva a sfiorare 1 GB. Su un server da 2 GB ci sta, ma senza
# margine: un file di scambio evita che venga uccisa a meta' lasciando il
# gestionale a terra. Su macchine piu' grandi non serve.
RAM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [[ "$RAM_MB" -lt 3000 && ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "   ${RAM_MB} MB di RAM: aggiunti 2 GB di scambio."
else
  echo "   ${RAM_MB} MB di RAM: sufficiente, nessuno scambio necessario."
fi

echo "== 4/9  Utente dedicato ===================================================="
# Il programma non gira come amministratore: se qualcosa va storto, i danni
# restano dentro la sua cartella.
id -u "$UTENTE" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$UTENTE"

echo "== 5/9  Programma =========================================================="
mkdir -p "$CARTELLA"
TEMP="$(mktemp -d)"
curl -fsSL "$ARCHIVIO" | tar xz -C "$TEMP" --strip-components=1
# I dati non si toccano mai: si sostituisce solo il programma.
rsync -a --delete --exclude data --exclude backup --exclude node_modules \
  "$TEMP/crm/" "$CARTELLA/"
rm -rf "$TEMP"
mkdir -p "$CARTELLA/data" "$CARTELLA/backup"
chown -R "$UTENTE:$UTENTE" "$CARTELLA"

echo "   Installazione delle dipendenze e compilazione (un paio di minuti)…"
# L'output va in un file, ma se qualcosa fallisce viene mostrato: un errore
# silenzioso qui lascia l'installazione a meta' senza dire perche'.
REGISTRO=/tmp/mondo-installazione.log
if ! sudo -u "$UTENTE" bash -c "cd '$CARTELLA' && npm install --no-audit --no-fund" > "$REGISTRO" 2>&1; then
  echo
  echo "   NON RIUSCITA. Ultime righe dell'errore:"
  echo "   ------------------------------------------------------------------"
  tail -25 "$REGISTRO" | sed 's/^/   /'
  echo "   ------------------------------------------------------------------"
  echo "   Registro completo: $REGISTRO"
  exit 1
fi
if ! sudo -u "$UTENTE" bash -c "cd '$CARTELLA' && npm run build" >> "$REGISTRO" 2>&1; then
  echo
  echo "   COMPILAZIONE NON RIUSCITA. Ultime righe:"
  echo "   ------------------------------------------------------------------"
  tail -25 "$REGISTRO" | sed 's/^/   /'
  echo "   ------------------------------------------------------------------"
  exit 1
fi

echo "== 6/9  Avvio automatico ==================================================="
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
systemctl enable --now mondo-crm >/dev/null
sleep 3

echo "== 7/9  Indirizzo web ======================================================"
# Non tutti i server hanno IPv6: se manca, quella riga impedirebbe a nginx
# di partire, e il gestionale non risponderebbe affatto.
ASCOLTA_IPV6=""
[[ -f /proc/net/if_inet6 ]] && ASCOLTA_IPV6="    listen [::]:80;"

cat > /etc/nginx/sites-available/mondo-crm <<NGINX
server {
    listen 80;
$ASCOLTA_IPV6
    server_name $DOMINIO;

    # L'importazione dell'archivio invia il file intero: il limite
    # predefinito di 1 MB lo bloccherebbe.
    client_max_body_size 32M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        # Da questa intestazione il programma capisce che la connessione e'
        # cifrata, e marca il cookie di sessione di conseguenza.
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/mondo-crm /etc/nginx/sites-enabled/mondo-crm
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null
systemctl reload nginx

echo "== 8/9  Firewall e certificato HTTPS ======================================="
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
if certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos -m "$EMAIL" --redirect >/dev/null 2>&1; then
  echo "   Certificato attivo, rinnovo automatico."
  HTTPS=1
else
  echo "   ATTENZIONE: certificato non rilasciato."
  echo "   Quasi sempre significa che $DOMINIO non punta ancora a questo server."
  echo "   Sistema il DNS e rilancia:  sudo certbot --nginx -d $DOMINIO"
  HTTPS=0
fi

echo "== 9/9  Copia di sicurezza notturna ========================================"
cat > /etc/cron.d/mondo-crm <<CRON
# Copia dell'archivio ogni notte alle 2. Le copie oltre i 60 giorni si
# cancellano da sole.
0 2 * * * $UTENTE cd $CARTELLA && /usr/bin/node scripts/backup.mjs >> $CARTELLA/backup/backup.log 2>&1
CRON
chmod 644 /etc/cron.d/mondo-crm

echo
echo "==========================================================================="
# Il primo utente si crea sempre: `seed` non tocca niente se esiste gia'.
# Non si puo' usare l'esistenza del file come indizio — il programma, appena
# avviato al passo 6, se lo crea da solo, e il controllo salterebbe la
# creazione dell'utente lasciando un gestionale in cui non si entra.
sudo -u "$UTENTE" bash -c "cd '$CARTELLA' && node scripts/seed.mjs --email '$EMAIL'" 2>/dev/null
chown -R "$UTENTE:$UTENTE" "$CARTELLA/data"
systemctl restart mondo-crm

echo
if [[ "$HTTPS" == "1" ]]; then
  echo " Fatto. Il gestionale e' su:  https://$DOMINIO"
else
  echo " Fatto, ma senza HTTPS. Sistema il DNS, poi:  sudo certbot --nginx -d $DOMINIO"
fi
echo
echo " Per aggiornarlo in futuro:   sudo bash $CARTELLA/deploy/aggiorna.sh"
echo " Per vedere se sta bene:      systemctl status mondo-crm"
echo "==========================================================================="
