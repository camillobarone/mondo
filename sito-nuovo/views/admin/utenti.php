<?php

/** @var array<int,array<string,mixed>> $utenti */

use Mil\Core\Csrf;
?>
<div class="due-colonne">
  <div class="pannello">
    <h2>Utenti</h2>
    <table class="tabella">
      <thead><tr><th>Nome</th><th>Email</th><th>Ruolo</th><th>Ultimo accesso</th></tr></thead>
      <tbody>
      <?php foreach ($utenti as $u): ?>
        <tr class="<?= (int) $u['active'] === 0 ? 'spento' : '' ?>">
          <td><a href="<?= e(url('/gestionale/utenti/' . $u['id'] . '/')) ?>"><?= e((string) $u['name']) ?></a></td>
          <td><small><?= e((string) $u['email']) ?></small></td>
          <td><?= ['admin' => 'Amministratore', 'firma' => 'Solo firma'][$u['role']] ?? 'Agente' ?></td>
          <td><?= $u['role'] === 'firma'
                ? '<small class="muto">non entra</small>'
                : e(!empty($u['last_login_at']) ? data_it((string) $u['last_login_at'], true) : 'mai') ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>

  <div class="pannello">
    <h2>Nuovo utente</h2>
    <form method="post" class="form">
      <?= Csrf::field() ?>
      <label>Nome<input type="text" name="name" required></label>
      <label>Email <small>per «Solo firma» va bene quella dell’agenzia, anche ripetuta</small>
        <input type="email" name="email" required autocomplete="off">
      </label>
      <label>Telefono<input type="tel" name="phone"></label>
      <label>Ruolo
        <select name="role">
          <option value="agent">Agente</option>
          <option value="admin">Amministratore</option>
          <option value="firma">Solo firma — non entra nel gestionale</option>
        </select>
      </label>
      <?php /* La password non è `required`: con «Solo firma» non serve, e
               senza JavaScript non si può togliere l'obbligo al volo. Il
               controllo vero è nel controller, che è dove deve stare. */ ?>
      <label>Password <small>almeno 10 caratteri — lasciala vuota per «Solo firma»</small>
        <input type="password" name="password" minlength="10" autocomplete="new-password">
      </label>
      <button class="btn btn-primary">Crea utente</button>
    </form>
  </div>
</div>
