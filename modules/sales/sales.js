/**
 * sales.js — Sales history with payment status & profit tracking
 * Changes: payment status display/filter, sack labels
 */

DB.seedIfEmpty();

const tbody         = document.getElementById('sales-tbody');
const emptyState    = document.getElementById('sales-empty');
const statsEl       = document.getElementById('sales-stats');
const saleCountEl   = document.getElementById('sale-count');
const dateFilterEl  = document.getElementById('date-filter');
const dailySummaryEl= document.getElementById('daily-summary');
const statusFilterEl= document.getElementById('status-filter');

function init() {
  dateFilterEl.value = Utils.todayISO();

  renderStats();
  renderDailySummary();
  renderTable();

  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  dateFilterEl.addEventListener('change', renderDailySummary);
  statusFilterEl.addEventListener('change', renderTable);

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', (e) => { if (e.target === el) closeModal(el.id); });
  });
}

function calcSaleProfit(sale) {
  let revenue = 0, cost = 0;
  sale.items.forEach(item => {
    revenue += (item.price     || 0) * item.quantity;
    cost    += (item.costPrice || 0) * item.quantity;
  });
  return { revenue, cost, profit: revenue - cost };
}

function paymentBadge(sale) {
  const status = sale.paymentStatus || 'paid';
  const labels = { paid: '✅ Paid', partial: '⚠️ Partial', unpaid: '❌ Unpaid' };
  return `<span class="badge badge--${status}">${labels[status] || status}</span>`;
}

// ── Stats ─────────────────────────────────────────────────────
function renderStats() {
  const sales   = DB.getData('sales');
  const today   = Utils.todayISO();
  const salesToday = sales.filter(s => s.date && s.date.startsWith(today));

  let totalRevenue = 0, totalProfit = 0, totalUnpaid = 0;
  sales.forEach(s => {
    const { revenue, profit } = calcSaleProfit(s);
    totalRevenue += revenue;
    totalProfit  += profit;
    if ((s.paymentStatus || 'paid') !== 'paid') totalUnpaid += (s.amountDue || 0);
  });

  let todayRevenue = 0;
  salesToday.forEach(s => { todayRevenue += calcSaleProfit(s).revenue; });

  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-card__label">Total Sales</div>
      <div class="stat-card__value">${sales.length}</div>
    </div>
    <div class="stat-card stat-card--amber">
      <div class="stat-card__label">Today's Sales</div>
      <div class="stat-card__value">${salesToday.length}</div>
      <div class="stat-card__sub">${Utils.formatCurrency(todayRevenue)} revenue</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__label">Total Revenue</div>
      <div class="stat-card__value" style="font-size:1.3rem;">${Utils.formatCurrency(totalRevenue)}</div>
    </div>
    <div class="stat-card stat-card--red">
      <div class="stat-card__label">Outstanding Balance</div>
      <div class="stat-card__value" style="font-size:1.3rem;color:var(--red-600)">
        ${Utils.formatCurrency(totalUnpaid)}
      </div>
      <div class="stat-card__sub">Unpaid &amp; partial sales</div>
    </div>
  `;
}

// ── Daily Summary ─────────────────────────────────────────────
function renderDailySummary() {
  const dateStr = dateFilterEl.value || Utils.todayISO();
  const sales   = DB.getData('sales').filter(s => s.date && s.date.startsWith(dateStr));

  let revenue = 0, cost = 0, sacksCount = 0;
  sales.forEach(s => {
    const p = calcSaleProfit(s);
    revenue    += p.revenue;
    cost       += p.cost;
    sacksCount += s.items.reduce((sum, i) => sum + i.quantity, 0);
  });
  const profit = revenue - cost;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

  if (sales.length === 0) {
    dailySummaryEl.innerHTML = `<p class="text-muted" style="font-size:.875rem;">No sales on ${Utils.formatDate(dateStr + 'T00:00:00')}.</p>`;
    return;
  }

  const unpaidCount   = sales.filter(s => (s.paymentStatus || 'paid') === 'unpaid').length;
  const partialCount  = sales.filter(s => (s.paymentStatus || 'paid') === 'partial').length;

  dailySummaryEl.innerHTML = `
    <div class="daily-grid">
      <div class="daily-stat">
        <div class="daily-stat__label">Transactions</div>
        <div class="daily-stat__value">${sales.length}</div>
      </div>
      <div class="daily-stat">
        <div class="daily-stat__label">Sacks Sold</div>
        <div class="daily-stat__value">${sacksCount}</div>
      </div>
      <div class="daily-stat daily-stat--amber">
        <div class="daily-stat__label">Revenue</div>
        <div class="daily-stat__value">${Utils.formatCurrency(revenue)}</div>
      </div>
      <div class="daily-stat">
        <div class="daily-stat__label">Cost</div>
        <div class="daily-stat__value">${Utils.formatCurrency(cost)}</div>
      </div>
      <div class="daily-stat daily-stat--green">
        <div class="daily-stat__label">Profit</div>
        <div class="daily-stat__value">${Utils.formatCurrency(profit)}</div>
      </div>
      <div class="daily-stat daily-stat--green">
        <div class="daily-stat__label">Margin</div>
        <div class="daily-stat__value">${margin}%</div>
      </div>
      ${unpaidCount + partialCount > 0 ? `
      <div class="daily-stat daily-stat--red" style="grid-column:1/-1;">
        <div class="daily-stat__label">Pending Payments</div>
        <div class="daily-stat__value" style="font-size:1rem;">
          ${partialCount > 0 ? `${partialCount} partial` : ''}
          ${partialCount > 0 && unpaidCount > 0 ? ' · ' : ''}
          ${unpaidCount > 0 ? `${unpaidCount} unpaid` : ''}
        </div>
      </div>` : ''}
    </div>
  `;
}

// ── Sales Table ───────────────────────────────────────────────
function renderTable() {
  const statusFilter = statusFilterEl.value;
  let sales = DB.getData('sales')
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (statusFilter) {
    sales = sales.filter(s => (s.paymentStatus || 'paid') === statusFilter);
  }

  saleCountEl.textContent = `${sales.length} transaction${sales.length !== 1 ? 's' : ''}`;
  tbody.innerHTML = '';

  if (sales.length === 0) {
    emptyState.style.display = 'flex';
    document.querySelector('#sales-table thead').style.display = 'none';
    return;
  }
  emptyState.style.display = 'none';
  document.querySelector('#sales-table thead').style.display = '';

  sales.forEach(sale => {
    const { revenue, cost, profit } = calcSaleProfit(sale);
    const margin      = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0';
    const totalSacks  = sale.items.reduce((s, i) => s + i.quantity, 0);
    const profitClass = profit > 0 ? 'profit-positive' : profit < 0 ? 'profit-negative' : 'profit-zero';
    const shortId     = sale.id.substring(0, 8).toUpperCase();
    const amountDue   = sale.amountDue || 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span style="font-family:var(--font-head);font-size:.8rem;font-weight:700;
          background:var(--green-100);color:var(--green-800);
          padding:2px 8px;border-radius:99px;">#${shortId}</span>
      </td>
      <td class="text-small">${Utils.formatDateTime(sale.date)}</td>
      <td>
        <span class="badge badge--slate">${sale.items.length} line${sale.items.length !== 1 ? 's' : ''}</span>
        <span class="text-muted text-small" style="margin-left:4px;">(${totalSacks} sacks)</span>
      </td>
      <td style="font-weight:600;">${Utils.formatCurrency(revenue)}</td>
      <td class="${profitClass}">${Utils.formatCurrency(profit)}</td>
      <td>${paymentBadge(sale)}</td>
      <td>${amountDue > 0 ? `<span style="color:var(--red-600);font-weight:600;">${Utils.formatCurrency(amountDue)}</span>` : '<span class="text-muted">—</span>'}</td>
      <td>
        <button class="btn btn--secondary btn--sm btn-view" data-id="${sale.id}">View</button>
      </td>
    `;
    tr.querySelector('.btn-view').addEventListener('click', () => openSaleDetail(sale.id));
    tbody.appendChild(tr);
  });
}

// ── Sale Detail Modal ─────────────────────────────────────────
function openSaleDetail(saleId) {
  const sale = DB.findById('sales', saleId);
  if (!sale) return;

  const { revenue, cost, profit } = calcSaleProfit(sale);
  const margin   = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0';
  const shortId  = sale.id.substring(0, 8).toUpperCase();
  const status   = sale.paymentStatus || 'paid';
  const amountDue      = sale.amountDue || 0;
  const amountTendered = sale.amountTendered || 0;
  const change         = sale.change || 0;

  document.getElementById('modal-sale-title').textContent = `Sale #${shortId}`;

  let itemsHtml = '';
  sale.items.forEach(item => {
    const productName  = Utils.getProductName(item.productId);
    const supplierName = Utils.getSupplierName(item.supplierId);
    const itemRevenue  = item.price * item.quantity;
    const itemCost     = (item.costPrice || 0) * item.quantity;
    const itemProfit   = itemRevenue - itemCost;

    itemsHtml += `
      <div class="sale-detail-item">
        <div class="sale-detail-item__name">${Utils.escape(productName)}</div>
        <div class="sale-detail-item__meta">Supplier: ${Utils.escape(supplierName)}</div>
        <div class="sale-detail-item__amounts">
          <span>Qty: <strong>${item.quantity} sack${item.quantity !== 1 ? 's' : ''}</strong></span>
          <span>Unit price: <strong>${Utils.formatCurrency(item.price)}</strong></span>
          <span>Cost/sack: <strong>${Utils.formatCurrency(item.costPrice || 0)}</strong></span>
          <span>Subtotal: <strong style="color:var(--green-700)">${Utils.formatCurrency(itemRevenue)}</strong></span>
          <span>Item profit: <strong style="color:${itemProfit >= 0 ? 'var(--green-600)' : 'var(--red-600)'}">${Utils.formatCurrency(itemProfit)}</strong></span>
        </div>
      </div>`;
  });

  const profitColor  = profit >= 0 ? 'var(--green-600)' : 'var(--red-600)';
  const statusLabels = { paid: '✅ Paid in Full', partial: '⚠️ Partial Payment', unpaid: '❌ Unpaid / Credit' };

  let paymentRows = '';
  if (status !== 'unpaid') {
    paymentRows += `<div class="payment-detail-row"><span class="text-muted">Cash Tendered</span><span>${Utils.formatCurrency(amountTendered)}</span></div>`;
  }
  if (change > 0) {
    paymentRows += `<div class="payment-detail-row"><span class="text-muted">Change Given</span><span style="color:var(--green-700)">${Utils.formatCurrency(change)}</span></div>`;
  }
  if (amountDue > 0) {
    paymentRows += `<div class="payment-detail-row"><span class="text-muted">Balance Due</span><span style="color:var(--red-600);font-weight:700;">${Utils.formatCurrency(amountDue)}</span></div>`;
  }

  document.getElementById('modal-sale-body').innerHTML = `
    <p class="text-muted text-small" style="margin-bottom:14px;">
      🕐 ${Utils.formatDateTime(sale.date)}
    </p>

    <div style="margin-bottom:16px;">${itemsHtml}</div>

    <div style="background:var(--bg);border-radius:var(--radius);padding:14px 16px;margin-bottom:12px;">
      <div class="sale-totals-row">
        <span class="text-muted">Total Revenue</span>
        <span style="font-weight:600;">${Utils.formatCurrency(revenue)}</span>
      </div>
      <div class="sale-totals-row">
        <span class="text-muted">Total Cost</span>
        <span>${Utils.formatCurrency(cost)}</span>
      </div>
      <div class="sale-totals-row sale-totals-row--total">
        <span>Net Profit</span>
        <span style="color:${profitColor}">${Utils.formatCurrency(profit)}</span>
      </div>
      <div class="sale-totals-row">
        <span class="text-muted">Profit Margin</span>
        <span style="color:${profitColor};font-weight:600;">${margin}%</span>
      </div>
    </div>

    <div class="payment-detail">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong style="font-size:.85rem;">Payment</strong>
        ${paymentBadge(sale)}
      </div>
      <div class="payment-detail-row">
        <span class="text-muted">Status</span>
        <span>${statusLabels[status] || status}</span>
      </div>
      ${paymentRows}
    </div>
  `;

  openModal('modal-sale');
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

init();
