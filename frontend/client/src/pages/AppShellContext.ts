import { createContext, useContext } from 'react';
import type { ChannelDto, DmSummary, WorkspaceDto } from '../api';

export type AppShellState = {
    workspaces: WorkspaceDto[];
    channels: ChannelDto[];
    dms: DmSummary[];
    activeWorkspace?: WorkspaceDto;
    loadingWorkspaces: boolean;
    loadingChannels: boolean;
    loadingDms: boolean;
    refreshWorkspaces: () => Promise<void>;
    refreshDms: (silent?: boolean) => Promise<void>;
    refreshWorkspaceChannels: (silent?: boolean) => Promise<void>;
    openWorkspace: (workspaceId: number) => Promise<void>;
};

export const AppShellContext = createContext<AppShellState | null>(null);

export function useAppShell() {
    const ctx = useContext(AppShellContext);
    if (!ctx) throw new Error('AppShellContext is not available');
    return ctx;
}
