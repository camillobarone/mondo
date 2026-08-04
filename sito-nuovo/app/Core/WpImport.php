<?php

declare(strict_types=1);

namespace Mil\Core;

use Mil\Repo\Properties;
use Throwable;

/**
 * L'importazione da WordPress, un immobile alla volta.
 *
 * Sta in una classe e non dentro lo script da riga di comando perché la
 * stessa importazione deve poter partire da due posti: dal terminale, per chi
 * ci sa lavorare, e da un pulsante del gestionale, per chi deve solo
 * riportarsi gli immobili aggiornati senza sapere cos'è una shell. Due copie
 * della stessa logica prima o poi divergono, e la seconda che diverge è
 * sempre quella che non viene provata.
 *
 * Lavorare un immobile per volta non è un dettaglio: dal web una richiesta ha
 * pochi minuti prima di essere interrotta, e cinquanta schede con le foto non
 * ci stanno. Chi chiama decide quanti farne per giro e ripassa.
 */
final class WpImport
{
    private WpMapper $mapper;

    public function __construct(
        private WpSource $wp,
        private string $uploads = '',
    ) {
        $this->mapper = new WpMapper();
    }

    /**
     * Gli ID WordPress degli immobili da lavorare, nell'ordine in cui
     * verranno importati.
     *
     * @param array<int,string> $stati
     * @return array<int,int>
     */
    public function daLavorare(array $stati = ['publish', 'draft'], int $limite = 0): array
    {
        return array_map(
            static fn (array $p): int => (int) $p['ID'],
            $this->wp->properties($stati, $limite)
        );
    }

    /**
     * Lavora un singolo immobile.
     *
     * Con $prova a true non scrive niente: serve a far vedere cosa
     * succederebbe prima di farlo succedere davvero.
     *
     * @return array{stato:string,titolo:string,prezzo:?float,mq:int,foto:int,messaggio:string}
     */
    public function uno(int $wpId, bool $prova = false, bool $conFoto = true): array
    {
        $esito = ['stato' => 'errore', 'titolo' => '#' . $wpId, 'prezzo' => null,
            'mq' => 0, 'foto' => 0, 'messaggio' => ''];

        try {
            $post = $this->wp->properties(['publish', 'draft', 'pending', 'private'], 0, $wpId)[0] ?? null;
            if ($post === null) {
                $esito['messaggio'] = 'non trovato in WordPress';
                return $esito;
            }

            $meta = $this->wp->meta($wpId);
            $dati = $this->mapper->map($post, $meta, $this->wp->terms($wpId));

            $esito['titolo'] = (string) $dati['title'];
            $esito['prezzo'] = $dati['price'] === null ? null : (float) $dati['price'];
            $esito['mq'] = (int) $dati['sqm'];

            $esistente = Db::one('SELECT id FROM properties WHERE wp_id = :w', ['w' => $wpId]);
            $esito['stato'] = $esistente === null ? 'nuovo' : 'aggiornato';

            if ($prova) {
                return $esito;
            }

            if ($esistente !== null) {
                $id = (int) $esistente['id'];
                // Il riferimento generato al primo import non si sovrascrive:
                // se qualcuno lo ha già dettato a un cliente deve restare quello.
                unset($dati['ref'], $dati['created_at']);
                Properties::update($id, $dati, 'aggiornato da WordPress');
            } else {
                if ($dati['ref'] === '') {
                    $dati['ref'] = Properties::nextRef();
                }
                $id = Properties::create($dati);
            }

            if ($conFoto && $this->uploads !== '') {
                $esito['foto'] = $this->foto($id, $this->mapper->immagini($meta));
            }
        } catch (Throwable $e) {
            $esito['stato'] = 'errore';
            $esito['messaggio'] = $e->getMessage();
        }

        return $esito;
    }

    /** @return array<int,string> avvisi raccolti dalla mappatura */
    public function avvisi(): array
    {
        return $this->mapper->avvisi();
    }

    /**
     * Le foto di un immobile. Quelle già importate si riconoscono dall'ID
     * WordPress e non vengono rifatte: reimportare due volte non produce
     * doppioni né rilavora immagini già convertite.
     *
     * @param array<int,int> $idAllegati
     */
    private function foto(int $propertyId, array $idAllegati): int
    {
        $fatte = 0;
        $ordine = (int) Db::value(
            'SELECT COALESCE(MAX(sort), 0) FROM property_images WHERE property_id = :p',
            ['p' => $propertyId]
        );

        foreach ($idAllegati as $attId) {
            $gia = (int) Db::value(
                'SELECT COUNT(*) FROM property_images WHERE property_id = :p AND wp_id = :w',
                ['p' => $propertyId, 'w' => $attId]
            );
            if ($gia > 0) {
                continue;
            }

            $relativo = $this->wp->attachmentFile($attId);
            if ($relativo === null) {
                continue;
            }

            $sorgente = rtrim($this->uploads, '/') . '/' . ltrim($relativo, '/');
            if (!is_file($sorgente)) {
                continue;
            }

            try {
                $img = Uploader::fromFile($sorgente, basename($relativo));
            } catch (Throwable) {
                // Una foto illeggibile non deve far saltare l'intero immobile.
                continue;
            }

            Db::insert('property_images', [
                'property_id' => $propertyId,
                'wp_id' => $attId,
                'path' => $img['path'],
                'thumb' => $img['thumb'],
                'srcset' => $img['srcset'],
                'alt' => mb_substr($this->wp->attachmentAlt($attId), 0, 191),
                'width' => $img['width'],
                'height' => $img['height'],
                'sort' => ++$ordine,
                'created_at' => Db::now(),
            ]);
            $fatte++;
        }

        return $fatte;
    }
}
