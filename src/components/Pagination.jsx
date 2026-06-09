import React from 'react'

export default function Pagination({ total, page, pageSize, onPage, onPageSize, noun = 'items' }) {
  const totalPages = Math.ceil(total / pageSize)
  if (total === 0) return null
  const from = page * pageSize + 1
  const to   = Math.min((page + 1) * pageSize, total)

  const maxButtons = 5
  let start = Math.max(0, page - Math.floor(maxButtons / 2))
  let end   = start + maxButtons
  if (end > totalPages) { end = totalPages; start = Math.max(0, end - maxButtons) }
  const pages = Array.from({ length: end - start }, (_, i) => start + i)

  const base    = { border: '1.5px solid #e2e8f0', borderRadius: 6, minWidth: 32, height: 32, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, background: '#fff', color: '#374151' }
  const dis     = { ...base, color: '#cbd5e1', cursor: 'default' }
  const act     = { ...base, background: '#e77204', color: '#fff', borderColor: '#e77204' }
  const sizeBtn = (n) => ({ ...base, background: pageSize === n ? '#e77204' : '#fff', color: pageSize === n ? '#fff' : '#374151', borderColor: pageSize === n ? '#e77204' : '#e2e8f0' })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
          {from}–{to} of {total} {noun}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginRight: 2 }}>Show</span>
          {[10, 25, 50].map(n => (
            <button key={n} onClick={() => { onPageSize(n); onPage(0) }} style={sizeBtn(n)}>{n}</button>
          ))}
        </div>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <button onClick={() => onPage(0)}              disabled={page === 0}             style={page === 0             ? dis : base} title="First">«</button>
          <button onClick={() => onPage(page - 1)}       disabled={page === 0}             style={page === 0             ? dis : base} title="Previous">‹</button>
          {pages.map(p => (
            <button key={p} onClick={() => onPage(p)} style={p === page ? act : base}>{p + 1}</button>
          ))}
          <button onClick={() => onPage(page + 1)}       disabled={page >= totalPages - 1} style={page >= totalPages - 1 ? dis : base} title="Next">›</button>
          <button onClick={() => onPage(totalPages - 1)} disabled={page >= totalPages - 1} style={page >= totalPages - 1 ? dis : base} title="Last">»</button>
        </div>
      )}
    </div>
  )
}
