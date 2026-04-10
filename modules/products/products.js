/**
 * products.js — Products CRUD module
 * Changes: per-sack labels, price history logging & viewing
 */

DB.seedIfEmpty();

let searchQuery = '';

const tbody       = document.getElementById('product-tbody');
const emptyState  = document.getElementById('product-empty');
const statsEl     = document.getElementById('product-stats');
const searchInput = document.getElementById('search-input');
const modal       = document.getElementById('modal-product');
const modalTitle  = document.getElementById('modal-title');
const fieldId     = document.getElementById('edit-id');
const fieldName   = document.getElementById('field-name');
const fieldPrice  = document.getElementById('field-price');
const btnSave     = document.getElementById('btn-save-product');

function init() {
  renderStats();
  renderTable();

  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('btn-add-product').addEventListener('click', openAddModal);
  btnSave.addEventListener('click', saveProduct);
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderTable();
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', (e) => { if (e.target === el) closeModal(el.id); });
  });
}

function renderStats() {
  const products  = DB.getData('products');
  const inventory = DB.getData('inventory');

  const totalSacks = inventory.reduce((s, i) => s + (i.quantity || 0), 0);
  const lowStock   = products.filter(p => {
    const s = Utils.getTotalStock(p.id);
    return s > 0 && s <= 10;
  }).length;
  const outOfStock = products.filter(p => Utils.getTotalStock(p.id) === 0).length;

  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-card__label">Total Products</div>
      <div class="stat-card__value">${products.length}</div>
    </div>
    <div class="stat-card stat-card--amber">
      <div class="stat-card__label">Low Stock</div>
      <div class="stat-card__value">${lowStock}</div>
      <div class="stat-card__sub">≤ 10 sacks remaining</div>
    </div>
    <div class="stat-card stat-card--red">
      <div class="stat-card__label">Out of Stock</div>
      <div class="stat-card__value">${outOfStock}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__label">Total Sacks</div>
      <div class="stat-card__value">${totalSacks}</div>
      <div class="stat-card__sub">Across all products</div>
    </div>
  `;
}

function renderTable() {
  let products = DB.getData('products');
  const inventory = DB.getData('inventory');
  const suppliers  = DB.getData('suppliers');

  if (searchQuery) {
    products = products.filter(p => p.name.toLowerCase().includes(searchQuery));
  }

  tbody.innerHTML = '';

  if (products.length === 0) {
    emptyState.style.display = 'flex';
    document.querySelector('#product-table thead').style.display = 'none';
    return;
  }
  emptyState.style.display = 'none';
  document.querySelector('#product-table thead').style.display = '';

  products.forEach((p, i) => {
    const totalSacks = Utils.getTotalStock(p.id);
    const isLow = totalSacks > 0 && totalSacks <= 10;
    const isOut = totalSacks === 0;

    const supplierIds = [...new Set(
      inventory.filter(inv => inv.productId === p.id).map(inv => inv.supplierId)
    )];
    const supplierChips = supplierIds.map(sid => {
      const sup = DB.findById('suppliers', sid);
      return sup ? `<span class="supplier-chip">${Utils.escape(sup.name)}</span>` : '';
    }).join('');

    let stockBadge = `<span class="badge badge--green">✓ ${totalSacks} sacks</span>`;
    if (isOut) stockBadge = `<span class="badge badge--red">Out of stock</span>`;
    else if (isLow) stockBadge = `<span class="badge badge--amber">⚠ ${totalSacks} sacks low</span>`;

    // Check if price history exists
    const historyCount = DB.getData('price_history').filter(h => h.productId === p.id).length;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-muted">${i + 1}</td>
      <td><strong>${Utils.escape(p.name)}</strong></td>
      <td>${Utils.formatCurrency(p.price)}<span class="text-muted text-small"> /sack</span></td>
      <td>${stockBadge}</td>
      <td>
        <div class="supplier-chips">
          ${supplierChips || '<span class="text-muted text-small">—</span>'}
        </div>
      </td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn--secondary btn--sm btn-edit" data-id="${p.id}">✏️ Edit</button>
          <button class="btn btn--ghost btn--sm btn-history" data-id="${p.id}" title="Price History">
            📈 ${historyCount > 0 ? historyCount : ''}
          </button>
          <button class="btn btn--danger btn--sm btn-delete" data-id="${p.id}">🗑</button>
        </div>
      </td>
    `;

    tr.querySelector('.btn-edit').addEventListener('click', () => openEditModal(p.id));
    tr.querySelector('.btn-history').addEventListener('click', () => openPriceHistory(p.id));
    tr.querySelector('.btn-delete').addEventListener('click', () => deleteProduct(p.id));
    tbody.appendChild(tr);
  });
}

function openAddModal() {
  modalTitle.textContent = 'Add Product';
  fieldId.value    = '';
  fieldName.value  = '';
  fieldPrice.value = '';
  btnSave.textContent = 'Add Product';
  openModal('modal-product');
  setTimeout(() => fieldName.focus(), 100);
}

function openEditModal(id) {
  const p = DB.findById('products', id);
  if (!p) return;
  modalTitle.textContent = 'Edit Product';
  fieldId.value    = p.id;
  fieldName.value  = p.name;
  fieldPrice.value = p.price;
  btnSave.textContent = 'Save Changes';
  openModal('modal-product');
  setTimeout(() => fieldName.focus(), 100);
}

function saveProduct() {
  const name  = fieldName.value.trim();
  const price = parseFloat(fieldPrice.value);

  if (!name) { Utils.showToast('Product name is required.', 'error'); return; }
  if (isNaN(price) || price < 0) { Utils.showToast('Enter a valid price.', 'error'); return; }

  const id = fieldId.value;

  if (id) {
    const existing = DB.findById('products', id);
    // Log price change if price actually changed
    if (existing && existing.price !== price) {
      DB.logPriceChange(id, existing.price, price);
    }
    DB.update('products', id, { name, price });
    Utils.showToast('Product updated!');
  } else {
    DB.insert('products', { name, price });
    Utils.showToast('Product added!');
  }

  closeModal('modal-product');
  renderStats();
  renderTable();
}

function deleteProduct(id) {
  const p = DB.findById('products', id);
  if (!p) return;

  const inInventory = DB.getData('inventory').some(i => i.productId === id);
  const inSales     = DB.getData('sales').some(s => s.items.some(i => i.productId === id));

  let warning = `Delete "${p.name}"?`;
  if (inInventory || inSales) warning += '\n\n⚠️ This product has inventory or sales records. Deleting it may affect historical data.';

  if (!Utils.confirm(warning)) return;

  DB.delete('products', id);
  Utils.showToast('Product deleted.', 'warning');
  renderStats();
  renderTable();
}

// ── Price History Modal ───────────────────────────────────────
function openPriceHistory(productId) {
  const p       = DB.findById('products', productId);
  const history = DB.getData('price_history')
    .filter(h => h.productId === productId)
    .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));

  document.getElementById('price-history-title').textContent =
    `📈 Price History — ${p ? Utils.escape(p.name) : ''}`;

  const bodyEl = document.getElementById('price-history-body');

  if (history.length === 0) {
    bodyEl.innerHTML = `
      <p class="text-muted" style="font-size:.875rem;text-align:center;padding:20px 0;">
        No price changes recorded yet.<br>
        <span class="text-small">Prices are logged whenever you edit a product's price.</span>
      </p>`;
    openModal('modal-price-history');
    return;
  }

  let rows = history.map(h => {
    const arrow = h.newPrice > h.oldPrice
      ? `<span style="color:var(--red-600)">▲ +${Utils.formatCurrency(h.newPrice - h.oldPrice)}</span>`
      : `<span style="color:var(--green-600)">▼ −${Utils.formatCurrency(h.oldPrice - h.newPrice)}</span>`;
    return `
      <tr>
        <td class="text-small text-muted">${Utils.formatDateTime(h.changedAt)}</td>
        <td>${Utils.formatCurrency(h.oldPrice)}</td>
        <td>${Utils.formatCurrency(h.newPrice)}</td>
        <td>${arrow}</td>
      </tr>`;
  }).join('');

  bodyEl.innerHTML = `
    <p class="text-small text-muted" style="margin-bottom:12px;">
      Current price: <strong>${p ? Utils.formatCurrency(p.price) : '—'}</strong> / sack &nbsp;·&nbsp;
      ${history.length} change${history.length !== 1 ? 's' : ''} recorded
    </p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date &amp; Time</th>
            <th>Old Price</th>
            <th>New Price</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  openModal('modal-price-history');
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

init();
