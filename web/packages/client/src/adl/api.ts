/* @generated from adl module api */

import * as ADL from './runtime/adl';
import * as calc from './calc';
import * as model from './model';
import * as sys_types from './sys/types';

export interface Request_List {
  kind: 'list';
}
export interface Request_Get {
  kind: 'get';
  value: model.CalculationId;
}
export interface Request_Put {
  kind: 'put';
  value: model.Calculation;
}
export interface Request_Delete {
  kind: 'delete';
  value: model.CalculationId;
}
export interface Request_Parse {
  kind: 'parse';
  value: string;
}
export interface Request_Evaluate {
  kind: 'evaluate';
  value: EvaluateReq;
}

/**
 * One request from the page to the engine, in both transports.
 */
export type Request = Request_List | Request_Get | Request_Put | Request_Delete | Request_Parse | Request_Evaluate;

export interface RequestOpts {
  /**
   * Every calculation in the store.
   */
  list: null;
  /**
   * One calculation by id.
   */
  get: model.CalculationId;
  /**
   * Create or update: a put with an empty id creates, and the
   * response carries the id.
   */
  put: model.Calculation;
  /**
   * Forget a calculation.
   */
  delete: model.CalculationId;
  /**
   * Parse a text: the AST, or the first error and where it is.
   */
  parse: string;
  /**
   * Parse and evaluate.
   */
  evaluate: EvaluateReq;
}

export function makeRequest<K extends keyof RequestOpts>(kind: K, value: RequestOpts[K]) { return {kind, value}; }

const Request_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"Request","type_":{"kind":"union_","value":{"fields":[{"annotations":[],"default":{"kind":"nothing"},"name":"list","serializedName":"list","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Void"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"get","serializedName":"get","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"model","name":"CalculationId"}}}},{"annotations":[],"default":{"kind":"nothing"},"name":"put","serializedName":"put","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"model","name":"Calculation"}}}},{"annotations":[],"default":{"kind":"nothing"},"name":"delete","serializedName":"delete","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"model","name":"CalculationId"}}}},{"annotations":[],"default":{"kind":"nothing"},"name":"parse","serializedName":"parse","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"String"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"evaluate","serializedName":"evaluate","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"api","name":"EvaluateReq"}}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"api"};

export const snRequest: ADL.ScopedName = {moduleName:"api", name:"Request"};

export function texprRequest(): ADL.ATypeExpr<Request> {
  return {value : {typeRef : {kind: "reference", value : snRequest}, parameters : []}};
}

export interface EvaluateReq {
  text: string;
  bindings: model.Binding[];
}

export function makeEvaluateReq(
  input: {
    text: string,
    bindings: model.Binding[],
  }
): EvaluateReq {
  return {
    text: input.text,
    bindings: input.bindings,
  };
}

const EvaluateReq_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"EvaluateReq","type_":{"kind":"struct_","value":{"fields":[{"annotations":[],"default":{"kind":"nothing"},"name":"text","serializedName":"text","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"String"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"bindings","serializedName":"bindings","typeExpr":{"parameters":[{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"model","name":"Binding"}}}],"typeRef":{"kind":"primitive","value":"Vector"}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"api"};

export const snEvaluateReq: ADL.ScopedName = {moduleName:"api", name:"EvaluateReq"};

export function texprEvaluateReq(): ADL.ATypeExpr<EvaluateReq> {
  return {value : {typeRef : {kind: "reference", value : snEvaluateReq}, parameters : []}};
}

export interface Response_List {
  kind: 'list';
  value: model.Calculation[];
}
export interface Response_Got {
  kind: 'got';
  value: model.Calculation;
}
export interface Response_Put {
  kind: 'put';
  value: model.Calculation;
}
export interface Response_Deleted {
  kind: 'deleted';
  value: model.CalculationId;
}
export interface Response_Parsed {
  kind: 'parsed';
  value: ParseResp;
}
export interface Response_Evaluated {
  kind: 'evaluated';
  value: EvaluateResp;
}
export interface Response_Error {
  kind: 'error';
  value: Error;
}

/**
 * One response from the engine. An engine error is the error branch.
 */
export type Response = Response_List | Response_Got | Response_Put | Response_Deleted | Response_Parsed | Response_Evaluated | Response_Error;

export interface ResponseOpts {
  list: model.Calculation[];
  got: model.Calculation;
  put: model.Calculation;
  deleted: model.CalculationId;
  parsed: ParseResp;
  evaluated: EvaluateResp;
  error: Error;
}

export function makeResponse<K extends keyof ResponseOpts>(kind: K, value: ResponseOpts[K]) { return {kind, value}; }

const Response_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"Response","type_":{"kind":"union_","value":{"fields":[{"annotations":[],"default":{"kind":"nothing"},"name":"list","serializedName":"list","typeExpr":{"parameters":[{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"model","name":"Calculation"}}}],"typeRef":{"kind":"primitive","value":"Vector"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"got","serializedName":"got","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"model","name":"Calculation"}}}},{"annotations":[],"default":{"kind":"nothing"},"name":"put","serializedName":"put","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"model","name":"Calculation"}}}},{"annotations":[],"default":{"kind":"nothing"},"name":"deleted","serializedName":"deleted","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"model","name":"CalculationId"}}}},{"annotations":[],"default":{"kind":"nothing"},"name":"parsed","serializedName":"parsed","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"api","name":"ParseResp"}}}},{"annotations":[],"default":{"kind":"nothing"},"name":"evaluated","serializedName":"evaluated","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"api","name":"EvaluateResp"}}}},{"annotations":[],"default":{"kind":"nothing"},"name":"error","serializedName":"error","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"api","name":"Error"}}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"api"};

export const snResponse: ADL.ScopedName = {moduleName:"api", name:"Response"};

export function texprResponse(): ADL.ATypeExpr<Response> {
  return {value : {typeRef : {kind: "reference", value : snResponse}, parameters : []}};
}

export interface ParseResp {
  exp: calc.Exp;
  /**
   * The expression fully parenthesised.
   */
  printed: string;
}

export function makeParseResp(
  input: {
    exp: calc.Exp,
    printed: string,
  }
): ParseResp {
  return {
    exp: input.exp,
    printed: input.printed,
  };
}

const ParseResp_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"ParseResp","type_":{"kind":"struct_","value":{"fields":[{"annotations":[],"default":{"kind":"nothing"},"name":"exp","serializedName":"exp","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"calc","name":"Exp"}}}},{"annotations":[],"default":{"kind":"nothing"},"name":"printed","serializedName":"printed","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"String"}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"api"};

export const snParseResp: ADL.ScopedName = {moduleName:"api", name:"ParseResp"};

export function texprParseResp(): ADL.ATypeExpr<ParseResp> {
  return {value : {typeRef : {kind: "reference", value : snParseResp}, parameters : []}};
}

export interface EvaluateResp {
  value: number;
  printed: string;
}

export function makeEvaluateResp(
  input: {
    value: number,
    printed: string,
  }
): EvaluateResp {
  return {
    value: input.value,
    printed: input.printed,
  };
}

const EvaluateResp_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"EvaluateResp","type_":{"kind":"struct_","value":{"fields":[{"annotations":[],"default":{"kind":"nothing"},"name":"value","serializedName":"value","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Int64"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"printed","serializedName":"printed","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"String"}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"api"};

export const snEvaluateResp: ADL.ScopedName = {moduleName:"api", name:"EvaluateResp"};

export function texprEvaluateResp(): ADL.ATypeExpr<EvaluateResp> {
  return {value : {typeRef : {kind: "reference", value : snEvaluateResp}, parameters : []}};
}

export interface Error {
  message: string;
  /**
   * Where in the text, for a parse error; absent otherwise.
   */
  at: sys_types.Maybe<Position>;
}

export function makeError(
  input: {
    message: string,
    at: sys_types.Maybe<Position>,
  }
): Error {
  return {
    message: input.message,
    at: input.at,
  };
}

const Error_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"Error","type_":{"kind":"struct_","value":{"fields":[{"annotations":[],"default":{"kind":"nothing"},"name":"message","serializedName":"message","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"String"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"at","serializedName":"at","typeExpr":{"parameters":[{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"api","name":"Position"}}}],"typeRef":{"kind":"reference","value":{"moduleName":"sys.types","name":"Maybe"}}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"api"};

export const snError: ADL.ScopedName = {moduleName:"api", name:"Error"};

export function texprError(): ADL.ATypeExpr<Error> {
  return {value : {typeRef : {kind: "reference", value : snError}, parameters : []}};
}

export interface Position {
  line: number;
  column: number;
}

export function makePosition(
  input: {
    line: number,
    column: number,
  }
): Position {
  return {
    line: input.line,
    column: input.column,
  };
}

const Position_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"Position","type_":{"kind":"struct_","value":{"fields":[{"annotations":[],"default":{"kind":"nothing"},"name":"line","serializedName":"line","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Int32"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"column","serializedName":"column","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Int32"}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"api"};

export const snPosition: ADL.ScopedName = {moduleName:"api", name:"Position"};

export function texprPosition(): ADL.ATypeExpr<Position> {
  return {value : {typeRef : {kind: "reference", value : snPosition}, parameters : []}};
}

export const _AST_MAP: { [key: string]: ADL.ScopedDecl } = {
  "api.Request" : Request_AST,
  "api.EvaluateReq" : EvaluateReq_AST,
  "api.Response" : Response_AST,
  "api.ParseResp" : ParseResp_AST,
  "api.EvaluateResp" : EvaluateResp_AST,
  "api.Error" : Error_AST,
  "api.Position" : Position_AST
};
