import { LoggerService, LogLevel } from '@nestjs/common';
import { mkdir, rename, stat, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { redactSensitiveData } from './sanitize-log-data.util';

const SUPPORTED_LEVELS: LogLevel[] = [
  'fatal',
  'log',
  'error',
  'warn',
  'debug',
  'verbose',
];
const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  fatal: 0,
  error: 0,
  warn: 1,
  log: 2,
  debug: 3,
  verbose: 4,
};

type LoggerPayload = {
  level: LogLevel;
  message: unknown;
  context?: string;
  trace?: string;
  metadata?: unknown;
  timestamp: string;
};

export class AppLogger implements LoggerService {
  private readonly minLevel: LogLevel;
  private readonly logPath: string;
  private readonly maxFileSizeBytes: number;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly isProduction = process.env.NODE_ENV === 'production',
    level = process.env.LOG_LEVEL || 'log',
    maxFileSizeKb = Number(process.env.LOG_MAX_FILE_SIZE || 1024),
  ) {
    this.minLevel = SUPPORTED_LEVELS.includes(level as LogLevel)
      ? (level as LogLevel)
      : 'log';
    this.maxFileSizeBytes = Math.max(1, maxFileSizeKb) * 1024;
    this.logPath = resolve(process.cwd(), 'logs', 'app.log');
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.writeLog('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    const [trace, context, metadata] = this.extractErrorParams(optionalParams);
    this.writeLog('error', message, [context, metadata], trace);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.writeLog('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.writeLog('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.writeLog('verbose', message, optionalParams);
  }

  fatal(message: unknown, trace?: string, metadata?: unknown) {
    this.writeLog('error', message, ['process', metadata], trace);
  }

  private extractErrorParams(optionalParams: unknown[]) {
    const [traceOrContext, contextOrMetadata, metadata] = optionalParams;
    let trace: string | undefined;
    let context: string | undefined;
    let extra: unknown;

    if (typeof traceOrContext === 'string' && traceOrContext.includes('\n')) {
      trace = traceOrContext;
      context =
        typeof contextOrMetadata === 'string' ? contextOrMetadata : undefined;
      extra =
        typeof contextOrMetadata === 'string' ? metadata : contextOrMetadata;
    } else {
      context = typeof traceOrContext === 'string' ? traceOrContext : undefined;
      extra =
        typeof traceOrContext === 'string' ? contextOrMetadata : traceOrContext;
    }

    return [trace, context, extra] as const;
  }

  private writeLog(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
    trace?: string,
  ) {
    if (!this.shouldLog(level)) {
      return;
    }

    const [context, metadata] = optionalParams;
    const payload: LoggerPayload = {
      level,
      message: redactSensitiveData(message),
      context: typeof context === 'string' ? context : undefined,
      metadata: redactSensitiveData(metadata),
      trace,
      timestamp: new Date().toISOString(),
    };

    const line = this.format(payload);
    if (level === 'error') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }

    this.enqueueFileWrite(`${line}\n`);
  }

  private shouldLog(level: LogLevel) {
    return LEVEL_WEIGHTS[level] <= LEVEL_WEIGHTS[this.minLevel];
  }

  private format(payload: LoggerPayload): string {
    if (this.isProduction) {
      return JSON.stringify({
        timestamp: payload.timestamp,
        level: payload.level,
        context: payload.context,
        message: payload.message,
        trace: payload.trace,
        metadata: payload.metadata,
      });
    }

    const message =
      typeof payload.message === 'string'
        ? payload.message
        : JSON.stringify(payload.message);
    const contextChunk = payload.context ? ` [${payload.context}]` : '';
    const metadataChunk = payload.metadata
      ? ` ${JSON.stringify(payload.metadata)}`
      : '';
    const traceChunk = payload.trace ? `\n${payload.trace}` : '';

    return `[${payload.timestamp}] [${payload.level.toUpperCase()}]${contextChunk} ${message}${metadataChunk}${traceChunk}`;
  }

  private enqueueFileWrite(line: string) {
    this.writeQueue = this.writeQueue
      .then(async () => {
        await mkdir(dirname(this.logPath), { recursive: true });
        await this.rotateIfNeeded(Buffer.byteLength(line));
        await appendFile(this.logPath, line, 'utf8');
      })
      .catch((error) => {
        process.stderr.write(
          `Logger file write failed: ${(error as Error).message}\n`,
        );
      });
  }

  private async rotateIfNeeded(nextBytes = 0) {
    const currentSize = await this.getCurrentSize();
    if (currentSize + nextBytes <= this.maxFileSizeBytes) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = this.logPath.replace(/\.log$/, `-${timestamp}.log`);
    await rename(this.logPath, rotatedPath);
  }

  private async getCurrentSize() {
    try {
      const fileStats = await stat(this.logPath);
      return fileStats.size;
    } catch {
      return 0;
    }
  }
}
