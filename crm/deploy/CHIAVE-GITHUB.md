# La chiave per leggere l'archivio su GitHub

L'archivio `camillobarone/mondo-crm` e' **privato**: il server non puo' piu'
scaricarlo senza presentarsi. Gli serve una chiave di **sola lettura**, valida
per questo solo archivio. Si fa una volta sola, in quattro passi.

La chiave privata **non esce mai dal server** e non va incollata da nessuna
parte: si copia solo quella pubblica, che di per se' non apre niente.

---

## Passo 1 — creare la chiave sul server

    ssh root@77.81.234.151 "ssh-keygen -t ed25519 -N '' -C mondo-crm-deploy -f /root/.ssh/mondo_crm_deploy <<< y"

## Passo 2 — leggere la chiave pubblica

    ssh root@77.81.234.151 "cat /root/.ssh/mondo_crm_deploy.pub"

Copia la riga intera che stampa: comincia con `ssh-ed25519`.

## Passo 3 — incollarla su GitHub

Su `github.com/camillobarone/mondo-crm` → **Settings** → **Deploy keys** →
**Add deploy key**. Titolo: `VPS Aruba`. Nel riquadro grande incolla la riga del
passo 2. **Non** spuntare *Allow write access*: al server serve leggere, non
scrivere.

## Passo 4 — provare che funziona

    ssh root@77.81.234.151 "GIT_SSH_COMMAND='ssh -i /root/.ssh/mondo_crm_deploy' git ls-remote git@github.com:camillobarone/mondo-crm.git | head -1"

Se stampa una riga con un codice lungo e `refs/heads/main`, la chiave e' a
posto. Se dice `Permission denied (publickey)`, la chiave pubblica non e'
ancora fra le Deploy keys, oppure e' stata incollata a meta'.

---

Da qui in poi l'aggiornamento torna a essere il comando di sempre:

    ssh root@77.81.234.151 "bash /opt/mondo-crm/deploy/aggiorna.sh"
