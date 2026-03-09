import { useEffect, useRef, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import {
    deleteSoundClip,
    fetchAvailableSoundClips,
    fetchSoundClips,
    playSoundClip,
    shareSoundClip,
    stopSoundboard,
    uploadSoundClip,
    type SoundClipDto,
} from '../api';
import { isAdmin } from '../lib/auth';

type Props = {
    roomName?: string;
    triggerClassName?: string;
};

type SoundPlayPayload = {
    v: 1;
    type: 'sound.play';
    soundId: number;
    name: string;
    url: string;
    from?: string;
    ts: number;
};

type SoundStopPayload = {
    v: 1;
    type: 'sound.stop';
    from?: string;
    ts: number;
};

type SoundPayload = SoundPlayPayload | SoundStopPayload;

type SoundboardTab = 'room' | 'available';

export default function Soundboard({ roomName, triggerClassName }: Props) {
    const room = useRoomContext();
    const resolvedRoomName = roomName || room.name;
    const [open, setOpen] = useState(false);
    const [roomClips, setRoomClips] = useState<SoundClipDto[]>([]);
    const [availableClips, setAvailableClips] = useState<SoundClipDto[]>([]);
    const [tab, setTab] = useState<SoundboardTab>('room');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deleteMode, setDeleteMode] = useState(false);
    const [playbackVolumePct, setPlaybackVolumePct] = useState(95);
    const incomingAudioRef = useRef<HTMLAudioElement | null>(null);
    const playbackVolumeRef = useRef(0.95);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const isAdminUser = isAdmin();

    useEffect(() => {
        if (!open || !resolvedRoomName) return;
        void refresh();
    }, [open, resolvedRoomName]);

    useEffect(() => {
        const normalized = clampPercentToUnit(playbackVolumePct);
        playbackVolumeRef.current = normalized;
        if (incomingAudioRef.current) {
            incomingAudioRef.current.volume = normalized;
        }
    }, [playbackVolumePct]);

    useEffect(() => {
        const onDataReceived = (payload: Uint8Array) => {
            const parsed = safeParse(payload);
            if (!parsed) return;
            if (parsed.type === 'sound.play' && parsed.url) {
                playIncomingSound(parsed.url);
                return;
            }
            if (parsed.type === 'sound.stop') {
                stopIncomingSound();
            }
        };
        room.on(RoomEvent.DataReceived, onDataReceived);
        return () => {
            room.off(RoomEvent.DataReceived, onDataReceived);
        };
    }, [room]);

    useEffect(() => () => stopIncomingSound(), []);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    async function refresh() {
        if (!resolvedRoomName) return;
        setLoading(true);
        setError(null);
        try {
            const [roomPayload, availablePayload] = await Promise.all([
                fetchSoundClips(resolvedRoomName),
                fetchAvailableSoundClips(resolvedRoomName),
            ]);
            setRoomClips(normalizeClips(roomPayload));
            setAvailableClips(normalizeClips(availablePayload));
        } catch (e: any) {
            setError(e?.message || 'Не удалось загрузить soundboard');
        } finally {
            setLoading(false);
        }
    }

    async function playClip(clip: SoundClipDto) {
        if (!resolvedRoomName) return;
        try {
            await playSoundClip(clip.id, resolvedRoomName);
        } catch (e: any) {
            setError(e?.message || 'Не удалось проиграть звук');
        }
    }

    async function stopClipPlayback() {
        if (!resolvedRoomName) return;
        try {
            await stopSoundboard(resolvedRoomName);
        } catch (e: any) {
            setError(e?.message || 'Не удалось остановить звук');
        }
    }

    async function uploadFile(file?: File | null) {
        if (!file || !resolvedRoomName) return;
        setError(null);
        try {
            await uploadSoundClip(file, { roomName: resolvedRoomName });
            await refresh();
        } catch (e: any) {
            setError(e?.message || 'Не удалось загрузить звук');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function shareClipToCurrentRoom(clip: SoundClipDto) {
        if (!resolvedRoomName) return;
        try {
            await shareSoundClip(clip.id, resolvedRoomName);
            await refresh();
            setTab('room');
        } catch (e: any) {
            setError(e?.message || 'Не удалось поделиться звуком');
        }
    }

    async function deleteClip(clip: SoundClipDto) {
        try {
            await deleteSoundClip(clip.id);
            await refresh();
        } catch (e: any) {
            setError(e?.message || 'Не удалось удалить звук');
        }
    }

    function playIncomingSound(url: string) {
        const resolved = url.startsWith('http') ? url : `${import.meta.env.VITE_API_BASE}${url}`;
        const audio = incomingAudioRef.current ?? new Audio();
        incomingAudioRef.current = audio;
        audio.pause();
        audio.src = resolved;
        audio.volume = playbackVolumeRef.current;
        void audio.play().catch(() => {});
    }

    function stopIncomingSound() {
        const audio = incomingAudioRef.current;
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute('src');
        audio.load();
    }

    return (
        <div className="soundboard">
            <button
                type="button"
                className={triggerClassName || 'lk-button lk-soundboard-button'}
                onClick={() => setOpen(v => !v)}
            >
                <span>🥁 Soundboard</span>
            </button>

            {open && (
                <div className="soundboard__backdrop" onClick={() => setOpen(false)}>
                    <div
                        className="soundboard__panel"
                        onClick={event => event.stopPropagation()}
                    >
                        <div className="soundboard__header">
                            <strong className="soundboard__title">🥁 Soundboard · {resolvedRoomName}</strong>
                            <div className="soundboard__header-actions">
                                <label className="soundboard__upload">
                                    Upload
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp3"
                                        onChange={e => void uploadFile(e.target.files?.[0])}
                                    />
                                </label>
                                <button className="btn ghost small" type="button" onClick={() => void refresh()}>
                                    Обновить
                                </button>
                                {isAdminUser && (
                                    <button
                                        className={`btn ghost small${deleteMode ? ' filter-active' : ''}`}
                                        type="button"
                                        onClick={() => setDeleteMode(v => !v)}
                                    >
                                        {deleteMode ? 'Скрыть удаление' : 'Режим удаления'}
                                    </button>
                                )}
                                <button
                                    className="btn ghost small"
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    aria-label="Закрыть soundboard"
                                >
                                    Закрыть
                                </button>
                            </div>
                        </div>
                        <div className="soundboard__tabs">
                            <button
                                type="button"
                                className={`soundboard__tab${tab === 'room' ? ' is-active' : ''}`}
                                onClick={() => setTab('room')}
                            >
                                В комнате ({roomClips.length})
                            </button>
                            <button
                                type="button"
                                className={`soundboard__tab${tab === 'available' ? ' is-active' : ''}`}
                                onClick={() => setTab('available')}
                            >
                                Доступные ({availableClips.length})
                            </button>
                        </div>
                        <div className="soundboard__controls">
                            <label className="soundboard__volume">
                                <span>Громкость</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={playbackVolumePct}
                                    onChange={event => setPlaybackVolumePct(Number(event.target.value))}
                                />
                                <strong>{playbackVolumePct}%</strong>
                            </label>
                            <button className="btn ghost small" type="button" onClick={() => void stopClipPlayback()}>
                                Stop
                            </button>
                        </div>

                        {error && <div className="soundboard__error">{error}</div>}
                        {loading ? (
                            <div className="soundboard__empty">Загрузка…</div>
                        ) : tab === 'room' && roomClips.length === 0 ? (
                            <div className="soundboard__empty">Пока нет звуков для этой комнаты.</div>
                        ) : tab === 'available' && availableClips.length === 0 ? (
                            <div className="soundboard__empty">Нет доступных звуков из других комнат.</div>
                        ) : (
                            <div className="soundboard__grid">
                                {(tab === 'room' ? roomClips : availableClips).map(clip => (
                                    <div className="soundboard__item" key={clip.id}>
                                        <div className="soundboard__name" title={clip.name}>
                                            {clip.name}
                                        </div>
                                        <div className="soundboard__meta">
                                            ID: {clip.id} · {clip.sourceRoomName}
                                            {clip.sharedToCurrentRoom ? ' · shared' : ''}
                                        </div>
                                        <div className="soundboard__row">
                                            <button
                                                className="btn small"
                                                type="button"
                                                onClick={() => void playClip(clip)}
                                            >
                                                Play
                                            </button>
                                            {tab === 'available' && (
                                                <button
                                                    className="btn ghost small"
                                                    type="button"
                                                    onClick={() => void shareClipToCurrentRoom(clip)}
                                                >
                                                    Поделиться в эту комнату
                                                </button>
                                            )}
                                            {isAdminUser && deleteMode && (
                                                <button
                                                    className="btn ghost small"
                                                    type="button"
                                                    onClick={() => void deleteClip(clip)}
                                                >
                                                    Удалить
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function safeParse(payload: Uint8Array): SoundPayload | null {
    try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text) as SoundPayload;
        if (!data || data.v !== 1) return null;
        if (data.type === 'sound.play' && 'url' in data) return data;
        if (data.type === 'sound.stop') return data;
        return null;
    } catch {
        return null;
    }
}

function clampPercentToUnit(value: number): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) return 0.95;
    return Math.max(0, Math.min(1, value / 100));
}

function normalizeClips(payload: unknown): SoundClipDto[] {
    const sortByNewest = (items: SoundClipDto[]) =>
        items.slice().sort((a, b) => {
            const at = a.createdAt ? Date.parse(a.createdAt) : 0;
            const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
            if (at !== bt) return bt - at;
            return b.id - a.id;
        });

    if (Array.isArray(payload)) {
        return sortByNewest(payload as SoundClipDto[]);
    }
    if (payload && typeof payload === 'object' && Array.isArray((payload as any).items)) {
        return sortByNewest((payload as any).items as SoundClipDto[]);
    }
    return [];
}
