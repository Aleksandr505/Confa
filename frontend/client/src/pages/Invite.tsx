import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { acceptInvite, acceptWorkspaceInvite, type RoomAccess, type WorkspaceDto } from '../api';

export default function InvitePage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [room, setRoom] = useState<RoomAccess | null>(null);
    const [workspace, setWorkspace] = useState<WorkspaceDto | null>(null);

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setError('Некорректная ссылка приглашения');
            return;
        }
        acceptWorkspaceInvite(token)
            .then(ws => {
                setWorkspace(ws);
                setStatus('ok');
                setTimeout(() => {
                    navigate(`/app/w/${ws.id}`, { replace: true });
                }, 800);
            })
            .catch(() => {
                acceptInvite(token)
                    .then(access => {
                        setRoom(access);
                        setStatus('ok');
                        setTimeout(() => {
                            navigate(`/room/${encodeURIComponent(access.name)}`, { replace: true });
                        }, 800);
                    })
                    .catch(e => {
                        setError(e?.message || 'Не удалось принять приглашение');
                        setStatus('error');
                    });
            });
    }, [token, navigate]);

    return (
        <div className="auth-root client-theme">
            <div className="auth-card">
                <h1 className="auth-title">Приглашение</h1>
                {status === 'loading' && (
                    <>
                        <p className="auth-subtitle">Принимаем приглашение…</p>
                        <div className="spinner" aria-label="loading" />
                    </>
                )}
                {status === 'ok' && workspace && (
                    <>
                        <p className="auth-subtitle">
                            Доступ в workspace <strong>{workspace.name}</strong> получен.
                        </p>
                        <p className="auth-subtitle" style={{ fontSize: 13 }}>
                            Перенаправляем вас в workspace…
                        </p>
                        <button
                            className="btn primary"
                            type="button"
                            onClick={() => navigate(`/app/w/${workspace.id}`, { replace: true })}
                        >
                            Открыть workspace
                        </button>
                    </>
                )}
                {status === 'ok' && !workspace && room && (
                    <>
                        <p className="auth-subtitle">
                            Доступ в комнату <strong>{room.name}</strong> получен.
                        </p>
                        <p className="auth-subtitle" style={{ fontSize: 13 }}>
                            Перенаправляем вас в комнату…
                        </p>
                        <button
                            className="btn primary"
                            type="button"
                            onClick={() => navigate(`/room/${encodeURIComponent(room.name)}`, { replace: true })}
                        >
                            Открыть комнату
                        </button>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <p className="auth-subtitle">Приглашение не сработало</p>
                        <div className="alert alert-error">{error}</div>
                        <button className="btn primary" type="button" onClick={() => navigate('/app', { replace: true })}>
                            На главную
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
