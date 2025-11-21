import { useEffect, useMemo, useState } from 'react';
import {
    type AgentInfoDto,
    fetchActiveRooms,
    fetchAgentsByRoom,
    fetchParticipantsByRoom,
    kickAgent,
    type ParticipantInfoDto,
    type RoomSummaryDto,
} from '../api';

type FilterMode = 'all' | 'agents' | 'users';

type CombinedRow = ParticipantInfoDto & {
    isAgent: boolean;
    muted?: boolean;
};

export default function RoomsPage() {
    const [rooms, setRooms] = useState<RoomSummaryDto[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

    const [participants, setParticipants] = useState<ParticipantInfoDto[]>([]);
    const [agents, setAgents] = useState<AgentInfoDto[]>([]);

    const [roomsLoading, setRoomsLoading] = useState(true);
    const [listLoading, setListLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [filter, setFilter] = useState<FilterMode>('agents');

    useEffect(() => {
        (async () => {
            setRoomsLoading(true);
            setErr(null);
            try {
                const data = await fetchActiveRooms();
                setRooms(data);
                if (data.length > 0 && !selectedRoom) {
                    setSelectedRoom(data[0].name);
                }
            } catch (e: any) {
                setErr(e?.message || 'Не удалось получить список комнат');
            } finally {
                setRoomsLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        if (!selectedRoom) return;

        (async () => {
            setListLoading(true);
            setErr(null);
            try {
                const [p, a] = await Promise.all([
                    fetchParticipantsByRoom(selectedRoom),
                    fetchAgentsByRoom(selectedRoom),
                ]);
                setParticipants(p);
                setAgents(a);
            } catch (e: any) {
                setErr(e?.message || 'Не удалось получить участников комнаты');
            } finally {
                setListLoading(false);
            }
        })();
    }, [selectedRoom]);

    const rows: CombinedRow[] = useMemo(() => {
        const byIdentity = new Map<string, AgentInfoDto>();
        agents.forEach(a => byIdentity.set(a.identity, a));

        return participants.map(p => {
            const agent = byIdentity.get(p.identity);
            const isAgent = !!agent || p.identity.startsWith('agent-');
            return {
                ...p,
                isAgent,
                muted: agent?.muted,
            };
        });
    }, [participants, agents]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (filter === 'agents') return r.isAgent;
            if (filter === 'users') return !r.isAgent;
            return true;
        });
    }, [rows, filter]);

    async function handleKick(row: CombinedRow) {
        if (!selectedRoom) return;
        if (!row.isAgent) {
            alert('Кикать из этой панели можно только агентов');
            return;
        }
        if (!confirm(`Выгнать агента ${row.identity} из комнаты ${selectedRoom}?`)) return;

        try {
            await kickAgent(selectedRoom, { agentIdentity: row.identity });
            const [p, a] = await Promise.all([
                fetchParticipantsByRoom(selectedRoom),
                fetchAgentsByRoom(selectedRoom),
            ]);
            setParticipants(p);
            setAgents(a);
        } catch (e: any) {
            alert(e?.message || 'Не удалось выгнать агента');
        }
    }

    const currentRoomInfo = rooms.find(r => r.name === selectedRoom);

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1>Комнаты и агенты</h1>
                    <p className="muted">
                        Мониторинг активных комнат, агентов и участников LiveKit.
                    </p>
                </div>
            </div>

            {err && <div className="alert alert-error">{err}</div>}

            <div className="card card-inline">
                <div className="room-toolbar">
                    <div className="room-select-block">
                        <span className="label">Комната</span>
                        {roomsLoading ? (
                            <div className="spinner-row">
                                <div className="spinner" />
                                <span>Загрузка комнат…</span>
                            </div>
                        ) : rooms.length === 0 ? (
                            <span className="muted">Активных комнат нет.</span>
                        ) : (
                            <select
                                value={selectedRoom ?? ''}
                                onChange={e => setSelectedRoom(e.target.value || null)}
                            >
                                {rooms.map(r => (
                                    <option key={r.name} value={r.name}>
                                        {r.name} ({r.numParticipants})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="room-filters">
                        <span className="label">Фильтр</span>
                        <div className="filter-buttons">
                            <button
                                className={`btn ghost small ${filter === 'all' ? 'filter-active' : ''}`}
                                type="button"
                                onClick={() => setFilter('all')}
                            >
                                Все
                            </button>
                            <button
                                className={`btn ghost small ${filter === 'agents' ? 'filter-active' : ''}`}
                                type="button"
                                onClick={() => setFilter('agents')}
                            >
                                Только агенты
                            </button>
                            <button
                                className={`btn ghost small ${filter === 'users' ? 'filter-active' : ''}`}
                                type="button"
                                onClick={() => setFilter('users')}
                            >
                                Только пользователи
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="room-summary">
                    {selectedRoom && currentRoomInfo && (
                        <span className="muted">
              Комната <strong>{currentRoomInfo.name}</strong>, участников:{" "}
                            <strong>{currentRoomInfo.numParticipants}</strong>, агентов:{" "}
                            <strong>{agents.length}</strong>
            </span>
                    )}
                </div>

                {listLoading ? (
                    <div className="spinner-row">
                        <div className="spinner" />
                        <span>Загрузка участников…</span>
                    </div>
                ) : filteredRows.length === 0 ? (
                    <p className="muted">В этой комнате сейчас нет участников (с учётом фильтра).</p>
                ) : (
                    <table className="table">
                        <thead>
                        <tr>
                            <th>Identity</th>
                            <th>Имя</th>
                            <th>Тип</th>
                            <th>Kind</th>
                            <th>Muted</th>
                            <th>Metadata</th>
                            <th style={{ width: 120 }} />
                        </tr>
                        </thead>
                        <tbody>
                        {filteredRows.map(row => (
                            <tr key={row.sid}>
                                <td><code>{row.identity}</code></td>
                                <td>{row.name}</td>
                                <td>
                    <span className={row.isAgent ? 'badge badge-admin' : 'badge'}>
                      {row.isAgent ? 'AGENT' : 'USER'}
                    </span>
                                </td>
                                <td>{row.kind}</td>
                                <td>
                                    {row.isAgent
                                        ? (row.muted ? 'Да' : 'Нет')
                                        : <span className="muted">–</span>}
                                </td>
                                <td className="metadata-cell">
                                    {row.metadata
                                        ? <span title={row.metadata}>{shorten(row.metadata, 60)}</span>
                                        : <span className="muted">—</span>}
                                </td>
                                <td>
                                    <div className="table-actions">
                                        {row.isAgent && (
                                            <button
                                                className="btn ghost small"
                                                type="button"
                                                onClick={() => handleKick(row)}
                                            >
                                                Выгнать агента
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function shorten(str: string, max: number): string {
    if (str.length <= max) return str;
    return str.slice(0, max - 1) + '…';
}
