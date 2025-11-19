import {type FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginAdmin } from '../api';

export default function LoginPage() {
    const [username, setU] = useState('');
    const [password, setP] = useState('');
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const nav = useNavigate();
    const location = useLocation() as any;
    const from = location.state?.from?.pathname || '/';

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setErr(null);
        setLoading(true);
        try {
            await loginAdmin(username, password);
            nav(from, { replace: true });
        } catch (e: any) {
            setErr(e?.message || 'Ошибка авторизации');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fullpage-center gradient-bg">
            <div className="card card-narrow">
                <h1>Админ-панель</h1>
                <p className="muted">Введите логин и пароль администратора.</p>

                <form className="form" onSubmit={onSubmit}>
                    <label className="field">
                        <span>Логин</span>
                        <input
                            value={username}
                            onChange={e => setU(e.target.value)}
                            autoComplete="username"
                        />
                    </label>

                    <label className="field">
                        <span>Пароль</span>
                        <input
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
