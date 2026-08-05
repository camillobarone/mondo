<?php

declare(strict_types=1);

namespace Mil\Core;

/**
 * Dal testo scritto a mano al testo impaginato.
 *
 * Gli articoli e le descrizioni arrivano da una chat, cioè scritti col
 * pochissimo che si usa lì: una riga vuota fra i paragrafi, `##` davanti a un
 * sottotitolo, un trattino davanti a un elenco, due asterischi intorno a una
 * parola. Prima si mostrava tutto con `nl2br()`, e quei segni restavano a
 * schermo: un articolo di duemila parole diventava un muro con dei cancelletti
 * dentro.
 *
 * Qui si riconosce solo quel poco. Niente HTML in ingresso — il testo viene
 * prima messo in sicurezza con `e()` e poi ricostruito — così non c'è modo di
 * far entrare uno script scrivendolo dentro un articolo.
 */
final class Testo
{
    /** @var list<string> righe del paragrafo in corso */
    private array $paragrafo = [];

    /** @var list<string> righe della citazione in corso */
    private array $citazione = [];

    /** 'ul' o 'ol' finché un elenco è aperto */
    private ?string $lista = null;

    private string $html = '';

    public static function html(string $testo): string
    {
        return (new self())->converti($testo);
    }

    /**
     * Lo stesso testo senza i segni: serve dove non c'è impaginazione ma solo
     * caratteri contati — la meta description, il riassunto in una scheda, la
     * `description` dentro il JSON-LD. Lì un `##` non è formattazione, è
     * rumore che si porta via due caratteri buoni su centocinquantacinque.
     */
    public static function piano(string $testo): string
    {
        $testo = (string) preg_replace('/^\s{0,3}(#{1,6}|>|[-*•]|\d+[.)])\s+/mu', '', $testo);
        $testo = (string) preg_replace('/^\s{0,3}(-{3,}|\*{3,})\s*$/mu', '', $testo);
        $testo = (string) preg_replace('/\[([^\]]+)\]\([^)\s]*\)/u', '$1', $testo);
        $testo = (string) preg_replace('/\*\*([^*]+)\*\*/u', '$1', $testo);

        return (string) preg_replace('/(?<!\*)\*([^*]+)\*(?!\*)/u', '$1', $testo);
    }

    private function converti(string $testo): string
    {
        $testo = trim(str_replace(["\r\n", "\r"], "\n", $testo));
        if ($testo === '') {
            return '';
        }

        foreach (explode("\n", $testo) as $riga) {
            $this->riga(trim($riga));
        }
        $this->chiudi();

        return $this->html;
    }

    private function riga(string $riga): void
    {
        if ($riga === '') {
            $this->chiudi();
            return;
        }

        // Sottotitoli. In pagina il titolo è un `h1`, e il primo livello
        // scritto nel testo deve stargli subito sotto: `#` e `##` diventano
        // `h2`, tutto il resto `h3`. Così l'indice della pagina resta una
        // scala senza gradini saltati — che è quello che legge un motore di
        // ricerca, e quello su cui si sposta chi naviga con lo screen reader.
        if (preg_match('/^(#{1,6})\s+(.+)$/u', $riga, $m) === 1) {
            $this->chiudi();
            $livello = strlen($m[1]) <= 2 ? '2' : '3';
            $this->html .= '<h' . $livello . '>' . self::inline($m[2]) . '</h' . $livello . ">\n";
            return;
        }

        if ($riga === '---' || $riga === '***') {
            $this->chiudi();
            $this->html .= "<hr>\n";
            return;
        }

        if (preg_match('/^[-*•]\s+(.+)$/u', $riga, $m) === 1) {
            $this->voce('ul', $m[1]);
            return;
        }

        if (preg_match('/^\d+[.)]\s+(.+)$/u', $riga, $m) === 1) {
            $this->voce('ol', $m[1]);
            return;
        }

        if (preg_match('/^>\s?(.*)$/u', $riga, $m) === 1) {
            if ($this->paragrafo !== [] || $this->lista !== null) {
                $this->chiudi();
            }
            $this->citazione[] = self::inline($m[1]);
            return;
        }

        if ($this->citazione !== [] || $this->lista !== null) {
            $this->chiudi();
        }
        $this->paragrafo[] = self::inline($riga);
    }

    /**
     * Una voce di elenco. Se l'elenco aperto è di un altro tipo lo chiude e ne
     * apre uno nuovo: un elenco puntato subito sotto a uno numerato non deve
     * finire dentro quello sbagliato.
     */
    private function voce(string $tipo, string $contenuto): void
    {
        if ($this->paragrafo !== [] || $this->citazione !== [] || ($this->lista !== null && $this->lista !== $tipo)) {
            $this->chiudi();
        }

        if ($this->lista === null) {
            $this->html .= '<' . $tipo . ">\n";
            $this->lista = $tipo;
        }

        $this->html .= '<li>' . self::inline($contenuto) . "</li>\n";
    }

    /** Chiude tutto quello che è rimasto aperto. */
    private function chiudi(): void
    {
        if ($this->paragrafo !== []) {
            // Righe consecutive senza riga vuota in mezzo restano nello stesso
            // paragrafo, separate da un a capo: è come si scrive un indirizzo.
            $this->html .= '<p>' . implode("<br>\n", $this->paragrafo) . "</p>\n";
            $this->paragrafo = [];
        }

        if ($this->citazione !== []) {
            $this->html .= '<blockquote><p>' . implode("<br>\n", $this->citazione) . "</p></blockquote>\n";
            $this->citazione = [];
        }

        if ($this->lista !== null) {
            $this->html .= '</' . $this->lista . ">\n";
            $this->lista = null;
        }
    }

    /**
     * Grassetto, corsivo e collegamenti dentro una riga già messa in sicurezza.
     */
    private static function inline(string $riga): string
    {
        $riga = e($riga);

        // I collegamenti per primi: il testo fra parentesi quadre può contenere
        // del grassetto, l'indirizzo no.
        $riga = (string) preg_replace_callback(
            '/\[([^\]]+)\]\(([^)\s]+)\)/u',
            static function (array $m): string {
                // Solo indirizzi che portano da qualche parte: `javascript:` e
                // compagnia non diventano un collegamento, resta il testo.
                if (preg_match('#^(https?://|/|mailto:|tel:)#i', $m[2]) !== 1) {
                    return $m[1];
                }

                return '<a href="' . $m[2] . '">' . $m[1] . '</a>';
            },
            $riga
        );

        $riga = (string) preg_replace('/\*\*([^*]+)\*\*/u', '<strong>$1</strong>', $riga);

        return (string) preg_replace('/(?<!\*)\*([^*]+)\*(?!\*)/u', '<em>$1</em>', $riga);
    }
}
