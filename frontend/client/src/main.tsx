import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, redirect } from 'react-router-dom';
import LoginPage from './pages/Login.tsx';
import RoomPage from './pages/Room.tsx';
import { isAuthed } from './auth';
import {loadTokensFromSession} from "./lib/auth.ts";

loadTokensFromSession();

const router = createBrowserRouter([
    { path: '/login', element: <LoginPage /> },
    {
        path: '/room/:roomId',
        loader: async () => { if (!isAuthed()) throw redirect('/login'); return null; },
        element: <RoomPage />,
    },
    { path: '/', loader: async () => redirect('/login') }
]);

ReactDOM.createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);

