<?php

/** @var array<string,mixed> $u */

use Mil\Core\Auth;
use Mil\Core\Csrf;
?>
<form method="post" class="form pannello">
  <?= Csrf::field() ?>
  <h2><?= e((string) $u['email']) ?></h2>

  <div class="form-row">
    <label>Nome<input type="text" name="name" value="<?= e((string) $u['name']) ?>" required></label>
    <label>Telefono<input type="tel" name="phone" value="<?= e((string) $u['phone']) ?>"></label>
    <label>Ruolo
      <select name="role" <?= (int) $u['id'] === Auth::id() ? 'disabled' : '' ?>>
        <option value="agent" <?= $u['role'] === 'agent' ? 'selected' : '' ?>>Agente</option>
        <option value="admin" <?= $u['role'] === 'admin' ? 'selected' : '' ?>>Amministratore</option>
        <option value="firma" <?= $u['role'] === 'firma' ? 'selected' : '' ?>>Solo firma — non entra</option>
      </select>
      <?php if ((int) $u['id'] === Auth::id()): ?>
        <small>Non puoi cambiare il ruolo a te stesso: resteresti chiuso fuori.</small>
      <?php endif; ?>
    </label>
  </div>

  <label>Bio <small>compare in fondo agli articoli firmati. Si può usare **grassetto** e *corsivo*</small>
    <textarea name="bio" rows="4"><?= e((string) $u['bio']) ?></textarea>
  </label>

  <?php if ($u['role'] !== 'firma'): ?>
    <label>Nuova password <small>lascia vuoto per non cambiarla</small>
      <input type="password" name="password" minlength="10" autocomplete="new-password">
    </label>
  <?php else: ?>
    <p class="muto">Questo account non entra nel gestionale: non ha password.
      Per dargliela, cambia il ruolo in Agente e salva.</p>
  <?php endif; ?>

  <label class="check">
    <input type="checkbox" name="active" value="1" <?= (int) $u['active'] === 1 ? 'checked' : '' ?>
      <?= (int) $u['id'] === Auth::id() ? 'disabled' : '' ?>>
    Account attivo
    <?php if ((int) $u['id'] === Auth::id()): ?><small>Non puoi disattivare il tuo stesso account.</small><?php endif; ?>
  </label>

  <button class="btn btn-primary">Salva</button>
  <p class="muto"><a href="<?= e(url('/gestionale/utenti/')) ?>">← Torna all’elenco</a></p>
</form>
