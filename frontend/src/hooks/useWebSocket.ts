import { useEffect, useCallback, useRef } from 'react';
import type { ServerMessage, ClientMessage } from '../types/socket.types';

interface UseWebSocketOptions {
    url: string;
    onMessage: (msg: ServerMessage) => void;
    onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

export const useWebSocket = ({ url, onMessage, onStatusChange }: UseWebSocketOptions) => {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryCountRef = useRef(0);
    const MAX_RETRIES = 5;

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        onStatusChange('connecting');

        try {
            const ws = new WebSocket(url);

            ws.onopen = () => {
                retryCountRef.current = 0;
                onStatusChange('connected');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as ServerMessage;
                    onMessage(data);
                } catch (err) {
                    console.error('Failed to parse websocket message', err);
                }
            };

            ws.onerror = () => {
                // Do not explicitly force error here as onclose will instantly fire managing retries
            };

            ws.onclose = () => {
                const currentRetry = retryCountRef.current;

                if (currentRetry < MAX_RETRIES) {
                    onStatusChange('connecting');
                    // Exponential backoff reconnect
                    const timeout = Math.min(1000 * Math.pow(2, currentRetry), 10000);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        retryCountRef.current += 1;
                        connect();
                    }, timeout);
                } else {
                    // Maximum threshold reached, transition system to permanent error needing manual override
                    onStatusChange('error');
                }
            };

            wsRef.current = ws;

        } catch (err) {
            console.error(err);
            onStatusChange('error');
        }
    }, [url, onMessage, onStatusChange]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    const sendMessage = useCallback((msg: ClientMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        } else {
            console.warn('Cannot send message, WebSocket is not open');
        }
    }, []);

    const forceReconnect = useCallback(() => {
        retryCountRef.current = 0;
        connect();
    }, [connect]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.onclose = null; // Prevent generic auto-reconnect
            wsRef.current.close();
            wsRef.current = null;
        }
        onStatusChange('disconnected');
    }, [onStatusChange]);

    return {
        sendMessage,
        forceReconnect,
        disconnect
    };
};
