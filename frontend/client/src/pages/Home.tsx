import {type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';

export default function HomePage() {
    const [room, setRoom] = useState('demo');
    const [err, setErr] = useState<string | null>(null);
    const nav = useNavigate();

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        const value = room.trim();
        if (!value) {
            setErr('Введите название комнаты');
            return;
        }
        setErr(null);
        nav(`/room/${encodeURIComponent(value)}`);
    }

    return (
        <div className="auth-root client-theme">
            <div className="auth-card">
                <h1 className="auth-title">Confa</h1>
                <p className="auth-subtitle">Выберите комнату для встречи</p>

                <form className="auth-form" onSubmit={onSubmit}>
                    <label className="field">
                        <span>Название комнаты</span>
                        <input
                            value={room}
                            onChange={e => setRoom(e.target.value)}
                            placeholder="Например: demo, team-chat..."
                        />
                    </label>
                    {err && <div className="alert alert-error">{err}</div>}
                    <button className="btn primary" type="submit">
                        Перейти в комнату
                    </button>
                </form>
            </div>
        </div>
    );
}
