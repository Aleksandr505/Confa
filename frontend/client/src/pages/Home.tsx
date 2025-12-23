import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { acceptInvite, createRoom, fetchMyRooms, type RoomAccess } from '../api';
import '../styles/login.css';

function normalizeRoomName(raw: string) {
    return raw
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .toLowerCase();
}

export default function HomePage() {
    const [rooms, setRooms] = useState<RoomAccess[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [roomName, setRoomName] = useState('my-room');
    const [isPrivate, setIsPrivate] = useState(true);
    const [creating, setCreating] = useState(false);
    const [inviteToken, setInviteToken] = useState('');
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteBusy, setInviteBusy] = useState(false);
    const nav = useNavigate();

    useEffect(() => {
        loadRooms();
    }, []);

    async function loadRooms() {
        setLoading(true);
        setErr(null);
        try {
            const list = await fetchMyRooms();
            setRooms(list);
            if (list.length === 0) {
                setRoomName('my-room');
            }
        } catch (e: any) {
            setErr(e?.message || 'Не удалось получить список комнат');
        } finally {
            setLoading(false);
        }
    }

    async function onCreateRoom(e: FormEvent) {
        e.preventDefault();
        const slug = normalizeRoomName(roomName);
        if (!slug || slug.length < 3) {
            setErr('Название должно содержать минимум 3 символа (a-z, 0-9, -, _)');
            return;
        }
        setErr(null);
        setCreating(true);
        try {
            const room = await createRoom({ name: slug, isPrivate });
            setRooms(prev => [room, ...prev.filter(r => r.id !== room.id)]);
            nav(`/room/${encodeURIComponent(room.name)}`);
        } catch (e: any) {
            setErr(e?.message || 'Не удалось создать комнату');
        } finally {
            setCreating(false);
        }
    }

    async function onAcceptInvite(e: FormEvent) {
        e.preventDefault();
        const token = inviteToken.trim();
        if (!token) {
            setInviteError('Введите токен приглашения');
            return;
        }
        setInviteBusy(true);
        setInviteError(null);
        try {
            const room = await acceptInvite(token);
            setRooms(prev => [room, ...prev.filter(r => r.id !== room.id)]);
            nav(`/room/${encodeURIComponent(room.name)}`);
        } catch (e: any) {
            setInviteError(e?.message || 'Не удалось принять приглашение');
        } finally {
            setInviteBusy(false);
        }
    }

    return (
        <div className="auth-root client-theme">
            <div className="auth-card">
                <h1 className="auth-title">Confa</h1>
                <p className="auth-subtitle">Комнаты с вашим доступом</p>

                {err && <div className="alert alert-error">{err}</div>}
                {loading ? (
                    <div className="spinner" aria-label="loading" />
                ) : rooms.length === 0 ? (
                    <div className="alert">У вас пока нет комнат. Создайте личную комнату ниже или примите приглашение.</div>
                ) : (
                    <div className="room-list">
                        {rooms.map(room => (
                            <div className="room-row" key={room.id}>
                                <div className="room-info">
                                    <div className="room-name">{room.name}</div>
                                    <div className="room-meta">
                                        <span className="pill">{room.role === 'OWNER' ? 'Владелец' : 'Участник'}</span>
                                        {room.isPrivate && <span className="pill pill-muted">Private</span>}
                                    </div>
                                </div>
                                <button
                                    className="btn primary"
                                    type="button"
                                    onClick={() => nav(`/room/${encodeURIComponent(room.name)}`)}
                                >
                                    Перейти
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <hr className="divider" />

                <form className="auth-form" onSubmit={onCreateRoom}>
                    <label className="field">
                        <span>Создать новую комнату</span>
                        <input
                            value={roomName}
                            onChange={e => {
                                setRoomName(e.target.value);
                                setErr(null);
                            }}
                            placeholder="team-sync или demo"
                        />
                    </label>
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={isPrivate}
                            onChange={e => setIsPrivate(e.target.checked)}
                        />
                        <span>Сделать комнату приватной (доступ только по инвайту)</span>
                    </label>
                    <button className="btn primary" type="submit" disabled={creating}>
                        {creating ? 'Создаём…' : 'Создать и зайти'}
                    </button>
                </form>

                <form className="auth-form" onSubmit={onAcceptInvite}>
                    <label className="field">
                        <span>Есть приглашение?</span>
                        <input
                            value={inviteToken}
                            onChange={e => {
                                setInviteToken(e.target.value);
                                setInviteError(null);
                            }}
                            placeholder="Вставьте токен приглашения"
                        />
                    </label>
                    {inviteError && <div className="alert alert-error">{inviteError}</div>}
                    <button className="btn ghost" type="submit" disabled={inviteBusy}>
                        {inviteBusy ? 'Принимаем…' : 'Принять приглашение'}
                    </button>
                </form>

                <button className="btn ghost small" type="button" onClick={loadRooms}>
                    Обновить список
                </button>
            </div>
        </div>
    );
}
