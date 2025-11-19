import {type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFirstAdmin } from '../api';
import { useBootstrap } from '../App';

export default function BootstrapPage() {
    const { markReady } = useBootstrap();
    const nav = useNavigate();

    const [serviceKey, setServiceKey] = useState('');
    const [username, setUsername] = useState('');
    const [result, setResult] = useState<{ username: string; password: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setErr(null);
        setLoading(true);

        try {
            const res = await createFirstAdmin({ serviceKey, username });
            setResult(res);
        } catch (e: any) {
            setErr(e?.message || 'Ошибка при создании админа');
        } finally {
            setLoading(false);
        }
    }

    function goToLogin() {
        markReady();
        nav('/login', { replace: true });
    }

    return (
        <div className="fullpage-center gradient-bg">
            <div className="card card-narrow">
                <h1>Первичная настройка</h1>
                <p className="muted">
                    В системе ещё нет администраторов. Введите сервисный ключ и логин для первого админа.
                </p>

                <form className="form" onSubmit={onSubmit}>
                    <label className="field">
                        <span>Сервисный ключ</span>
                        <input
                            type="password"
                            value={serviceKey}
                            onChange={e => setServiceKey(e.target.value)}
                            required
                        />
                    </label>

                    <label className="field">
                        <span>Логин первого админа</span>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                        />
                    </label>

                    {err && <div className="alert alert-error">{err}</div>}

                    <button className="btn primary" type="submit" disabled={loading}>
                        {loading ? 'Создаём…' : 'Создать админа'}
                    </button>
                </form>

                {result && (
                    <>
                        <div className="info-block">
                            <h2>Администратор создан</h2>
                            <p className="muted">
                                Сохраните эти данные, потом они не будут показаны повторно.
                            </p>
                            <div className="credentials">
                                <div><strong>Логин:</strong> <code>{result.username}</code></div>
                                <div><strong>Пароль:</strong> <code>{result.password}</code></div>
                            </div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                            <button className="btn primary" type="button" onClick={goToLogin}>
                                Перейти к входу
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
