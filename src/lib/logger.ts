interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    digest?: string;
  };
}

function createEntry(
  level: string,
  message: string,
  context?: Record<string, unknown>
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };
  if (context) {
    entry.context = context;
  }
  return entry;
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== "development") {
      return;
    }
    const entry = createEntry("debug", message, context);
    console.debug(JSON.stringify(entry));
  },

  info(message: string, context?: Record<string, unknown>): void {
    const entry = createEntry("info", message, context);
    console.info(JSON.stringify(entry));
  },

  warn(message: string, context?: Record<string, unknown>): void {
    const entry = createEntry("warn", message, context);
    console.warn(JSON.stringify(entry));
  },

  error(
    message: string,
    error?: Error & { digest?: string },
    context?: Record<string, unknown>
  ): void {
    const entry = createEntry("error", message, context);
    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
      };
      if (error.digest) {
        entry.error.digest = error.digest;
      }
    }
    console.error(JSON.stringify(entry));
  },
};
