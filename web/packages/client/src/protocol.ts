// The wire format: ADL JSON for the request and response unions,
// through the bindings the ADL runtime generates. The value in memory,
// {kind: 'put', value}, and the wire's {"put": ...} are both generated
// from spec/api.adl. Nothing else in this package knows how a message
// is spelled.

import { createJsonBinding, type Json, type JsonBinding } from './adl/runtime/json';
import { RESOLVER } from './adl/resolver';
import { texprRequest, texprResponse, type Request, type Response } from './adl/api';
import { texprCalculation, texprStore, type Calculation, type Store } from './adl/model';

export const requestBinding: JsonBinding<Request> = createJsonBinding(RESOLVER, texprRequest());
export const responseBinding: JsonBinding<Response> = createJsonBinding(RESOLVER, texprResponse());
const storeBinding: JsonBinding<Store> = createJsonBinding(RESOLVER, texprStore());
const calculationBinding: JsonBinding<Calculation> = createJsonBinding(RESOLVER, texprCalculation());

/** A request as its JSON value, as a report's replay holds it. */
export function requestJson(req: Request): Json {
  return requestBinding.toJson(req);
}

/** A response as its JSON value. */
export function responseJson(resp: Response): Json {
  return responseBinding.toJson(resp);
}

/** A store as its JSON value: the shape of bff's --store file. */
export function storeJson(store: Store): Json {
  return storeBinding.toJson(store);
}

/** A calculation as its JSON value, as a `put` carries it. */
export function calculationJson(calc: Calculation): Json {
  return calculationBinding.toJson(calc);
}

/** Encodes a request as the JSON text the engine reads. */
export function encodeRequest(req: Request): string {
  return JSON.stringify(requestJson(req));
}

/** Decodes one request from its JSON value. Throws on a value that is not a request. */
export function decodeRequest(json: unknown): Request {
  return requestBinding.fromJsonE(json as Json);
}

/** Decodes the JSON text the engine writes. Throws on a malformed reply. */
export function decodeResponse(text: string): Response {
  return responseBinding.fromJsonE(JSON.parse(text) as Json);
}

/** Encodes a response as the JSON text the engine writes. */
export function encodeResponse(resp: Response): string {
  return JSON.stringify(responseJson(resp));
}

/** A request as indented JSON, for a reader. */
export function formatRequest(req: Request): string {
  return JSON.stringify(requestJson(req), null, 2);
}

/** A response as indented JSON, for a reader. */
export function formatResponse(resp: Response): string {
  return JSON.stringify(responseJson(resp), null, 2);
}
