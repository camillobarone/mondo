"use client";

/**
 * Stampa la pagina. Da qui si ottiene anche il PDF da mandare su WhatsApp:
 * nella finestra di stampa si sceglie "Salva come PDF" invece della
 * stampante. E' la strada piu' corta per avere un file da consegnare senza
 * aggiungere al programma una libreria che generi PDF.
 */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary">
      Stampa o salva in PDF
    </button>
  );
}
