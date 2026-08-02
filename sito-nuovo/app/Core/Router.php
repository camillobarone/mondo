<?php

declare(strict_types=1);

namespace Mil\Core;

/**
 * Router minimale a pattern. I segmenti dinamici si scrivono {nome}
 * e arrivano al controller come argomenti nell'ordine di dichiarazione.
 */
final class Router
{
    /** @var array<int,array{method:string,regex:string,keys:array<int,string>,handler:callable}> */
    private array $routes = [];

    /** @var callable|null */
    private $fallback = null;

    public function get(string $pattern, callable $handler): void
    {
        $this->add('GET', $pattern, $handler);
    }

    public function post(string $pattern, callable $handler): void
    {
        $this->add('POST', $pattern, $handler);
    }

    /** Registra la stessa rotta su GET e POST. */
    public function any(string $pattern, callable $handler): void
    {
        $this->add('GET', $pattern, $handler);
        $this->add('POST', $pattern, $handler);
    }

    public function fallback(callable $handler): void
    {
        $this->fallback = $handler;
    }

    /** Forma canonica di un percorso: senza slash finale, tranne la root. */
    public static function normalize(string $path): string
    {
        $path = '/' . trim($path, '/');
        return $path === '//' ? '/' : $path;
    }

    private function add(string $method, string $pattern, callable $handler): void
    {
        $pattern = self::normalize($pattern);
        $keys = [];
        $regex = preg_replace_callback(
            '/\{([a-z_]+)\}/',
            static function (array $m) use (&$keys): string {
                $keys[] = $m[1];
                return '([^/]+)';
            },
            $pattern
        ) ?? $pattern;

        $this->routes[] = [
            'method' => $method,
            'regex' => '#^' . $regex . '$#',
            'keys' => $keys,
            'handler' => $handler,
        ];
    }

    public function dispatch(string $method, string $path): void
    {
        $path = self::normalize($path);

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }
            if (preg_match($route['regex'], $path, $matches) === 1) {
                array_shift($matches);
                ($route['handler'])(...$matches);
                return;
            }
        }

        if ($this->fallback !== null) {
            ($this->fallback)($path);
            return;
        }

        http_response_code(404);
        echo 'Pagina non trovata';
    }

    public static function redirect(string $to, int $code = 302): never
    {
        header('Location: ' . (str_starts_with($to, 'http') ? $to : url($to)), true, $code);
        exit;
    }
}
