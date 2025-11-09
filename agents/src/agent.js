import { defineAgent, voice, cli, WorkerOptions, } from '@livekit/agents';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { fileURLToPath } from 'node:url';
import { request } from 'undici';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
/**
 * Основное описание агента
 */
export default defineAgent({
    prewarm: async (proc) => {
        proc.userData.vad = await silero.VAD.load();
    },
    entry: async (ctx) => {
        const vad = ctx.proc.userData.vad;
        // Создаем голосового ассистента
        const assistant = new voice.Agent({
            instructions: 'You are a helpful AI coach that guides users in conversation.',
        });
        // Конфигурируем цепочку: STT -> LLM -> TTS
        const session = new voice.AgentSession({
            vad,
            stt: process.env.STT_PROVIDER || 'assemblyai/universal-streaming:en',
            llm: process.env.LLM_PROVIDER || 'openai/gpt-4.1-mini',
            tts: process.env.TTS_PROVIDER || 'cartesia/sonic-2',
            turnDetection: new livekit.turnDetector.MultilingualModel(),
        });
        // Подключаемся к комнате LiveKit
        await ctx.connect();
        // Запускаем сессию
        await session.start({
            agent: assistant,
            room: ctx.room,
        });
        console.log(`[Agent] Connected as ${ctx.room.localParticipant?.identity} in ${ctx.room.name}`);
        console.log('STT=', process.env.STT_PROVIDER, 'LLM=', process.env.LLM_PROVIDER, 'TTS=', process.env.TTS_PROVIDER);
        // Обработка управляющих сообщений
        ctx.room.on('dataReceived', (payload) => {
            try {
                const msg = JSON.parse(new TextDecoder().decode(payload));
                if (msg.topic === 'control.turn') {
                    console.log('Turn control command received');
                }
                if (msg.topic === 'control.stop_tts') {
                    console.log('Stop TTS command received');
                }
            }
            catch (e) {
                console.error('Invalid control message', e);
            }
        });
        // Первое сообщение от агента
        await session.generateReply({
            instructions: 'Greet the user and introduce yourself as their conversation coach.',
        });
    },
});
cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
//# sourceMappingURL=agent.js.map