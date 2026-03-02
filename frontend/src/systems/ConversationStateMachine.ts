export type ConversationState =
    | 'DISCONNECTED'
    | 'CONNECTING'
    | 'IDLE'
    | 'LISTENING'
    | 'THINKING'
    | 'SPEAKING'
    | 'ERROR';

type StateListener = (state: ConversationState) => void;

export class ConversationStateMachine {
    private currentState: ConversationState = 'DISCONNECTED';
    private listeners: Set<StateListener> = new Set();

    // Enforce valid state progression structurally prohibiting overlapping parallel commands
    private validTransitions: Record<ConversationState, ConversationState[]> = {
        'DISCONNECTED': ['CONNECTING', 'ERROR'],
        'CONNECTING': ['IDLE', 'ERROR', 'DISCONNECTED'],
        'IDLE': ['LISTENING', 'ERROR', 'DISCONNECTED'],
        'LISTENING': ['THINKING', 'IDLE', 'ERROR', 'DISCONNECTED'],
        'THINKING': ['SPEAKING', 'ERROR', 'DISCONNECTED'],
        'SPEAKING': ['IDLE', 'LISTENING', 'ERROR', 'DISCONNECTED'],
        'ERROR': ['CONNECTING', 'DISCONNECTED']
    };

    public getState(): ConversationState {
        return this.currentState;
    }

    public subscribe(listener: StateListener): () => void {
        this.listeners.add(listener);
        // Dispatch immediate sync state to new subscribers natively
        listener(this.currentState);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.currentState));
    }

    public safeTransition(targetState: ConversationState): boolean {
        if (this.currentState === targetState) return true;

        const allowed = this.validTransitions[this.currentState];
        if (allowed && allowed.includes(targetState)) {
            this.currentState = targetState;
            this.notifyListeners();
            return true;
        }

        console.warn(`[State Machine] Illegal transition blocked: ${this.currentState} -> ${targetState}`);
        return false;
    }

    // Sugar helpers for semantic forcing when recovery requires blunt overwrites
    public forceErrorState() {
        this.currentState = 'ERROR';
        this.notifyListeners();
    }
}
