import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { clearTokens } from '../lib/auth';

export default function AdminLayout() {
    const nav = useNavigate();

    function logout() {
        clearTokens();
        nav('/login', { replace: true });
    }

    return (
        <div className="app-shell gradient-bg">
            <div className="app-main">
                <header className="topbar">
                    <div className="brand">
                        <span className="brand-dot" />
                        <span className="brand-title">Admin · Confa</span>
                    </div>
                    <nav className="topnav">
                        <NavLink
                            to="/users"
                            className={({ isActive }) => isActive ? 'topnav-link active' : 'topnav-link'}
                        >
                            Пользователи
                        </NavLink>
                        <button className="btn ghost small" onClick={logout}>
                            Выйти
                        </button>
                    </nav>
                </header>

                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
