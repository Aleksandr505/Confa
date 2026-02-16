import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, fetchMyRoomsSummary, type RoomAccessSummary } from '../api';
import '../styles/login.css';
import '../styles/home.css';

function normalizeRoomName(raw: string) {
    return raw
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .toLowerCase();
}

export default function HomePage() {
    const [rooms, setRooms] = useState<RoomAccessSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [roomName, setRoomName] = useState('my-room');
    const [creating, setCreating] = useState(false);
    const nav = useNavigate();

    useEffect(() => {
        document.body.classList.remove('app-shell-mode');
    }, []);

    const loadRoomOrder = () => {
        try {
            const raw = localStorage.getItem('confa:roomLastVisited');
            return raw ? (JSON.parse(raw) as Record<string, number>) : {};
        } catch (e) {
            console.warn('Failed to load room order', e);
            return {};
        }
    };

    const storeRoomVisit = (name: string) => {
        try {
            const order = loadRoomOrder();
            order[name] = Date.now();
            localStorage.setItem('confa:roomLastVisited', JSON.stringify(order));
        } catch (e) {
            console.warn('Failed to store room order', e);
        }
    };

    useEffect(() => {
        loadRooms();
    }, []);

    async function loadRooms() {
        setLoading(true);
        setErr(null);
        try {
            const list = await fetchMyRoomsSummary();
            const order = loadRoomOrder();
            const sorted = list.slice().sort((a, b) => {
                const aOrder = order[a.name] ?? 0;
                const bOrder = order[b.name] ?? 0;
                if (aOrder === bOrder) return 0;
                return bOrder - aOrder;
            });
            setRooms(sorted);
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
            const room = await createRoom({ name: slug });
            const summary: RoomAccessSummary = {
                ...room,
                participantCount: 0,
                participantNames: [],
            };
            storeRoomVisit(room.name);
            setRooms(prev => [summary, ...prev.filter(r => r.id !== room.id)]);
            nav(`/room/${encodeURIComponent(room.name)}`);
        } catch (e: any) {
            const message = typeof e?.message === 'string' && e.message.startsWith('409')
                ? 'Такая комната уже существует. Выберите другое имя или попросите инвайт.'
                : e?.message || 'Не удалось создать комнату';
            setErr(message);
        } finally {
            setCreating(false);
        }
    }

    return (
        <div className="auth-root client-theme home-root">
            <a
                className="switch-to-shell"
                href="/app"
                target="_blank"
                rel="noreferrer"
                title="Open Messenger"
            >
                ⦿
            </a>
            <div className="auth-card">
                <h1 className="auth-title">Confa</h1>
                <p className="auth-subtitle">Комнаты:</p>

                {err && <div className="alert alert-error">{err}</div>}
                {loading ? (
                    <div className="spinner" aria-label="loading" />
                ) : rooms.length === 0 ? (
                    <div className="alert">У вас пока нет комнат. Создайте личную комнату ниже или примите приглашение.</div>
                ) : (
                    <div className="room-list">
                        {rooms.map(room => {
                            const names = (room.participantNames || []).filter(Boolean);
                            const tooltip =
                                names.length > 0 ? names.join(', ') : 'Сейчас в комнате никого нет';
                            const hasParticipants = (room.participantCount ?? 0) > 0;
                            return (
                            <div className="room-row" key={room.id}>
                                <div className="room-info">
                                    <div className="room-name">{room.name}</div>
                                    <div className="room-meta">
                                        <span className="pill">{room.role === 'OWNER' ? 'Владелец' : 'Участник'}</span>
                                        <span
                                            className={`pill pill-muted room-tooltip${hasParticipants ? ' pill-online' : ''}`}
                                            title={tooltip}
                                            data-tooltip={tooltip}
                                        >
                                            {room.participantCount ?? 0} online
                                        </span>
                                    </div>
                                </div>
                                <button
                                    className="btn primary"
                                    type="button"
                                    onClick={() => {
                                        storeRoomVisit(room.name);
                                        nav(`/room/${encodeURIComponent(room.name)}`);
                                    }}
                                >
                                    Перейти
                                </button>
                            </div>
                        );
                        })}
                    </div>
                )}

                <hr className="divider divider-spaced" />

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
                    <button className="btn primary" type="submit" disabled={creating}>
                        {creating ? 'Создаём…' : 'Создать и зайти'}
                    </button>
                </form>

            </div>
        </div>
    );
}
