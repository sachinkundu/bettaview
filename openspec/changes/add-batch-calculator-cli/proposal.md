## Why

Developers need a small deterministic command-line tool for evaluating many arithmetic expressions without opening an interactive calculator or writing one-off scripts. Predictable grammar, batch continuation, and machine-readable output are necessary for automation to consume results safely.

## What Changes

- Add a `calc` command that evaluates one expression supplied as an argument or reads newline-delimited expressions from standard input.
- Support decimal numbers, parentheses, unary signs, the `+`, `-`, `*`, `/`, and `^` operators, and conventional precedence and associativity.
- Add `--format text|json` output and `--fail-fast` batch behavior; the default batch mode reports an error for each invalid line and continues with later lines.
- Reject division by zero, malformed expressions, unsupported tokens, and non-finite results with stable error codes and non-zero exit behavior.

## Capabilities

### New Capabilities

- `batch-calculator-cli`: Expression grammar, evaluation semantics, batch processing, output formats, and error/exit behavior for the calculator command.

### Modified Capabilities

None.

## Impact

- Adds a standalone CLI entry point and its parser/evaluator modules.
- Adds no network access, persistent storage, or production service integration.
- Adds focused command-level tests for arithmetic, batch continuation, formatting, and failures.
