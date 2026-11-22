/* QuestRaider — effets de la landing : pépite 3D (WebGL, sans bibliothèque), titres animés,
   récit au défilement, compteurs. Tout est décoratif : la page reste lisible sans ce fichier. */
(() => {
  'use strict'

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const wide = window.matchMedia('(min-width: 1021px)')
  const root = document.documentElement
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector))
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
  const lerp = (from, to, t) => from + (to - from) * t
  const smooth = (t) => t * t * (3 - 2 * t)

  // ───────────── Titres : chaque mot monte derrière un cache ─────────────
  function splitTitles() {
    $$('[data-split]').forEach((title) => {
      let index = 0
      const walk = (node) => {
        Array.from(node.childNodes).forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            const fragment = document.createDocumentFragment()
            child.textContent.split(/(\s+)/).forEach((part) => {
              if (part === '') return
              if (/^\s+$/.test(part)) { fragment.append(' '); return }
              const mask = document.createElement('span')
              mask.className = 'mot'
              const word = document.createElement('span')
              word.textContent = part
              word.style.setProperty('--i', String(index))
              index += 1
              mask.append(word)
              fragment.append(mask)
            })
            child.replaceWith(fragment)
          } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
            walk(child)
          }
        })
      }
      walk(title)
    })
  }

  // ───────────── Compteurs ─────────────
  function countUp(element) {
    const target = Number(element.dataset.count)
    const format = (value) => Math.round(value).toLocaleString('fr-FR').replace(/[  ]/g, ' ')
    if (reducedMotion) { element.textContent = format(target); return }
    const startedAt = performance.now()
    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / 1400)
      element.textContent = format(target * (1 - Math.pow(1 - progress, 4)))
      if (progress < 1) window.requestAnimationFrame(step)
    }
    window.requestAnimationFrame(step)
  }

  // ───────────── Éléments qui s'animent en entrant dans l'écran ─────────────
  let waiting = []
  function watchEntries() {
    waiting = $$('[data-split], [data-count], [data-entree], [data-joue]')
  }
  function checkEntries() {
    if (waiting.length === 0) return
    const limit = window.innerHeight * 0.9
    waiting = waiting.filter((element) => {
      if (element.getBoundingClientRect().top > limit) return true
      element.classList.add('is-in')
      if (element.dataset.count !== undefined) countUp(element)
      // A demo marked "data-joue" plays once by itself when it comes on screen.
      if (element.dataset.joue !== undefined && !reducedMotion) {
        const button = element.querySelector('#api-go')
        if (button) window.setTimeout(() => button.click(), 700)
      }
      return false
    })
  }

  // ───────────── Récit : le panneau collant suit l'étape au centre de l'écran ─────────────
  const stories = []
  function setupStories() {
    $$('.story').forEach((story) => {
      stories.push({ story, steps: $$('.pas', story), demo: story.querySelector('.app'), active: 0 })
    })
  }
  function updateStories() {
    if (!wide.matches) return
    const center = window.innerHeight / 2
    stories.forEach((entry) => {
      let best = 0
      let bestDistance = Infinity
      entry.steps.forEach((step, index) => {
        const box = step.getBoundingClientRect()
        const distance = Math.abs(box.top + box.height / 2 - center)
        if (distance < bestDistance) { bestDistance = distance; best = index + 1 }
      })
      if (best === entry.active) return
      entry.active = best
      entry.steps.forEach((step, index) => step.classList.toggle('is-actif', index + 1 === best))
      if (entry.demo) entry.demo.dispatchEvent(new CustomEvent('qr:stage', { detail: best }))
    })
  }

  // ───────────── Boutons aimantés et halo qui suit le pointeur ─────────────
  function pointerEffects() {
    if (reducedMotion || !window.matchMedia('(hover: hover)').matches) return
    $$('[data-aimant]').forEach((button) => {
      button.addEventListener('pointermove', (event) => {
        const box = button.getBoundingClientRect()
        const x = (event.clientX - box.left - box.width / 2) * 0.22
        const y = (event.clientY - box.top - box.height / 2) * 0.32
        button.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      })
      button.addEventListener('pointerleave', () => { button.style.transform = '' })
    })
    // A soft light follows the pointer over the opening screen.
    $$('.vitrine').forEach((hero) => {
      hero.addEventListener('pointermove', (event) => {
        const box = hero.getBoundingClientRect()
        hero.style.setProperty('--px', event.clientX - box.left + 'px')
        hero.style.setProperty('--py', event.clientY - box.top + 'px')
        // The stacked panels of the opening screen turn slightly towards the pointer.
        hero.style.setProperty('--ry', (((event.clientX - box.left) / box.width - 0.5) * 14).toFixed(2) + 'deg')
        hero.style.setProperty('--rx', (((event.clientY - box.top) / box.height - 0.5) * -10).toFixed(2) + 'deg')
      })
    })
    // The app window leans slightly towards the pointer.
    $$('.story__colle .app').forEach((panel) => {
      const zone = panel.closest('.story__panneau')
      zone.addEventListener('pointermove', (event) => {
        const box = panel.getBoundingClientRect()
        const x = clamp((event.clientX - box.left) / box.width - 0.5, -0.6, 0.6)
        const y = clamp((event.clientY - box.top) / box.height - 0.5, -0.6, 0.6)
        panel.style.transform = `perspective(1100px) rotateY(${(x * 7).toFixed(2)}deg) rotateX(${(-y * 5).toFixed(2)}deg)`
      })
      zone.addEventListener('pointerleave', () => { panel.style.transform = '' })
    })
    $$('[data-halo]').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const box = card.getBoundingClientRect()
        card.style.setProperty('--mx', event.clientX - box.left + 'px')
        card.style.setProperty('--my', event.clientY - box.top + 'px')
      })
    })
  }

  // ───────────── Pépite 3D ─────────────
  // A low-poly nugget (displaced icosphere, flat shading) lit by a procedural studio environment.
  function buildNugget() {
    let seed = 7
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    const phi = (1 + Math.sqrt(5)) / 2
    let vertices = [[-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0], [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi], [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]]
    let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
    const unit = (v) => { const length = Math.hypot(v[0], v[1], v[2]); return [v[0] / length, v[1] / length, v[2] / length] }
    vertices = vertices.map(unit)
    // One subdivision: 80 facets.
    const cache = new Map()
    const middle = (a, b) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`
      if (!cache.has(key)) {
        vertices.push(unit([vertices[a][0] + vertices[b][0], vertices[a][1] + vertices[b][1], vertices[a][2] + vertices[b][2]]))
        cache.set(key, vertices.length - 1)
      }
      return cache.get(key)
    }
    faces = faces.flatMap(([a, b, c]) => {
      const ab = middle(a, b), bc = middle(b, c), ca = middle(c, a)
      return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]
    })
    // Irregular, slightly flattened: a nugget, not a ball.
    vertices = vertices.map((v) => {
      const k = 0.8 + random() * 0.42
      return [v[0] * k * 1.08, v[1] * k * 0.84, v[2] * k * 0.94]
    })
    const positions = []
    const normals = []
    faces.forEach(([a, b, c]) => {
      const A = vertices[a], B = vertices[b], C = vertices[c]
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
      const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]
      const normal = unit([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]])
      ;[A, B, C].forEach((vertex) => { positions.push(...vertex); normals.push(...normal) })
    })
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), count: positions.length / 3 }
  }

  const VERTEX = `
    attribute vec3 aPosition; attribute vec3 aNormal;
    uniform mat4 uModel; uniform mat4 uProjection;
    varying vec3 vNormal; varying vec3 vView;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vNormal = mat3(uModel) * aNormal;
      vView = world.xyz;
      gl_Position = uProjection * world;
    }`
  const FRAGMENT = `
    precision mediump float;
    varying vec3 vNormal; varying vec3 vView;
    uniform float uAlpha;
    vec3 environment(vec3 r) {
      float height = r.y * 0.5 + 0.5;
      vec3 color = mix(vec3(0.20, 0.13, 0.05), vec3(1.0, 0.84, 0.52), smoothstep(0.25, 0.9, height));
      color += vec3(1.0, 0.96, 0.86) * pow(max(dot(r, normalize(vec3(0.45, 0.75, 0.55))), 0.0), 28.0) * 1.7;
      color += vec3(0.30, 0.46, 0.66) * pow(max(dot(r, normalize(vec3(-0.85, -0.05, 0.45))), 0.0), 5.0) * 0.4;
      return color;
    }
    void main() {
      vec3 n = normalize(vNormal);
      vec3 v = normalize(-vView);
      vec3 gold = vec3(0.90, 0.70, 0.30);
      float fresnel = pow(1.0 - max(dot(n, v), 0.0), 4.0);
      float diffuse = max(dot(n, normalize(vec3(0.35, 0.75, 0.55))), 0.0);
      vec3 base = gold * (0.26 + 0.95 * diffuse);
      vec3 mirror = environment(reflect(-v, n)) * gold * 1.3;
      vec3 color = mix(base, mirror, 0.5) + vec3(1.0, 0.9, 0.7) * fresnel * 0.22;
      gl_FragColor = vec4(color * uAlpha, uAlpha);
    }`

  function nuggetScene() {
    const canvas = document.querySelector('.pepite3d')
    const frames = $$('[data-n]')
    if (!canvas || frames.length === 0) return null
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true })
    if (!gl) { canvas.hidden = true; return null }

    const compile = (type, source) => {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      return shader
    }
    const program = gl.createProgram()
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { canvas.hidden = true; return null }
    gl.useProgram(program)

    const mesh = buildNugget()
    const bind = (name, data) => {
      const location = gl.getAttribLocation(program, name)
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0)
    }
    bind('aPosition', mesh.positions)
    bind('aNormal', mesh.normals)
    const uModel = gl.getUniformLocation(program, 'uModel')
    const uProjection = gl.getUniformLocation(program, 'uProjection')
    const uAlpha = gl.getUniformLocation(program, 'uAlpha')
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)

    const FOV = 0.6
    const DISTANCE = 7
    const halfHeight = Math.tan(FOV / 2) * DISTANCE
    let aspect = 1
    const model = new Float32Array(16)
    function setModel(x, y, z, rx, ry, rz, scale) {
      const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz)
      model[0] = cz * cy * scale; model[1] = sz * cy * scale; model[2] = -sy * scale; model[3] = 0
      model[4] = (cz * sy * sx - sz * cx) * scale; model[5] = (sz * sy * sx + cz * cx) * scale; model[6] = cy * sx * scale; model[7] = 0
      model[8] = (cz * sy * cx + sz * sx) * scale; model[9] = (sz * sy * cx - cz * sx) * scale; model[10] = cy * cx * scale; model[11] = 0
      model[12] = x; model[13] = y; model[14] = z - DISTANCE; model[15] = 1
      gl.uniformMatrix4fv(uModel, false, model)
    }
    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.round(window.innerWidth * ratio)
      const height = Math.round(window.innerHeight * ratio)
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      gl.viewport(0, 0, width, height)
      aspect = width / height
      const f = 1 / Math.tan(FOV / 2)
      const near = 0.1, far = 50
      gl.uniformMatrix4fv(uProjection, false, new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0]))
    }

    // Each section gives the nugget a place on screen: "x y scale alpha" (x, y from -1 to 1, y downwards).
    const read = (element) => {
      const raw = (!wide.matches && element.dataset.nm) || element.dataset.n
      const [x, y, scale, alpha] = raw.split(/\s+/).map(Number)
      return { x, y, scale, alpha: alpha ?? 1 }
    }
    function target() {
      const center = window.innerHeight / 2
      // The last sections cannot reach the middle of the screen: their place is brought back within reach.
      const reachable = center + document.documentElement.scrollHeight - window.innerHeight - window.scrollY
      const points = frames.map((element) => {
        const box = element.getBoundingClientRect()
        return { at: Math.min(box.top + box.height / 2, reachable), value: read(element) }
      })
      if (center <= points[0].at) return points[0].value
      for (let index = 0; index < points.length - 1; index += 1) {
        const a = points[index], b = points[index + 1]
        if (center <= b.at) {
          const t = smooth(clamp((center - a.at) / (b.at - a.at), 0, 1))
          return { x: lerp(a.value.x, b.value.x, t), y: lerp(a.value.y, b.value.y, t), scale: lerp(a.value.scale, b.value.scale, t), alpha: lerp(a.value.alpha, b.value.alpha, t) }
        }
      }
      return points[points.length - 1].value
    }

    const satellites = Array.from({ length: 9 }, (_unused, index) => ({
      radius: 1.7 + (index % 3) * 0.55 + index * 0.04,
      speed: (0.16 + index * 0.027) * (index % 2 ? 1 : -1),
      phase: index * 0.7,
      tilt: 0.3 + index * 0.21,
      size: 0.07 + (index % 4) * 0.035
    }))
    const state = { ...target(), spin: 0, intro: reducedMotion ? 1 : 0 }
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    window.addEventListener('pointermove', (event) => {
      pointer.tx = (event.clientX / window.innerWidth) * 2 - 1
      pointer.ty = (event.clientY / window.innerHeight) * 2 - 1
    }, { passive: true })
    window.addEventListener('resize', resize)
    resize()

    return function draw(time, scrollSpeed) {
      const goal = target()
      const ease = reducedMotion ? 1 : 0.07
      state.x = lerp(state.x, goal.x, ease)
      state.y = lerp(state.y, goal.y, ease)
      state.scale = lerp(state.scale, goal.scale, ease)
      state.alpha = lerp(state.alpha, goal.alpha, ease)
      state.intro = lerp(state.intro, 1, 0.07)
      pointer.x = lerp(pointer.x, pointer.tx, 0.05)
      pointer.y = lerp(pointer.y, pointer.ty, 0.05)
      if (!reducedMotion) state.spin += 0.0035 + Math.min(Math.abs(scrollSpeed), 60) * 0.0009

      const seconds = reducedMotion ? 0 : time / 1000
      const x = state.x * halfHeight * aspect + pointer.x * 0.12
      const y = -state.y * halfHeight - pointer.y * 0.1 + Math.sin(seconds * 0.7) * 0.06
      const scale = state.scale * (0.55 + 0.45 * state.intro)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      if (state.alpha < 0.01) return
      gl.uniform1f(uAlpha, state.alpha * state.intro)
      setModel(x, y, 0, 0.42 + pointer.y * 0.35 + Math.sin(seconds * 0.4) * 0.08, state.spin + pointer.x * 0.5, 0.18, scale)
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count)
      satellites.forEach((satellite) => {
        const angle = satellite.phase + seconds * satellite.speed + state.spin * 0.6
        const radius = satellite.radius * scale
        gl.uniform1f(uAlpha, state.alpha * state.intro * 0.92)
        setModel(
          x + Math.cos(angle) * radius,
          y + Math.sin(angle) * radius * Math.sin(satellite.tilt) * 0.7,
          Math.sin(angle) * radius * Math.cos(satellite.tilt),
          angle * 1.7, angle * 1.1 + satellite.phase, satellite.phase,
          satellite.size * scale * 1.6
        )
        gl.drawArrays(gl.TRIANGLES, 0, mesh.count)
      })
    }
  }

  // ───────────── Boucle ─────────────
  splitTitles()
  setupStories()
  watchEntries()
  pointerEffects()
  const draw = nuggetScene()
  let lastScroll = window.scrollY
  function frame(time) {
    const scroll = window.scrollY
    const speed = scroll - lastScroll
    lastScroll = scroll
    const max = document.documentElement.scrollHeight - window.innerHeight
    root.style.setProperty('--progression', max > 0 ? (scroll / max).toFixed(4) : '0')
    checkEntries()
    updateStories()
    if (draw && !document.hidden) draw(time, speed)
    window.requestAnimationFrame(frame)
  }
  root.classList.add('fx')
  // The intro waits for the fonts so the big title never flashes in a fallback face.
  const ready = () => root.classList.add('pret')
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ready)
  window.setTimeout(ready, 1200)
  window.requestAnimationFrame(frame)
})()
