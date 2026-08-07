<?php

declare(strict_types=1);

namespace Mil\Core;

use RuntimeException;

/**
 * Upload delle foto degli immobili. Ridimensiona con GD (estensione già
 * attiva su SiteGround) per non caricare in pagina file da 6 MB usciti
 * dal telefono: la velocità è un fattore di ranking e costa zero curarla.
 */
final class Uploader
{
    private const MAX_BYTES = 12 * 1024 * 1024;

    /**
     * Larghezze generate a ogni caricamento, dalla più piccola.
     *
     * Servono al `srcset`: un telefono non deve scaricare l'immagine da
     * 1600 px per mostrarla larga 360. È la singola voce che pesa di più
     * sul caricamento in mobilità, molto più del codice.
     *
     * Non si ingrandisce mai: si otterrebbe un file più pesante e più
     * sfocato. Al posto delle misure più grandi dell'originale si genera
     * l'originale stesso, così la risoluzione che c'è non va persa.
     */
    private const WIDTHS = [480, 960, 1600];

    private const ALLOWED = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG => 'png',
        IMAGETYPE_WEBP => 'webp',
    ];

    /**
     * @param array{name:string,type:string,tmp_name:string,error:int,size:int} $file
     * @return array{path:string,thumb:string,srcset:string,width:int,height:int}
     */
    public static function image(array $file, string $subdir = 'immobili'): array
    {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new RuntimeException('Caricamento non riuscito (codice ' . $file['error'] . ').');
        }
        if ($file['size'] > self::MAX_BYTES) {
            throw new RuntimeException('File troppo grande: massimo 12 MB.');
        }

        return self::process($file['tmp_name'], $file['name'], $subdir);
    }

    /**
     * Stessa lavorazione, ma su un file già presente su disco: la usa
     * l'importatore da WordPress, che le foto se le trova in wp-content.
     *
     * @return array{path:string,thumb:string,srcset:string,width:int,height:int}
     */
    public static function fromFile(string $path, string $originalName = '', string $subdir = 'immobili'): array
    {
        if (!is_file($path)) {
            throw new RuntimeException("File non trovato: {$path}");
        }
        if (filesize($path) > self::MAX_BYTES) {
            throw new RuntimeException('File troppo grande: massimo 12 MB.');
        }

        return self::process($path, $originalName !== '' ? $originalName : basename($path), $subdir);
    }

    /** @return array{path:string,thumb:string,srcset:string,width:int,height:int} */
    private static function process(string $sourcePath, string $originalName, string $subdir): array
    {
        // Il tipo si determina dal contenuto, mai dall'estensione dichiarata.
        $info = @getimagesize($sourcePath);
        if ($info === false || !isset(self::ALLOWED[$info[2]])) {
            throw new RuntimeException('Formato non supportato. Usa JPG, PNG o WebP.');
        }

        [$width, $height, $imageType] = $info;
        $source = match ($imageType) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($sourcePath),
            IMAGETYPE_PNG => @imagecreatefrompng($sourcePath),
            IMAGETYPE_WEBP => @imagecreatefromwebp($sourcePath),
            default => false,
        };
        if ($source === false) {
            throw new RuntimeException('Immagine illeggibile o danneggiata.');
        }

        $dir = rtrim((string) Config::get('uploads_dir'), '/') . '/' . $subdir . '/' . date('Y/m');
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException("Impossibile creare la cartella {$dir}.");
        }

        $stem = slugify(pathinfo($originalName, PATHINFO_FILENAME)) ?: 'foto';
        $name = $stem . '-' . bin2hex(random_bytes(4));
        $urlBase = rtrim((string) Config::get('uploads_url'), '/') . '/' . $subdir . '/' . date('Y/m') . '/' . $name;

        // La misura più grande è quella dell'originale, ma senza superare
        // 1600: non si ingrandisce mai, e non si tiene in pagina un file da
        // 5000 px che nessuno schermo userebbe. Sotto di essa restano le
        // misure fisse. Così una foto da 1400 px viene servita a 1400 e non
        // buttata giù a 960 solo perché non arriva a 1600.
        $massima = min($width, max(self::WIDTHS));
        $larghezze = array_values(array_filter(self::WIDTHS, static fn (int $w): bool => $w < $massima));
        $larghezze[] = $massima;

        $srcset = [];
        $piuGrande = null;
        $piuPiccola = null;

        foreach ($larghezze as $w) {
            $variante = self::resize($source, $width, $height, $w);
            $reale = imagesx($variante);
            $file = $name . '-' . $reale . '.webp';

            // Le larghezze piccole reggono una compressione più aggressiva:
            // si vedono su schermi dove il dettaglio non si apprezza.
            imagewebp($variante, $dir . '/' . $file, $reale <= 640 ? 76 : 82);

            $srcset[] = $urlBase . '-' . $reale . '.webp ' . $reale . 'w';
            $piuPiccola ??= ['url' => $urlBase . '-' . $reale . '.webp'];
            $piuGrande = ['url' => $urlBase . '-' . $reale . '.webp', 'w' => $reale, 'h' => imagesy($variante)];

            imagedestroy($variante);
        }

        imagedestroy($source);

        return [
            'path' => $piuGrande['url'],
            'thumb' => $piuPiccola['url'],
            'srcset' => implode(', ', $srcset),
            'width' => $piuGrande['w'],
            'height' => $piuGrande['h'],
        ];
    }

    /** @return \GdImage */
    private static function resize(\GdImage $source, int $width, int $height, int $maxWidth): \GdImage
    {
        if ($width <= $maxWidth) {
            $copy = imagecreatetruecolor($width, $height);
            imagecopy($copy, $source, 0, 0, 0, 0, $width, $height);
            return $copy;
        }

        $newWidth = $maxWidth;
        $newHeight = (int) round($height * ($maxWidth / $width));
        $copy = imagecreatetruecolor($newWidth, $newHeight);
        imagecopyresampled($copy, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        return $copy;
    }

    /** Elimina file caricato + miniatura, ignorando quelli già assenti. */
    public static function remove(string $publicPath): void
    {
        $base = rtrim((string) Config::get('uploads_dir'), '/');
        $rel = ltrim(str_replace((string) Config::get('uploads_url'), '', $publicPath), '/');

        // Il percorso salvato è quello della variante più grande: le altre
        // hanno lo stesso nome con una larghezza diversa. Si cancellano tutte,
        // altrimenti restano file orfani a occupare spazio per sempre.
        $senzaLarghezza = preg_replace('/-\d+\.webp$/', '', $rel) ?? $rel;
        $candidati = glob($base . '/' . $senzaLarghezza . '-*.webp') ?: [];

        foreach ($candidati as $file) {
            // Non uscire mai dalla cartella uploads, qualunque cosa arrivi dal DB.
            if (str_starts_with(realpath($file) ?: '', $base) && is_file($file)) {
                @unlink($file);
            }
        }
    }
}
