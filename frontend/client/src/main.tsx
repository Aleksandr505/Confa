import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, redirect } from 'react-router-dom';
import LoginPage from './pages/Login';
import RoomPage from './pages/Room';
import HomePage from './pages/Home';
import { isAuthed } from './auth';
import { loadTokensFromSession } from './lib/auth';

loadTokensFromSession();

const router = createBrowserRouter([
    {
        path: '/login',
        element: <LoginPage />,
    },
    {
        path: '/',
        loader: async () => {
            if (!isAuthed()) throw redirect('/login');
            return null;
        },
        element: <HomePage />,
    },
    {
        path: '/room/:roomId',
        loader: async () => {
            if (!isAuthed()) throw redirect('/login');
            return null;
        },
        element: <RoomPage />,
    },
    {
        path: '*',
        loader: async () => redirect('/'),
    },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <RouterProvider router={router} />,
);
