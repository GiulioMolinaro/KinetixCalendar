// Widget Kinetix per Übersicht (macOS) — rettangolo largo e corto: data + energia
// a sinistra, giorni affiancati come colonne a destra. Priorità a OGGI: mostra
// SEMPRE tutti gli impegni di oggi, restringendo i box se sono tanti.
//
// COME INSTALLARLO:
// 1. Scarica e installa l'app gratuita "Übersicht" da http://tracesof.net (apri, sposta in Applications, avvia).
// 2. Vai su Impostazioni di Kinetix, copia il "Link dati per widget".
// 3. Sostituisci "INCOLLA_QUI_IL_TUO_LINK" qui sotto con quel link.
// 4. Copia l'intera cartella "kinetix-ubersicht" dentro
//    ~/Library/Application Support/Übersicht/widgets/
// 5. Il widget appare in alto a sinistra sulla scrivania e si aggiorna da solo ogni 5 minuti.
//
// Per spostarlo: cambia "top" / "left" qui sotto in className.

const WIDGET_URL = "INCOLLA_QUI_IL_TUO_LINK"
const MAX_UPCOMING_DAY_COLUMNS = 1
const MAX_EVENTS_PER_UPCOMING_DAY = 2

export const command = `curl -s "${WIDGET_URL}"`
export const refreshFrequency = 5 * 60 * 1000 // 5 minuti

export const className = `
  top: 40px;
  left: 40px;
  width: 540px;
  padding: 18px 20px;
  background: rgba(30, 30, 32, 0.88);
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 20px 40px rgba(0,0,0,0.35);
  color: #f4f4f5;
  font-family: -apple-system, "SF Pro Display", sans-serif;
  backdrop-filter: blur(24px);

  .card {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }
  .left {
    width: 82px;
    flex-shrink: 0;
  }
  .weekday {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #fb7185;
    margin-bottom: 2px;
  }
  .daynum {
    font-size: 34px;
    font-weight: 600;
    line-height: 1;
    margin-bottom: 10px;
  }
  .energy-pct {
    font-size: 14px;
    font-weight: 700;
  }
  .energy-caption {
    font-size: 9px;
    color: #a1a1aa;
  }
  .empty-today {
    font-size: 10px;
    color: #71717a;
    line-height: 1.35;
    margin-top: 8px;
  }
  .divider {
    width: 1px;
    align-self: stretch;
    background: rgba(255,255,255,0.08);
    flex-shrink: 0;
  }
  .days {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 18px;
  }
  .day-col {
    min-width: 0;
    flex: 1;
  }
  .day-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #a1a1aa;
    margin-bottom: 7px;
  }
  .event-title {
    font-weight: 700;
    color: #f0f0f2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .event-time {
    color: #93c5fd;
  }
  .all-clear {
    font-size: 11px;
    color: #71717a;
  }
`

// Più impegni ci sono in un giorno, più i box si restringono per farli entrare tutti.
function tierFor(count) {
  if (count <= 2) return { pad: '7px 10px', titleSize: '12px', timeSize: '10.5px', gap: '6px', stacked: true, radius: '8px' }
  if (count <= 4) return { pad: '5px 9px', titleSize: '11px', timeSize: '9.5px', gap: '4px', stacked: true, radius: '7px' }
  return { pad: '4px 8px', titleSize: '10.5px', timeSize: '9.5px', gap: '3px', stacked: false, radius: '6px' }
}

function EventBox({ ev, tier }) {
  const boxStyle = {
    padding: tier.pad,
    borderLeft: `3px solid ${ev.colorHex}`,
    borderRadius: tier.radius,
    background: 'rgba(255,255,255,0.045)',
    marginBottom: tier.gap,
    display: 'flex',
    alignItems: tier.stacked ? 'stretch' : 'baseline',
    flexDirection: tier.stacked ? 'column' : 'row',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  }
  if (tier.stacked) {
    return (
      <div style={boxStyle}>
        <div className="event-title" style={{ fontSize: tier.titleSize }}>{ev.title}</div>
        <div className="event-time" style={{ fontSize: tier.timeSize }}>{ev.timeLabel}</div>
      </div>
    )
  }
  return (
    <div style={boxStyle}>
      <span className="event-time" style={{ fontSize: tier.timeSize }}>{ev.timeLabel.split('–')[0]}</span>
      <span className="event-title" style={{ fontSize: tier.titleSize, marginLeft: 6 }}>{ev.title}</span>
    </div>
  )
}

export const render = ({ output }) => {
  if (!output) return <div className="weekday">KINETIX</div>

  let data
  try {
    data = JSON.parse(output)
  } catch {
    return <div className="weekday">Kinetix — errore link</div>
  }
  if (data.error) return <div className="weekday">Kinetix — link non valido</div>

  const { energy, today, upcoming } = data

  const dayColumns = []
  if (today.events.length > 0) {
    dayColumns.push({ dateLabel: 'OGGI', events: today.events, tier: tierFor(today.events.length) })
  }
  for (const g of upcoming) {
    if (dayColumns.length >= 1 + MAX_UPCOMING_DAY_COLUMNS) break
    const events = g.events.slice(0, MAX_EVENTS_PER_UPCOMING_DAY)
    dayColumns.push({ dateLabel: g.dateLabel, events, tier: tierFor(events.length) })
  }

  return (
    <div className="card">
      <div className="left">
        <div className="weekday">{today.weekdayLabel}</div>
        <div className="daynum">{today.dayNumber}</div>
        <div>
          <span className="energy-pct" style={{ color: energy.color }}>{energy.pct}%</span>
          <span className="energy-caption"> energia</span>
        </div>
        {today.events.length === 0 && <div className="empty-today">Nessun evento oggi</div>}
      </div>
      <div className="divider" />
      <div className="days">
        {dayColumns.length === 0 ? (
          <div className="all-clear">Nessun evento in programma</div>
        ) : (
          dayColumns.map((col, i) => (
            <div className="day-col" key={i}>
              <div className="day-label">{col.dateLabel}</div>
              {col.events.map((ev, j) => <EventBox ev={ev} tier={col.tier} key={j} />)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
