// src/store/cart.js
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

/* ------------------ Store interno en memoria ------------------ */
const _items = new Map(); // productId -> { id, productId, title, quantity }
const _subs = new Set();  // listeners para notificar cambios

function _notify() {
  for (const fn of _subs) {
    try { fn(); } catch {}
  }
}

function _toArray() {
  // Normalizamos cada item con 'id' para que FlatList use 'id' directamente
  return Array.from(_items.values()).map((it) => ({
    id: it.productId,
    productId: it.productId,
    title: it.title,
    productTitle: it.title,
    quantity: Number(it.quantity) || 0,
  }));
}

function _count() {
  let total = 0;
  for (const it of _items.values()) total += (Number(it.quantity) || 0);
  return total;
}

/* ------------------ API core del carrito ------------------ */
const CartCore = {
  /** Suma/resta cantidad (delta). Crea el item si no existe. */
  add(productId, title, qtyDelta = 1) {
    const id = Number(productId);
    const delta = Number.isFinite(qtyDelta) ? Math.trunc(qtyDelta) : 0;
    if (!Number.isFinite(id) || id <= 0 || delta === 0) return;

    const curr = _items.get(id) || { productId: id, title: String(title ?? 'Producto'), quantity: 0 };
    const nextQty = Math.max(0, (Number(curr.quantity) || 0) + delta);

    if (nextQty <= 0) {
      _items.delete(id);
    } else {
      _items.set(id, { ...curr, title: String(title ?? curr.title ?? 'Producto'), quantity: nextQty });
    }
    _notify();
  },

  /** Fija cantidad exacta (0 elimina). */
  set(productId, title, qtyExact) {
    const id = Number(productId);
    const q = Number.isFinite(qtyExact) ? Math.max(0, Math.trunc(qtyExact)) : 0;
    if (!Number.isFinite(id) || id <= 0) return;

    if (q <= 0) {
      _items.delete(id);
    } else {
      const curr = _items.get(id) || { productId: id, title: String(title ?? 'Producto'), quantity: 0 };
      _items.set(id, { ...curr, title: String(title ?? curr.title ?? 'Producto'), quantity: q });
    }
    _notify();
  },

  /** Alias para compatibilidad con CartScreen: update(id, qty) */
  update(id, qty) {
    // No cambiamos el título aquí: mantenemos el que ya exista
    const curr = _items.get(Number(id));
    const title = curr?.title ?? 'Producto';
    return CartCore.set(id, title, qty);
  },

  remove(productId) {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) return;
    _items.delete(id);
    _notify();
  },

  clear() {
    _items.clear();
    _notify();
  },

  /** Lecturas */
  toArray: _toArray,
  count: _count,

  /** Subscripción (para badges/tab icon) */
  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    _subs.add(fn);
    return () => _subs.delete(fn);
  },
};

/* ------------------ Context y Provider ------------------ */
const CartContext = createContext({
  items: [],
  count: 0,
  loading: false,
  reload: async () => {},
  add: () => {},
  set: () => {},
  update: () => {},
  remove: () => {},
  clear: () => {},
});

export function CartProvider({ children }) {
  const [items, setItems] = useState(_toArray());
  const [count, setCount] = useState(_count());
  const [loading] = useState(false); // in-memory → sin latencia

  // reload no hace fetch (in-memory), pero mantiene la misma interfaz
  const reload = async () => {
    setItems(_toArray());
    setCount(_count());
  };

  useEffect(() => {
    // sincroniza cambios del store con el contexto
    return CartCore.subscribe(() => {
      setItems(_toArray());
      setCount(_count());
    });
  }, []);

  const value = useMemo(() => ({
    items,
    count,
    loading,
    reload,
    add: CartCore.add,
    set: CartCore.set,
    update: CartCore.update,
    remove: CartCore.remove,
    clear: CartCore.clear,
  }), [items, count, loading]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}

/* Exports de compatibilidad */
export const Cart = CartCore;
export default CartCore;
