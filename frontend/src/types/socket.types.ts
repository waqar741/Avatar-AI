export interface TokenMessage {
    type: 'token';
    content: str;
}

export interface AudioChunkMessage {
    type: 'audio_chunk';
    data: string; // Base64
}

export interface AudioDoneMessage {
    type: 'audio_done';
}

export interface PhonemeMessage {
    type: 'phoneme';
    frames: PhonemeFrame[];
}

export interface PhonemeDoneMessage {
    type: 'phoneme_done';
}

export interface DoneMessage {
    type: 'done';
}

export interface ErrorMessage {
    type: 'error';
    message: string;
}

export interface HeartbeatMessage {
    type: 'heartbeat';
    content: string;
}

export type ServerMessage =
    | TokenMessage
    | AudioChunkMessage
    | AudioDoneMessage
    | PhonemeMessage
    | PhonemeDoneMessage
    | DoneMessage
    | ErrorMessage
    | HeartbeatMessage;

export interface ClientChatMessage {
    type: 'chat';
    message: string;
}

export interface ClientPingMessage {
    type: 'ping';
}

export type ClientMessage = ClientChatMessage | ClientPingMessage;
