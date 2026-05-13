import { useEffect, useRef, useState } from 'react';
import type { MessageDto } from '../api';
import { getErrorMessage } from '../lib/errors';
import {
    type CompressedChatImage,
    compressImageForChat,
    formatBytes,
} from '../lib/imageCompression';

type MessageComposerProps = {
    placeholder: string;
    replyTo?: MessageDto | null;
    onCancelReply?: () => void;
    onSend: (body: string, image?: CompressedChatImage) => Promise<void>;
    disabled?: boolean;
};

type SelectedImage = CompressedChatImage & {
    previewUrl: string;
};

export default function MessageComposer({
    placeholder,
    replyTo,
    onCancelReply,
    onSend,
    disabled = false,
}: MessageComposerProps) {
    const [draft, setDraft] = useState('');
    const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
    const [busy, setBusy] = useState(false);
    const [compressing, setCompressing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = '0px';
        const maxHeight = 160;
        const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = `${Math.max(24, nextHeight)}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [draft]);

    useEffect(() => {
        return () => {
            if (selectedImage) {
                URL.revokeObjectURL(selectedImage.previewUrl);
            }
        };
    }, [selectedImage]);

    async function handleImageChange(file?: File | null) {
        if (!file) return;
        setError(null);
        setCompressing(true);
        try {
            const compressed = await compressImageForChat(file);
            const previewUrl = URL.createObjectURL(compressed.file);
            setSelectedImage(prev => {
                if (prev) URL.revokeObjectURL(prev.previewUrl);
                return { ...compressed, previewUrl };
            });
        } catch (e) {
            setError(getErrorMessage(e, 'Failed to prepare image'));
        } finally {
            setCompressing(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }

    function clearImage() {
        setSelectedImage(prev => {
            if (prev) URL.revokeObjectURL(prev.previewUrl);
            return null;
        });
    }

    async function submit() {
        const body = draft.trim();
        if (busy || disabled || compressing || (!body && !selectedImage)) return;
        setBusy(true);
        setError(null);
        try {
            await onSend(body, selectedImage ?? undefined);
            setDraft('');
            clearImage();
        } catch (e) {
            setError(getErrorMessage(e, 'Failed to send message'));
        } finally {
            setBusy(false);
        }
    }

    const replyPreview = replyTo ? messagePreview(replyTo) : '';

    return (
        <div className="composer">
            {replyTo && (
                <div className="composer-reply">
                    <div className="composer-reply-text">
                        <span className="composer-reply-author">
                            Replying to {replyTo.senderUsername || `User ${replyTo.senderUserId ?? 'System'}`}
                        </span>
                        <span className="composer-reply-body">{replyPreview}</span>
                    </div>
                    <button className="ghost-btn" type="button" onClick={onCancelReply} disabled={busy}>
                        Cancel
                    </button>
                </div>
            )}

            {selectedImage && (
                <div className="composer-image-preview">
                    <img src={selectedImage.previewUrl} alt={selectedImage.originalName} />
                    <div className="composer-image-meta">
                        <span>{selectedImage.width}x{selectedImage.height}</span>
                        <span>{formatBytes(selectedImage.sizeBytes)}</span>
                    </div>
                    <button className="ghost-btn" type="button" onClick={clearImage} disabled={busy}>
                        Remove
                    </button>
                </div>
            )}

            {error && <div className="composer-error">{error}</div>}

            <div className="composer-input-row">
                <button
                    className="ghost-btn composer-attach-btn"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || disabled || compressing || !!selectedImage}
                >
                    {compressing ? 'Preparing' : 'Image'}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={e => {
                        void handleImageChange(e.target.files?.[0]);
                    }}
                />
                <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder={placeholder}
                    rows={1}
                    disabled={busy || disabled}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void submit();
                        }
                    }}
                />
                <button
                    className="primary-btn"
                    type="button"
                    onClick={() => void submit()}
                    disabled={busy || disabled || compressing || (!draft.trim() && !selectedImage)}
                >
                    {busy ? 'Sending' : 'Send'}
                </button>
            </div>
        </div>
    );
}

function messagePreview(message: MessageDto): string {
    if (message.body?.trim()) {
        return message.body;
    }
    if (message.attachments?.length) {
        return 'Image';
    }
    return 'Original message unavailable';
}
