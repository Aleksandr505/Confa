import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login, register } from '../api';

type AuthMode = 'login' | 'register';

const REGISTRATION_USERNAME_PATTERN = '[A-Za-z0-9._-]{3,64}';

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export default function LoginPage() {
    const [username, setU] = useState('');
    const [password, setP] = useState('');
    const [err, setErr] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<AuthMode>('login');
    const nav = useNavigate();
    const [searchParams] = useSearchParams();
    const inviteToken = searchParams.get('invite');

    useEffect(() => {
        document.body.classList.remove('app-shell-mode');
    }, []);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setErr(null);
        setNotice(null);
        setLoading(true);
        try {
            if (mode === 'register') {
                await register(username, password);
                setP('');
                setMode('login');
                setNotice('Заявка отправлена. Администратор должен одобрить аккаунт перед входом.');
            } else {
                await login(username, password);
                const target = inviteToken ? `/invite/${encodeURIComponent(inviteToken)}` : '/';
                nav(target, { replace: true });
            }
        } catch (e: unknown) {
            setErr(errorMessage(e, mode === 'register' ? 'Registration failed' : 'Login failed'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-root client-theme">
            <div className="auth-card">
                <h1 className="auth-title">Confa</h1>
                <p className="auth-subtitle">
                    {mode === 'register'
                        ? 'Создайте заявку на доступ к системе'
                        : 'Войдите, чтобы присоединиться к встрече'}
                </p>
                {inviteToken && (
                    <p className="auth-subtitle" style={{ fontSize: 13 }}>
                        После входа мы примем приглашение автоматически.
                    </p>
                )}

                <form className="auth-form" onSubmit={onSubmit}>
                    <label className="field">
                        <span>Логин</span>
                        <input
                            placeholder="username"
                            value={username}
                            onChange={e => setU(e.target.value)}
                            autoComplete="username"
                            required
                            minLength={mode === 'register' ? 3 : undefined}
                            maxLength={mode === 'register' ? 64 : undefined}
                            pattern={mode === 'register' ? REGISTRATION_USERNAME_PATTERN : undefined}
                            title={mode === 'register' ? '3-64 символа: латиница, цифры, точка, дефис или подчёркивание' : undefined}
                        />
                    </label>

                    <label className="field">
                        <span>Пароль</span>
                        <input
                            placeholder="password"
                            type="password"
                            value={password}
                            onChange={e => setP(e.target.value)}
                            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                            required
                            minLength={mode === 'register' ? 8 : undefined}
                            maxLength={mode === 'register' ? 128 : undefined}
                        />
                    </label>

                    {notice && <div className="alert alert-success">{notice}</div>}
                    {err && <div className="alert alert-error">{err}</div>}

                    <button className="btn primary" type="submit" disabled={loading}>
                        {loading
                            ? (mode === 'register' ? 'Отправляем…' : 'Входим…')
                            : (mode === 'register' ? 'Отправить заявку' : 'Войти')}
                    </button>
                </form>

                <div className="auth-switch">
                    <span>
                        {mode === 'register'
                            ? 'Уже есть одобренный аккаунт?'
                            : 'Нет аккаунта?'}
                    </span>
                    <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => {
                            setMode(mode === 'register' ? 'login' : 'register');
                            setErr(null);
                            setNotice(null);
                        }}
                    >
                        {mode === 'register' ? 'Войти' : 'Зарегистрироваться'}
                    </button>
                </div>
            </div>
        </div>
    );
}
