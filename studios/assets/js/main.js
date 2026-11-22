/* QuestRaider — landing page : les trois aperçus interactifs. Tout est simulé, rien n'est envoyé. */
(() => {
  'use strict'

  const $ = (selector, root = document) => root.querySelector(selector)
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector))
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // The narrow no-break space of fr-FR has no glyph in Barlow: a plain no-break space is used instead.
  const plainSpaces = (text) => text.replace(/[  ]/g, ' ')
  const formatNumber = (value) => plainSpaces(value.toLocaleString('fr-FR'))
  const formatEuros = (cents) =>
    plainSpaces((cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €'
  /** 1 000 pépites = 1 €, so 10 pépites = 1 centime. */
  const nuggetsToCents = (nuggets) => Math.round(nuggets / 10)

  // ───────────── Aperçu 1 : l'appli côté joueur ─────────────
  function playerDemo() {
    const app = $('#demo-joueur')
    if (!app) return
    const START = 22300
    const THRESHOLD = 25000
    const SCALE = 40000
    const list = $('#quetes')
    const balanceBox = $('#solde')
    const nuggetsEl = $('#solde-pepites')
    const eurosEl = $('#solde-euros')
    const gauge = $('.seuil', app)
    const gaugeFill = $('#seuil-fill')
    const gaugeText = $('#seuil-txt')
    const message = $('#demo-msg')
    const resetButton = $('#demo-reset')
    let balance = START
    let shown = START
    let frame = 0
    const timers = new Set()

    const later = (callback, delay) => {
      const id = window.setTimeout(() => { timers.delete(id); callback() }, delay)
      timers.add(id)
    }

    function paintBalance(value) {
      nuggetsEl.textContent = formatNumber(value)
      eurosEl.textContent = `(${formatEuros(nuggetsToCents(value))})`
    }

    function paintGauge() {
      gaugeFill.style.width = Math.min(100, (balance / SCALE) * 100) + '%'
      const reached = balance >= THRESHOLD
      gauge.classList.toggle('is-ok', reached)
      gaugeText.textContent = reached
        ? 'Retrait possible : tu as dépassé 25 €'
        : `Encore ${formatEuros(nuggetsToCents(THRESHOLD - balance))} avant de pouvoir retirer`
    }

    function countUp(target) {
      window.cancelAnimationFrame(frame)
      if (reducedMotion) { shown = target; paintBalance(target); return }
      const from = shown
      const startedAt = performance.now()
      const step = (now) => {
        const progress = Math.min(1, (now - startedAt) / 900)
        shown = Math.round(from + (target - from) * (1 - Math.pow(1 - progress, 3)))
        paintBalance(shown)
        if (progress < 1) frame = window.requestAnimationFrame(step)
      }
      frame = window.requestAnimationFrame(step)
    }

    function burst(card) {
      if (reducedMotion) return
      const frameBox = app.getBoundingClientRect()
      const from = card.getBoundingClientRect()
      const to = balanceBox.getBoundingClientRect()
      const startX = from.left - frameBox.left + 40
      const startY = from.top - frameBox.top + from.height / 2
      for (let index = 0; index < 9; index += 1) {
        const coin = document.createElement('span')
        coin.className = 'jeton'
        coin.style.left = startX + (Math.random() * 60 - 10) + 'px'
        coin.style.top = startY + (Math.random() * 24 - 12) + 'px'
        coin.style.setProperty('--dx', to.left - from.left - 20 + to.width / 2 - Math.random() * 40 + 'px')
        coin.style.setProperty('--dy', to.top - from.top - from.height / 2 + 6 + 'px')
        coin.style.setProperty('--d', index * 0.05 + 's')
        coin.addEventListener('animationend', () => coin.remove())
        app.appendChild(coin)
      }
    }

    function remaining(card) {
      const left = Math.max(0, Number(card.dataset.fin) - Date.now())
      const total = Math.floor(left / 1000)
      const pad = (value) => String(value).padStart(2, '0')
      return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
    }

    function take(card) {
      const hours = parseInt($('.quete__delai', card).textContent, 10)
      card.dataset.etat = 'encours'
      card.dataset.fin = String(Date.now() + hours * 3600 * 1000)
      $('.quete__etat', card).textContent = `En cours · ${remaining(card)}`
      $('.quete__btn', card).textContent = 'Valider la quête'
      message.textContent = 'Quête prise. Dans la vraie appli, tu vas jouer ; ici, valide tout de suite.'
    }

    function validate(card) {
      const button = $('.quete__btn', card)
      card.dataset.etat = 'verif'
      $('.quete__etat', card).textContent = 'Vérification…'
      button.textContent = 'Vérification…'
      $$('.quete__btn', list).forEach((other) => { other.disabled = true })
      list.classList.add('is-busy')
      message.textContent = 'QuestRaider demande au serveur du jeu si la quête est réussie…'
      later(() => succeed(card), reducedMotion ? 300 : 1500)
    }

    function succeed(card) {
      {
        const gain = Number(card.dataset.pepites)
        card.dataset.etat = 'reussie'
        $('.quete__etat', card).textContent = '✓ Réussie'
        $('.quete__btn', card).hidden = true
        list.classList.remove('is-busy')
        $$('.quete__btn', list).forEach((other) => { other.disabled = false })
        balance += gain
        countUp(balance)
        paintGauge()
        burst(card)
        balanceBox.classList.add('is-up')
        later(() => balanceBox.classList.remove('is-up'), 1200)
        const allDone = $$('.quete', list).every((quest) => quest.dataset.etat === 'reussie')
        message.textContent = allDone
          ? `Tout est validé : ${formatNumber(balance)} pépites, prêtes à être retirées.`
          : `Le studio a confirmé : +${formatNumber(gain)} pépites sur ton solde.`
        resetButton.hidden = false
      }
    }

    // Scroll-driven story: each step of the page puts the demo in the matching state.
    app.addEventListener('qr:stage', (event) => {
      const step = event.detail
      reset()
      const card = $('.quete', list)
      if (step === 1) {
        card.classList.add('is-cible')
        message.textContent = 'Le catalogue : une quête, une récompense, un délai.'
        return
      }
      take(card)
      if (step === 2) { message.textContent = 'Quête prise : le compte à rebours tourne, à toi de jouer.'; return }
      const button = $('.quete__btn', card)
      card.dataset.etat = 'verif'
      $('.quete__etat', card).textContent = 'Vérification…'
      button.textContent = 'Vérification…'
      message.textContent = 'QuestRaider demande au serveur du jeu si la quête est réussie…'
      if (step === 3) { button.disabled = true; return }
      succeed(card)
    })

    function reset() {
      timers.forEach((id) => window.clearTimeout(id))
      timers.clear()
      window.cancelAnimationFrame(frame)
      balance = START
      shown = START
      paintBalance(START)
      paintGauge()
      list.classList.remove('is-busy')
      $$('.quete', list).forEach((card) => {
        card.dataset.etat = 'libre'
        card.classList.remove('is-cible')
        delete card.dataset.fin
        $('.quete__etat', card).textContent = ''
        const button = $('.quete__btn', card)
        button.hidden = false
        button.disabled = false
        button.textContent = 'Je prends la quête'
      })
      message.textContent = 'Choisis une quête pour commencer.'
      resetButton.hidden = true
    }

    list.addEventListener('click', (event) => {
      const button = event.target.closest('.quete__btn')
      if (!button || button.disabled) return
      const card = button.closest('.quete')
      if (card.dataset.etat === 'libre') take(card)
      else if (card.dataset.etat === 'encours') validate(card)
    })
    resetButton.addEventListener('click', reset)
    window.setInterval(() => {
      $$('.quete[data-etat="encours"]', list).forEach((card) => {
        $('.quete__etat', card).textContent = `En cours · ${remaining(card)}`
      })
    }, 1000)
    paintGauge()
  }

  // ───────────── Aperçu 2 : l'appel au serveur du jeu ─────────────
  function apiDemo() {
    const flow = $('#demo-api')
    if (!flow) return
    const OUTCOMES = {
      ok: {
        response: '200 OK\n\n{ "ok": true }',
        verdict: 'Quête validée : les pépites sont créditées au joueur tout de suite.'
      },
      non: {
        response: '200 OK\n\n{ "ok": false }',
        verdict: '« Pas encore réussie » : le joueur garde sa place et peut réessayer 5 minutes plus tard.'
      },
      muet: {
        response: '— aucune réponse après 5 secondes —',
        verdict: '« Le studio ne répond pas » : la quête reste en cours, nouvel essai possible 30 secondes plus tard.'
      }
    }
    const chips = $$('.chip', flow)
    const responseEl = $('#api-rep')
    const verdictEl = $('#api-verdict')
    const goButton = $('#api-go')
    let run = 0

    function clear() {
      run += 1
      delete flow.dataset.phase
      responseEl.textContent = "— en attente de l'appel —"
      responseEl.className = 'attente'
      verdictEl.textContent = ''
      delete verdictEl.dataset.t
      goButton.disabled = false
      goButton.textContent = "Lancer l'appel"
    }

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((other) => other.setAttribute('aria-pressed', String(other === chip)))
        flow.dataset.cas = chip.dataset.cas
        clear()
      })
    })

    goButton.addEventListener('click', () => {
      clear()
      const current = run
      const scenario = flow.dataset.cas
      const stepDelay = reducedMotion ? 150 : 700
      goButton.disabled = true
      goButton.textContent = 'Appel en cours…'
      responseEl.textContent = '… appel en cours'
      const phases = ['p1', 'p2', 'p3']
      phases.forEach((phase, index) => {
        window.setTimeout(() => { if (current === run) flow.dataset.phase = phase }, index * stepDelay)
      })
      const wait = phases.length * stepDelay + (scenario === 'muet' && !reducedMotion ? 900 : 0)
      window.setTimeout(() => {
        if (current !== run) return
        delete flow.dataset.phase
        responseEl.textContent = OUTCOMES[scenario].response
        responseEl.className = ''
        verdictEl.textContent = OUTCOMES[scenario].verdict
        verdictEl.dataset.t = scenario
        goButton.disabled = false
        goButton.textContent = "Relancer l'appel"
      }, wait)
    })
  }

  // ───────────── Aperçu 3 : le simulateur de quête pour les studios ─────────────
  function studioDemo() {
    const root = $('#demo-studio')
    if (!root) return
    const nameInput = $('#q-nom')
    const rewardInput = $('#q-rec')
    const slotsInput = $('#q-places')

    function update() {
      const rewardCents = Math.round(Number(rewardInput.value) * 100)
      const slots = Number(slotsInput.value)
      const hours = $('input[name="q-delai"]:checked', root).value
      const rewardsTotal = rewardCents * slots

      $('#q-rec-out').textContent = formatEuros(rewardCents)
      $('#q-places-out').textContent = formatNumber(slots)
      $('#ap-nom').textContent = nameInput.value.trim() || 'Votre objectif'
      $('#ap-pepites').textContent = formatNumber(rewardCents * 10)
      $('#ap-euros').textContent = `(${formatEuros(rewardCents)})`
      $('#ap-delai').textContent = `${hours} h`
      $('#ap-places').textContent = `${formatNumber(slots)} places`
      $('#b-unite').textContent = formatEuros(rewardCents)
      $('#b-places').textContent = formatNumber(slots)
      $('#b-rec').textContent = formatEuros(rewardsTotal)
    }

    root.addEventListener('input', update)
    root.addEventListener('change', update)
    $('form', root).addEventListener('submit', (event) => event.preventDefault())
    update()
  }

  // ───────────── Aperçu studio : le suivi d'une quête, en direct ─────────────
  function followDemo() {
    const root = $('#demo-suivi')
    if (!root) return
    const SLOTS = 100
    const REWARD_CENTS = 500
    const START = { taken: 38, done: 21 }
    const PLAYERS = ['Lynx_Bleu', 'Mara_K', 'Orso77', 'Nox_Vega', 'Tibou', 'Kestrel9', 'Pixelle', 'Aldric_M', 'Sova', 'Juno_42']
    const feed = $('#suivi-fil')
    const pauseButton = $('#suivi-pause')
    let taken = START.taken
    let done = START.done
    let paused = false

    function paint() {
      $('#suivi-prises').textContent = formatNumber(taken)
      $('#suivi-reussies').textContent = formatNumber(done)
      $('#suivi-verse').textContent = formatEuros(done * REWARD_CENTS)
      $('#suivi-fill-prises').style.width = (taken / SLOTS) * 100 + '%'
      $('#suivi-fill-reussies').style.width = (done / SLOTS) * 100 + '%'
    }

    function push(kind, player) {
      $$('time', feed).forEach((time, index) => { time.textContent = `il y a ${(index + 1) * 2} min` })
      const item = document.createElement('li')
      item.dataset.t = kind
      const label = document.createElement('span')
      label.textContent = `${player} a ${kind === 'ok' ? 'réussi' : 'pris'} la quête`
      const time = document.createElement('time')
      time.textContent = "à l'instant"
      item.append(label, time)
      feed.prepend(item)
      while (feed.children.length > 3) feed.lastElementChild.remove()
    }

    function tick() {
      if (paused || document.hidden) return
      if (taken >= SLOTS) { taken = START.taken; done = START.done }
      const player = PLAYERS[Math.floor(Math.random() * PLAYERS.length)]
      // A quest can only be completed by someone who took it first.
      if (done < taken - 5 && Math.random() < 0.5) { done += 1; push('ok', player) }
      else { taken += 1; push('prise', player) }
      paint()
    }

    pauseButton.addEventListener('click', () => {
      paused = !paused
      pauseButton.setAttribute('aria-pressed', String(paused))
      pauseButton.textContent = paused ? 'Reprendre' : 'Mettre en pause'
    })
    // Scroll-driven story: the page tells the panel which part to put forward.
    root.addEventListener('qr:stage', (event) => { root.dataset.stage = String(event.detail) })
    paint()
    if (!reducedMotion) window.setInterval(tick, 2400)
  }

  // ───────────── Apparition des sections au défilement ─────────────
  function reveal() {
    if (reducedMotion) return
    document.documentElement.classList.add('js')
    let pending = $$('.bloc h2:not([data-split]), .bloc .chapo, .etapes li, .flux, .calc, .parcours li, .regles li, .faq, .faits')
    pending.forEach((target) => target.classList.add('rev'))
    // Plain scroll check (no observer): content can never stay hidden once it is on screen.
    const check = () => {
      const limit = window.innerHeight * 0.94
      pending = pending.filter((target) => {
        if (target.getBoundingClientRect().top > limit) return true
        target.classList.add('is-in')
        return false
      })
      if (pending.length === 0) {
        window.removeEventListener('scroll', check)
        window.removeEventListener('resize', check)
      }
    }
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    check()
  }

  playerDemo()
  apiDemo()
  studioDemo()
  followDemo()
  reveal()
})()
