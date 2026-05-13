import {type FormEvent, useEffect, useState } from 'react';
import {
    approveUser,
    blockUser,
    createUser,
    deleteUser,
    fetchRegistrationRequests,
    fetchUsers,
    rejectUser,
    unblockUser,
    type UserDto,
} from '../api';

type NewUserForm = {
    username: string;
    password: string;
    role: 'USER' | 'ADMIN';
};

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export default function UsersPage() {
    const [users, setUsers] = useState<UserDto[]>([]);
    const [requests, setRequests] = useState<UserDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<NewUserForm>({
        username: '',
        password: '',
        role: 'USER',
    });

    async function load() {
        setLoading(true);
        setErr(null);
        try {
            const [usersData, requestsData] = await Promise.all([
                fetchUsers(),
                fetchRegistrationRequests(),
            ]);
            setUsers(usersData);
            setRequests(requestsData);
        } catch (e: unknown) {
            setErr(errorMessage(e, 'Не удалось загрузить пользователей'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function onCreate(e: FormEvent) {
        e.preventDefault();
        setErr(null);
        try {
            const created = await createUser(form);
            setUsers(prev => [...prev, created]);
            setForm({ username: '', password: '', role: 'USER' });
            setCreating(false);
        } catch (e: unknown) {
            setErr(errorMessage(e, 'Не удалось создать пользователя'));
        }
    }

    async function onDelete(id: string) {
        if (!confirm('Удалить пользователя?')) return;
        try {
            await deleteUser(id);
            setUsers(prev => prev.filter(u => u.id !== id));
        } catch (e: unknown) {
            alert(errorMessage(e, 'Не удалось удалить пользователя'));
        }
    }

    async function onToggleBlock(u: UserDto) {
        try {
            const updated = u.blockedAt
                ? await unblockUser(u.id)
                : await blockUser(u.id);

            setUsers(prev =>
                prev.map(x => (x.id === updated.id ? updated : x)),
            );
        } catch (e: unknown) {
            alert(errorMessage(e, 'Не удалось изменить статус пользователя'));
        }
    }

    async function onApprove(u: UserDto) {
        if (!confirm(`Одобрить заявку пользователя ${u.username}?`)) return;
        try {
            const updated = await approveUser(u.id);
            setRequests(prev => prev.filter(x => x.id !== updated.id));
            setUsers(prev => {
                const exists = prev.some(x => x.id === updated.id);
                return exists
                    ? prev.map(x => (x.id === updated.id ? updated : x))
                    : [...prev, updated];
            });
        } catch (e: unknown) {
            alert(errorMessage(e, 'Не удалось одобрить заявку'));
        }
    }

    async function onReject(u: UserDto) {
        if (!confirm(`Отклонить заявку пользователя ${u.username}?`)) return;
        try {
            const updated = await rejectUser(u.id);
            setRequests(prev => prev.filter(x => x.id !== updated.id));
            setUsers(prev => {
                const exists = prev.some(x => x.id === updated.id);
                return exists
                    ? prev.map(x => (x.id === updated.id ? updated : x))
                    : [...prev, updated];
            });
        } catch (e: unknown) {
            alert(errorMessage(e, 'Не удалось отклонить заявку'));
        }
    }

    const visibleUsers = users.filter(u => u.status !== 'PENDING');

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1>Пользователи</h1>
                    <p className="muted">Управление пользователями системы.</p>
                </div>
                <button className="btn primary" onClick={() => setCreating(true)}>
                    + Создать пользователя
                </button>
            </div>

            {err && <div className="alert alert-error">{err}</div>}

            <div className="card card-inline">
                <div className="section-header">
                    <div>
                        <h2>Заявки на регистрацию</h2>
                        <p className="muted">Новые пользователи не смогут войти, пока администратор не одобрит заявку.</p>
                    </div>
                    <button className="btn ghost small" onClick={load} disabled={loading}>
                        Обновить
                    </button>
                </div>

                {loading ? (
                    <div className="spinner-row">
                        <div className="spinner" />
                        <span>Загрузка заявок…</span>
                    </div>
                ) : requests.length === 0 ? (
                    <p className="muted">Новых заявок нет.</p>
                ) : (
                    <table className="table">
                        <thead>
                        <tr>
                            <th>ID</th>
                            <th>Логин</th>
                            <th>Создан</th>
                            <th style={{ width: 180 }} />
                        </tr>
                        </thead>
                        <tbody>
                        {requests.map(u => (
                            <tr key={u.id}>
                                <td><code>{u.id}</code></td>
                                <td>{u.username}</td>
                                <td>{u.createdAt ? new Date(u.createdAt).toLocaleString('ru-RU') : '—'}</td>
                                <td>
                                    <div className="table-actions">
                                        <button
                                            className="btn primary small"
                                            onClick={() => onApprove(u)}
                                        >
                                            Одобрить
                                        </button>
                                        <button
                                            className="btn ghost small"
                                            onClick={() => onReject(u)}
                                        >
                                            Отклонить
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>

            {creating && (
                <div className="card card-inline">
                    <h2>Новый пользователь</h2>
                    <form className="form-inline" onSubmit={onCreate}>
                        <input
                            placeholder="Логин"
                            value={form.username}
                            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                            required
                        />
                        <input
                            placeholder="Пароль"
                            type="password"
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            required
                        />
                        <select
                            value={form.role}
                            onChange={e => setForm(f => ({
                                ...f,
                                role: e.target.value as NewUserForm['role'],
                            }))}
                        >
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                        </select>
                        <button className="btn primary small" type="submit">
                            Создать
                        </button>
                        <button
                            type="button"
                            className="btn ghost small"
                            onClick={() => setCreating(false)}
                        >
                            Отмена
                        </button>
                    </form>
                </div>
            )}

            <div className="card">
                {loading ? (
                    <div className="spinner-row">
                        <div className="spinner" />
                        <span>Загрузка…</span>
                    </div>
                ) : visibleUsers.length === 0 ? (
                    <p className="muted">Пользователей пока нет.</p>
                ) : (
                    <table className="table">
                        <thead>
                        <tr>
                            <th>ID</th>
                            <th>Логин</th>
                            <th>Роль</th>
                            <th>Статус</th>
                            <th>Заблокирован с</th> {}
                            <th style={{ width: 140 }} />
                        </tr>
                        </thead>
                        <tbody>
                        {visibleUsers.map(u => (
                            <tr key={u.id}>
                                <td><code>{u.id}</code></td>
                                <td>{u.username}</td>
                                <td>
                    <span className={u.role === 'ADMIN' ? 'badge badge-admin' : 'badge'}>
                      {u.role}
                    </span>
                                </td>
                                <td>
                                    <span className={`badge badge-status badge-${u.status.toLowerCase()}`}>
                                        {u.status}
                                    </span>
                                </td>
                                <td>
                                    {u.blockedAt
                                        ? new Date(u.blockedAt).toLocaleString('ru-RU')
                                        : <span className="muted">Активен</span>}
                                </td>
                                <td>
                                    <div className="table-actions">
                                        <button
                                            className="btn ghost small"
                                            onClick={() => onToggleBlock(u)}
                                        >
                                            {u.blockedAt ? 'Разблокировать' : 'Заблокировать'}
                                        </button>
                                        <button
                                            className="btn ghost small"
                                            onClick={() => onDelete(u.id)}
                                        >
                                            Удалить
                                        </button>
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
