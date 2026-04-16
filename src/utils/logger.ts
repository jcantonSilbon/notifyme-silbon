type LogLevel = 'info' | 'warn' | 'error' | 'debug'

function log(level: LogLevel, message: string, data?: unknown) {
  const timestamp = new Date().toISOString()
  const entry = {
    timestamp,
    level,
    message,
    ...(data !== undefined ? { data } : {}),
  }
  if (level === 'error') {
    console.error(JSON.stringify(entry))
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}

export const logger = {
  info: (message: string, data?: unknown) => log('info', message, data),
  warn: (message: string, data?: unknown) => log('warn', message, data),
  error: (message: string, data?: unknown) => log('error', message, data),
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      log('debug', message, data)
    }
  },
}
