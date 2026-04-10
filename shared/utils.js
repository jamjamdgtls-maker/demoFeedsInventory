/**
 * utils.js — Shared helper utilities for AgroFeed POS
 */

const Utils = {
  formatCurrency(amount) {
    return '₱' + Number(amount || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  },

  formatDate(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  },

  formatDateTime(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  todayISO() {
    return new Date().toISOString().split('T')[0];
  },

  escape(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  },

  confirm(msg) { return window.confirm(msg); },

  showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast toast--${type} toast--visible`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.className = `toast toast--${type}`; }, 3200);
  },

  getStockByProductSupplier(productId, supplierId) {
    return DB.getData('inventory')
      .filter(i => i.productId === productId && i.supplierId === supplierId)
      .reduce((s, i) => s + (i.quantity || 0), 0);
  },

  getTotalStock(productId) {
    return DB.getData('inventory')
      .filter(i => i.productId === productId)
      .reduce((s, i) => s + (i.quantity || 0), 0);
  },

  getProductName(id) {
    const p = DB.findById('products', id);
    return p ? p.name : '—';
  },

  getSupplierName(id) {
    const s = DB.findById('suppliers', id);
    return s ? s.name : '—';
  },

  deductInventoryFIFO(productId, supplierId, qty) {
    const inventory = DB.getData('inventory');
    const batches   = inventory
      .filter(i => i.productId === productId && i.supplierId === supplierId && i.quantity > 0)
      .sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived));

    if (batches.reduce((s, b) => s + b.quantity, 0) < qty) return false;

    let remaining = qty;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      const idx  = inventory.findIndex(i => i.id === batch.id);
      if (idx !== -1) inventory[idx].quantity -= take;
      remaining -= take;
    }
    DB.saveData('inventory', inventory);
    return true;
  },

  /** Apply a discount to an amount. Returns { discountAmount, finalAmount } */
  applyDiscount(amount, discValue, discType) {
    if (!discValue || discValue <= 0) return { discountAmount: 0, finalAmount: amount };
    const discountAmount = discType === 'pct'
      ? (amount * Math.min(discValue, 100)) / 100
      : Math.min(discValue, amount);
    return { discountAmount, finalAmount: amount - discountAmount };
  },

  /** Get the cost used for profit calculation on a sale item (FIFO first batch) */
  getCostForSaleItem(productId, supplierId) {
    const batches = DB.getData('inventory')
      .filter(i => i.productId === productId && i.supplierId === supplierId)
      .sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived));
    return batches.length > 0 ? batches[0].costPrice : 0;
  },

  calcSaleProfit(sale) {
    let revenue = 0, cost = 0;
    (sale.items || []).forEach(item => {
      revenue += (item.subtotal  ?? item.price * item.quantity);
      cost    += (item.costPrice ?? 0) * item.quantity;
    });
    const orderDisc = sale.orderDiscountAmount || 0;
    return { revenue: revenue - orderDisc, cost, profit: revenue - orderDisc - cost };
  },
};
