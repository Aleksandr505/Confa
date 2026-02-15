import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppShell } from './AppShell';
import {
    type MessageDto,
    createChannelMessage,
    fetchChannelMessages,
} from '../api';

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

    const currentChannelId = channelId ? Number(channelId) : undefined;
    const channel = useMemo(
        () => channels.find(c => c.id === currentChannelId),
        [channels, currentChannelId],
    );

    useEffect(() => {
        if (!currentChannelId) return;
        setLoading(true);
        setError(null);
        fetchChannelMessages(currentChannelId)
            .then(page => {
                const items = page.items.slice().reverse();
                setMessages(items);
            })
            .catch(e => setError(e?.message || 'Failed to load messages'))
            .finally(() => setLoading(false));
    }, [currentChannelId]);
    
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

    const isVoice = channel?.type === 'VOICE';

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
                <div className="channel-actions">
                    <button className="ghost-btn" type="button">Invite</button>
                    <button className="primary-btn" type="button">
                        {isVoice ? 'Join room' : 'Start thread'}
                    </button>
                </div>
            </header>

            {isVoice && (
                <div className="voice-hero">
                    <div>
                        <div className="voice-title">Live room</div>
                        <div className="voice-sub">
                            This voice channel is ready for LiveKit. Chat stays in the same thread.
                        </div>
                    </div>
                    <button className="primary-btn" type="button">Connect audio</button>
                </div>
            )}

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
                                <div className="message-avatar">
                                    {String(msg.senderUserId ?? 'S').slice(0, 2)}
                                </div>
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
        </section>
    );
}
