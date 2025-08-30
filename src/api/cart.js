// src/api/cart.js
import client from './client';

/**
 * Normaliza la respuesta del backend → siempre un array de items
 */
function pickItems(data) {
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.cart?.items)) return data.cart.items;
  return [];
}

/**
 * GET /cart → devuelve array de items
 */
export async function getCart() {
  const res = await client.get('/cart');
  return pickItems(res.data);
}

/**
 * POST /cart → agrega un producto
 */
export async function addToCart(productId, quantity = 1) {
  const res = await client.post('/cart', { productId, quantity });
  return res.data?.item || null;
}

/**
 * PUT /cart/:id → actualiza cantidad
 */
export async function updateCartItem(id, quantity) {
  const res = await client.put(`/cart/${id}`, { quantity });
  return res.data?.item || null;
}

/**
 * DELETE /cart/:id → elimina un ítem
 */
export async function removeCartItem(id) {
  await client.delete(`/cart/${id}`);
  return true;
}

/**
 * DELETE /cart → vacía carrito completo
 */
export async function clearCart() {
  await client.delete('/cart');
  return true;
}
