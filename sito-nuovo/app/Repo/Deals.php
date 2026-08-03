<?php

declare(strict_types=1);

namespace Mil\Repo;

use Mil\Core\Auth;
use Mil\Core\Db;

/**
 * Proposte d'acquisto e valutazioni.
 *
 * Sono le due cose che oggi vivono su carta o nelle chat: quanto è stato
 * offerto su un immobile e quanto è stato promesso a un proprietario.
 * Entrambe tornano utili mesi dopo, quando nessuno ricorda più i numeri.
 */
final class Deals
{
    // ------------------------------------------------------------ proposte

    /** @return array<int,array<string,mixed>> */
    public static function offersFor(int $propertyId): array
    {
        return Db::all(
            'SELECT o.*, c.name AS contact_name, c.phone AS contact_phone, u.name AS user_name
             FROM offers o
             LEFT JOIN contacts c ON c.id = o.contact_id
             LEFT JOIN users u ON u.id = o.user_id
             WHERE o.property_id = :id
             ORDER BY o.presented_at DESC, o.id DESC',
            ['id' => $propertyId]
        );
    }

    /** @return array<int,array<string,mixed>> */
    public static function offersBy(int $contactId): array
    {
        return Db::all(
            'SELECT o.*, p.title AS property_title, p.slug AS property_slug
             FROM offers o LEFT JOIN properties p ON p.id = o.property_id
             WHERE o.contact_id = :id ORDER BY o.presented_at DESC',
            ['id' => $contactId]
        );
    }

    /** @return array<string,mixed>|null */
    public static function offer(int $id): ?array
    {
        return Db::one('SELECT * FROM offers WHERE id = :id', ['id' => $id]);
    }

    /** @param array<string,mixed> $data */
    public static function createOffer(array $data): int
    {
        $data['user_id'] = Auth::id();
        $data['created_at'] = Db::now();
        $data['presented_at'] = $data['presented_at'] ?? Db::now();

        return Db::insert('offers', $data);
    }

    /**
     * Cambia lo stato di una proposta. Accettarla porta l'immobile a
     * `proposta` e lo mette sotto proposta anche in vetrina: due sistemi
     * disallineati sono il modo più veloce di far fare a un collega una
     * visita su un immobile già impegnato.
     */
    public static function setOfferStatus(int $id, string $status): void
    {
        $offer = self::offer($id);
        if ($offer === null) {
            return;
        }

        Db::update('offers', $id, ['status' => $status, 'replied_at' => Db::now()]);

        if ($status === 'accettata') {
            Db::update('properties', (int) $offer['property_id'], [
                'deal_stage' => 'proposta',
                'status' => 'reserved',
                'updated_at' => Db::now(),
            ]);
        }
    }

    public static function deleteOffer(int $id): void
    {
        Db::delete('offers', $id);
    }

    /** Proposte aperte su tutto il portafoglio. @return array<int,array<string,mixed>> */
    public static function openOffers(int $limit = 20): array
    {
        return Db::all(
            "SELECT o.*, p.title AS property_title, c.name AS contact_name
             FROM offers o
             LEFT JOIN properties p ON p.id = o.property_id
             LEFT JOIN contacts c ON c.id = o.contact_id
             WHERE o.status = 'presentata'
             ORDER BY o.presented_at DESC LIMIT {$limit}"
        );
    }

    // -------------------------------------------------------- valutazioni

    /** @return array<int,array<string,mixed>> */
    public static function valuationsFor(int $propertyId): array
    {
        return Db::all(
            'SELECT v.*, u.name AS user_name
             FROM valuations v LEFT JOIN users u ON u.id = v.user_id
             WHERE v.property_id = :id ORDER BY v.created_at DESC',
            ['id' => $propertyId]
        );
    }

    /** @param array<string,mixed> $data */
    public static function createValuation(array $data): int
    {
        $data['user_id'] = Auth::id();
        $data['created_at'] = Db::now();

        return Db::insert('valuations', $data);
    }

    public static function deleteValuation(int $id): void
    {
        Db::delete('valuations', $id);
    }

    /** @return array<int,array<string,mixed>> */
    public static function latestValuations(int $limit = 20): array
    {
        return Db::all(
            "SELECT v.*, u.name AS user_name, p.title AS property_title
             FROM valuations v
             LEFT JOIN users u ON u.id = v.user_id
             LEFT JOIN properties p ON p.id = v.property_id
             ORDER BY v.created_at DESC LIMIT {$limit}"
        );
    }

    // ------------------------------------------------------------- report

    /**
     * Da dove arrivano i clienti che hanno davvero comprato o venduto.
     * È il numero che dice dove conviene spendere il tempo.
     *
     * @return array<int,array<string,mixed>>
     */
    public static function sourceReport(): array
    {
        return Db::all(
            "SELECT c.source,
                    COUNT(*) AS totale,
                    SUM(CASE WHEN c.status = 'chiuso' THEN 1 ELSE 0 END) AS chiusi
             FROM contacts c
             WHERE c.source <> ''
             GROUP BY c.source
             ORDER BY chiusi DESC, totale DESC"
        );
    }

    /**
     * Compravendite concluse e provvigioni maturate nell'anno indicato.
     *
     * @return array<string,mixed>
     */
    public static function yearSummary(?int $year = null): array
    {
        $year = $year ?? (int) date('Y');

        $row = Db::one(
            "SELECT COUNT(*) AS rogiti,
                    SUM(sold_price) AS volume,
                    SUM(COALESCE(commission_seller, 0) + COALESCE(commission_buyer, 0)) AS provvigioni
             FROM properties
             WHERE deed_date IS NOT NULL AND deed_date <> ''
               AND deed_date >= :da AND deed_date <= :a",
            ['da' => $year . '-01-01', 'a' => $year . '-12-31']
        );

        return [
            'anno' => $year,
            'rogiti' => (int) ($row['rogiti'] ?? 0),
            'volume' => (float) ($row['volume'] ?? 0),
            'provvigioni' => (float) ($row['provvigioni'] ?? 0),
        ];
    }

    /**
     * Giorni medi fra pubblicazione e rogito, sugli immobili conclusi.
     * Restituisce null se non ci sono ancora abbastanza dati per dirlo.
     */
    public static function averageDaysToSale(): ?int
    {
        $rows = Db::all(
            "SELECT published_at, created_at, deed_date FROM properties
             WHERE deed_date IS NOT NULL AND deed_date <> ''"
        );

        $giorni = [];
        foreach ($rows as $row) {
            $inizio = strtotime((string) ($row['published_at'] ?: $row['created_at']));
            $fine = strtotime((string) $row['deed_date']);
            if ($inizio !== false && $fine !== false && $fine > $inizio) {
                $giorni[] = (int) round(($fine - $inizio) / 86400);
            }
        }

        return $giorni === [] ? null : (int) round(array_sum($giorni) / count($giorni));
    }
}
