export function renderRetention(store) {
  const cohorts = store.selectors.retentionCohorts();
  const maxPeriods = Math.max(...cohorts.map(c => c.retention.length));

  const headerCells = Array.from({ length: maxPeriods }, (_, i) =>
    `<div class="retention-cell" style="font-size:10px;color:var(--text-muted)">M${i}</div>`
  ).join("");

  const rows = cohorts.map(c => {
    const cells = Array.from({ length: maxPeriods }, (_, i) => {
      const v = c.retention[i];
      if (v == null) return `<div class="retention-cell empty"></div>`;
      const cls = v >= 0.8 ? "high" : v >= 0.5 ? "mid" : "low";
      return `<div class="retention-cell ${cls}">${(v * 100).toFixed(0)}%</div>`;
    }).join("");
    return `<div class="retention-row"><span class="retention-label">${c.label} (${c.size})</span>${cells}</div>`;
  }).join("");

  document.getElementById("retention-grid").innerHTML = `
    <h3>Retention Cohort Grid</h3>
    <div style="margin-bottom:8px;font-size:11px;color:var(--text-dim)">Each row = monthly cohort; columns = months since signup. Cell = % retained.</div>
    <div class="retention-grid">
      <div class="retention-row"><span class="retention-label"></span>${headerCells}</div>
      ${rows}
    </div>
  `;
}
