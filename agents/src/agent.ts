import {cli, defineAgent, type JobContext, type JobProcess, JobRequest, voice, llm, WorkerOptions,} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import * as openai from '@livekit/agents-plugin-openai';
import OpenAI from 'openai';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as deepgram from '@livekit/agents-plugin-deepgram';

import { getAgentConfig, type AgentRole } from './configuration/config.js';
import { ConfigurableAgent } from './configuration/configurableAgent.js';


dotenv.config({ path: '.env.local' });

const requestFunc = async (req: JobRequest) => {
    const meta = safeJSON<{ role?: AgentRole }>(req.job.metadata ?? '');
    const role = meta?.role ?? (process.env.AGENT_ROLE as AgentRole) ?? 'bored';

    const displayNameByRole: Record<AgentRole, string> = {
        bored: 'Bored Agent',
        friendly: 'Friendly Agent',
        funny: 'Funny Agent',
    };

    const name = displayNameByRole[role];
    const identity = `agent-${role}-${req.job.id}`;

    console.log('[Agent] job:', {
        room: req.job.room?.name,
        agentName: req.job.agentName,
        dispatchId: req.job.dispatchId,
        metadata: req.job.metadata,
        role,
        name,
        identity,
    });

    await req.accept(name, identity);
};

function resolveRole(ctx: JobContext): AgentRole {
    const raw = ctx.job.metadata;
    const meta = safeJSON<{ role?: string }>(raw);
    const fromMeta = meta?.role as AgentRole | undefined;
    if (fromMeta) return fromMeta;

    return 'bored';
}

function requireEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`[ENV] ${name} is required`);
    return v;
}

function safeJSON<T = any>(buf: Uint8Array | string | null | undefined): T | null {
    if (!buf) return null;

    let text: string;
    if (typeof buf === 'string') {
        text = buf;
    } else {
        text = new TextDecoder().decode(buf);
    }

    try {
        return JSON.parse(text) as T;
    } catch {
        return null;
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

        const role = resolveRole(ctx);
        const cfg = getAgentConfig(role);
        const assistant = new ConfigurableAgent(cfg);

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


        const roomIO = new voice.RoomIO({
            agentSession: session,
            room: ctx.room,
            inputOptions: {
                audioEnabled: true,
                textEnabled: false,
            },
        });

        roomIO.start();

        await ctx.connect();

        await session.start({
            agent: assistant,
            room: ctx.room,
        });

        console.log(`[Agent] Connected as ${ctx.room.localParticipant?.identity} in ${ctx.room.name}`);

        ctx.room.on('trackPublished', (pub, participant) => {
            console.log('[Agent] trackPublished', {
                participant: participant.identity,
                kind: pub.kind,
                sid: pub.sid,
            });
        });

        async function applyMuteState(newState: boolean) {
            console.log(`[Agent] start mute agent with newState=${newState} and oldState=${assistant.hardMuted}`);
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

        ctx.room.on('dataReceived', async (payload, participant, kind) => {
            console.log('[Agent] dataReceived raw:', {
                from: participant?.identity,
                kind,
                bytes: payload.length,
                text: new TextDecoder().decode(payload),
            });

            const msg = safeJSON<{ topic?: string; value?: any }>(payload);
            if (!msg || !msg.topic) return;

            console.log('[Agent] dataReceived parsed:', msg.topic, msg.value);

            switch (msg.topic) {
                case 'control.set_target':
                    const target =
                        typeof msg.value === 'string'
                            ? msg.value
                            : msg.value != null
                                ? String(msg.value)
                                : undefined;

                    if (target) {
                        console.log('[Agent] switching target to', target);
                        roomIO.setParticipant(target);
                    }
                    break;
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
