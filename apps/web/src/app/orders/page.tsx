'use client';

import { useCallback, useEffect, useState } from 'react';
import { OperatorNav } from '@/components/OperatorNav';
import { CapabilityGuard } from '@/components/CapabilityGuard';
import type {
  CatalogItemDto,
  OrderDto,
  OrderStatus,
} from '@ai-sales-agent/contracts';

export default function OrdersPage() {
  const [orgId, setOrgId] = useState('');
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isArabic, setIsArabic] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAuthMe = useCallback(async () => {
    try {
      const res = await fetch('/api/backend/me');
      if (res.ok) {
        const data = await res.json();
        if (data.activeOrganizationId) {
          setOrgId(data.activeOrganizationId);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const [ordersRes, catalogRes] = await Promise.all([
        fetch(`/api/backend/organizations/${orgId}/orders`),
        fetch(`/api/backend/organizations/${orgId}/catalog/items`),
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.items ?? []);
      } else {
        setError(`Failed to load orders: HTTP ${ordersRes.status}`);
      }

      if (catalogRes.ok) {
        const data = await catalogRes.json();
        setCatalogItems(data.items ?? []);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchAuthMe();
  }, [fetchAuthMe]);

  useEffect(() => {
    if (orgId) {
      void refresh();
    }
  }, [orgId, refresh]);

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !selectedCatalogItemId) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ catalogItemId: selectedCatalogItemId, quantity: Number(quantity) || 1 }],
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || `Failed to create order (HTTP ${res.status})`);
      }

      setShowCreateModal(false);
      setSelectedCatalogItemId('');
      setQuantity(1);
      setNotes('');
      void refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(orderId: string, action: 'confirm' | 'cancel' | 'complete', expectedVersion?: number) {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/orders/${orderId}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedVersion }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || `Action failed (HTTP ${res.status})`);
      }
      void refresh();
      if (selectedOrder?.id === orderId) {
        const updated = await res.json();
        setSelectedOrder(updated);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <CapabilityGuard organizationId={orgId} requiredCapability="supportsOrders" pathname="/orders">
      <div className="flex h-screen bg-slate-950 text-slate-100 antialiased overflow-hidden" dir={isArabic ? 'rtl' : 'ltr'}>
        <OperatorNav current="/orders" orgId={orgId} />

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Bar */}
          <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold tracking-tight text-white">
                {isArabic ? 'الطلبات' : 'Orders & Non-Booking Transactions'}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                MB-12
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsArabic(!isArabic)}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition"
              >
                {isArabic ? 'English' : 'عربي'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="text-sm px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition"
              >
                {isArabic ? '+ إنشاء طلب' : '+ Create Order'}
              </button>
            </div>
          </header>

          {/* Content Area */}
          <main className="p-6 max-w-7xl w-full mx-auto space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center justify-between">
                <span>{error}</span>
                <button type="button" onClick={() => setError('')} className="text-rose-400 hover:underline text-xs">
                  Dismiss
                </button>
              </div>
            )}

            {/* Orders Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">
                  {isArabic ? `إجمالي الطلبات: ${orders.length}` : `Total Orders: ${orders.length}`}
                </span>
                {loading && <span className="text-xs text-slate-500 animate-pulse">Loading...</span>}
              </div>

              {orders.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  {loading ? 'Fetching orders...' : 'No orders found for this organization.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3 font-medium">Order ID</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Items</th>
                        <th className="px-4 py-3 font-medium">Total Amount</th>
                        <th className="px-4 py-3 font-medium">Created</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-4 py-3 font-mono text-xs text-slate-300">
                            {o.id.slice(0, 8)}...
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                o.status === 'CONFIRMED' || o.status === 'COMPLETED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : o.status === 'PENDING_CONFIRMATION'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : o.status === 'CANCELLED' || o.status === 'REJECTED'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {o.lineItems?.length ?? 0} item(s)
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-100">
                            {o.totalAmountMinor} {o.currency}
                            {BigInt(o.discountAmountMinor) > 0n && (
                              <span className="block text-xs text-emerald-400 font-normal">
                                (-{o.discountAmountMinor} discount)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {new Date(o.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(o)}
                              className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                            >
                              Details
                            </button>
                            {o.status === 'PENDING_CONFIRMATION' && (
                              <button
                                type="button"
                                onClick={() => handleAction(o.id, 'confirm', o.version)}
                                className="text-xs px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                              >
                                Confirm
                              </button>
                            )}
                            {o.status === 'CONFIRMED' && (
                              <button
                                type="button"
                                onClick={() => handleAction(o.id, 'complete', o.version)}
                                className="text-xs px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                              >
                                Complete
                              </button>
                            )}
                            {['DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED'].includes(o.status) && (
                              <button
                                type="button"
                                onClick={() => handleAction(o.id, 'cancel', o.version)}
                                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950 text-rose-400"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Selected Order Details Modal */}
            {selectedOrder && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-semibold text-white">Order Details</h3>
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Order ID</span>
                      <span className="font-mono text-slate-200">{selectedOrder.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Status</span>
                      <span className="font-semibold text-slate-200">{selectedOrder.status}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Subtotal</span>
                      <span className="text-slate-200">{selectedOrder.subtotalAmountMinor} {selectedOrder.currency}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Discount</span>
                      <span className="text-emerald-400">{selectedOrder.discountAmountMinor} {selectedOrder.currency}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total</span>
                      <span className="text-base font-bold text-white">{selectedOrder.totalAmountMinor} {selectedOrder.currency}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Confirmed At</span>
                      <span className="text-slate-200">{selectedOrder.confirmedAt ? new Date(selectedOrder.confirmedAt).toLocaleString() : 'Pending'}</span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-800 pt-3">
                    <h4 className="text-xs font-semibold uppercase text-slate-400">Line Items Snapshot</h4>
                    <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                      {selectedOrder.lineItems?.map((line) => (
                        <div key={line.id} className="p-3 text-xs flex items-center justify-between bg-slate-950/40">
                          <div>
                            <span className="font-medium text-slate-200">{line.descriptionSnapshot}</span>
                            <span className="block text-slate-500">Qty: {line.quantity} × {line.unitAmountMinor}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-slate-100">{line.lineTotalAmountMinor} {selectedOrder.currency}</span>
                            {BigInt(line.discountAmountMinor) > 0n && (
                              <span className="block text-emerald-400">(-{line.discountAmountMinor})</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(null)}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Create Order Modal */}
            {showCreateModal && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-semibold text-white">Create Order</h3>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Catalog Item</label>
                      <select
                        value={selectedCatalogItemId}
                        onChange={(e) => setSelectedCatalogItemId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                        required
                      >
                        <option value="">Select a catalog item...</option>
                        {catalogItems
                          .filter((item) => item.amountMinor != null)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.amountMinor} {item.currency})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Notes</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Order delivery / customer notes..."
                        rows={3}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || !selectedCatalogItemId}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium"
                      >
                        {submitting ? 'Creating...' : 'Create Order'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </CapabilityGuard>
  );
}
