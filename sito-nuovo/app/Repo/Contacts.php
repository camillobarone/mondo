<?php

declare(strict_types=1);

namespace Mil\Repo;

use Mil\Core\Db;

/**
 * Anagrafica delle richieste di acquisto e motore di abbinamento.
 *
 * È il pezzo che il sito attuale non ha: oggi la domanda (chi cerca cosa)
 * vive nella testa degli agenti, l'offerta sul sito, e l'incrocio si fa a
 * memoria. Qui è una query — quando entra un immobile nuovo il gestionale
 * dice subito a chi va proposto.
 */
final class Contacts
{
    /**
     * @param array<string,mixed> $data
     * @return array{items:array<int,array<string,mixed>>,total:int,pages:int,page:int}
     */
    public static function search(array $data = [], int $page = 1, int $perPage = 25): array
    {
        $clauses = [];
        $params = [];

        if (($data['active'] ?? '1') !== 'any') {
            $clauses[] = 'c.active = :active';
            $params['active'] = (int) ($data['active'] ?? 1);
        }
        if (!empty($data['q'])) {
            $clauses[] = '(c.name LIKE :q OR c.phone LIKE :q OR c.email LIKE :q OR c.notes LIKE :q)';
            $params['q'] = '%' . $data['q'] . '%';
        }
        if (!empty($data['status'])) {
            $clauses[] = 'c.status = :status';
            $params['status'] = $data['status'];
        }
        if (!empty($data['role'])) {
            // I ruoli stanno in una lista separata da virgole: si cerca il
            // ruolo circondato da virgole, così "collega" non pesca
            // "segnalatore_collega" e simili.
            $clauses[] = Db::concat("','", 'c.roles', "','") . ' LIKE :role';
            $params['role'] = '%,' . $data['role'] . ',%';
        }

        $where = $clauses === [] ? '1 = 1' : implode(' AND ', $clauses);
        $total = (int) Db::value("SELECT COUNT(*) FROM contacts c WHERE {$where}", $params);
        $pages = max(1, (int) ceil($total / $perPage));
        $page = max(1, min($page, $pages));

        $items = Db::all(
            "SELECT c.*, u.name AS agent_name
             FROM contacts c LEFT JOIN users u ON u.id = c.assigned_to
             WHERE {$where} ORDER BY c.created_at DESC
             LIMIT {$perPage} OFFSET " . (($page - 1) * $perPage),
            $params
        );

        return ['items' => $items, 'total' => $total, 'pages' => $pages, 'page' => $page];
    }

    /** @return array<string,mixed>|null */
    public static function find(int $id): ?array
    {
        return Db::one('SELECT * FROM contacts WHERE id = :id', ['id' => $id]);
    }

    /** @param array<string,mixed> $data */
    public static function create(array $data): int
    {
        $data['created_at'] = Db::now();
        return Db::insert('contacts', $data);
    }

    /** @param array<string,mixed> $data */
    public static function update(int $id, array $data): void
    {
        $data['updated_at'] = Db::now();
        Db::update('contacts', $id, $data);
    }

    public static function delete(int $id): void
    {
        Db::delete('contacts', $id);
    }

    public static function countActive(): int
    {
        return (int) Db::value('SELECT COUNT(*) FROM contacts WHERE active = 1');
    }

    /** Segna che il cliente è stato sentito adesso. */
    public static function touch(int $id): void
    {
        Db::run(
            'UPDATE contacts SET last_contact_at = :now WHERE id = :id',
            ['now' => Db::now(), 'id' => $id]
        );
    }

    /**
     * Clienti attivi non sentiti da troppo tempo. Un cliente che non senti
     * per due mesi non è più un tuo cliente: è di chi lo richiama.
     *
     * @return array<int,array<string,mixed>>
     */
    public static function notContactedSince(int $days = 45, int $limit = 20): array
    {
        $soglia = date('Y-m-d H:i:s', strtotime('-' . $days . ' days'));

        return Db::all(
            "SELECT c.*, u.name AS agent_name
             FROM contacts c LEFT JOIN users u ON u.id = c.assigned_to
             WHERE c.active = 1
               AND c.status IN ('attivo','in_trattativa')
               AND (c.last_contact_at IS NULL OR c.last_contact_at < :soglia)
             ORDER BY CASE WHEN c.last_contact_at IS NULL THEN 0 ELSE 1 END,
                      c.last_contact_at
             LIMIT {$limit}",
            ['soglia' => $soglia]
        );
    }

    /**
     * Contatti senza consenso privacy datato o senza identificazione
     * antiriciclaggio, fra quelli in trattativa. Sono gli adempimenti che
     * si scoprono mancanti sempre nel momento sbagliato.
     *
     * @return array<int,array<string,mixed>>
     */
    public static function missingCompliance(int $limit = 20): array
    {
        return Db::all(
            "SELECT * FROM contacts
             WHERE active = 1 AND status IN ('attivo','in_trattativa')
               AND (privacy_consent = 0 OR privacy_date IS NULL OR aml_checked_at IS NULL)
             ORDER BY status DESC, name LIMIT {$limit}"
        );
    }

    // --------------------------------------------------------- abbinamento

    /** Soglia sotto la quale un abbinamento non viene proposto. */
    public const MIN_SCORE = 60;

    /**
     * Immobili adatti a una richiesta, dal più affine.
     *
     * @param array<string,mixed> $contact
     * @return array<int,array{property:array<string,mixed>,score:int,reasons:array<int,string>}>
     */
    public static function propertiesFor(array $contact, int $limit = 20): array
    {
        $properties = Db::all(
            "SELECT p.*,
                    (SELECT thumb FROM property_images i WHERE i.property_id = p.id ORDER BY i.sort, i.id LIMIT 1) AS cover_thumb
             FROM properties p
             WHERE p.status IN ('published','reserved') AND p.contract = :contract",
            ['contract' => (string) $contact['contract']]
        );

        $out = [];
        foreach ($properties as $property) {
            $match = self::score($contact, $property);
            if ($match['score'] >= self::MIN_SCORE) {
                $out[] = ['property' => $property, 'score' => $match['score'], 'reasons' => $match['reasons']];
            }
        }

        usort($out, static fn (array $a, array $b): int => $b['score'] <=> $a['score']);

        return array_slice($out, 0, $limit);
    }

    /**
     * Richieste a cui proporre un immobile, dalla più affine.
     *
     * @param array<string,mixed> $property
     * @return array<int,array{contact:array<string,mixed>,score:int,reasons:array<int,string>}>
     */
    public static function contactsFor(array $property, int $limit = 20): array
    {
        $contacts = Db::all(
            'SELECT * FROM contacts WHERE active = 1 AND contract = :contract',
            ['contract' => (string) $property['contract']]
        );

        $out = [];
        foreach ($contacts as $contact) {
            $match = self::score($contact, $property);
            if ($match['score'] >= self::MIN_SCORE) {
                $out[] = ['contact' => $contact, 'score' => $match['score'], 'reasons' => $match['reasons']];
            }
        }

        usort($out, static fn (array $a, array $b): int => $b['score'] <=> $a['score']);

        return array_slice($out, 0, $limit);
    }

    /**
     * Punteggio 0-100 fra una richiesta e un immobile.
     *
     * Ogni criterio dichiarato dal cliente pesa; i criteri che non ha
     * espresso non penalizzano. Il budget è l'unico criterio bloccante:
     * un immobile fuori budget non è un abbinamento debole, è un no.
     *
     * @param array<string,mixed> $contact
     * @param array<string,mixed> $property
     * @return array{score:int,reasons:array<int,string>}
     */
    public static function score(array $contact, array $property): array
    {
        if ((string) $contact['contract'] !== (string) $property['contract']) {
            return ['score' => 0, 'reasons' => []];
        }

        $weights = [];
        $earned = [];
        $reasons = [];

        $price = (float) ($property['price'] ?? 0);
        $budgetMax = (float) ($contact['budget_max'] ?? 0);
        $budgetMin = (float) ($contact['budget_min'] ?? 0);

        if ($budgetMax > 0 && $price > 0) {
            // Tolleranza del 5%: una trattativa recupera facilmente uno scarto così.
            if ($price > $budgetMax * 1.05) {
                return ['score' => 0, 'reasons' => []];
            }
            $weights['budget'] = 35;
            $earned['budget'] = $price <= $budgetMax ? 35 : 25;
            $reasons[] = 'Prezzo ' . euro($price) . ' entro il budget di ' . euro($budgetMax);
        }
        if ($budgetMin > 0 && $price > 0 && $price < $budgetMin) {
            $weights['budget_min'] = 10;
            $earned['budget_min'] = 4;
        }

        $cities = self::listOf((string) ($contact['cities'] ?? ''));
        if ($cities !== []) {
            $weights['city'] = 25;
            $hit = in_array(mb_strtolower((string) $property['city']), array_map('mb_strtolower', $cities), true);
            $earned['city'] = $hit ? 25 : 0;
            if ($hit) {
                $reasons[] = 'Zona richiesta: ' . $property['city'];
            }
        }

        $types = self::listOf((string) ($contact['types'] ?? ''));
        if ($types !== []) {
            $weights['type'] = 20;
            $hit = in_array((string) $property['type'], $types, true);
            $earned['type'] = $hit ? 20 : 0;
            if ($hit) {
                $reasons[] = 'Tipologia richiesta: ' . \Mil\Core\Vocab::label('type', (string) $property['type']);
            }
        }

        $sqmMin = (int) ($contact['sqm_min'] ?? 0);
        if ($sqmMin > 0) {
            $weights['sqm'] = 12;
            $sqm = (int) $property['sqm'];
            $earned['sqm'] = $sqm >= $sqmMin ? 12 : ($sqm >= $sqmMin * 0.9 ? 6 : 0);
            if ($sqm >= $sqmMin) {
                $reasons[] = $sqm . ' mq (ne chiedeva almeno ' . $sqmMin . ')';
            }
        }

        $bedMin = (int) ($contact['bedrooms_min'] ?? 0);
        if ($bedMin > 0) {
            $weights['bedrooms'] = 8;
            $hit = (int) $property['bedrooms'] >= $bedMin;
            $earned['bedrooms'] = $hit ? 8 : 0;
            if ($hit) {
                $reasons[] = $property['bedrooms'] . ' camere';
            }
        }

        $totalWeight = array_sum($weights);
        if ($totalWeight === 0) {
            // Nessun criterio espresso: contratto compatibile e basta.
            return ['score' => self::MIN_SCORE, 'reasons' => ['Nessun criterio specifico indicato']];
        }

        return [
            'score' => (int) round(array_sum($earned) / $totalWeight * 100),
            'reasons' => $reasons,
        ];
    }

    /** @return array<int,string> */
    private static function listOf(string $csv): array
    {
        return array_values(array_filter(array_map('trim', explode(',', $csv))));
    }
}
