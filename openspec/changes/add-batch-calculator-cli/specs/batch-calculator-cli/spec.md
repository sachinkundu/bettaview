## Purpose

Define deterministic command-line expression evaluation for single calculations and newline-delimited batches, including observable formatting and failure behavior.

## ADDED Requirements

### Requirement: Accept single and batch input
The calculator SHALL evaluate an expression argument as one input, or SHALL read standard input as a sequence of newline-delimited inputs when no expression argument is supplied. It SHALL ignore blank standard-input lines and MUST reject simultaneous expression-argument and non-empty standard-input usage as `USAGE_ERROR`.

#### Scenario: Evaluate one expression argument
- **WHEN** the user invokes `calc "2 + 3"` without non-empty standard input
- **THEN** the command evaluates exactly one input expression

#### Scenario: Read a batch from standard input
- **WHEN** no expression argument is supplied and standard input contains three non-blank expression lines
- **THEN** the command evaluates the three expressions in source order

### Requirement: Apply deterministic arithmetic semantics
The calculator SHALL accept decimal numbers, parentheses, unary `+` and `-`, and binary `+`, `-`, `*`, `/`, and `^`. It SHALL apply exponentiation right-associatively, multiplication and division before addition and subtraction, and exponentiation before unary signs, so `2 ^ 3 ^ 2` evaluates to `512` and `-2 ^ 2` evaluates to `-4`.

#### Scenario: Respect precedence and associativity
- **WHEN** the input is `2 + 3 * 4 ^ 2`
- **THEN** the result is `50`

#### Scenario: Apply exponentiation before unary minus
- **WHEN** the input is `-2 ^ 2`
- **THEN** the result is `-4`

### Requirement: Continue or stop batch processing predictably
In the default batch mode, the calculator SHALL emit a result or error for every non-blank input line and continue after invalid expressions. When `--fail-fast` is present, it SHALL stop immediately after emitting the first error and MUST NOT evaluate or emit records for later lines.

#### Scenario: Continue after an invalid line by default
- **WHEN** a three-line batch contains an invalid expression on line two and `--fail-fast` is absent
- **THEN** the command emits records for lines one, two, and three in that order

#### Scenario: Stop at the first invalid line
- **WHEN** a three-line batch contains an invalid expression on line two and `--fail-fast` is present
- **THEN** the command emits records for lines one and two only

### Requirement: Provide text and JSON output
The calculator SHALL default to text output and SHALL accept `--format json`. Text mode SHALL emit one line per evaluated input containing either its result or `ERROR <code>: <message>`. JSON mode SHALL emit one JSON array whose ordered objects contain the one-based source line, original expression, status, and either result or error code and message.

#### Scenario: Emit JSON batch records
- **WHEN** a two-line batch is evaluated with `--format json`
- **THEN** stdout is a JSON array containing two ordered records with the required fields

### Requirement: Report stable failures and exit status
The calculator SHALL classify division by zero as `DIVISION_BY_ZERO`, malformed syntax as `INVALID_EXPRESSION`, unsupported characters or names as `UNSUPPORTED_TOKEN`, non-finite results as `NON_FINITE_RESULT`, and invalid command usage as `USAGE_ERROR`. It SHALL exit with status `0` only when every evaluated input succeeds, status `1` when any evaluated input fails, and status `2` for `USAGE_ERROR`.

#### Scenario: Report division by zero
- **WHEN** an evaluated expression divides by zero
- **THEN** its error code is `DIVISION_BY_ZERO` and the command exits with status `1`

#### Scenario: Reject invalid option usage
- **WHEN** the user supplies an unsupported output format
- **THEN** the command reports `USAGE_ERROR` and exits with status `2`
