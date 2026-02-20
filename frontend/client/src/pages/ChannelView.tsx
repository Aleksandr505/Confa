import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppShell } from './AppShell';
import {
    type MessageDto,
    addMessageReaction,
    createDmChannel,
    createChannelMessage,
    fetchChannelMessages,
    removeMessageReaction,
    resolveAvatarsBatch,
} from '../api';
import { getUserIdentity } from '../lib/auth';
import VoiceChannelView from './VoiceChannelView';
import MessageTimeline from '../components/MessageTimeline';

export default function ChannelViewPage() {
    const { channelId } = useParams();
    const { channels } = useAppShell();
    const [messages, setMessages] = useState<MessageDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [avatarUrlByUserId, setAvatarUrlByUserId] = useState<Record<number, string>>({});
    const listRef = useRef<HTMLDivElement | null>(null);
    const composerRef = useRef<HTMLTextAreaElement | null>(null);
    const autoScrollRef = useRef(true);
    const navigate = useNavigate();
    const myUserId = useMemo(() => {
        const identity = getUserIdentity();
        if (!identity) return null;
        const parsed = Number(identity);
        return Number.isFinite(parsed) ? parsed : null;
    }, []);

    const currentChannelId = channelId ? Number(channelId) : undefined;
    const channel = useMemo(
        () => channels.find(c => c.id === currentChannelId),
        [channels, currentChannelId],
    );
    const isVoice = channel?.type === 'VOICE';
    const avatarUserIds = useMemo(
        () =>
            Array.from(
                new Set(
                    messages
                        .map(msg => msg.senderUserId)
                        .filter((id): id is number => typeof id === "number" && id > 0),
                ),
            ).sort((a, b) => a - b),
        [messages],
    );
    const avatarUsersKey = avatarUserIds.join(',');

    useEffect(() => {
        if (!currentChannelId || isVoice) return;
        let active = true;

        const mergeById = (prev: MessageDto[], incoming: MessageDto[]) => {
            const map = new Map<number, MessageDto>();
            for (const msg of prev) map.set(msg.id, msg);
            for (const msg of incoming) map.set(msg.id, msg);
            return Array.from(map.values()).sort((a, b) => a.id - b.id);
        };

        const loadMessages = async (silent: boolean) => {
            if (!silent) {
                setLoading(true);
                setError(null);
            }
            try {
                const page = await fetchChannelMessages(currentChannelId);
                if (!active) return;
                const items = page.items.slice().reverse();
                setMessages(prev => mergeById(prev, items));
            } catch (e: any) {
                if (!silent && active) {
                    setError(e?.message || 'Failed to load messages');
                }
            } finally {
                if (!silent && active) setLoading(false);
            }
        };

        setMessages([]);
        loadMessages(false);
        const timer = window.setInterval(() => {
            if (document.hidden) return;
            loadMessages(true);
        }, 3000);

        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [currentChannelId, isVoice]);

    useEffect(() => {
        if (avatarUserIds.length === 0) {
            setAvatarUrlByUserId({});
            return;
        }
        let cancelled = false;
        const syncAvatars = async () => {
            try {
                const items = await resolveAvatarsBatch(avatarUserIds);
                if (cancelled) return;
                const next: Record<number, string> = {};
                for (const item of items) {
                    if (!item.contentUrl) continue;
                    const resolvedUrl = item.contentUrl.startsWith('http')
                        ? item.contentUrl
                        : `${import.meta.env.VITE_API_BASE}${item.contentUrl}`;
                    next[item.userId] = resolvedUrl;
                }
                setAvatarUrlByUserId(next);
            } catch (e) {
                if (!cancelled) console.warn('Failed to sync channel message avatars', e);
            }
        };

        void syncAvatars();

        return () => {
            cancelled = true;
        };
    }, [avatarUsersKey]);
    
    useEffect(() => {
        const list = listRef.current;
        if (!list || !autoScrollRef.current) return;
        list.scrollTop = list.scrollHeight;
    }, [messages]);

    const autoResizeComposer = () => {
        const textarea = composerRef.current;
        if (!textarea) return;
        textarea.style.height = '0px';
        const maxHeight = 160;
        const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = `${Math.max(24, nextHeight)}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    };

    useEffect(() => {
        autoResizeComposer();
    }, [draft]);

    const handleScroll = () => {
        const list = listRef.current;
        if (!list) return;
        const threshold = 48;
        const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
        const atBottom = distanceToBottom <= threshold;
        autoScrollRef.current = atBottom;
        setShowScrollDown(!atBottom);
    };

    const scrollToBottom = () => {
        const list = listRef.current;
        if (!list) return;
        list.scrollTop = list.scrollHeight;
        autoScrollRef.current = true;
        setShowScrollDown(false);
    };

    async function sendMessage() {
        if (!currentChannelId) return;
        const trimmed = draft.trim();
        if (!trimmed) return;
        setDraft('');
        try {
            const msg = await createChannelMessage(currentChannelId, trimmed, replyTo?.id);
            setMessages(prev => [...prev, msg]);
            setReplyTo(null);
        } catch (e: any) {
            setError(e?.message || 'Failed to send message');
        }
    }

    async function openDm(userId: number | null) {
        if (!userId) return;
        try {
            await createDmChannel(userId);
            navigate(`/app/dm/${userId}`);
        } catch (e) {
            console.warn('Failed to open DM', e);
        }
    }

    async function toggleReaction(message: MessageDto, emoji: string, reactedByMe: boolean) {
        try {
            const reactions = reactedByMe
                ? await removeMessageReaction(message.id, emoji)
                : await addMessageReaction(message.id, emoji);
            setMessages(prev =>
                prev.map(item => (item.id === message.id ? { ...item, reactions } : item)),
            );
        } catch (e) {
            console.warn('Failed to toggle reaction', e);
        }
    }

    return (
        <section className="channel-view">
            <header className="channel-header">
                <div>
                    <div className="channel-title">
                        {channel ? (channel.type === 'VOICE' ? 'Voice • ' : '#') : ''}
                        {channel?.name || 'Channel'}
                    </div>
                    <div className="channel-subtitle">{channel?.topic || 'No topic set'}</div>
                </div>
            </header>

            {isVoice ? (
                <VoiceChannelView
                    key={`voice-${currentChannelId}`}
                    channelId={currentChannelId ?? 0}
                    channelName={channel?.name || 'Voice channel'}
                />
            ) : (
                <>
                    <div className="message-panel">
                        {loading ? (
                            <div className="empty-subtitle">Loading messages…</div>
                        ) : error ? (
                            <div className="alert-banner">{error}</div>
                        ) : messages.length === 0 ? (
                            <div className="empty-subtitle">No messages yet. Say hello.</div>
                        ) : (
                            <MessageTimeline
                                messages={messages}
                                myUserId={myUserId}
                                listRef={listRef}
                                onScroll={handleScroll}
                                avatarUrlByUserId={avatarUrlByUserId}
                                onAvatarClick={openDm}
                                onReply={setReplyTo}
                                onToggleReaction={toggleReaction}
                            />
                        )}
                        {showScrollDown && (
                            <button className="scroll-down-btn" type="button" onClick={scrollToBottom}>
                                ↓ Newer
                            </button>
                        )}
                    </div>

                    <div className="composer">
                        {replyTo && (
                            <div className="composer-reply">
                                <div className="composer-reply-text">
                                    <span className="composer-reply-author">
                                        Replying to {replyTo.senderUsername || `User ${replyTo.senderUserId ?? 'System'}`}
                                    </span>
                                    <span className="composer-reply-body">{replyTo.body}</span>
                                </div>
                                <button className="ghost-btn" type="button" onClick={() => setReplyTo(null)}>
                                    Cancel
                                </button>
                            </div>
                        )}
                        <div className="composer-input-row">
                            <textarea
                                ref={composerRef}
                                value={draft}
                                onChange={e => setDraft(e.target.value)}
                                onInput={autoResizeComposer}
                                placeholder={`Message ${channel?.name || 'channel'}`}
                                rows={1}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                            />
                            <button className="primary-btn" type="button" onClick={sendMessage}>
                                Send
                            </button>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}
