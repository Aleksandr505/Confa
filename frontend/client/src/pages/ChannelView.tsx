import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppShell } from './AppShell';
import {
    type MessageDto,
    createDmChannel,
    createChannelMessage,
    fetchChannelMessages,
} from '../api';
import VoiceChannelView from './VoiceChannelView';

export default function ChannelViewPage() {
    const { channelId } = useParams();
    const { channels } = useAppShell();
    const [messages, setMessages] = useState<MessageDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [showScrollDown, setShowScrollDown] = useState(false);
    const listRef = useRef<HTMLDivElement | null>(null);
    const autoScrollRef = useRef(true);
    const navigate = useNavigate();

    const currentChannelId = channelId ? Number(channelId) : undefined;
    const channel = useMemo(
        () => channels.find(c => c.id === currentChannelId),
        [channels, currentChannelId],
    );
    const isVoice = channel?.type === 'VOICE';

    useEffect(() => {
        if (!currentChannelId || isVoice) return;
        setLoading(true);
        setError(null);
        fetchChannelMessages(currentChannelId)
            .then(page => {
                const items = page.items.slice().reverse();
                setMessages(items);
            })
            .catch(e => setError(e?.message || 'Failed to load messages'))
            .finally(() => setLoading(false));
    }, [currentChannelId, isVoice]);
    
    useEffect(() => {
        const list = listRef.current;
        if (!list || !autoScrollRef.current) return;
        list.scrollTop = list.scrollHeight;
    }, [messages]);

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
            const msg = await createChannelMessage(currentChannelId, trimmed);
            setMessages(prev => [...prev, msg]);
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
                            <div className="message-list" ref={listRef} onScroll={handleScroll}>
                                {messages.map(msg => (
                                    <div key={msg.id} className="message-row">
                                        <button
                                            className="message-avatar"
                                            type="button"
                                            onClick={() => openDm(msg.senderUserId ?? null)}
                                            title="Open DM"
                                        >
                                            {String(msg.senderUserId ?? 'S').slice(0, 2)}
                                        </button>
                                        <div className="message-body">
                                            <div className="message-meta">
                                                <span className="message-author">User {msg.senderUserId ?? 'System'}</span>
                                                <span className="message-time">
                                                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ''}
                                                </span>
                                            </div>
                                            <div className="message-text">{msg.body}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {showScrollDown && (
                            <button className="scroll-down-btn" type="button" onClick={scrollToBottom}>
                                ↓ Newer
                            </button>
                        )}
                    </div>

                    <div className="composer">
                        <input
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            placeholder={`Message ${channel?.name || 'channel'}`}
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
                </>
            )}
        </section>
    );
}
