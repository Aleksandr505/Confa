import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {useEffect, useState, type ReactNode,} from 'react';
import { getBootstrapStatus } from './api';
import BootstrapPage from './pages/BootstrapPage';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import RoomsPage from './pages/RoomsPage';
import AdminLayout from './components/AdminLayout';
import { isAuthed } from './auth';

type BootstrapState = 'loading' | 'needsBootstrap' | 'ready';

function BootstrapProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<BootstrapState>('loading');

    useEffect(() => {
        (async () => {
            try {
                const res = await getBootstrapStatus();
                setState(res.isInitialized ? 'ready' : 'needsBootstrap');
            } catch (e) {
                console.error('bootstrap status error', e);
                setState('ready');
            }
        })();
    }, []);

    if (state === 'loading') {
        return (
            <div className="fullpage-center">
                <div className="card">
                    <div className="spinner" />
                    <p>Загрузка статуса системы…</p>
                </div>
            </div>
        );
    }

    if (state === 'needsBootstrap') {
        return <BootstrapPage onReady={() => setState('ready')} />;
    }

    return <>{children}</>;
}

function RequireAuth({ children }: { children: ReactNode }) {
    const location = useLocation();
    if (!isAuthed()) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return <>{children}</>;
}

export default function App() {
    return (
        <BootstrapProvider>
            <Routes>
                <Route path="/login" element={<LoginPage />} />

                <Route element={<AdminLayout />}>
                    <Route
                        path="/"
                        element={<RequireAuth><UsersPage /></RequireAuth>}
                    />
                    <Route
                        path="/users"
                        element={<RequireAuth><UsersPage /></RequireAuth>}
                    />
                    <Route
                        path="/rooms"
                        element={<RequireAuth><RoomsPage /></RequireAuth>}
                    />
                </Route>

                {/* fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BootstrapProvider>
    );
}
