/* @generated from adl */
import { declResolver, ScopedDecl } from "./runtime/adl";
import { _AST_MAP as api } from "./api";
import { _AST_MAP as calc } from "./calc";
import { _AST_MAP as model } from "./model";
import { _AST_MAP as sys_annotations } from "./sys/annotations";
import { _AST_MAP as sys_types } from "./sys/types";

export const ADL: { [key: string]: ScopedDecl } = {
  ...api,
  ...calc,
  ...model,
  ...sys_annotations,
  ...sys_types,
};

export const RESOLVER = declResolver(ADL);
