import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import { loadEnv } from 'vite'
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import { handleApi, type ServerEnv } from './api'

export function saathApiPlugin(): Plugin {
  return {
    name: 'saath-api',
    configureServer(server) {
      attachApi(server)
    },
    configurePreviewServer(server) {
      attachApi(server)
    },
  }
}

function attachApi(server: ViteDevServer | PreviewServer) {
  const fileEnv = loadEnv(server.config.mode, process.cwd(), '')
  const env: ServerEnv = {
    SAATH_AI_BASE_URL: process.env.SAATH_AI_BASE_URL ?? fileEnv.SAATH_AI_BASE_URL,
    SAATH_AI_API_KEY: process.env.SAATH_AI_API_KEY ?? fileEnv.SAATH_AI_API_KEY,
    SAATH_AI_MODEL: process.env.SAATH_AI_MODEL ?? fileEnv.SAATH_AI_MODEL,
    SAATH_AI_PROVIDER_LABEL: process.env.SAATH_AI_PROVIDER_LABEL ?? fileEnv.SAATH_AI_PROVIDER_LABEL,
  }

  server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ?? ''
    if (!url.startsWith('/api/')) {
      next()
      return
    }
    try {
      const method = req.method ?? 'GET'
      const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req)
      const host = req.headers.host ?? 'localhost:3000'
      const request = new Request(`http://${host}${url}`, {
        method,
        headers: headersToObject(req.headers),
        body,
      })
      const response = await handleApi(request, env)
      if (!response) {
        next()
        return
      }
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      const payload = Buffer.from(await response.arrayBuffer())
      res.end(payload)
    } catch {
      // Never log request bodies, contact data or locations.
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json; charset=utf-8')
      }
      res.end(JSON.stringify({ error: 'server_error' }))
    }
  })
}

function headersToObject(headers: IncomingHttpHeaders): Headers {
  const result = new Headers()
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') result.set(key, value)
    else if (Array.isArray(value)) result.set(key, value.join(', '))
  }
  return result
}

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > 64 * 1024) throw new Error('body_too_large')
    chunks.push(buffer)
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined
}
