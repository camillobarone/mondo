<?php

declare(strict_types=1);

/**
 * Mappa delle URL. Gli slug pubblici sono in italiano e ricalcano quelli del
 * sito attuale: è la condizione per riusare i redirect esistenti senza
 * riscriverli uno per uno.
 *
 * @var \Mil\Core\Router $router
 */

use Mil\Controller\Admin\AgendaController;
use Mil\Controller\Admin\ContactController;
use Mil\Controller\Admin\ContentController;
use Mil\Controller\Admin\ImportController;
use Mil\Controller\Admin\Dashboard;
use Mil\Controller\Admin\LeadController;
use Mil\Controller\Admin\PropertyController;
use Mil\Controller\Admin\Session as AdminSession;
use Mil\Controller\Admin\SystemController;
use Mil\Controller\Site\Feeds;
use Mil\Controller\Site\Forms;
use Mil\Controller\Site\Journal;
use Mil\Controller\Site\Listings;
use Mil\Controller\Site\Pages;

// ------------------------------------------------------------------ pubblico

$router->get('/', [Pages::class, 'home']);
$router->get('/immobili', [Listings::class, 'index']);
$router->get('/immobili/{slug}', [Listings::class, 'show']);
$router->get('/blog', [Journal::class, 'index']);
$router->get('/blog/{slug}', [Journal::class, 'show']);
$router->get('/contatti', [Pages::class, 'contatti']);
$router->get('/valutazione-gratuita', [Pages::class, 'valutazione']);

$router->post('/invia-richiesta', [Forms::class, 'submit']);

$router->get('/sitemap.xml', [Feeds::class, 'sitemap']);
$router->get('/robots.txt', [Feeds::class, 'robots']);

// Qualsiasi altro percorso: prima i redirect 301, poi le pagine statiche,
// e solo alla fine il 404.
$router->fallback([Pages::class, 'catchAll']);

// --------------------------------------------------------------- gestionale

$router->any('/gestionale/login', [AdminSession::class, 'login']);
$router->get('/gestionale/logout', [AdminSession::class, 'logout']);

$router->get('/gestionale', [Dashboard::class, 'index']);

$router->get('/gestionale/immobili', [PropertyController::class, 'index']);
$router->any('/gestionale/immobili/nuovo', [PropertyController::class, 'create']);
$router->any('/gestionale/immobili/{id}', [PropertyController::class, 'edit']);
$router->post('/gestionale/immobili/{id}/foto', [PropertyController::class, 'uploadPhotos']);
$router->post('/gestionale/immobili/{id}/foto/aggiorna', [PropertyController::class, 'managePhotos']);

// Importazione da WordPress: dal gestionale, non solo da riga di comando.
$router->get('/gestionale/importa', [ImportController::class, 'page']);
$router->get('/gestionale/importa/lavora', [ImportController::class, 'work']);
$router->post('/gestionale/importa/campi', [ImportController::class, 'census']);
$router->post('/gestionale/importa/prova', [ImportController::class, 'preview']);
$router->post('/gestionale/importa/avvia', [ImportController::class, 'start']);
$router->post('/gestionale/immobili/{id}/foto/{imageId}/elimina', [PropertyController::class, 'deletePhoto']);
$router->post('/gestionale/immobili/{id}/elimina', [PropertyController::class, 'destroy']);
$router->get('/gestionale/immobili/{id}/abbinamenti', [PropertyController::class, 'matches']);
$router->post('/gestionale/immobili/{id}/proposte', [PropertyController::class, 'addOffer']);
$router->post('/gestionale/immobili/{id}/proposte/{offerId}/stato', [PropertyController::class, 'offerStatus']);
$router->post('/gestionale/immobili/{id}/proposte/{offerId}/elimina', [PropertyController::class, 'deleteOffer']);

$router->get('/gestionale/richieste', [LeadController::class, 'index']);
$router->any('/gestionale/richieste/{id}', [LeadController::class, 'show']);

$router->get('/gestionale/clienti', [ContactController::class, 'index']);
$router->any('/gestionale/clienti/nuovo', [ContactController::class, 'create']);
$router->any('/gestionale/clienti/{id}', [ContactController::class, 'edit']);
$router->post('/gestionale/clienti/{id}/elimina', [ContactController::class, 'destroy']);
$router->get('/gestionale/clienti/{id}/abbinamenti', [ContactController::class, 'matches']);

$router->any('/gestionale/agenda', [AgendaController::class, 'index']);
$router->post('/gestionale/agenda/{id}/fatto', [AgendaController::class, 'toggle']);
$router->post('/gestionale/agenda/{id}/elimina', [AgendaController::class, 'destroy']);

$router->get('/gestionale/articoli', [ContentController::class, 'posts']);
$router->any('/gestionale/articoli/nuovo', [ContentController::class, 'createPost']);
$router->any('/gestionale/articoli/{id}', [ContentController::class, 'editPost']);
$router->post('/gestionale/articoli/{id}/elimina', [ContentController::class, 'destroyPost']);

$router->get('/gestionale/pagine', [ContentController::class, 'pages']);
$router->any('/gestionale/pagine/nuova', [ContentController::class, 'createPage']);
$router->any('/gestionale/pagine/{id}', [ContentController::class, 'editPage']);
$router->post('/gestionale/pagine/{id}/elimina', [ContentController::class, 'destroyPage']);

$router->any('/gestionale/redirect', [SystemController::class, 'redirects']);
$router->post('/gestionale/redirect/{id}/elimina', [SystemController::class, 'destroyRedirect']);
$router->any('/gestionale/utenti', [SystemController::class, 'users']);
$router->any('/gestionale/utenti/{id}', [SystemController::class, 'editUser']);
$router->any('/gestionale/impostazioni', [SystemController::class, 'settings']);
