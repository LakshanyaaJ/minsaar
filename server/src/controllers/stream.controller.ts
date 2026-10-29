import { Request, Response } from 'express';
import { ingestService } from '../services/ingest.service';
import { eventBus } from '../services/eventBus.service';
import { ServerEvent } from '../types/events';

export class IngestController {
  async ingestReadings(req: Request, res: Response) {
    const apiKey = (req.headers['x-device-key'] as string) || (req.headers['device-key'] as string);
    const readings = Array.isArray(req.body) ? req.body : (req.body.readings || []);
    const result = await ingestService.ingestReadings(apiKey, readings);
    res.status(201).json({ success: true, count: result.count });
  }
}

export class StreamController {
  stream(req: Request, res: Response) {
    // Set headers for Server-Sent Events (SSE)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });

    // Send initial handshake
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    const listener = (event: ServerEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    eventBus.onEvent(listener);

    // Keep connection alive with heartbeat comment every 20 seconds
    const interval = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 20000);

    req.on('close', () => {
      clearInterval(interval);
      eventBus.offEvent(listener);
    });
  }
}

export const ingestController = new IngestController();
export const streamController = new StreamController();
