import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../api';

export default function LoginPage() {
    const [username, setU] = useState('');
    const [password, setP] = useState('');
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const nav = useNavigate();
    const [searchParams] = useSearchParams();
    const inviteToken = searchParams.get('invite');

    useEffect(() => {
        document.body.classList.remove('app-shell-mode');
    }, []);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setErr(null);
        setLoading(true);
        try {
            await login(username, password);
            const target = inviteToken ? `/invite/${encodeURIComponent(inviteToken)}` : '/';
            nav(target, { replace: true });
        } catch (e: any) {
            setErr(e?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-root client-theme">
            <div className="auth-card">
                <h1 className="auth-title">Confa</h1>
                <p className="auth-subtitle">Войдите, чтобы присоединиться к встрече</p>
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
                        />
                    </label>

                    <label className="field">
                        <span>Пароль</span>
                        <input
                            placeholder="password"
                            type="password"
                            value={password}
                            onChange={e => setP(e.target.value)}
                            autoComplete="current-password"
                        />
                    </label>

                    {err && <div className="alert alert-error">{err}</div>}

                    <button className="btn primary" type="submit" disabled={loading}>
                        {loading ? 'Входим…' : 'Войти'}
                    </button>
                </form>
            </div>
        </div>
    );
}
