import {cli, defineAgent, type JobContext, type JobProcess, JobRequest, voice, llm, WorkerOptions,} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import * as openai from '@livekit/agents-plugin-openai';
import OpenAI from 'openai';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as deepgram from '@livekit/agents-plugin-deepgram';


dotenv.config({ path: '.env.local' });

const requestFunc = async (req: JobRequest) => {
    console.log('[Agent] job:', { room: req.job.room?.name, agentName: req.job.agentName, dispatchId: req.job.dispatchId });
    await req.accept('Agent', `agent-${req.job.id}`);
};

function requireEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`[ENV] ${name} is required`);
    return v;
}

function safeJSON<T = any>(buf: Uint8Array): T | null {
    try {
        return JSON.parse(new TextDecoder().decode(buf)) as T;
    } catch {
        return null;
    }
}

class BoredAgent extends voice.Agent {
    public hardMuted = false;
    private wakeWord = 'Agent';

    constructor() {
        super({
            instructions: 'You are a bored person who answers very briefly and reluctantly (average 4-8 words).',
        });
    }

    async onUserTurnCompleted(chatCtx: llm.ChatContext, newMessage: llm.ChatMessage): Promise<void> {
        const text = newMessage.textContent?.toLowerCase?.() ?? '';

        if (this.hardMuted) {
            if (text.includes(this.wakeWord)) {
                console.log('[Agent] wake word detected, unmuting');
                this.hardMuted = false;

                throw new voice.StopResponse();
            }

            throw new voice.StopResponse();
        }

    }
}

/**
 * Основное описание агента
 */
export default defineAgent({
    prewarm: async (proc: JobProcess) => {
        proc.userData.vad = await silero.VAD.load();
    },

    entry: async (ctx: JobContext) => {

        const vad = ctx.proc.userData.vad! as silero.VAD;

        const assistant = new BoredAgent();


        const stt = new deepgram.STT({});

        let llm;

        if (process.env.LLM_PROVIDER === 'yandex') {
            console.log('[LLM] Using YandexGPT');

            const llmClient = new OpenAI({
                apiKey: requireEnv('YANDEX_CLOUD_API_KEY'),
                baseURL: 'https://llm.api.cloud.yandex.net/v1',
                project: process.env.YANDEX_CLOUD_FOLDER!,
            });

            llm = new openai.LLM({
                client: llmClient,
                model: `gpt://${requireEnv('YANDEX_CLOUD_FOLDER')}/${requireEnv('YANDEX_CLOUD_MODEL')}`,
                maxCompletionTokens: 100,
                temperature: 0.3,
            });
        } else {
            console.log('[LLM] Using OpenAI ChatGPT');

            llm = new openai.LLM({
                apiKey: requireEnv('OPENAI_API_KEY'),
                model: 'gpt-4.1-mini',
                maxCompletionTokens: 100,
                temperature: 0.7,
            });
        }

        const tts = new cartesia.TTS({
            model: "sonic-2",
            voice: "6ccbfb76-1fc6-48f7-b71d-91ac6298247b",
            apiKey: requireEnv('CARTESIA_API_KEY'),
        });


        const session = new voice.AgentSession({
            vad,
            stt: stt,
            llm: llm,
            tts: tts,
           // turnDetection: new livekit.turnDetector.MultilingualModel(),
        });

        await ctx.connect();

        await session.start({
            agent: assistant,
            room: ctx.room,
        });

        console.log(`[Agent] Connected as ${ctx.room.localParticipant?.identity} in ${ctx.room.name}`);


        async function applyMuteState(newState: boolean) {
            if (assistant.hardMuted === newState) return;
            assistant.hardMuted = newState;

            if (assistant.hardMuted) {
                try {
                    await session.interrupt();
                } catch (e) {
                    console.warn('[Agent] interrupt failed (ignored):', e);
                }
            }

            console.log(`[Agent] hardMuted=${assistant.hardMuted}`);
        }

        ctx.room.on('dataReceived', async (payload) => {
            const msg = safeJSON<{ topic?: string; value?: any }>(payload);
            if (!msg || !msg.topic) return;

            switch (msg.topic) {
                case 'control.muted':
                    await applyMuteState(!!msg.value);
                    break;
                case 'control.stop_tts':
                    try {
                        await session.interrupt();
                        console.log('[Agent] Stop TTS command handled');
                    } catch (e) {
                        console.warn('[Agent] interrupt failed:', e);
                    }
                    break;
                case 'control.leave':
                    try {
                        await session.close();
                    } finally {
                        process.nextTick(() => process.exit(0));
                    }
                    break;
                default:
                    break;
            }
        });

        async function maybeReply(instructions: string) {
            if (assistant.hardMuted) return;
            await session.generateReply({
                instructions: instructions,
            });
        }

        await maybeReply('Greet the user and say something.')
    },
});

cli.runApp(new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    requestFunc,
    agentName: 'Agent'
}));
