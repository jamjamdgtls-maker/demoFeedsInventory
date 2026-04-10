/**
 * suppliers.js — Suppliers CRUD module
 */

DB.seedIfEmpty();

let searchQuery = '';

const tbody       = document.getElementById('supplier-tbody');
const emptyState  = document.getElementById('supplier-empty');
const statsEl     = document.getElementById('supplier-stats');
const searchInput = document.getElementById('search-input');
const modalTitle  = document.getElementById('modal-title');
const fieldId     = document.getElementById('edit-id');
const fieldName   = document.getElementById('field-name');
const btnSave     = document.getElementById('btn-save-supplier');

function init() {
  renderStats();
  renderTable();

  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('btn-add-supplier').addEventListener('click', openAddModal);
  btnSave.addEventListener('click', saveSupplier);

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
  const suppliers = DB.getData('suppliers');
  const inventory = DB.getData('inventory');

  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-card__label">Total Suppliers</div>
      <div class="stat-card__value">${suppliers.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__label">Stock Batches</div>
      <div class="stat-card__value">${inventory.length}</div>
      <div class="stat-card__sub">Across all suppliers</div>
    </div>
  `;
}

function renderTable() {
  let suppliers = DB.getData('suppliers');
  const inventory = DB.getData('inventory');

  if (searchQuery) {
    suppliers = suppliers.filter(s => s.name.toLowerCase().includes(searchQuery));
  }

  tbody.innerHTML = '';

  if (suppliers.length === 0) {
    emptyState.style.display = 'flex';
    document.querySelector('#supplier-table thead').style.display = 'none';
    return;
  }
  emptyState.style.display = 'none';
  document.querySelector('#supplier-table thead').style.display = '';

  suppliers.forEach((sup, i) => {
    const batches = inventory.filter(inv => inv.supplierId === sup.id);
    const productIds = [...new Set(batches.map(b => b.productId))];
    const totalStock = batches.reduce((s, b) => s + (b.quantity || 0), 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-muted">${i + 1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:8px;background:var(--green-100);display:flex;align-items:center;justify-content:center;font-size:1rem;">🏭</div>
          <strong>${Utils.escape(sup.name)}</strong>
        </div>
      </td>
      <td>${productIds.length} product${productIds.length !== 1 ? 's' : ''}</td>
      <td>${batches.length} batch${batches.length !== 1 ? 'es' : ''}</td>
      <td><span class="badge badge--green">${totalStock} units</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn--secondary btn--sm btn-edit" data-id="${sup.id}">✏️ Edit</button>
          <button class="btn btn--danger btn--sm btn-delete" data-id="${sup.id}">🗑</button>
        </div>
      </td>
    `;

    tr.querySelector('.btn-edit').addEventListener('click', () => openEditModal(sup.id));
    tr.querySelector('.btn-delete').addEventListener('click', () => deleteSupplier(sup.id));
    tbody.appendChild(tr);
  });
}

function openAddModal() {
  modalTitle.textContent = 'Add Supplier';
  fieldId.value   = '';
  fieldName.value = '';
  btnSave.textContent = 'Add Supplier';
  openModal('modal-supplier');
  setTimeout(() => fieldName.focus(), 100);
}

function openEditModal(id) {
  const s = DB.findById('suppliers', id);
  if (!s) return;
  modalTitle.textContent = 'Edit Supplier';
  fieldId.value   = s.id;
  fieldName.value = s.name;
  btnSave.textContent = 'Save Changes';
  openModal('modal-supplier');
  setTimeout(() => fieldName.focus(), 100);
}

function saveSupplier() {
  const name = fieldName.value.trim();
  if (!name) { Utils.showToast('Supplier name is required.', 'error'); return; }

  const id = fieldId.value;
  if (id) {
    DB.update('suppliers', id, { name });
    Utils.showToast('Supplier updated!');
  } else {
    DB.insert('suppliers', { name });
    Utils.showToast('Supplier added!');
  }

  closeModal('modal-supplier');
  renderStats();
  renderTable();
}

function deleteSupplier(id) {
  const s = DB.findById('suppliers', id);
  if (!s) return;

  const inInventory = DB.getData('inventory').some(i => i.supplierId === id);
  const inSales     = DB.getData('sales').some(sale => sale.items.some(i => i.supplierId === id));

  let warning = `Delete supplier "${s.name}"?`;
  if (inInventory || inSales) warning += '\n\n⚠️ This supplier has inventory or sales records.';

  if (!Utils.confirm(warning)) return;

  DB.delete('suppliers', id);
  Utils.showToast('Supplier deleted.', 'warning');
  renderStats();
  renderTable();
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

init();
