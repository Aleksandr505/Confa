import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppShell } from './AppShell';
import {
    type MessageDto,
    addMessageReaction,
    createDmMessage,
    fetchDmMessages,
    removeMessageReaction,
    resolveAvatarsBatch,
} from '../api';
import { getUserIdentity } from '../lib/auth';
import MessageTimeline from '../components/MessageTimeline';

export default function DmViewPage() {
    const { peerId } = useParams();
    const { dms } = useAppShell();
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
    const myUserId = useMemo(() => {
        const identity = getUserIdentity();
        if (!identity) return null;
        const parsed = Number(identity);
        return Number.isFinite(parsed) ? parsed : null;
    }, []);

    const numericPeerId = peerId ? Number(peerId) : undefined;
    const peer = useMemo(
        () => dms.find(dm => dm.peerUserId === numericPeerId),
        [dms, numericPeerId],
    );
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
        if (!numericPeerId) return;
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
                const page = await fetchDmMessages(numericPeerId);
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
    }, [numericPeerId]);

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
                if (!cancelled) console.warn('Failed to sync DM message avatars', e);
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
        if (!numericPeerId) return;
        const trimmed = draft.trim();
        if (!trimmed) return;
        setDraft('');
        try {
            const msg = await createDmMessage(numericPeerId, trimmed, replyTo?.id);
            setMessages(prev => [...prev, msg]);
            setReplyTo(null);
        } catch (e: any) {
            setError(e?.message || 'Failed to send message');
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
                    <div className="channel-title">@{peer?.peerUsername || 'Direct message'}</div>
                    <div className="channel-subtitle">Private conversation</div>
                </div>
                <div className="channel-actions">
                    <button className="ghost-btn" type="button">Call</button>
                    <button className="primary-btn" type="button">Share</button>
                </div>
            </header>

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
                        placeholder={`Message ${peer?.peerUsername || 'user'}`}
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
        </section>
    );
}
