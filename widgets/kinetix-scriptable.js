// Widget Kinetix per Scriptable (iPhone) — stile "Calendario" di Apple:
// giorno grande + energia a sinistra, giorni affiancati con box colorati a destra.
// Priorità a OGGI: mostra sempre tutti gli impegni di oggi, restringendo i box
// se sono tanti (fino a un massimo per non far esplodere il widget).

const WIDGET_URL = "INCOLLA_QUI_IL_TUO_LINK"
const MAX_UPCOMING_DAY_COLUMNS = 1
const MAX_EVENTS_PER_UPCOMING_DAY = 1
// Tetto massimo di box mostrati per colonna, a prescindere da quanti impegni
// ci sono davvero: un widget iPhone ha un'altezza FISSA, quindi oltre questo
// numero mostriamo "+N altri" invece di far traboccare il contenuto fuori dal
// riquadro arrotondato (esattamente il bug segnalato con giornate piene).
const MAX_VISIBLE_PER_COLUMN = 5

async function fetchData() {
  const req = new Request(WIDGET_URL)
  return await req.loadJSON()
}

// Più impegni ci sono in un giorno, più i box si restringono per farli entrare tutti.
function tierFor(count) {
  if (count <= 2) return { padV: 7, padH: 10, titleFont: 13, timeFont: 11, gap: 5, stacked: true }
  if (count <= 4) return { padV: 3, padH: 8, titleFont: 11, timeFont: 9.5, gap: 3, stacked: false }
  return { padV: 2, padH: 7, titleFont: 10, timeFont: 9, gap: 2, stacked: false }
}

function addEventBox(column, ev, tier) {
  const box = column.addStack()
  box.layoutHorizontally()
  box.centerAlignContent()
  box.backgroundColor = new Color(ev.colorHex, 0.18)
  box.cornerRadius = 8
  box.setPadding(tier.padV, 0, tier.padV, tier.padH)

  const bar = box.addStack()
  bar.size = new Size(3, tier.stacked ? 28 : 14)
  bar.backgroundColor = new Color(ev.colorHex)
  bar.cornerRadius = 1.5
  box.addSpacer(6)

  if (tier.stacked) {
    const textStack = box.addStack()
    textStack.layoutVertically()
    const title = textStack.addText(ev.title)
    title.font = Font.semiboldSystemFont(tier.titleFont)
    title.textColor = new Color(ev.colorHex)
    title.lineLimit = 1
    textStack.addSpacer(1)
    const time = textStack.addText(ev.timeLabel)
    time.font = Font.systemFont(tier.timeFont)
    time.textColor = new Color(ev.colorHex, 0.85)
  } else {
    const time = box.addText(ev.timeLabel.split('–')[0])
    time.font = Font.semiboldSystemFont(tier.timeFont)
    time.textColor = new Color(ev.colorHex)
    box.addSpacer(5)
    const title = box.addText(ev.title)
    title.font = Font.systemFont(tier.titleFont)
    title.textColor = new Color(ev.colorHex, 0.9)
    title.lineLimit = 1
  }
}

function addDayColumn(row, dateLabel, events) {
  const col = row.addStack()
  col.layoutVertically()

  const label = col.addText(dateLabel)
  label.font = Font.boldSystemFont(11)
  label.textColor = new Color("#a1a1aa")
  col.addSpacer(6)

  const visible = events.slice(0, MAX_VISIBLE_PER_COLUMN)
  const extra = events.length - visible.length
  const tier = tierFor(events.length)
  visible.forEach((ev, i) => {
    addEventBox(col, ev, tier)
    if (i < visible.length - 1) col.addSpacer(tier.gap)
  })
  if (extra > 0) {
    col.addSpacer(tier.gap)
    const more = col.addText(`+${extra} altri`)
    more.font = Font.systemFont(10)
    more.textColor = new Color("#71717a")
  }
}

async function createWidget() {
  const w = new ListWidget()
  w.backgroundColor = new Color("#111114")
  w.setPadding(16, 18, 16, 18)

  const row = w.addStack()
  row.layoutHorizontally()

  try {
    const data = await fetchData()
    const { energy, today, upcoming } = data

    const left = row.addStack()
    left.layoutVertically()
    left.size = new Size(78, 0)

    const weekday = left.addText(today.weekdayLabel)
    weekday.font = Font.boldSystemFont(13)
    weekday.textColor = new Color("#fb7185")

    const dayNum = left.addText(String(today.dayNumber))
    dayNum.font = Font.boldSystemFont(38)
    dayNum.textColor = Color.white()
    left.addSpacer(10)

    const pct = left.addText(`${energy.pct}%`)
    pct.font = Font.boldSystemFont(15)
    pct.textColor = new Color(energy.color)
    const energyCaption = left.addText("energia")
    energyCaption.font = Font.systemFont(10)
    energyCaption.textColor = new Color("#a1a1aa")

    if (today.events.length === 0) {
      left.addSpacer(10)
      const empty = left.addText("Nessun evento oggi")
      empty.font = Font.systemFont(11)
      empty.textColor = new Color("#71717a")
    }

    row.addSpacer(16)

    const dayColumns = []
    if (today.events.length > 0) {
      dayColumns.push({ dateLabel: 'OGGI', events: today.events })
    }
    for (const g of upcoming) {
      if (dayColumns.length >= 1 + MAX_UPCOMING_DAY_COLUMNS) break
      dayColumns.push({ dateLabel: g.dateLabel, events: g.events.slice(0, MAX_EVENTS_PER_UPCOMING_DAY) })
    }

    if (dayColumns.length === 0) {
      const allClear = row.addText("Nessun evento in programma")
      allClear.font = Font.systemFont(12)
      allClear.textColor = new Color("#71717a")
    } else {
      dayColumns.forEach((col, i) => {
        addDayColumn(row, col.dateLabel, col.events)
        if (i < dayColumns.length - 1) row.addSpacer(16)
      })
    }
  } catch {
    const errText = w.addText("Impossibile caricare Kinetix")
    errText.font = Font.systemFont(12)
    errText.textColor = new Color("#fb7185")
  }

  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)
  return w
}

const widget = await createWidget()
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentMedium()
}
Script.complete()
