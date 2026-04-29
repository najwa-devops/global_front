/**
 * Professional structured logger for production-grade financial systems.
 * Standardizes logging across the application and ensures zero console spam in production.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown> | undefined;
    error?: Error | unknown | undefined;
}

class Logger {
    private static instance: Logger;
    private isProduction: boolean;

    private constructor() {
        this.isProduction = process.env.NODE_ENV === 'production';
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private formatLog(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error | unknown): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
        };
    }

    private log(entry: LogEntry): void {
        if (this.isProduction && entry.level === 'debug') {
            return;
        }

        const logOutput = JSON.stringify(entry);

        switch (entry.level) {
            case 'debug':
                console.debug(logOutput);
                break;
            case 'info':
                console.info(logOutput);
                break;
            case 'warn':
                console.warn(logOutput);
                break;
            case 'error':
                console.error(logOutput);
                break;
        }
    }

    public debug(message: string, context?: Record<string, unknown>): void {
        this.log(this.formatLog('debug', message, context));
    }

    public info(message: string, context?: Record<string, unknown>): void {
        this.log(this.formatLog('info', message, context));
    }

    public warn(message: string, context?: Record<string, unknown>): void {
        this.log(this.formatLog('warn', message, context));
    }

    public error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
        this.log(this.formatLog('error', message, context, error));
    }
}

export const logger = Logger.getInstance();
