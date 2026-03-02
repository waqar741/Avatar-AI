import { ConversationStateMachine } from './ConversationStateMachine';

interface CoordinatorConfig {
    stateMachine: ConversationStateMachine;
    onStartSpeaking: () => void;
    onStopSpeaking: () => void;
}

export class SpeakingCoordinator {
    private stateMachine: ConversationStateMachine;
    private onStartSpeaking: () => void;
    private onStopSpeaking: () => void;

    private audioDone: boolean = true;
    private phonemesDone: boolean = true;
    private isCurrentlySpeaking: boolean = false;

    constructor(config: CoordinatorConfig) {
        this.stateMachine = config.stateMachine;
        this.onStartSpeaking = config.onStartSpeaking;
        this.onStopSpeaking = config.onStopSpeaking;
    }

    public notifyAudioChunkReceived() {
        // Triggers instantly upon first payload frame bypassing arbitrary websocket sentence boundaries
        if (!this.isCurrentlySpeaking && this.stateMachine.getState() === 'THINKING') {
            this.isCurrentlySpeaking = true;
            this.audioDone = false;
            this.phonemesDone = false;

            this.stateMachine.safeTransition('SPEAKING');
            this.onStartSpeaking();
        }
    }

    public notifyAudioDone() {
        this.audioDone = true;
        this.checkCompletion();
    }

    public notifyPhonemesDone() {
        this.phonemesDone = true;
        this.checkCompletion();
    }

    public interruptAndClear() {
        // Immediate violent halt for when users hold the Mic forcefully mid-speaking
        this.audioDone = true;
        this.phonemesDone = true;

        if (this.isCurrentlySpeaking) {
            this.isCurrentlySpeaking = false;
            this.onStopSpeaking();
        }
    }

    private checkCompletion() {
        // Await dual conclusion resolving race conditions gracefully
        if (this.audioDone && this.phonemesDone && this.isCurrentlySpeaking) {
            this.isCurrentlySpeaking = false;
            this.onStopSpeaking();

            // Revert securely preventing illegal hops if UI interrupted upstream
            if (this.stateMachine.getState() === 'SPEAKING') {
                this.stateMachine.safeTransition('IDLE');
            }
        }
    }
}
