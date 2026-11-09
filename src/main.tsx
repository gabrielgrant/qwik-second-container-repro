import { component$, render } from '@qwik.dev/core'

/**
 * Handlers are PLAIN FUNCTIONS spread at runtime (not `$(...)`-wrapped), the
 * form Qwik dispatches synchronously during native propagation — which is
 * what makes `event.stopPropagation()` / conditional `preventDefault()`
 * usable inside them. This mirrors how state-machine libraries (e.g. the
 * Zag.js Qwik adapter) attach their handlers via normalized prop spreads.
 */
let log: (entry: string) => void = () => {}

const parentProps = {
  'data-part': 'parent',
  onClick$: () => log('parent-handler'),
}
const childProps = {
  'data-part': 'child',
  onClick$: (event: Event) => {
    log('child-handler')
    event.stopPropagation()
  },
}

const Fixture = component$(() => (
  <div {...parentProps}>
    <button type="button" {...childProps}>
      click me
    </button>
  </div>
))

const EXPECTED = '["child-handler"]'

async function runContainer(n: number, app: Element) {
  const section = document.createElement('section')
  section.innerHTML = `<h2>Container ${n}</h2>`
  app.appendChild(section)

  const host = document.createElement('div')
  section.appendChild(host)

  await render(host, <Fixture />)

  const entries: string[] = []
  log = (entry) => entries.push(entry)

  const parent = host.querySelector('[data-part="parent"]') as HTMLElement
  const child = host.querySelector('[data-part="child"]') as HTMLElement
  // native listener: if the event escapes the child despite stopPropagation,
  // this fires during real DOM propagation
  parent.addEventListener('click', () => entries.push('parent-native-bubble'))

  child.click()
  // handlers on the broken path run asynchronously — give them time to land
  await new Promise((resolve) => setTimeout(resolve, 300))

  const got = JSON.stringify(entries)
  const ok = got === EXPECTED
  const result = document.createElement('p')
  result.className = ok ? 'pass' : 'fail'
  result.textContent = `${ok ? 'PASS' : 'FAIL'} — log: ${got}`
  section.appendChild(result)
  return ok
}

async function injectQwikLoader() {
  // Client-rendered Qwik pages need the qwikloader for event dispatch, same
  // as any SSR page would ship it. (vitest-browser-qwik does exactly this
  // before its first render().)
  const { getQwikLoaderScript } = await import('@qwik.dev/core/server')
  const script = document.createElement('script')
  script.innerHTML = getQwikLoaderScript()
  document.head.appendChild(script)
}

async function main() {
  await injectQwikLoader()
  const app = document.getElementById('app') as Element
  const first = await runContainer(1, app)
  const second = await runContainer(2, app)

  const summary = document.createElement('pre')
  summary.id = 'summary'
  summary.textContent = `container 1: ${first ? 'PASS' : 'FAIL'}\ncontainer 2: ${second ? 'PASS' : 'FAIL'}`
  app.appendChild(summary)
}

main()
