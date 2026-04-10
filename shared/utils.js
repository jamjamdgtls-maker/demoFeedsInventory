/**
 * utils.js — Shared helper utilities
 */

const Utils = {
  /**
   * Format a number as Philippine Peso currency.
   */
  formatCurrency(amount) {
    return '₱' + Number(amount).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },

  /**
   * Format an ISO date string to a readable local format.
   */
  formatDate(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  },

  /**
   * Format an ISO date string to date + time.
   */
  formatDateTime(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  /**
   * Get total available stock for a product from a specific supplier.
   * Sums all inventory records matching productId + supplierId.
   */
  getStockByProductSupplier(productId, supplierId) {
    const inventory = DB.getData('inventory');
    return inventory
      .filter(i => i.productId === productId && i.supplierId === supplierId)
      .reduce((sum, i) => sum + (i.quantity || 0), 0);
  },

  /**
   * Get total stock for a product across ALL suppliers.
   */
  getTotalStock(productId) {
    const inventory = DB.getData('inventory');
    return inventory
      .filter(i => i.productId === productId)
      .reduce((sum, i) => sum + (i.quantity || 0), 0);
  },

  /**
   * Get the name of a product by its id. Returns '—' if not found.
   */
  getProductName(productId) {
    const p = DB.findById('products', productId);
    return p ? p.name : '—';
  },

  /**
   * Get the name of a supplier by its id. Returns '—' if not found.
   */
  getSupplierName(supplierId) {
    const s = DB.findById('suppliers', supplierId);
    return s ? s.name : '—';
  },

  /**
   * Deduct inventory using FIFO (oldest batch first).
   * Modifies inventory in localStorage.
   * Returns true if fully deducted, false if insufficient stock.
   */
  deductInventoryFIFO(productId, supplierId, quantityToDeduct) {
    const inventory = DB.getData('inventory');

    // Gather matching batches, sort oldest first
    const batches = inventory
      .filter(i => i.productId === productId && i.supplierId === supplierId && i.quantity > 0)
      .sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived));

    const totalAvailable = batches.reduce((s, b) => s + b.quantity, 0);
    if (totalAvailable < quantityToDeduct) return false;

    let remaining = quantityToDeduct;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      // Find the record in the master array and deduct
      const masterIdx = inventory.findIndex(i => i.id === batch.id);
      if (masterIdx !== -1) inventory[masterIdx].quantity -= take;
      remaining -= take;
    }

    DB.saveData('inventory', inventory);
    return true;
  },

  /**
   * Show a brief toast notification.
   * Requires a #toast element in the page.
   */
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
    toast._timer = setTimeout(() => {
      toast.className = `toast toast--${type}`;
    }, 3000);
  },

  /**
   * Confirm dialog helper. Returns true/false.
   */
  confirm(message) {
    return window.confirm(message);
  },

  /**
   * Get today's date as ISO string (date only, no time).
   */
  todayISO() {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Sanitize a string for safe display (prevent XSS).
   */
  escape(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },
};
