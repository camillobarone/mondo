/**
 * Il pezzetto di programma che resta acceso nel telefono.
 *
 * Serve solo agli avvisi: riceve la notifica dei 30 minuti prima e la mostra
 * anche a gestionale chiuso. Non tiene niente in memoria e non serve pagine da
 * solo — un «service worker» che si mette a fare la cache e' la cosa che poi
 * mostra una pagina vecchia e fa impazzire chi la guarda.
 *
 * Sta in `public/`, quindi viene servito da /sw.js, che e' la radice del sito:
 * e' obbligatorio. Da un sottoindirizzo potrebbe ricevere gli avvisi solo per
 * quel sottoindirizzo.
 */

// Il nuovo prende il posto del vecchio subito, senza aspettare che tutte le
// pagine aperte vengano chiuse. Senza queste due righe, una correzione qui
// dentro entrerebbe in vigore chissa' quando.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  // Se il messaggio non si legge si mostra lo stesso qualcosa: un avviso muto
  // e' peggio di un avviso generico, perche' l'appuntamento resta lo stesso.
  let dati = { titolo: "Mondo Immobiliare", corpo: "Hai un appuntamento.", url: "/agenda" };
  try {
    if (evento.data) dati = { ...dati, ...evento.data.json() };
  } catch {
    /* messaggio illeggibile: restano i valori qui sopra */
  }

  evento.waitUntil(
    self.registration.showNotification(dati.titolo, {
      body: dati.corpo,
      icon: "/icona-192.png",
      badge: "/icona-192.png",
      // Il `tag` fa in modo che due avvisi dello stesso appuntamento si
      // sostituiscano invece di impilarsi.
      tag: dati.tag || "appuntamento",
      // Resta finche' non la si tocca: un avviso che sparisce da solo mentre
      // sei alla guida non ha avvisato nessuno.
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: dati.url },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destinazione = evento.notification.data?.url || "/agenda";

  evento.waitUntil(
    (async () => {
      const aperte = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Se il gestionale e' gia' aperto si porta avanti quella finestra invece
      // di aprirne una seconda: due copie della stessa agenda confondono.
      for (const finestra of aperte) {
        if (new URL(finestra.url).origin === self.location.origin) {
          await finestra.focus();
          if ("navigate" in finestra) await finestra.navigate(destinazione);
          return;
        }
      }
      await self.clients.openWindow(destinazione);
    })(),
  );
});
