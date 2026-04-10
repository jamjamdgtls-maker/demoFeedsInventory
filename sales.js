/**
 * stock-in.js — Receive stock (create inventory batches)
 *
 * Rule: Each form submission creates a NEW inventory record.
 *       Batches are NEVER merged automatically.
 */

DB.seedIfEmpty();

const productSelect  = document.getElementById('field-product');
const supplierSelect = document.getElementById('field-supplier');
const qtyInput       = document.getElementById('field-quantity');
const costInput      = document.getElementById('field-cost');
const dateInput      = document.getElementById('field-date');
const previewEl      = document.getElementById('stock-preview');
const historyTbody   = document.getElementById('history-tbody');
const historyEmpty   = document.getElementById('history-empty');
const batchCountEl   = document.getElementById('batch-count');

function init() {
  populateSelects();
  setDefaultDate();
  renderHistory();

  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Live preview
  [productSelect, supplierSelect, qtyInput, costInput].forEach(el => {
    el.addEventListener('change', updatePreview);
    el.addEventListener('input', updatePreview);
  });

  document.getElementById('btn-submit').addEventListener('click', submitStockIn);
}

function populateSelects() {
  const products  = DB.getData('products');
  const suppliers = DB.getData('suppliers');

  productSelect.innerHTML = '<option value="">— Select product —</option>';
  products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    productSelect.appendChild(opt);
  });

  supplierSelect.innerHTML = '<option value="">— Select supplier —</option>';
  suppliers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    supplierSelect.appendChild(opt);
  });

  if (products.length === 0) {
    productSelect.innerHTML = '<option value="">No products — add products first</option>';
  }
  if (suppliers.length === 0) {
    supplierSelect.innerHTML = '<option value="">No suppliers — add suppliers first</option>';
  }
}

function setDefaultDate() {
  dateInput.value = Utils.todayISO();
}

function updatePreview() {
  const productId  = productSelect.value;
  const supplierId = supplierSelect.value;
  const qty        = parseInt(qtyInput.value);
  const cost       = parseFloat(costInput.value);

  if (!productId || !supplierId || isNaN(qty) || isNaN(cost)) {
    previewEl.style.display = 'none';
    return;
  }

  const product  = DB.findById('products', productId);
  const supplier = DB.findById('suppliers', supplierId);
  const existing = Utils.getStockByProductSupplier(productId, supplierId);
  const totalCostValue = qty * cost;

  previewEl.style.display = 'block';
  previewEl.innerHTML = `
    <div class="stock-preview__title">📋 Batch Preview</div>
    <div class="stock-preview__row"><span>Product</span><span>${Utils.escape(product?.name || '—')}</span></div>
    <div class="stock-preview__row"><span>Supplier</span><span>${Utils.escape(supplier?.name || '—')}</span></div>
    <div class="stock-preview__row"><span>Quantity</span><span>${qty} units</span></div>
    <div class="stock-preview__row"><span>Cost per unit</span><span>${Utils.formatCurrency(cost)}</span></div>
    <div class="stock-preview__row"><span>Batch value</span><span>${Utils.formatCurrency(totalCostValue)}</span></div>
    <div class="stock-preview__row" style="padding-top:6px;border-top:1px solid var(--green-200);margin-top:4px;">
      <span>Current stock (this supplier)</span>
      <span>${existing} units</span>
    </div>
    <div class="stock-preview__row">
      <span>After this batch</span>
      <span style="color:var(--green-600);">${existing + qty} units</span>
    </div>
  `;
}

function submitStockIn() {
  const productId   = productSelect.value;
  const supplierId  = supplierSelect.value;
  const qty         = parseInt(qtyInput.value);
  const cost        = parseFloat(costInput.value);
  const dateReceived = dateInput.value || Utils.todayISO();

  // Validation
  if (!productId)         { Utils.showToast('Please select a product.', 'error');  return; }
  if (!supplierId)        { Utils.showToast('Please select a supplier.', 'error'); return; }
  if (isNaN(qty) || qty < 1)  { Utils.showToast('Enter a valid quantity (min 1).', 'error'); return; }
  if (isNaN(cost) || cost < 0) { Utils.showToast('Enter a valid cost price.', 'error'); return; }

  // Create batch — do NOT merge
  const batch = {
    productId,
    supplierId,
    quantity:     qty,
    costPrice:    cost,
    dateReceived: new Date(dateReceived + 'T00:00:00').toISOString(),
  };

  DB.insert('inventory', batch);

  // Reset form
  productSelect.value  = '';
  supplierSelect.value = '';
  qtyInput.value       = '';
  costInput.value      = '';
  setDefaultDate();
  previewEl.style.display = 'none';

  Utils.showToast(`✅ Stock received! ${qty} units added.`);
  renderHistory();
}

function renderHistory() {
  const inventory = DB.getData('inventory');
  // Show newest first
  const sorted = [...inventory].sort((a, b) => new Date(b.dateReceived) - new Date(a.dateReceived));
  const recent = sorted.slice(0, 30); // show last 30

  batchCountEl.textContent = `${inventory.length} batch${inventory.length !== 1 ? 'es' : ''}`;
  historyTbody.innerHTML = '';

  if (recent.length === 0) {
    historyEmpty.style.display = 'flex';
    return;
  }
  historyEmpty.style.display = 'none';

  recent.forEach(batch => {
    const productName  = Utils.getProductName(batch.productId);
    const supplierName = Utils.getSupplierName(batch.supplierId);
    const isActive     = batch.quantity > 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-small text-muted">${Utils.formatDate(batch.dateReceived)}</td>
      <td><strong>${Utils.escape(productName)}</strong></td>
      <td>${Utils.escape(supplierName)}</td>
      <td>
        ${isActive
          ? `<span class="badge badge--green">${batch.quantity}</span>`
          : `<span class="badge badge--slate">depleted</span>`}
      </td>
      <td>${Utils.formatCurrency(batch.costPrice)}</td>
      <td>
        <button class="btn btn--danger btn--sm btn--icon" title="Delete batch" data-id="${batch.id}">🗑</button>
      </td>
    `;

    tr.querySelector('[data-id]').addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      if (!Utils.confirm('Delete this inventory batch? This cannot be undone.')) return;
      DB.delete('inventory', id);
      Utils.showToast('Batch deleted.', 'warning');
      renderHistory();
    });

    historyTbody.appendChild(tr);
  });
}

init();
