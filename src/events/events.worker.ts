import { computeEvents } from './compute';
import type { EventsRequest, EventsResponse } from './types';

self.onmessage = (e: MessageEvent<EventsRequest>) => {
  const req = e.data;
  if (req.type !== 'compute') return;
  const events = computeEvents(req.ms, req.horizonDays);
  const res: EventsResponse = { type: 'result', ms: req.ms, events };
  (self as unknown as Worker).postMessage(res);
};
