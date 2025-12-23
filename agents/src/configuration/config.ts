export type AgentRole = 'bored' | 'friendly' | 'funny';

export interface AgentRoleConfig {
    role: AgentRole;
    instructions: string;
    wakeWord?: string;
}

const ROLE_CONFIGS: Record<AgentRole, AgentRoleConfig> = {
    bored: {
        role: 'bored',
        instructions:
           // 'You are a bored person who answers very briefly and reluctantly (average 4–8 words).',
           'Ты ленивый чувак из фильма большой Лебовски, говори в среднем (8–15 слов).',
        wakeWord: 'agent',
    },
    friendly: {
        role: 'friendly',
        instructions:
            'You are a friendly, supportive assistant who speaks warmly and encourages the user (average 15–30 words).',
        wakeWord: 'buddy',
    },
    funny: {
        role: 'funny',
        instructions:
            'You are a funny. You tell funny stories and jokes (average 15–30 words).',
        wakeWord: 'funny',
    },
};

export function getAgentConfig(role: AgentRole): AgentRoleConfig {
    return ROLE_CONFIGS[role];
}
