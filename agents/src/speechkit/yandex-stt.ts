import {
    stt as coreSTT,
    type AudioBuffer,
    mergeFrames,
} from '@livekit/agents';

/**
 * Options for Yandex SpeechKit STT
 */
export interface YandexSTTOptions {
    folderId: string;
    iamToken?: string | undefined;
    apiKey?: string | undefined;
    /**
     * ru-RU default language
     */
    lang?: string;
    /**
     * general topic is default
     * see https://yandex.cloud/en/docs/speechkit/stt/
     */
    topic?: string;
    sampleRateHertz?: number;
}

/**
 * Simple STT implementation for API v1:
 * POST https://stt.api.cloud.yandex.net/speech/v1/stt:recognize
 *
 * Wrap this class to coreSTT.StreamAdapter for stream work
 */
export class YandexShortAudioSTT extends coreSTT.STT {
    public label = 'yandex_speechkit_short_audio';
    private readonly opts: Required<Pick<YandexSTTOptions, 'folderId'>> & YandexSTTOptions;

    constructor(options: YandexSTTOptions) {
        super({
            streaming: false,
            interimResults: false,
        } as any);

        if (!options.folderId) {
            throw new Error('[YandexSTT] folderId is required');
        }
        if (!options.iamToken && !options.apiKey) {
            throw new Error('[YandexSTT] iamToken or apiKey is required');
        }

        this.opts = {
            lang: 'ru-RU',
            topic: 'general',
            ...options,
        };
    }

    async close(): Promise<void> {
        // no-op
    }

    protected async _recognize(buffer: AudioBuffer): Promise<coreSTT.SpeechEvent> {
        const frame = Array.isArray(buffer) ? mergeFrames(buffer) : buffer;

        const pcm16 = this.encodeToPCM16(frame);

        const frameRate = (frame as any).sampleRate;
        const targetRate =
            this.opts.sampleRateHertz ?? frameRate ?? 16000;

        const allowed = [48000, 16000, 8000];
        const closest = allowed.reduce((best, r) =>
                Math.abs(r - targetRate) < Math.abs(best - targetRate) ? r : best,
            allowed[0]!
        );

        if (!allowed.includes(targetRate)) {
            console.warn(
                `[YandexSTT] sampleRateHertz=${targetRate} not allowed, using closest=${closest}`,
            );
        }

        const sampleRateHertz = allowed.includes(targetRate) ? targetRate : closest;

        console.log('[YandexSTT] _recognize debug (before fetch):', {
            frameRate,
            sampleRateHertz,
            samples: pcm16.length,
        });

        const url = new URL(
            'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize',
        );

        url.searchParams.set('folderId', this.opts.folderId);
        url.searchParams.set('lang', this.opts.lang ?? 'ru-RU');
        url.searchParams.set('topic', this.opts.topic ?? 'general');
        url.searchParams.set('format', 'lpcm');
        url.searchParams.set('sampleRateHertz', String(sampleRateHertz));

        const headers: Record<string, string> = {};
        if (this.opts.iamToken) {
            headers['Authorization'] = `Bearer ${this.opts.iamToken}`;
        } else if (this.opts.apiKey) {
            headers['Authorization'] = `Api-Key ${this.opts.apiKey}`;
        }

        const body = pcm16.buffer as ArrayBuffer;

        let textBody: string;
        let status: number;
        let statusText: string;

        try {
            const res = await fetch(url.toString(), {
                method: 'POST',
                headers,
                body,
            });

            status = res.status;
            statusText = res.statusText;
            textBody = await res.text();
        } catch (err) {
            console.error('[YandexSTT] fetch failed:', err);
            throw err;
        }

        console.log('[YandexSTT] HTTP response:', {
            status,
            statusText,
            raw: textBody,
        });

        if (status < 200 || status >= 300) {
            throw new Error(
                `[YandexSTT] HTTP ${status} ${statusText}: ${textBody}`,
            );
        }

        let json: {
            result?: string;
            error_code?: string;
            error_message?: string;
        };

        try {
            json = JSON.parse(textBody);
        } catch (e) {
            throw new Error(
                `[YandexSTT] Failed to parse JSON: ${(e as Error).message}. Raw: ${textBody}`,
            );
        }

        if (json.error_code) {
            throw new Error(
                `[YandexSTT] ${json.error_code}: ${json.error_message ?? ''}`,
            );
        }

        const text = json.result ?? '';

        console.log('[YandexSTT] parsed result:', { text });

        const event: coreSTT.SpeechEvent = {
            type: coreSTT.SpeechEventType.FINAL_TRANSCRIPT,
            alternatives: [
                {
                    text,
                    confidence: text ? 1.0 : 0,
                    language: this.opts.lang ?? 'ru-RU',
                    startTime: 0,
                    endTime: 0,
                },
            ],
        };

        return event;
    }

    /**
     * Implement later for gRPC streaming
     */
    stream(): coreSTT.SpeechStream {
        throw new Error(
            '[YandexSTT] stream() is not implemented. Wrap with StreamAdapter.',
        );
    }

    private encodeToPCM16(frame: any): Int16Array {
        const data = frame?.data ?? frame?.samples ?? frame?.pcm;

        if (!data) {
            throw new Error('[YandexSTT] AudioFrame has no data');
        }

        if (data instanceof Int16Array) {
            return data;
        }

        if (data instanceof Float32Array) {
            const out = new Int16Array(data.length);
            for (let i = 0; i < data.length; i++) {
                let s = data[i]!;
                if (s > 1) s = 1;
                else if (s < -1) s = -1;
                out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
            return out;
        }

        if (data instanceof Uint8Array) {
            return new Int16Array(
                data.buffer,
                data.byteOffset,
                Math.floor(data.byteLength / 2),
            );
        }

        throw new Error(
            `[YandexSTT] Unsupported audio frame data type: ${data?.constructor?.name}`,
        );
    }
}
