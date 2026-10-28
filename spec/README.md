# spec

The specification: hand-written, generated nowhere. Each generator
writes its output into the directory that uses it, never here.

| file                    | what it is                       | the task that reads it              |
|-------------------------|----------------------------------|-------------------------------------|
| `calc.ohm`              | the grammar of an expression     | `calc:ohm2wasm`, `calc:gen_visitor` |
| `calc.adl`              | the AST that `engine/ast` builds | `calc:goadlc`, `calc:adl-ts`        |
| `ohm-cli/tests/*.txtar` | the grammar's fixtures           | `calc:grammar-test`                 |
