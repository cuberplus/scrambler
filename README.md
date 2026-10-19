# Scrambler

A static, browser-only Rubik's Cube practice-sheet builder. Generates
difficulty-balanced practice scrambles, solves the selected partial-cube target
optimally in HTM, and prints the selected grid columns. There are no API calls,
remote solvers, external fonts, or analytics. These are practice scrambles, not
WCA uniform random-state scrambles.

The default worksheet contains 20 X-Cross scrambles with a minimum solution
length of 2 HTM.

## Run

```sh
npm ci
npm start
```

```sh
npm run test:ci
npm run test:performance
npm run build
```

## Deploy

```sh
npm run deploy
```

This builds the website with the `/scrambler` asset prefix and publishes `build`
to the `gh-pages` branch. GitHub Pages serves that branch from its root at
`https://cuberplus.com/scrambler/`, inheriting the custom domain from the
`cuberplus.github.io` site. Do not add a project-level `CNAME`, which would
override that inherited domain.

The `build` directory can also be served by any static host at `/scrambler/`.
Serve over HTTP(S), not `file://`, so the browser can load the bundled worker.
A deployed site needs no application server.

## Print

Use **Print sheet** for a grid-only, portrait worksheet: no site header, footer,
settings, status, or promotional text. Column headings repeat as part of the
grid. The layout fits 20 scrambles per full page on Letter and A4 paper, with
larger cube diagrams and more space between rows.
Only the final page may contain fewer rows. Additional custom columns reduce
the print font size to preserve the page density without dropping columns.

## Targets and notation

- Cross: four base-color edges, aligned with their centers.
- X-Cross (default): cross plus one completely solved F2L corner/edge pair.
- 2×2×2 block: two adjacent base edges and their intervening corner/edge pair.
- XX-Cross: cross plus two solved pairs, optionally adjacent or diagonal.

U is white, F is green, and R is red (D yellow, B blue, L orange). Algorithms
always use this original orientation; no uncounted cube rotations or setup
moves are needed. Clockwise, counterclockwise, and half turns each cost one
HTM move. A pair is named by its two side colors; its corner also contains the
base color. For blocks, the cross-color column identifies the base face.

Color-neutral searches minimize over every permitted color and pair, not just
the first cross found. Fixed pairs restrict the allowed targets. In XX-Cross,
each specified pair must be among the two solved pairs. If several choices tie,
one is returned; incidental additional solved pairs are not listed.

Bounds are inclusive and filter the **optimal** solution length. The solver
never pads a short solution to meet the minimum. Generation favors the least
represented requested lengths. Starting from a 25-turn random-move scramble,
it can append a prefix of an optimal solution to reach an easier case; the
remaining suffix is still provably optimal across all allowed colors and pairs.
This avoids waiting for rare easy scrambles to occur randomly. Final scramble
algorithms can therefore exceed 25 turns. Lengths above the seed's optimum
cannot be manufactured this way, so rare or unattainable high lengths may be
underrepresented rather than blocking the whole worksheet.

Rare or impossible filters stop after a bounded number of attempts or three
minutes, preserving completed rows.
An individual search has a 30-second budget; if it expires, the app reports an
error rather than returning an unproven result. Cancel terminates the worker
immediately. A subsequent batch reuses tables unless the worker was stopped.

## Exact search and performance

The original solver uses generated cubie move tables and iterative-deepening
search over all 18 face moves. Breadth-first pattern databases provide
admissible lower bounds: a complete four-edge cross, a three-edge/corner block,
and two complementary four-edge/corner projections of an X-Cross. XX-Cross
combines the cross and both projections for each pair. Maximum, not sum,
combines overlapping patterns. Searching every allowed target at each depth
proves global optimality within the selected constraints.

Consecutive turns of the same face are eliminated; commuting opposite faces
have one canonical ordering. Both reductions preserve a shortest solution.
Typed-array tables are built lazily in a Web Worker, use about 23 MiB of
persistent table buffers when all modes are initialized, and are reused across
scrambles. Cube nets are inline SVGs computed from the same physical state.

Tests compare moves and diagrams against an independent 54-facelet model,
check cube invariants and all 24 rotations, compare shallow optimal solutions
with independent exhaustive search, and exercise constraints, filtering,
timeouts, balanced length distributions, UI behavior, and cancellation.
Deterministic performance regressions
cover cold startup (15 seconds), a warm 20-row color-neutral X-Cross batch
(2 seconds), representative neutral XX-Cross searches (2 seconds), and a
10-row XX-Cross batch with two fixed diagonal pairs (5 seconds).
These are test budgets, not guarantees for every device or random scramble;
exact search has a variable, potentially expensive worst case.
