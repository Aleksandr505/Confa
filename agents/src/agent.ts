import {cli, defineAgent, type JobContext, type JobProcess, JobRequest, voice, WorkerOptions,} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import * as openai from '@livekit/agents-plugin-openai';
import * as assemblyai from '@livekit/agents-plugin-assemblyai';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import { stt } from '@livekit/agents';

dotenv.config({ path: '.env.local' });

const requestFunc = async (req: JobRequest) => {
    await req.accept('Agent Coach', `coach-${req.job.id}`);
};

/**
 * Основное описание агента
 */
export default defineAgent({
    prewarm: async (proc: JobProcess) => {
        proc.userData.vad = await silero.VAD.load();
    },

    entry: async (ctx: JobContext) => {
        console.log('STT=', process.env.STT_PROVIDER, 'LLM=', process.env.LLM_PROVIDER, 'TTS=', process.env.TTS_PROVIDER);

        const vad = ctx.proc.userData.vad! as silero.VAD;

        const assistant = new voice.Agent({
            instructions: 'You are a helpful AI coach that guides users in conversation.',
        });


        const stt = new deepgram.STT({});

        const llm = new openai.LLM({
            model: 'gpt-4.1-mini',
            apiKey: process.env.OPENAI_API_KEY!,
        });

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
            instructions: 'Greet the user and introduce yourself as their conversation coach.',
        });
    },
});

cli.runApp(new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    requestFunc,
}));
