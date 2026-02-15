import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppShell } from './AppShell';
import { type MessageDto, createDmMessage, fetchDmMessages } from '../api';

export default function DmViewPage() {
    const { peerId } = useParams();
    const { dms } = useAppShell();
    const [messages, setMessages] = useState<MessageDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [showScrollDown, setShowScrollDown] = useState(false);
    const listRef = useRef<HTMLDivElement | null>(null);
    const autoScrollRef = useRef(true);

    const numericPeerId = peerId ? Number(peerId) : undefined;
    const peer = useMemo(
        () => dms.find(dm => dm.peerUserId === numericPeerId),
        [dms, numericPeerId],
    );

    useEffect(() => {
        if (!numericPeerId) return;
        setLoading(true);
        setError(null);
        fetchDmMessages(numericPeerId)
            .then(page => setMessages(page.items.slice().reverse()))
            .catch(e => setError(e?.message || 'Failed to load messages'))
            .finally(() => setLoading(false));
    }, [numericPeerId]);
    
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
        if (!numericPeerId) return;
        const trimmed = draft.trim();
        if (!trimmed) return;
        setDraft('');
        try {
            const msg = await createDmMessage(numericPeerId, trimmed);
            setMessages(prev => [...prev, msg]);
        } catch (e: any) {
            setError(e?.message || 'Failed to send message');
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
                    placeholder={`Message ${peer?.peerUsername || 'user'}`}
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
