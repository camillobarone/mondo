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
    private const MAX_WIDTH = 1600;
    private const THUMB_WIDTH = 640;

    private const ALLOWED = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG => 'png',
        IMAGETYPE_WEBP => 'webp',
    ];

    /**
     * @param array{name:string,type:string,tmp_name:string,error:int,size:int} $file
     * @return array{path:string,thumb:string,width:int,height:int}
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
     * @return array{path:string,thumb:string,width:int,height:int}
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

    /** @return array{path:string,thumb:string,width:int,height:int} */
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

        $full = self::resize($source, $width, $height, self::MAX_WIDTH);
        $thumb = self::resize($source, $width, $height, self::THUMB_WIDTH);
        imagedestroy($source);

        imagewebp($full, $dir . '/' . $name . '.webp', 82);
        imagewebp($thumb, $dir . '/' . $name . '-thumb.webp', 78);

        $finalWidth = imagesx($full);
        $finalHeight = imagesy($full);
        imagedestroy($full);
        imagedestroy($thumb);

        $urlBase = rtrim((string) Config::get('uploads_url'), '/') . '/' . $subdir . '/' . date('Y/m') . '/' . $name;

        return [
            'path' => $urlBase . '.webp',
            'thumb' => $urlBase . '-thumb.webp',
            'width' => $finalWidth,
            'height' => $finalHeight,
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
        foreach ([$rel, str_replace('.webp', '-thumb.webp', $rel)] as $candidate) {
            $file = $base . '/' . $candidate;
            // Non uscire mai dalla cartella uploads, qualunque cosa arrivi dal DB.
            if (str_starts_with(realpath($file) ?: '', $base) && is_file($file)) {
                @unlink($file);
            }
        }
    }
}
