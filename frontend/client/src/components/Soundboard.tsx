import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import {
    fetchAvailableSoundClips,
    fetchSoundClips,
    playSoundClip,
    shareSoundClip,
    uploadSoundClip,
    type SoundClipDto,
} from '../api';

type Props = {
    roomName?: string;
    triggerClassName?: string;
};

type EmojiPayload = {
    v: 1;
    type: 'emoji';
    emoji: string;
    from?: string;
    ts: number;
};

type SoundPayload = {
    v: 1;
    type: 'sound.play';
    soundId: number;
    name: string;
    url: string;
    from?: string;
    ts: number;
};

type FlyingReaction = {
    id: string;
    emoji: string;
};

type SoundboardTab = 'room' | 'available';

const QUICK_EMOJIS = ['👍', '🔥', '😂', '👏', '❤️', '🎉'] as const;
const MAX_FLYING_REACTIONS = 24;
const SEND_COOLDOWN_MS = 700;
const FLYING_REACTION_LIFETIME_MS = 2200;
const SOUND_ENABLED_KEY = 'confa:roomReactionSoundEnabled';

export default function Soundboard({ roomName, triggerClassName }: Props) {
    const room = useRoomContext();
    const resolvedRoomName = roomName || room.name;
    const [open, setOpen] = useState(false);
    const [roomClips, setRoomClips] = useState<SoundClipDto[]>([]);
    const [availableClips, setAvailableClips] = useState<SoundClipDto[]>([]);
    const [tab, setTab] = useState<SoundboardTab>('room');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [flying, setFlying] = useState<FlyingReaction[]>([]);
    const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
        try {
            return localStorage.getItem(SOUND_ENABLED_KEY) !== '0';
        } catch {
            return true;
        }
    });
    const audioCtxRef = useRef<AudioContext | null>(null);
    const incomingAudioRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const lastSentAtRef = useRef(0);

    useEffect(() => {
        try {
            localStorage.setItem(SOUND_ENABLED_KEY, soundEnabled ? '1' : '0');
        } catch {
            // noop
        }
    }, [soundEnabled]);

    useEffect(() => {
        if (!open || !resolvedRoomName) return;
        void refresh();
    }, [open, resolvedRoomName]);

    useEffect(() => {
        const onDataReceived = (payload: Uint8Array) => {
            const parsed = safeParse(payload);
            if (!parsed) return;
            if (parsed.type === 'emoji') {
                enqueueReaction(parsed.emoji);
                if (soundEnabled) playReactionTone(parsed.emoji);
                return;
            }
            if (parsed.type === 'sound.play') {
                playIncomingSound(parsed.url);
            }
        };
        room.on(RoomEvent.DataReceived, onDataReceived);
        return () => {
            room.off(RoomEvent.DataReceived, onDataReceived);
        };
    }, [room, soundEnabled]);

    useEffect(() => {
        return () => {
            audioCtxRef.current?.close().catch(() => {});
        };
    }, []);

    const canSendEmoji = useMemo(
        () => Date.now() - lastSentAtRef.current >= SEND_COOLDOWN_MS,
        [flying.length],
    );

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

    function enqueueReaction(emoji: string) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setFlying(prev => {
            const next = [...prev, { id, emoji }];
            return next.length > MAX_FLYING_REACTIONS
                ? next.slice(next.length - MAX_FLYING_REACTIONS)
                : next;
        });
        window.setTimeout(() => {
            setFlying(prev => prev.filter(item => item.id !== id));
        }, FLYING_REACTION_LIFETIME_MS);
    }

    async function sendEmoji(emoji: string) {
        const now = Date.now();
        if (now - lastSentAtRef.current < SEND_COOLDOWN_MS) return;
        lastSentAtRef.current = now;
        const payload: EmojiPayload = {
            v: 1,
            type: 'emoji',
            emoji,
            from: room.localParticipant.identity,
            ts: now,
        };
        try {
            await room.localParticipant.publishData(
                new TextEncoder().encode(JSON.stringify(payload)),
                { reliable: false },
            );
            enqueueReaction(emoji);
            if (soundEnabled) playReactionTone(emoji);
        } catch (e) {
            console.warn('Failed to send room reaction', e);
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

    function playIncomingSound(url: string) {
        const resolved = url.startsWith('http') ? url : `${import.meta.env.VITE_API_BASE}${url}`;
        const audio = incomingAudioRef.current ?? new Audio();
        incomingAudioRef.current = audio;
        audio.src = resolved;
        audio.volume = 0.95;
        void audio.play().catch(() => {});
    }

    function playReactionTone(emoji: string) {
        const ctx = audioCtxRef.current ?? new AudioContext();
        audioCtxRef.current = ctx;
        void ctx.resume();
        const start = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frequencyForEmoji(emoji), start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.06, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.18);
    }

    return (
        <div className="soundboard">
            <button
                type="button"
                className={triggerClassName || 'lk-button lk-soundboard-button'}
                onClick={() => setOpen(v => !v)}
            >
                <span>Soundboard</span>
            </button>

            {open && (
                <div className="soundboard__panel">
                    <div className="soundboard__header">
                        <strong>Soundboard · {resolvedRoomName}</strong>
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
                            <button
                                className="btn ghost small"
                                type="button"
                                onClick={() => setSoundEnabled(v => !v)}
                            >
                                {soundEnabled ? 'Звук эмодзи: On' : 'Звук эмодзи: Off'}
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
                                    <div className="soundboard__emojis">
                                        {QUICK_EMOJIS.map(emoji => (
                                            <button
                                                key={`${clip.id}-${emoji}`}
                                                type="button"
                                                className="soundboard__emoji-btn"
                                                disabled={!canSendEmoji}
                                                onClick={() => void sendEmoji(emoji)}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="soundboard__name" title={clip.name}>
                                        {clip.name}
                                    </div>
                                    <div className="soundboard__meta">
                                        {clip.sourceRoomName}
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
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="room-reactions__overlay" aria-hidden>
                {flying.map(item => (
                    <span className="room-reactions__fly" key={item.id}>
                        {item.emoji}
                    </span>
                ))}
            </div>
        </div>
    );
}

function safeParse(payload: Uint8Array): EmojiPayload | SoundPayload | null {
    try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text) as EmojiPayload | SoundPayload;
        if (data && data.v === 1 && data.type === 'emoji' && 'emoji' in data) return data;
        if (data && data.v === 1 && data.type === 'sound.play' && 'url' in data) return data;
        return null;
    } catch {
        return null;
    }
}

function frequencyForEmoji(emoji: string): number {
    switch (emoji) {
        case '🔥':
            return 760;
        case '😂':
            return 680;
        case '❤️':
            return 520;
        case '🎉':
            return 920;
        case '👏':
            return 840;
        default:
            return 600;
    }
}

function normalizeClips(payload: unknown): SoundClipDto[] {
    if (Array.isArray(payload)) {
        return payload as SoundClipDto[];
    }
    if (payload && typeof payload === 'object' && Array.isArray((payload as any).items)) {
        return (payload as any).items as SoundClipDto[];
    }
    return [];
}
