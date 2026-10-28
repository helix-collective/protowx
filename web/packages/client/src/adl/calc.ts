/* @generated from adl module calc */

import * as ADL from './runtime/adl';

export interface Exp_Num {
  kind: 'num';
  value: number;
}
export interface Exp_Variable {
  kind: 'variable';
  value: string;
}
export interface Exp_Bin {
  kind: 'bin';
  value: Binary;
}

export type Exp = Exp_Num | Exp_Variable | Exp_Bin;

export interface ExpOpts {
  num: number;
  variable: string;
  bin: Binary;
}

export function makeExp<K extends keyof ExpOpts>(kind: K, value: ExpOpts[K]) { return {kind, value}; }

const Exp_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"Exp","type_":{"kind":"union_","value":{"fields":[{"annotations":[],"default":{"kind":"nothing"},"name":"num","serializedName":"num","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Int64"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"variable","serializedName":"variable","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"String"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"bin","serializedName":"bin","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"calc","name":"Binary"}}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"calc"};

export const snExp: ADL.ScopedName = {moduleName:"calc", name:"Exp"};

export function texprExp(): ADL.ATypeExpr<Exp> {
  return {value : {typeRef : {kind: "reference", value : snExp}, parameters : []}};
}

export interface Binary {
  op: Op;
  left: Exp;
  right: Exp;
}

export function makeBinary(
  input: {
    op: Op,
    left: Exp,
    right: Exp,
  }
): Binary {
  return {
    op: input.op,
    left: input.left,
    right: input.right,
  };
}

const Binary_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"Binary","type_":{"kind":"struct_","value":{"fields":[{"annotations":[],"default":{"kind":"nothing"},"name":"op","serializedName":"op","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"calc","name":"Op"}}}},{"annotations":[],"default":{"kind":"nothing"},"name":"left","serializedName":"left","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"calc","name":"Exp"}}}},{"annotations":[],"default":{"kind":"nothing"},"name":"right","serializedName":"right","typeExpr":{"parameters":[],"typeRef":{"kind":"reference","value":{"moduleName":"calc","name":"Exp"}}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"calc"};

export const snBinary: ADL.ScopedName = {moduleName:"calc", name:"Binary"};

export function texprBinary(): ADL.ATypeExpr<Binary> {
  return {value : {typeRef : {kind: "reference", value : snBinary}, parameters : []}};
}

export type Op = 'plus' | 'minus' | 'times' | 'divide';
export const valuesOp : Op[] = ['plus', 'minus', 'times', 'divide'];

const Op_AST : ADL.ScopedDecl =
  {"decl":{"annotations":[],"name":"Op","type_":{"kind":"union_","value":{"fields":[{"annotations":[],"default":{"kind":"nothing"},"name":"plus","serializedName":"plus","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Void"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"minus","serializedName":"minus","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Void"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"times","serializedName":"times","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Void"}}},{"annotations":[],"default":{"kind":"nothing"},"name":"divide","serializedName":"divide","typeExpr":{"parameters":[],"typeRef":{"kind":"primitive","value":"Void"}}}],"typeParams":[]}},"version":{"kind":"nothing"}},"moduleName":"calc"};

export const snOp: ADL.ScopedName = {moduleName:"calc", name:"Op"};

export function texprOp(): ADL.ATypeExpr<Op> {
  return {value : {typeRef : {kind: "reference", value : snOp}, parameters : []}};
}

export const _AST_MAP: { [key: string]: ADL.ScopedDecl } = {
  "calc.Exp" : Exp_AST,
  "calc.Binary" : Binary_AST,
  "calc.Op" : Op_AST
};
