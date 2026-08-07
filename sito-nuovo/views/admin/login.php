<?php

/** @var string $error */

use Mil\Core\Csrf;
?>
<main class="login">
  <h1>Gestionale<span>Mondo Immobiliare</span></h1>

  <?php if ($error !== ''): ?>
    <p class="flash flash-error"><?= e($error) ?></p>
  <?php endif; ?>

  <form method="post" class="form">
    <?= Csrf::field() ?>
    <label>Email
      <input type="email" name="email" required autocomplete="username" autofocus>
    </label>
    <label>Password
      <input type="password" name="password" required autocomplete="current-password">
    </label>
    <button type="submit" class="btn btn-primary">Entra</button>
  </form>

  <p class="login-back"><a href="<?= e(url('/')) ?>">← Torna al sito</a></p>
</main>
