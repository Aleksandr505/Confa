import { AudioByteStream, log, shortuuid, tts } from '@livekit/agents';

const NUM_CHANNELS = 1;

export interface YandexTTSOptions {
    folderId?: string;
    iamToken?: string | undefined;
    apiKey?: string | undefined;
    sampleRateHertz?: number;
    voice?: string;
    role?: string;
    speed?: number;
    model?: string;
    baseUrl?: string;
}

type NormalizedOpts = {
    folderId?: string | undefined;
    iamToken?: string | undefined;
    apiKey?: string | undefined;
    sampleRateHertz: number;
    voice: string;
    role?: string | undefined;
    speed?: number | undefined;
    model?: string | undefined;
    baseUrl: string;
};

const defaultOpts: NormalizedOpts = {
    sampleRateHertz: 16000,
    voice: 'marina',
    baseUrl: 'https://tts.api.cloud.yandex.net',
};

export class YandexTTS extends tts.TTS {
    public label = 'yandex_speechkit_tts';
    private readonly opts: NormalizedOpts;
    private readonly logger = log();

    constructor(options: YandexTTSOptions) {
        const sampleRate = options.sampleRateHertz ?? defaultOpts.sampleRateHertz;

        super(sampleRate, NUM_CHANNELS, { streaming: false });

        if (!options.iamToken && !options.apiKey) {
            throw new Error('[YandexTTS] iamToken or apiKey is required');
        }

        this.opts = {
            ...defaultOpts,
            ...options,
            sampleRateHertz: sampleRate,
            baseUrl: options.baseUrl ?? defaultOpts.baseUrl,
            voice: options.voice ?? defaultOpts.voice,
        };
    }

    async close(): Promise<void> {
        // no-op
    }

    synthesize(text: string): tts.ChunkedStream {
        return new YandexChunkedStream(this, text, this.opts);
    }

    stream(): tts.SynthesizeStream {
        throw new Error(
            '[YandexTTS] stream() is not implemented. Use this TTS as non-streaming (it will be wrapped by TTSStreamAdapter).',
        );
    }
}

class YandexChunkedStream extends tts.ChunkedStream {
    public label = 'yandex_speechkit.ChunkedStream';

    private readonly opts: NormalizedOpts;
    private readonly text: string;

    constructor(ttsInstance: YandexTTS, text: string, opts: NormalizedOpts) {
        super(text, ttsInstance);
        this.text = text;
        this.opts = opts;
    }

    protected async run() {
        const requestId = shortuuid();
        const logger = log();

        try {
            const audioBytes = await synthesizeToPCM(this.opts, this.text, logger);
            const bstream = new AudioByteStream(this.opts.sampleRateHertz, NUM_CHANNELS);

            for (const frame of bstream.write(audioBytes)) {
                this.queue.put({
                    requestId,
                    segmentId: requestId,
                    frame,
                    final: false,
                });
            }

            for (const frame of bstream.flush()) {
                this.queue.put({
                    requestId,
                    segmentId: requestId,
                    frame,
                    final: true,
                });
            }
        } catch (err) {
            logger.error({ err }, '[YandexTTS] synthesis failed');
            throw err;
        } finally {
            this.queue.close();
        }
    }
}

async function synthesizeToPCM(
    opts: NormalizedOpts,
    text: string,
    logger: ReturnType<typeof log>,
): Promise<ArrayBuffer> {
    const url = `${opts.baseUrl.replace(/\/+$/, '')}/tts/v3/utteranceSynthesis`;

    const hints: any[] = [
        { voice: opts.voice },
    ];

    if (opts.role) {
        hints.push({ role: opts.role });
    }
    if (typeof opts.speed === 'number') {
        hints.push({ speed: opts.speed });
    }

    const body: any = {
        text,
        hints,
        outputAudioSpec: {
            rawAudio: {
                audioEncoding: 'LINEAR16_PCM',
                sampleRateHertz: String(opts.sampleRateHertz),
            },
        },
    };

    if (opts.model) {
        body.model = opts.model;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (opts.apiKey) {
        headers['Authorization'] = `Api-Key ${opts.apiKey}`;
    } else if (opts.iamToken) {
        headers['Authorization'] = `Bearer ${opts.iamToken}`;
        if (opts.folderId) {
            headers['x-folder-id'] = opts.folderId;
        }
    }

    let status = 0;
    let statusText = '';
    let textBody = '';

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        status = res.status;
        statusText = res.statusText;
        textBody = await res.text();
    } catch (err) {
        logger.error({ err }, '[YandexTTS] fetch failed');
        throw err;
    }

    if (status < 200 || status >= 300) {
        throw new Error(
            `[YandexTTS] HTTP ${status} ${statusText}: ${textBody.slice(0, 2000)}`,
        );
    }

    const pcmChunks: Buffer[] = [];
    const lines = textBody.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let json: any;
        try {
            json = JSON.parse(trimmed);
        } catch (e) {
            logger.warn(
                {
                    line: trimmed.slice(0, 120),
                    error: (e as Error).message,
                },
                '[YandexTTS] Failed to parse JSON line from response',
            );
            continue;
        }

        const result = json.result;
        if (!result) continue;

        const textChunk = result.textChunk?.text as string | undefined;
        if (textChunk) {
            logger.debug(`[YandexTTS] textChunk: ${textChunk}`);
        }

        const b64 = result.audioChunk?.data as string | undefined;
        if (b64) {
            pcmChunks.push(Buffer.from(b64, 'base64'));
        }
    }

    if (!pcmChunks.length) {
        throw new Error(
            `[YandexTTS] No audioChunk.data in response: ${textBody.slice(
                0,
                2000,
            )}`,
        );
    }

    const buf = Buffer.concat(pcmChunks);

    return buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
}
