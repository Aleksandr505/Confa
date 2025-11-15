import { voice, llm } from '@livekit/agents';
import type { AgentRoleConfig } from './config.js';

export class ConfigurableAgent extends voice.Agent {
    public hardMuted = false;
    private wakeWord?: string | undefined;
    private roleId: string;

    constructor(cfg: AgentRoleConfig) {
        super({
            instructions: cfg.instructions,
        });
        this.roleId = cfg.role;
        this.wakeWord = cfg.wakeWord ? cfg.wakeWord.toLowerCase() : undefined;
    }

    async onUserTurnCompleted(
        chatCtx: llm.ChatContext,
        newMessage: llm.ChatMessage,
    ): Promise<void> {
        const text = newMessage.textContent?.toLowerCase?.() ?? '';

        if (this.hardMuted) {
            if (this.wakeWord && text.includes(this.wakeWord)) {
                console.log(`[Agent:${this.roleId}] wake word detected, unmuting`);
                this.hardMuted = false;
            }

            throw new voice.StopResponse();
        }
    }
}
