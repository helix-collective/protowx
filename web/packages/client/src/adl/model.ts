/* @generated from adl module model */

import * as ADL from './runtime/adl';
import * as sys_types from './sys/types';

/**
 * A calculation's key in the store. A put with an empty id makes one.
 */
export type CalculationId = string;

const CalculationId_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"CalculationId","type_":{"kind":"newtype_","value":{"default":{"kind":"nothing"},"typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"String"}},"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"model"};

export const snCalculationId: ADL.ScopedName = {moduleName:"model", name:"CalculationId"};

export function texprCalculationId(): ADL.ATypeExpr<CalculationId> {
  return {value : {typeRef : {kind: "reference", value : snCalculationId}, parameters : []}};
}

/**
 * The record the page edits: one of each ADL shape a form has to draw.
 */
export interface Calculation {
  id: CalculationId;
  name: string;
  /**
   * The expression, in calc.ohm's syntax.
   */
  text: string;
  /**
   * The variables the expression may name.
   */
  bindings: Binding[];
  /**
   * How the result is shown.
   */
  base: Base;
  notes: sys_types.Maybe<string>;
  starred: boolean;
}

export function makeCalculation(
  input: {
    id: CalculationId,
    name: string,
    text: string,
    bindings?: Binding[],
    base?: Base,
    notes?: sys_types.Maybe<string>,
    starred?: boolean,
  }
): Calculation {
  return {
    id: input.id,
    name: input.name,
    text: input.text,
    bindings: input.bindings === undefined ? [] : input.bindings,
    base: input.base === undefined ? "decimal" : input.base,
    notes: input.notes === undefined ? {kind : "nothing"} : input.notes,
    starred: input.starred === undefined ? false : input.starred,
  };
}

const Calculation_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"Calculation","type_":{"kind":"struct_","value":{"fields":[{"annotations":[],"default":{"kind":"nothing"},"name":"id","serializedName":"id","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"model","name":"CalculationId"}}}},{"annotations":[],"default":{"kind":"nothing"},"name":"name","serializedName":"name","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"String"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"text","serializedName":"text","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"String"}}},{"annotations":[],"default":{"kind":"just","value":[]},"name":"bindings","serializedName":"bindings","typeExpr":{"parameters":[{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"model","name":"Binding"}}}],"typeRef":{"kind":"primitive","value":"Vector"}}},{"annotations":[],"default":{"kind":"just","value":"decimal"},"name":"base","serializedName":"base","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"model","name":"Base"}}}},{"annotations":[],"default":{"kind":"just","value":"nothing"},"name":"notes","serializedName":"notes","typeExpr":{"parameters":[{"parameters":[],"typeRef":{"kind":"primitive","value":"String"}}],"typeRef":{"kind":"reference","value":{"moduleName":"sys.types","name":"Maybe"}}}},{"annotations":[],"default":{"kind":"just","value":false},"name":"starred","serializedName":"starred","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Bool"}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"model"};

export const snCalculation: ADL.ScopedName = {moduleName:"model", name:"Calculation"};

export function texprCalculation(): ADL.ATypeExpr<Calculation> {
  return {value : {typeRef : {kind: "reference", value : snCalculation}, parameters : []}};
}

export interface Binding {
  name: string;
  value: number;
}

export function makeBinding(
  input: {
    name: string,
    value: number,
  }
): Binding {
  return {
    name: input.name,
    value: input.value,
  };
}

const Binding_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"Binding","type_":{"kind":"struct_","value":{"fields":[{"annotations":[],"default":{"kind":"nothing"},"name":"name","serializedName":"name","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"String"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"value","serializedName":"value","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Int64"}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"model"};

export const snBinding: ADL.ScopedName = {moduleName:"model", name:"Binding"};

export function texprBinding(): ADL.ATypeExpr<Binding> {
  return {value : {typeRef : {kind: "reference", value : snBinding}, parameters : []}};
}

export type Base = 'decimal' | 'hex' | 'binary';
export const valuesBase : Base[] = ['decimal', 'hex', 'binary'];

const Base_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"Base","type_":{"kind":"union_","value":{"fields":[{"annotations":[],"default":{"kind":"nothing"},"name":"decimal","serializedName":"decimal","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Void"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"hex","serializedName":"hex","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Void"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"binary","serializedName":"binary","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Void"}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"model"};

export const snBase: ADL.ScopedName = {moduleName:"model", name:"Base"};

export function texprBase(): ADL.ATypeExpr<Base> {
  return {value : {typeRef : {kind: "reference", value : snBase}, parameters : []}};
}

/**
 * Every calculation, in the order they were made.
 */
export interface Store {
  calculations: Calculation[];
}

export function makeStore(
  input: {
    calculations?: Calculation[],
  }
): Store {
  return {
    calculations: input.calculations === undefined ? [] : input.calculations,
  };
}

const Store_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"Store","type_":{"kind":"struct_","value":{"fields":[{"annotations":[],"default":{"kind":"just","value":[]},"name":"calculations","serializedName":"calculations","typeExpr":{"parameters":[{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"model","name":"Calculation"}}}],"typeRef":{"kind":"primitive","value":"Vector"}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"model"};

export const snStore: ADL.ScopedName = {moduleName:"model", name:"Store"};

export function texprStore(): ADL.ATypeExpr<Store> {
  return {value : {typeRef : {kind: "reference", value : snStore}, parameters : []}};
}

export const _AST_MAP: { [key: string]: ADL.ScopedDecl } = {
  "model.CalculationId" : CalculationId_AST,
  "model.Calculation" : Calculation_AST,
  "model.Binding" : Binding_AST,
  "model.Base" : Base_AST,
  "model.Store" : Store_AST
};
