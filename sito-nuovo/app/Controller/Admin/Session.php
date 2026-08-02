<?php

declare(strict_types=1);

namespace Mil\Controller\Admin;

use Mil\Core\Auth;
use Mil\Core\Csrf;
use Mil\Core\Router;
use Mil\Core\Session as Sess;
use Mil\Core\View;
use Mil\Repo\Log;

final class Session
{
    public static function login(): void
    {
        if (Auth::check()) {
            Router::redirect('/gestionale/');
        }

        $error = '';

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();
            $email = (string) ($_POST['email'] ?? '');

            if (Auth::attempt($email, (string) ($_POST['password'] ?? ''))) {
                Log::write('login', 'user', Auth::id());
                $after = Sess::get('_after_login');
                Sess::forget('_after_login');
                Router::redirect(is_string($after) ? $after : '/gestionale/');
            }

            // Messaggio identico per email inesistente e password errata:
            // non si regala l'informazione su quali account esistono.
            $error = 'Email o password non corretti.';
            usleep(300_000);
        }

        View::show('admin/login', ['error' => $error], 'layout/vuoto');
    }

    public static function logout(): void
    {
        Log::write('logout', 'user', Auth::id());
        Auth::logout();
        Router::redirect('/gestionale/login/');
    }
}
