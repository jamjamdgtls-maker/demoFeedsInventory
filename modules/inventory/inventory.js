/**
 * inventory.js — View all inventory batches with filtering
 */

DB.seedIfEmpty();

let filterProduct  = '';
let filterSupplier = '';
let filterStatus   = '';

const tbody         = document.getElementById('inv-tbody');
const emptyState    = document.getElementById('inv-empty');
const statsEl       = document.getElementById('inventory-stats');
const recordCountEl = document.getElementById('record-count');
const filterProdEl  = document.getElementById('filter-product');
const filterSupEl   = document.getElementById('filter-supplier');
const filterStatEl  = document.getElementById('filter-status');

function init() {
  populateFilters();
  renderStats();
  renderTable();

  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  filterProdEl.addEventListener('change', (e) => { filterProduct  = e.target.value; renderTable(); });
  filterSupEl.addEventListener('change',  (e) => { filterSupplier = e.target.value; renderTable(); });
  filterStatEl.addEventListener('change', (e) => { filterStatus   = e.target.value; renderTable(); });

  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    filterProduct = filterSupplier = filterStatus = '';
    filterProdEl.value = '';
    filterSupEl.value  = '';
    filterStatEl.value = '';
    renderTable();
  });
}

function populateFilters() {
  const products  = DB.getData('products');
  const suppliers = DB.getData('suppliers');

  products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    filterProdEl.appendChild(opt);
  });

  suppliers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    filterSupEl.appendChild(opt);
  });
}

function renderStats() {
  const inventory = DB.getData('inventory');
  const products  = DB.getData('products');

  const totalBatches   = inventory.length;
  const activeBatches  = inventory.filter(i => i.quantity > 0).length;
  const totalUnits     = inventory.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalValue     = inventory.reduce((s, i) => s + (i.quantity || 0) * (i.costPrice || 0), 0);

  const lowProducts = products.filter(p => {
    const s = Utils.getTotalStock(p.id);
    return s > 0 && s <= 10;
  }).length;

  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-card__label">Total Batches</div>
      <div class="stat-card__value">${totalBatches}</div>
      <div class="stat-card__sub">${activeBatches} active</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__label">Total Units</div>
      <div class="stat-card__value">${totalUnits}</div>
      <div class="stat-card__sub">Across all batches</div>
    </div>
    <div class="stat-card stat-card--amber">
      <div class="stat-card__label">Inventory Value</div>
      <div class="stat-card__value" style="font-size:1.3rem;">${Utils.formatCurrency(totalValue)}</div>
      <div class="stat-card__sub">At cost price</div>
    </div>
    <div class="stat-card stat-card--amber">
      <div class="stat-card__label">Low Stock Products</div>
      <div class="stat-card__value">${lowProducts}</div>
      <div class="stat-card__sub">≤ 10 units</div>
    </div>
  `;
}

function renderTable() {
  let inventory = DB.getData('inventory');

  // Apply filters
  if (filterProduct)  inventory = inventory.filter(i => i.productId  === filterProduct);
  if (filterSupplier) inventory = inventory.filter(i => i.supplierId === filterSupplier);
  if (filterStatus) {
    if (filterStatus === 'active')   inventory = inventory.filter(i => i.quantity > 10);
    if (filterStatus === 'low')      inventory = inventory.filter(i => i.quantity > 0 && i.quantity <= 10);
    if (filterStatus === 'depleted') inventory = inventory.filter(i => i.quantity === 0);
  }

  // Sort: newest first
  inventory.sort((a, b) => new Date(b.dateReceived) - new Date(a.dateReceived));

  recordCountEl.textContent = `${inventory.length} record${inventory.length !== 1 ? 's' : ''}`;
  tbody.innerHTML = '';

  if (inventory.length === 0) {
    emptyState.style.display = 'flex';
    document.querySelector('#inv-table thead').style.display = 'none';
    return;
  }
  emptyState.style.display = 'none';
  document.querySelector('#inv-table thead').style.display = '';

  inventory.forEach(batch => {
    const productName  = Utils.getProductName(batch.productId);
    const supplierName = Utils.getSupplierName(batch.supplierId);
    const batchValue   = (batch.quantity || 0) * (batch.costPrice || 0);

    const isDepleted = batch.quantity === 0;
    const isLow      = batch.quantity > 0 && batch.quantity <= 10;

    let statusBadge = `<span class="badge badge--green">In Stock</span>`;
    if (isDepleted) statusBadge = `<span class="badge badge--slate">Depleted</span>`;
    else if (isLow) statusBadge = `<span class="badge badge--amber">⚠ Low</span>`;

    const tr = document.createElement('tr');
    if (isLow)      tr.classList.add('inv-row--low');
    if (isDepleted) tr.classList.add('inv-row--depleted');

    tr.innerHTML = `
      <td class="text-small text-muted">${Utils.formatDate(batch.dateReceived)}</td>
      <td><strong>${Utils.escape(productName)}</strong></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:.9rem;">🏭</span>
          ${Utils.escape(supplierName)}
        </div>
      </td>
      <td>
        <strong style="font-size:1rem; color:${isDepleted ? 'var(--slate-400)' : isLow ? 'var(--amber-600)' : 'var(--green-700)'}">
          ${batch.quantity}
        </strong>
      </td>
      <td>${Utils.formatCurrency(batch.costPrice)}</td>
      <td>${isDepleted ? '<span class="text-muted">—</span>' : Utils.formatCurrency(batchValue)}</td>
      <td>${statusBadge}</td>
    `;

    tbody.appendChild(tr);
  });
}

init();
