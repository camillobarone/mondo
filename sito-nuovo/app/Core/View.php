<?php

declare(strict_types=1);

namespace Mil\Core;

use RuntimeException;

/**
 * Template PHP puri. Nessun motore, nessuna dipendenza: i file in views/
 * ricevono le variabili passate a render() e stampano con e().
 */
final class View
{
    /** @param array<string,mixed> $data */
    public static function render(string $template, array $data = [], string $layout = 'layout/site'): string
    {
        $content = self::capture($template, $data);

        if ($layout === '') {
            return $content;
        }

        return self::capture($layout, $data + ['content' => $content]);
    }

    /** @param array<string,mixed> $data */
    public static function show(string $template, array $data = [], string $layout = 'layout/site'): void
    {
        echo self::render($template, $data, $layout);
    }

    /** @param array<string,mixed> $data */
    public static function partial(string $template, array $data = []): string
    {
        return self::capture($template, $data);
    }

    /** @param array<string,mixed> $data */
    private static function capture(string $template, array $data): string
    {
        $file = MIL_VIEWS . '/' . $template . '.php';
        if (!is_file($file)) {
            throw new RuntimeException("Template mancante: {$template}");
        }

        extract($data, EXTR_SKIP);
        ob_start();
        require $file;
        return (string) ob_get_clean();
    }
}
