# Qwik 2.0.0-rc.4 regression: second client container loses synchronous event dispatch

The second (and every later) container created with `render()` from
`@qwik.dev/core` in one document no longer dispatches element handlers
synchronously during native event propagation. Handlers run **after** the
native event has finished propagating, so `event.stopPropagation()` inside a
child's handler can no longer prevent an ancestor's handler from running, and
conditional `preventDefault()` cannot work either.

The first container on the page behaves correctly; only later containers are
affected. `2.0.0-beta.36` is correct for **all** containers (verified by
changing only the `@qwik.dev/core` version in this repro).

## Run it

```bash
npm install
npm run dev
```

Open the page: it renders the same component into two containers, clicks the
child button once in each, and prints the captured handler log.

- **Expected (and what beta.36 gives for both):** `["child-handler"]`
- **Actual on rc.4, container 2:** `["parent-native-bubble", "child-handler", "parent-handler"]`
  — a native bubble listener on the parent fires *first* (the event escaped the
  child during real propagation), and then both handlers run from a deferred
  dispatch that ignores the `stopPropagation()` the child handler called.

## Details

- Handlers are plain functions spread at runtime (`<div {...props}>` where
  `props.onClick$` is a function, not a `$(...)` QRL) — the form Qwik
  dispatches synchronously, which is what makes imperative `stopPropagation` /
  conditional `preventDefault` usable. State-machine UI libraries (e.g. the
  Zag.js Qwik adapter, used by Ark UI) attach all their handlers this way.
- The qwikloader is injected once (as any SSR page would ship it, and as
  testing tools such as vitest-browser-qwik do). Without any qwikloader,
  plain-function handlers never dispatch at all in a pure-CSR page.
- Element wiring is identical in both containers (`_qDispatch` carries the
  same handler entry); only the dispatch path differs.
- First noticed as a tree-view defect in the Ark UI Qwik port's browser test
  suite (every test file's second `render()` ran with broken semantics): one
  trusted click on a tree branch toggled it twice, because zag's branch
  trigger relies on `stopPropagation()` to shield the branch-control handler.

## Where this bites

Any page with more than one Qwik client container: browser-mode component
tests (each test renders a fresh container into a shared page), and
micro-frontend / islands setups that call `render()` more than once.
