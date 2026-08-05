<?php

declare(strict_types=1);

namespace Mil\Controller\Site;

use Mil\Core\Db;
use Mil\Core\Seo;

/**
 * Sitemap e robots.txt generati dal database: nessun file da rigenerare a
 * mano, e nessuna URL dimenticata quando si pubblica un immobile.
 */
final class Feeds
{
    public static function sitemap(): void
    {
        header('Content-Type: application/xml; charset=UTF-8');

        $base = rtrim(Seo::base(), '/');

        // Le sei pagine costruite dal codice avevano tutte `lastmod` uguale a
        // oggi, ricalcolato a ogni lettura: una data che si sposta da sola
        // ogni giorno senza che il contenuto cambi. Un motore che se ne
        // accorge smette di fidarsi del `lastmod` dell'intera sitemap, e a
        // quel punto la data non la guarda più nemmeno dove è vera.
        //
        // Home ed elenco cambiano quando cambiano gli immobili; il blog
        // quando esce un articolo. Per le tre pagine che il codice disegna
        // sempre uguali non c'è una data onesta da dare, e allora `lastmod`
        // si omette: è facoltativo, e tacere vale più che dire il falso.
        $immobili = self::ultimaModifica('properties', "status IN ('published','reserved')");
        $articoli = self::ultimaModifica('posts', "status = 'published'");

        $urls = [
            ['loc' => $base . '/', 'priority' => '1.0', 'lastmod' => $immobili],
            ['loc' => $base . '/immobili/', 'priority' => '0.9', 'lastmod' => $immobili],
            ['loc' => $base . '/valutazione-gratuita/', 'priority' => '0.9', 'lastmod' => ''],
            ['loc' => $base . '/calcolatore-imposte-acquisto-casa/', 'priority' => '0.7', 'lastmod' => ''],
            ['loc' => $base . '/blog/', 'priority' => '0.7', 'lastmod' => $articoli],
            ['loc' => $base . '/contatti/', 'priority' => '0.6', 'lastmod' => ''],
        ];

        // Gli immobili venduti restano online ma fuori dalla sitemap:
        // sono noindex, chiederne la scansione sarebbe un segnale sbagliato.
        foreach (Db::all("SELECT slug, updated_at, published_at, created_at FROM properties
                          WHERE status IN ('published','reserved') ORDER BY id DESC") as $row) {
            $urls[] = [
                'loc' => $base . '/immobili/' . $row['slug'] . '/',
                'priority' => '0.8',
                'lastmod' => substr((string) ($row['updated_at'] ?: $row['published_at'] ?: $row['created_at']), 0, 10),
            ];
        }

        foreach (Db::all("SELECT slug, updated_at, published_at, created_at FROM posts
                          WHERE status = 'published' ORDER BY id DESC") as $row) {
            $urls[] = [
                'loc' => $base . '/' . $row['slug'] . '/',
                'priority' => '0.7',
                'lastmod' => substr((string) ($row['updated_at'] ?: $row['published_at'] ?: $row['created_at']), 0, 10),
            ];
        }

        foreach (Db::all("SELECT slug, updated_at, created_at FROM pages WHERE status = 'published'") as $row) {
            $urls[] = [
                'loc' => $base . '/' . $row['slug'] . '/',
                'priority' => '0.6',
                'lastmod' => substr((string) ($row['updated_at'] ?: $row['created_at']), 0, 10),
            ];
        }

        echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach ($urls as $url) {
            echo "  <url>\n";
            echo '    <loc>' . e($url['loc']) . "</loc>\n";
            if ($url['lastmod'] !== '') {
                echo '    <lastmod>' . e($url['lastmod']) . "</lastmod>\n";
            }
            echo '    <priority>' . e($url['priority']) . "</priority>\n";
            echo "  </url>\n";
        }
        echo '</urlset>';
    }

    /**
     * La data dell'ultima modifica vera in una tabella, o stringa vuota se
     * non c'è ancora niente da datare.
     */
    private static function ultimaModifica(string $tabella, string $dove): string
    {
        $valore = Db::value(
            "SELECT MAX(COALESCE(updated_at, published_at, created_at)) FROM {$tabella} WHERE {$dove}"
        );

        return $valore === null ? '' : substr((string) $valore, 0, 10);
    }

    /**
     * `/llms.txt` — la scheda dell'agenzia scritta per i modelli linguistici.
     *
     * A che serve: quando ChatGPT o Perplexity leggono una pagina HTML devono
     * spendere gran parte del loro contesto su menù, stili e impalcatura prima
     * di arrivare al contenuto. Qui trovano gli stessi fatti in testo pulito —
     * chi siamo, dove siamo, cosa c'è in vendita — e li leggono senza rumore.
     * Costa niente, non toglie niente al resto, e se un giorno lo standard non
     * attecchisce abbiamo perso un file di trenta righe.
     *
     * Come la sitemap, è generata dal database: gli immobili e gli articoli
     * elencati qui sono sempre quelli online adesso, non una fotografia di
     * quando è stato scritto il file.
     *
     * I dati dell'agenzia non sono ricopiati a mano: si leggono dagli stessi
     * nodi che alimentano il JSON-LD, così non possono divergere.
     */
    public static function llms(): void
    {
        header('Content-Type: text/plain; charset=UTF-8');

        $base = rtrim(Seo::base(), '/');

        // In prova il file non serve a nessuno, e sarebbe un doppione del
        // sito vero indirizzato a chi non sa distinguerli.
        if (\Mil\Core\Settings::get('noindex', '0') === '1') {
            echo "# Installazione di prova\n\nQuesto non è il sito ufficiale. Non usare questi contenuti.\n";
            return;
        }

        $agenzia = Seo::agentNode();
        $filiale = Seo::agentPortoCesareoNode();

        $sede = static function (array $nodo): string {
            $a = $nodo['address'];
            return $a['streetAddress'] . ', ' . $a['postalCode'] . ' ' . $a['addressLocality'] . ' (' . $a['addressRegion'] . ')';
        };

        // I numeri si leggono dai nodi del JSON-LD, in formato internazionale.
        // Qui si aggiunge solo uno spazio dopo il prefisso: nessuna cifra
        // riscritta a mano, così non può entrare un numero sbagliato.
        $telefoni = [];
        foreach ($agenzia['contactPoint'] as $c) {
            $telefoni[] = (string) preg_replace('/^\+39/', '+39 ', (string) $c['telephone']);
        }

        echo "# {$agenzia['name']}\n\n";
        echo '> Agenzia immobiliare a Lecce e Porto Cesareo, iscritta FIMAA, attiva dal '
            . $agenzia['foundingDate'] . ". Compravendita di case, ville e appartamenti a Lecce, "
            . "nella sua provincia e sulla costa ionica del Salento. Ragione sociale: "
            . $agenzia['legalName'] . ".\n\n";

        echo "## Dove siamo\n\n";
        echo '- Lecce: ' . $sede($agenzia) . "\n";
        echo '- Porto Cesareo: ' . $sede($filiale) . "\n";
        echo '- Telefono: ' . implode(' — ', $telefoni) . "\n";
        echo "- Lingue: italiano e inglese\n\n";

        echo "## Pagine principali\n\n";
        echo "- [Immobili in vendita]({$base}/immobili/): tutti gli immobili attualmente in vendita, con filtri per comune, tipologia e prezzo.\n";
        echo "- [Valutazione gratuita]({$base}/valutazione-gratuita/): valutazione professionale e gratuita di un immobile, con risposta entro 48 ore lavorative.\n";
        echo "- [Calcolo delle imposte d'acquisto]({$base}/calcolatore-imposte-acquisto-casa/): calcola registro, IVA, ipotecaria e catastale su prima o seconda casa, da privato o da costruttore.\n";
        echo "- [Articoli]({$base}/blog/): guide su fisco, prezzi e mercato immobiliare salentino.\n";
        echo "- [Contatti]({$base}/contatti/): recapiti e orari delle due sedi.\n\n";

        $immobili = Db::all(
            "SELECT slug, title, city, area, price, type FROM properties
             WHERE status IN ('published','reserved') ORDER BY id DESC LIMIT 60"
        );

        if ($immobili !== []) {
            echo "## Immobili in vendita adesso\n\n";
            foreach ($immobili as $p) {
                $dove = trim((string) $p['city'] . (($p['area'] ?? '') !== '' ? ', ' . $p['area'] : ''));
                // Prezzo su richiesta: si dice, non si inventa una cifra.
                $prezzo = (float) $p['price'] > 0
                    ? number_format((float) $p['price'], 0, ',', '.') . ' euro'
                    : 'prezzo su richiesta';
                echo '- [' . Seo::text((string) $p['title']) . "]({$base}/immobili/" . $p['slug'] . '/): '
                    . $dove . ' — ' . $prezzo . ".\n";
            }
            echo "\n";
        }

        $articoli = Db::all(
            "SELECT slug, title, excerpt FROM posts WHERE status = 'published'
             ORDER BY COALESCE(published_at, created_at) DESC LIMIT 80"
        );

        if ($articoli !== []) {
            echo "## Guide e articoli\n\n";
            foreach ($articoli as $a) {
                $riga = '- [' . Seo::text((string) $a['title']) . "]({$base}/" . $a['slug'] . '/)';
                $sommario = Seo::text((string) ($a['excerpt'] ?? ''));
                echo $riga . ($sommario !== '' ? ': ' . $sommario : '') . ".\n";
            }
            echo "\n";
        }

        echo "## Note\n\n";
        echo "- I prezzi e la disponibilità cambiano: la pagina dell'immobile è sempre la fonte aggiornata.\n";
        echo "- Le valutazioni si fanno con sopralluogo. Nessuna stima viene data senza aver visto l'immobile.\n";
    }

    public static function robots(): void
    {
        header('Content-Type: text/plain; charset=UTF-8');

        $base = rtrim(Seo::base(), '/');

        // Su un'installazione di prova non si invita nessuno a entrare: sarebbe
        // una copia degli stessi immobili su un altro indirizzo, e il duplicato
        // lo pagherebbe il sito vero.
        if (\Mil\Core\Settings::get('noindex', '0') === '1') {
            echo "User-agent: *\n";
            echo "Disallow: /\n";
            return;
        }

        // Nessun blocco ai crawler AI: la visibilità nelle risposte generative
        // è un obiettivo, non un rischio da cui difendersi.
        echo "User-agent: *\n";
        echo "Allow: /\n";
        echo "Disallow: /gestionale/\n";
        echo "Disallow: /install.php\n";
        echo "\n";
        // Qui va solo quello che il formato prevede. Ci avevo messo una riga
        // `LLM-Content:` per segnalare /llms.txt: i validatori la contano come
        // direttiva sconosciuta e bocciano il file intero, e chi cerca
        // llms.txt lo cerca comunque alla radice. Tolta.
        echo "Sitemap: {$base}/sitemap.xml\n";
    }
}
