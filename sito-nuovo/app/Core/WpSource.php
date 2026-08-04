<?php

declare(strict_types=1);

namespace Mil\Core;

use PDO;
use RuntimeException;

/**
 * Lettura del database WordPress di origine.
 *
 * Legge e basta: nessun metodo di questa classe scrive sul sito attuale.
 * È una scelta, non una dimenticanza — l'importazione non deve poter
 * rompere il sito che è ancora in produzione.
 *
 * Si legge dal database e non dalla REST API per due motivi: i meta dei
 * custom post type non sono esposti alla REST se non registrati uno per uno,
 * e su SiteGround i due siti stanno sullo stesso server, quindi la
 * connessione è locale e non passa da internet.
 */
final class WpSource
{
    private PDO $pdo;

    /**
     * Sorgente costruita su una connessione già aperta. Serve alle prove:
     * l'importatore si può far girare contro un WordPress finto senza
     * toccare quello vero.
     */
    public static function fromPdo(PDO $pdo, string $prefix = 'wp_'): self
    {
        $istanza = new self('', '', '', '', $prefix, 0, $pdo);
        return $istanza;
    }

    public function __construct(
        string $host,
        string $name,
        string $user,
        string $pass,
        private string $prefix = 'wp_',
        int $port = 3306,
        ?PDO $pdo = null
    ) {
        if ($pdo instanceof PDO) {
            $this->pdo = $pdo;
            return;
        }

        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $name);

        try {
            $this->pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        } catch (\PDOException $e) {
            throw new RuntimeException('Connessione al database WordPress non riuscita: ' . $e->getMessage());
        }
    }

    /**
     * Ricava host, nome, utente, password e prefisso da un wp-config.php.
     * Su SiteGround è il modo più rapido: il file sta già sul server.
     */
    public static function fromWpConfig(string $file): self
    {
        if (!is_readable($file)) {
            throw new RuntimeException("wp-config.php non leggibile: {$file}");
        }

        $src = (string) file_get_contents($file);

        $costante = static function (string $nome) use ($src): string {
            // Accetta apici singoli o doppi e spazi variabili, come si trova
            // nei wp-config.php veri.
            $re = '/define\s*\(\s*[\'"]' . preg_quote($nome, '/') . '[\'"]\s*,\s*[\'"](.*?)[\'"]\s*\)/s';
            return preg_match($re, $src, $m) === 1 ? $m[1] : '';
        };

        $prefisso = preg_match('/\$table_prefix\s*=\s*[\'"](.*?)[\'"]/', $src, $m) === 1 ? $m[1] : 'wp_';

        $host = $costante('DB_HOST') ?: 'localhost';
        $porta = 3306;
        if (str_contains($host, ':')) {
            [$host, $p] = explode(':', $host, 2);
            $porta = (int) $p ?: 3306;
        }

        $nome = $costante('DB_NAME');
        if ($nome === '') {
            throw new RuntimeException("DB_NAME non trovato in {$file}: il file è quello giusto?");
        }

        return new self($host, $nome, $costante('DB_USER'), $costante('DB_PASSWORD'), $prefisso, $porta);
    }

    /** @param array<string,mixed> $params @return array<int,array<string,mixed>> */
    private function all(string $sql, array $params = []): array
    {
        $stmt = $this->pdo->prepare(str_replace('{p}', $this->prefix, $sql));
        $stmt->execute($params);

        /** @var array<int,array<string,mixed>> $rows */
        $rows = $stmt->fetchAll();
        return $rows;
    }

    /**
     * Gli immobili, dal più recente.
     *
     * @param array<int,string> $statuses
     * @param int $onlyId se maggiore di zero, ne restituisce uno solo: serve
     *                    a rilavorare una singola scheda senza rileggere
     *                    tutto l'elenco a ogni giro
     * @return array<int,array<string,mixed>>
     */
    public function properties(array $statuses = ['publish', 'draft'], int $limit = 0, int $onlyId = 0): array
    {
        $in = implode(',', array_fill(0, count($statuses), '?'));
        $sql = "SELECT ID, post_title, post_name, post_content, post_excerpt,
                       post_status, post_date, post_modified
                FROM {p}posts
                WHERE post_type = 'estate_property' AND post_status IN ({$in})";
        $params = $statuses;

        if ($onlyId > 0) {
            $sql .= ' AND ID = ?';
            $params[] = (string) $onlyId;
        }

        $sql .= ' ORDER BY post_date DESC';
        if ($limit > 0) {
            $sql .= ' LIMIT ' . $limit;
        }

        $stmt = $this->pdo->prepare(str_replace('{p}', $this->prefix, $sql));
        $stmt->execute($params);

        /** @var array<int,array<string,mixed>> $rows */
        $rows = $stmt->fetchAll();
        return $rows;
    }

    /** @return array<string,string> tutti i meta di un post, chiave => valore */
    public function meta(int $postId): array
    {
        $out = [];
        foreach ($this->all(
            'SELECT meta_key, meta_value FROM {p}postmeta WHERE post_id = :id',
            ['id' => $postId]
        ) as $row) {
            $out[(string) $row['meta_key']] = (string) $row['meta_value'];
        }

        return $out;
    }

    /**
     * Termini di un post raggruppati per tassonomia.
     *
     * @return array<string,array<int,string>>
     */
    public function terms(int $postId): array
    {
        $rows = $this->all(
            'SELECT tt.taxonomy, t.name
             FROM {p}term_relationships tr
             JOIN {p}term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
             JOIN {p}terms t ON t.term_id = tt.term_id
             WHERE tr.object_id = :id',
            ['id' => $postId]
        );

        $out = [];
        foreach ($rows as $row) {
            $out[(string) $row['taxonomy']][] = (string) $row['name'];
        }

        return $out;
    }

    /**
     * Percorso relativo del file di un allegato, come sta in wp-content/uploads.
     * Null se l'allegato non esiste o non ha un file associato.
     */
    public function attachmentFile(int $attachmentId): ?string
    {
        $rows = $this->all(
            "SELECT meta_value FROM {p}postmeta
             WHERE post_id = :id AND meta_key = '_wp_attached_file' LIMIT 1",
            ['id' => $attachmentId]
        );

        return $rows === [] ? null : (string) $rows[0]['meta_value'];
    }

    /** Testo alternativo di un allegato, se compilato. */
    public function attachmentAlt(int $attachmentId): string
    {
        $rows = $this->all(
            "SELECT meta_value FROM {p}postmeta
             WHERE post_id = :id AND meta_key = '_wp_attachment_image_alt' LIMIT 1",
            ['id' => $attachmentId]
        );

        return $rows === [] ? '' : (string) $rows[0]['meta_value'];
    }

    /**
     * Censimento dei meta effettivamente usati dagli immobili: chiave,
     * su quanti immobili compare, e un valore di esempio non vuoto.
     *
     * È il primo comando da lanciare su un'installazione nuova: i nomi dei
     * campi di WP-Residence cambiano fra versioni e temi child, e tirare a
     * indovinare significa importare colonne vuote senza accorgersene.
     *
     * @return array<int,array{key:string,n:int,esempio:string}>
     */
    public function metaCensus(): array
    {
        $rows = $this->all(
            "SELECT pm.meta_key AS k, COUNT(DISTINCT pm.post_id) AS n,
                    MAX(CASE WHEN pm.meta_value <> '' THEN SUBSTR(pm.meta_value, 1, 80) END) AS esempio
             FROM {p}postmeta pm
             JOIN {p}posts p ON p.ID = pm.post_id
             WHERE p.post_type = 'estate_property'
             GROUP BY pm.meta_key
             ORDER BY n DESC, pm.meta_key"
        );

        return array_map(static fn (array $r): array => [
            'key' => (string) $r['k'],
            'n' => (int) $r['n'],
            'esempio' => (string) ($r['esempio'] ?? ''),
        ], $rows);
    }

    /**
     * Valori distinti usati in ogni tassonomia degli immobili.
     *
     * @return array<string,array<int,string>>
     */
    public function taxonomyCensus(): array
    {
        $rows = $this->all(
            "SELECT tt.taxonomy AS tax, t.name AS nome, COUNT(*) AS n
             FROM {p}term_relationships tr
             JOIN {p}term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
             JOIN {p}terms t ON t.term_id = tt.term_id
             JOIN {p}posts p ON p.ID = tr.object_id
             WHERE p.post_type = 'estate_property'
             GROUP BY tt.taxonomy, t.name
             ORDER BY tt.taxonomy, n DESC"
        );

        $out = [];
        foreach ($rows as $row) {
            $out[(string) $row['tax']][] = $row['nome'] . ' (' . $row['n'] . ')';
        }

        return $out;
    }
}
