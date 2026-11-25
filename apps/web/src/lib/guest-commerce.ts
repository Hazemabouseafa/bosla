'use client';

import { apiFetch } from './api';

export interface GuestTargetRef {
  targetType: 'COURSE' | 'LEARNING_PATH' | 'DIPLOMA';
  targetId: string;
  titleAr?: string;
  slug?: string;
  priceCents?: number;
  thumbnailUrl?: string | null;
}

const GUEST_CART_KEY = 'bosla_guest_cart_v1';
const GUEST_WISHLIST_KEY = 'bosla_guest_wishlist_v1';

function readJsonList(key: string): GuestTargetRef[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonList(key: string, items: GuestTargetRef[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('bosla-guest-commerce-updated'));
  } catch {
    // Ignore storage quota errors
  }
}

export function getGuestCartItems(): GuestTargetRef[] {
  return readJsonList(GUEST_CART_KEY);
}

export function getGuestWishlistItems(): GuestTargetRef[] {
  return readJsonList(GUEST_WISHLIST_KEY);
}

export function isInGuestWishlist(
  targetType: 'COURSE' | 'LEARNING_PATH' | 'DIPLOMA',
  targetId: string,
): boolean {
  return getGuestWishlistItems().some(
    (x) => x.targetType === targetType && x.targetId === targetId,
  );
}

export function toggleGuestWishlistItem(item: GuestTargetRef): boolean {
  const list = getGuestWishlistItems();
  const exists = list.some(
    (x) => x.targetType === item.targetType && x.targetId === item.targetId,
  );
  const next = exists
    ? list.filter((x) => !(x.targetType === item.targetType && x.targetId === item.targetId))
    : [...list, item];
  writeJsonList(GUEST_WISHLIST_KEY, next);
  return !exists;
}

export function addGuestCartItem(item: GuestTargetRef): boolean {
  const list = getGuestCartItems();
  if (list.some((x) => x.targetType === item.targetType && x.targetId === item.targetId)) {
    return false;
  }
  writeJsonList(GUEST_CART_KEY, [...list, item]);
  return true;
}

export function removeGuestCartItem(
  targetType: 'COURSE' | 'LEARNING_PATH' | 'DIPLOMA',
  targetId: string,
): void {
  const next = getGuestCartItems().filter(
    (x) => !(x.targetType === targetType && x.targetId === targetId),
  );
  writeJsonList(GUEST_CART_KEY, next);
}

/**
 * Merges pre-login Guest Cart & Wishlist items into the authenticated user's account
 * right after signing in (login, Google OAuth, or passkey).
 */
export async function syncGuestCommerceOnAuth(): Promise<{
  cartMerged: number;
  wishlistMerged: number;
}> {
  const cartItems = getGuestCartItems();
  const wishItems = getGuestWishlistItems();
  let cartMerged = 0;
  let wishlistMerged = 0;

  const courseCartIds = cartItems
    .filter((i) => i.targetType === 'COURSE')
    .map((i) => i.targetId);

  if (courseCartIds.length > 0) {
    try {
      await apiFetch('/commerce/cart/merge', {
        method: 'POST',
        body: JSON.stringify({
          courseIds: courseCartIds,
        }),
      });
      cartMerged = courseCartIds.length;
      writeJsonList(GUEST_CART_KEY, []);
    } catch {
      // Leave items untouched if merge failed cleanly
    }
  }

  if (wishItems.length > 0) {
    try {
      await apiFetch('/commerce/wishlist/merge', {
        method: 'POST',
        body: JSON.stringify({
          items: wishItems.map((i) => ({
            targetType: i.targetType,
            targetId: i.targetId,
          })),
        }),
      });
      wishlistMerged = wishItems.length;
      writeJsonList(GUEST_WISHLIST_KEY, []);
    } catch {
      // Keep items untouched on error
    }
  }

  return { cartMerged, wishlistMerged };
}
