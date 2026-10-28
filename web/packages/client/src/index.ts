// The engine's client: the two transports, the factory, the log and
// the typed client. The generated types of spec/*.adl are under
// ./adl/*, and the ones the page uses most are re-exported here.

export type { Request, Response, EvaluateReq, EvaluateResp, ParseResp, Position, Error as ErrorValue } from './adl/api';
export type { Base, Binding, Calculation, CalculationId, Store } from './adl/model';
export type { Maybe } from './adl/sys/types';
export { type Engine, type Transport, type Timed, TypedEngine, EngineError, ProtocolError } from './engine';
export {
  encodeRequest,
  decodeRequest,
  decodeResponse,
  encodeResponse,
  formatRequest,
  formatResponse,
  requestJson,
  responseJson,
  storeJson,
  calculationJson,
} from './protocol';
export { WorkerTransport, createWorkerTransport, createWorkerEngine } from './workerEngine';
export { RequestLog, LoggingTransport, type LogEntry, type LogStatus } from './log';
export { serverTiming, onPageClock, absNow, type EngineBoot, type MessageTiming } from './timing';
export { HttpTransport, TransportError } from './http';
export { createEngine, DEFAULT_API_URL, type EngineConfig, type EngineMode } from './factory';
export { DirectTransport, loadEngine, serve, type RequestFn } from './direct';
export { emptyCalculation, formatValue, notesText } from './calculation';
