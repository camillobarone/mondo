# Metterlo online su un server

Quindici minuti, di cui dieci di attesa. Alla fine il gestionale è raggiungibile
da qualsiasi computer o telefono, con il lucchetto verde, e si tiene in piedi da
solo: riparte dopo un riavvio, fa una copia di sicurezza ogni notte, rinnova il
certificato da sé.

---

## 1 · Il server

Serve una macchina Linux con **Ubuntu 24.04**, e due requisiti da non sbagliare:

- **IPv4 pubblico.** I piani solo-IPv6 costano meno ma non sono raggiungibili
  dalla maggior parte delle connessioni italiane: il gestionale non si
  aprirebbe.
- **Almeno 2 GB di RAM.** La compilazione del programma tocca i 900 MB: con
  1 GB viene interrotta a metà. Sotto i 3 GB lo script aggiunge da sé 2 GB di
  memoria di scambio, così il margine c'è comunque.

40 GB di disco sono abbondanti: l'archivio pesa pochi megabyte, le foto qualche
centinaio.

| | Dove stanno i dati | Indicativo |
|---|---|---|
| **Aruba Cloud** | Italia (Arezzo, Bergamo) | ~4,50 €/mese + IVA |
| **Hetzner** | Germania, Finlandia | ~4,50 €/mese + IVA |

Entrambi sono nell'Unione Europea e forniscono l'accordo sul trattamento dei
dati (art. 28 GDPR) che serve avere agli atti: sono loro i responsabili del
trattamento, tu il titolare.

Quando crei il server, scegli **Ubuntu 24.04** e carica la tua chiave SSH (o
annota la password di root che ti viene mostrata). Segnati l'**indirizzo IP**.

## 2 · Il nome

Nel pannello dove gestisci il dominio dell'agenzia, aggiungi un record:

```
Tipo: A     Nome: gestionale     Valore: <IP del server>
```

Ottieni `gestionale.tuodominio.it`. Il DNS può metterci da pochi minuti a
qualche ora: prima di procedere verifica che risponda.

```bash
ping gestionale.tuodominio.it     # deve rispondere l'IP del server
```

## 3 · L'installazione

Collegati al server e lancia una riga sola:

```bash
ssh root@<IP del server>

curl -fsSL https://raw.githubusercontent.com/camillobarone/mondo/claude/real-estate-client-management-app-xl7dnx/crm/deploy/installa.sh \
  | bash -s -- gestionale.tuodominio.it tua@email.it
```

Lo script fa tutto: Node.js, il programma, l'avvio automatico, l'indirizzo web,
il firewall, il certificato HTTPS e la copia notturna.

Alla fine stampa **email e password del primo utente**: annotale subito.

Poi apri **https://gestionale.tuodominio.it**.

---

## Da lì in avanti

**Aggiornare** — quando c'è una versione nuova:

```bash
ssh root@<IP> 'bash /opt/mondo-crm/deploy/aggiorna.sh'
```

Fa una copia di sicurezza prima di toccare qualsiasi cosa, e se il programma non
riparte te lo dice invece di lasciarti al buio.

**Vedere se sta bene:**

```bash
systemctl status mondo-crm      # acceso o spento
journalctl -u mondo-crm -n 50   # cos'è successo
```

**Le copie di sicurezza** finiscono in `/opt/mondo-crm/backup/`, una a notte,
quelle oltre i 60 giorni si cancellano da sole.

> ⚠️ Una copia sullo stesso server non è una copia. Se quel disco muore, muore
> con lui. **Portane una fuori**, in un posto diverso.
>
> La via automatica è sotto, "Copia fuori dal server": una volta collegata,
> il server manda da solo l'ultima copia su Google Drive ogni mese. In più, a
> mano, quando vuoi:
>
> ```bash
> scp root@<IP>:/opt/mondo-crm/backup/*.db .
> ```

**Copia fuori dal server** — da collegare una volta sola, poi funziona da sé:

```bash
curl https://rclone.org/install.sh | sudo bash
rclone config
```

`rclone config` fa qualche domanda, una alla volta:

1. `n` — nuovo collegamento (new remote)
2. Nome: `gdrive` (esattamente così, minuscolo — lo script lo cerca con questo nome)
3. Tipo di spazio: cerca nell'elenco quello con scritto `Google Drive`, e scrivi il suo numero
4. `client_id` — vuoto, premi solo Invio
5. `client_secret` — vuoto, premi solo Invio
6. `scope` — `1` (accesso completo)
7. `root_folder_id` — vuoto, premi solo Invio
8. `service_account_file` — vuoto, premi solo Invio
9. `Edit advanced config?` — `n`
10. `Use auto config?` — `n` (il server non ha un browser). Compare un indirizzo lungo: aprilo su un browser qualsiasi — anche dal telefono — accedi con l'account Google dove vuoi salvare le copie, e incolla nel terminale il codice che ti dà alla fine
11. `Configure this as a Shared Drive?` — `n`
12. `y` poi `q` per chiudere

Da quel momento il collegamento resta. Il primo giorno di ogni mese, alle 3 di
notte, il server manda da solo l'ultima copia dell'archivio e le foto nuove
dentro una cartella `mondo-crm-backup` su quel Google Drive. Per controllare
che sia partita bene, il mese dopo:

```bash
cat /opt/mondo-crm/backup/esterno.log
```

**Ripristinare** una copia:

```bash
systemctl stop mondo-crm
cp /opt/mondo-crm/backup/<copia>.db /opt/mondo-crm/data/mondo.db
chown mondo:mondo /opt/mondo-crm/data/mondo.db
systemctl start mondo-crm
```

L'ordine conta: **prima si ferma il programma**, altrimenti continua a usare il
file vecchio e le modifiche finiscono nel nulla.

---

## Come si porta dentro l'archivio

L'archivio si carica dalla schermata **Importa**, dal browser, come in locale.
Il file esportato dal gestionale precedente va bene com'è: Excel o CSV.

---

## Cosa c'è dentro, per chi vuole sapere

- `installa.sh` — installazione completa, si può rilanciare senza danni
- `aggiorna.sh` — aggiornamento con copia di sicurezza preventiva

Il programma gira come utente `mondo`, non come amministratore, e può scrivere
soltanto nelle proprie cartelle `data/` e `backup/`. Ascolta solo su
`127.0.0.1`: dall'esterno ci si arriva unicamente attraverso nginx, che aggiunge
il certificato. Il firewall lascia aperte solo le porte 22, 80 e 443.
