import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, redirect } from 'react-router-dom';
import LoginPage from './pages/Login';
import InvitePage from './pages/Invite';
import HomePage from './pages/Home';
import RoomPage from './pages/Room';
import { isAuthed } from './auth';
import { loadTokensFromSession } from './lib/auth';
import AppShellLayout from './pages/AppShell';
import AppHomePage from './pages/AppHome';
import ChannelViewPage from './pages/ChannelView';
import DmViewPage from './pages/DmView';
import DmHomePage from './pages/DmHome';

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
        path: '/app',
        loader: async () => {
            if (!isAuthed()) throw redirect('/login');
            return null;
        },
        element: <AppShellLayout />,
        children: [
            { index: true, element: <AppHomePage /> },
            { path: 'w/:workspaceId', element: <AppHomePage /> },
            { path: 'w/:workspaceId/ch/:channelId', element: <ChannelViewPage /> },
            { path: 'dm', element: <DmHomePage /> },
            { path: 'dm/:peerId', element: <DmViewPage /> },
        ],
    },
    {
        path: '/invite/:token',
        loader: async ({ params }) => {
            if (!isAuthed()) {
                throw redirect(`/login?invite=${encodeURIComponent(params.token || '')}`);
            }
            return null;
        },
        element: <InvitePage />,
    },
    {
        path: '*',
        loader: async () => redirect('/'),
    },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <RouterProvider router={router} />,
);
