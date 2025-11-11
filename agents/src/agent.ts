import {cli, defineAgent, type JobContext, type JobProcess, JobRequest, voice, WorkerOptions,} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import * as openai from '@livekit/agents-plugin-openai';
import OpenAI from 'openai';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as deepgram from '@livekit/agents-plugin-deepgram';


dotenv.config({ path: '.env.local' });

const requestFunc = async (req: JobRequest) => {
    await req.accept('Somebody', `agent-${req.job.id}`);
};

/**
 * Основное описание агента
 */
export default defineAgent({
    prewarm: async (proc: JobProcess) => {
        proc.userData.vad = await silero.VAD.load();
    },

    entry: async (ctx: JobContext) => {

        const vad = ctx.proc.userData.vad! as silero.VAD;

        const assistant = new voice.Agent({
            instructions: 'You are a bored person who answers very briefly and reluctantly.',
        });


        const stt = new deepgram.STT({});

        let llm;

        if (process.env.LLM_PROVIDER === 'yandex') {
            console.log('[LLM] Using YandexGPT');

            const llmClient = new OpenAI({
                apiKey: process.env.YANDEX_CLOUD_API_KEY!,
                baseURL: 'https://llm.api.cloud.yandex.net/v1',
                project: process.env.YANDEX_CLOUD_FOLDER!,
            });

            llm = new openai.LLM({
                client: llmClient,
                model: `gpt://${process.env.YANDEX_CLOUD_FOLDER!}/${process.env.YANDEX_CLOUD_MODEL!}`,
                maxCompletionTokens: 50,
                temperature: 0.3,
            });
        } else {
            console.log('[LLM] Using OpenAI ChatGPT');

            llm = new openai.LLM({
                apiKey: process.env.OPENAI_API_KEY!,
                model: 'gpt-4.1-mini',
                maxCompletionTokens: 50,
                temperature: 0.7,
            });
        }

        const tts = new cartesia.TTS({
            model: "sonic-2",
            voice: "6ccbfb76-1fc6-48f7-b71d-91ac6298247b",
            apiKey: process.env.CARTESIA_API_KEY!,
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

        ctx.room.on('dataReceived', (payload) => {
            try {
                const msg = JSON.parse(new TextDecoder().decode(payload));
                if (msg.topic === 'control.turn') {
                    console.log('Turn control command received');
                }
                if (msg.topic === 'control.stop_tts') {
                    console.log('Stop TTS command received');
                }
            } catch (e) {
                console.error('Invalid control message', e);
            }
        });

        await session.generateReply({
            instructions: 'Greet the user and say something.',
        });
    },
});

cli.runApp(new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    requestFunc,
}));
