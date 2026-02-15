import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppShell } from './AppShell';

export default function AppHomePage() {
    const { workspaces, channels, loadingWorkspaces, openWorkspace } = useAppShell();
    const navigate = useNavigate();
    const hasNavigated = useRef(false);

    useEffect(() => {
        if (hasNavigated.current) return;
        if (loadingWorkspaces) return;
        if (workspaces.length === 0) return;
        const workspace = workspaces[0];
        if (channels.length > 0) {
            hasNavigated.current = true;
            navigate(`/app/w/${workspace.id}/ch/${channels[0].id}`, { replace: true });
        } else {
            hasNavigated.current = true;
            openWorkspace(workspace.id);
        }
    }, [loadingWorkspaces, workspaces, channels, navigate, openWorkspace]);

    return (
        <div className="empty-state">
            <div className="empty-title">Welcome to Confa</div>
            <div className="empty-subtitle">Pick a workspace to start chatting.</div>
        </div>
    );
}
