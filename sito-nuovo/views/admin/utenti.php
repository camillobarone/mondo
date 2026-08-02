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
          <td><?= $u['role'] === 'admin' ? 'Amministratore' : 'Agente' ?></td>
          <td><?= e(!empty($u['last_login_at']) ? data_it((string) $u['last_login_at'], true) : 'mai') ?></td>
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
      <label>Email<input type="email" name="email" required autocomplete="off"></label>
      <label>Telefono<input type="tel" name="phone"></label>
      <label>Ruolo
        <select name="role">
          <option value="agent">Agente</option>
          <option value="admin">Amministratore</option>
        </select>
      </label>
      <label>Password <small>almeno 10 caratteri</small>
        <input type="password" name="password" required minlength="10" autocomplete="new-password">
      </label>
      <button class="btn btn-primary">Crea utente</button>
    </form>
  </div>
</div>
