import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppShell } from './AppShellContext';
import {
    type MessageDto,
    addMessageReaction,
    createDmChannel,
    createChannelMessage,
    fetchChannelMessages,
    markChannelRead,
    removeMessageReaction,
    resolveAvatarsBatch,
    uploadMessageImage,
} from '../api';
import { getUserIdentity } from '../lib/auth';
import VoiceChannelView from './VoiceChannelView';
import MessageTimeline from '../components/MessageTimeline';
import { getErrorMessage } from '../lib/errors';
import MessageComposer from '../components/MessageComposer';
import type { CompressedChatImage } from '../lib/imageCompression';
import { mergeMessagesById } from '../lib/messageMerge';

export default function ChannelViewPage() {
    const { channelId } = useParams();
    const { channels, refreshWorkspaceChannels } = useAppShell();
    const [messages, setMessages] = useState<MessageDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [avatarUrlByUserId, setAvatarUrlByUserId] = useState<Record<number, string>>({});
    const resolvedAvatarByUserIdRef = useRef<Map<number, string | null>>(new Map());
    const listRef = useRef<HTMLDivElement | null>(null);
    const autoScrollRef = useRef(true);
    const lastMarkedReadMessageIdRef = useRef<number | null>(null);
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
        resolvedAvatarByUserIdRef.current.clear();
        setAvatarUrlByUserId({});
        lastMarkedReadMessageIdRef.current = null;
    }, [currentChannelId]);

    useEffect(() => {
        if (!currentChannelId || isVoice) return;
        let active = true;

        const loadMessages = async (silent: boolean) => {
            if (!silent) {
                setLoading(true);
                setError(null);
            }
            try {
                const page = await fetchChannelMessages(currentChannelId);
                if (!active) return;
                const items = page.items.slice().reverse();
                setMessages(prev => mergeMessagesById(prev, items));
            } catch (e: unknown) {
                if (!silent && active) {
                    setError(getErrorMessage(e, 'Failed to load messages'));
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
        if (!avatarUsersKey) {
            resolvedAvatarByUserIdRef.current.clear();
            setAvatarUrlByUserId({});
            return;
        }
        const userIds = avatarUsersKey
            .split(',')
            .map(value => Number(value))
            .filter(value => Number.isFinite(value) && value > 0);
        if (userIds.length === 0) return;
        const active = new Set(userIds);
        for (const cachedUserId of resolvedAvatarByUserIdRef.current.keys()) {
            if (!active.has(cachedUserId)) {
                resolvedAvatarByUserIdRef.current.delete(cachedUserId);
            }
        }
        const unresolvedUserIds = userIds.filter(userId => !resolvedAvatarByUserIdRef.current.has(userId));
        if (unresolvedUserIds.length === 0) return;

        let cancelled = false;
        const syncAvatars = async () => {
            try {
                const items = await resolveAvatarsBatch(unresolvedUserIds);
                if (cancelled) return;
                const resolvedBatch = new Map<number, string | null>();
                for (const item of items) {
                    const resolvedUrl = item.contentUrl
                        ? item.contentUrl.startsWith('http')
                            ? item.contentUrl
                            : `${import.meta.env.VITE_API_BASE}${item.contentUrl}`
                        : null;
                    resolvedBatch.set(item.userId, resolvedUrl);
                }
                setAvatarUrlByUserId(prev => {
                    const next = { ...prev };
                    let changed = false;
                    for (const userId of unresolvedUserIds) {
                        const url = resolvedBatch.get(userId) ?? null;
                        resolvedAvatarByUserIdRef.current.set(userId, url);
                        if (url) {
                            if (next[userId] !== url) {
                                next[userId] = url;
                                changed = true;
                            }
                        } else if (next[userId]) {
                            delete next[userId];
                            changed = true;
                        }
                    }
                    return changed ? next : prev;
                });
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

    useEffect(() => {
        if (!currentChannelId || isVoice || messages.length === 0) return;
        const latest = messages[messages.length - 1];
        if (!latest?.id) return;
        if (lastMarkedReadMessageIdRef.current === latest.id) return;
        let cancelled = false;
        void markChannelRead(currentChannelId, { lastReadMessageId: latest.id })
            .then(() => {
                if (cancelled) return;
                lastMarkedReadMessageIdRef.current = latest.id;
                void refreshWorkspaceChannels(true);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [currentChannelId, isVoice, messages, refreshWorkspaceChannels]);

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

    async function sendMessage(body: string, image?: CompressedChatImage) {
        if (!currentChannelId) return;
        try {
            const attachmentIds = image
                ? [(await uploadMessageImage(image.file, { channelId: currentChannelId })).id]
                : [];
            const msg = await createChannelMessage(currentChannelId, body, replyTo?.id, attachmentIds);
            setMessages(prev => [...prev, msg]);
            setReplyTo(null);
            setError(null);
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Failed to send message'));
            throw e;
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

                    <MessageComposer
                        key={`channel-composer-${currentChannelId}`}
                        placeholder={`Message ${channel?.name || 'channel'}`}
                        replyTo={replyTo}
                        onCancelReply={() => setReplyTo(null)}
                        onSend={sendMessage}
                    />
                </>
            )}
        </section>
    );
}
