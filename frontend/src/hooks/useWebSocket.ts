import { useState, useEffect, useCallback, useRef } from 'react';
import { ServerMessage, ClientMessage } from '../types/socket.types';

interface UseWebSocketOptions {
    url: string;
    onMessage: (msg: ServerMessage) => void;
    onOpen?: () => void;
    onClose?: () => void;
}

export const useWebSocket = ({ url, onMessage, onOpen, onClose }: UseWebSocketOptions) => {
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const retryCountRef = useRef(0);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            const ws = new WebSocket(url);

            ws.onopen = () => {
                setIsConnected(true);
                setError(null);
                retryCountRef.current = 0;
                if (onOpen) onOpen();
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
                setError('WebSocket connection error');
            };

            ws.onclose = () => {
                setIsConnected(false);
                if (onClose) onClose();

                // Exponential backoff reconnect
                const currentRetry = retryCountRef.current;
                if (currentRetry < 5) {
                    const timeout = Math.min(1000 * Math.pow(2, currentRetry), 10000);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        retryCountRef.current += 1;
                        connect();
                    }, timeout);
                }
            };

            wsRef.current = ws;

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown connection error');
            setIsConnected(false);
        }
    }, [url, onMessage, onOpen, onClose]);

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

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            // Unset onclose to prevent triggering auto-reconnect logic during manual termination
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);

    return {
        isConnected,
        error,
        sendMessage,
        disconnect
    };
};
