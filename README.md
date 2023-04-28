# Chaosudoku

Multiplayer sudoku game implemented with htmx.

## Running

```shell
scalesocket --staticdir ./public  --joinmsg '{"t":"Join","id":#ID}' node -- ./sudoku.js
```