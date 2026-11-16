/**
 * Milestone 3.1: Push Notification helpers and subscription management
 */

import { supabase } from './supabase.ts';

export type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export interface PushStatus {
  isStandalone: boolean;
  permission: PushPermission;
  isSubscribed: boolean;
  endpoint?: string;
}

/**
 * Detects whether the app is running in standalone mode (installed to home screen).
 * iPhone only allows web push notifications for installed standalone PWAs.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  return Boolean(isStandaloneMedia || isIosStandalone);
}

/**
 * Checks if the browser supports Push Notifications and Service Workers.
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Gets current notification permission.
 */
export function getNotificationPermission(): PushPermission {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission as PushPermission;
}

/**
 * Converts a base64url string to Uint8Array for applicationServerKey.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const atobFn =
    typeof window !== 'undefined' && typeof window.atob === 'function'
      ? window.atob.bind(window)
      : (globalThis as unknown as { atob: (str: string) => string }).atob;
  const rawData = atobFn(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Get current push subscription status for user.
 */
export async function getPushStatus(userId: string): Promise<PushStatus> {
  const standalone = isStandalone();

  if (!isPushSupported()) {
    return {
      isStandalone: standalone,
      permission: 'unsupported',
      isSubscribed: false,
    };
  }

  const permission = Notification.permission as PushPermission;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();

    if (!sub) {
      return {
        isStandalone: standalone,
        permission,
        isSubscribed: false,
      };
    }

    // Check if subscription exists in database for this user
    const { data } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('endpoint', sub.endpoint)
      .maybeSingle();

    return {
      isStandalone: standalone,
      permission,
      isSubscribed: Boolean(data),
      endpoint: sub.endpoint,
    };
  } catch (err) {
    console.warn('Error reading push subscription status:', err);
    return {
      isStandalone: standalone,
      permission,
      isSubscribed: false,
    };
  }
}

/**
 * Request notification permission and subscribe to push service.
 * Must be called in direct response to a user tap.
 */
export async function subscribeToPush(userId: string): Promise<{
  success: boolean;
  error?: string;
  subscription?: PushSubscription;
}> {
  if (!isPushSupported()) {
    return {
      success: false,
      error: 'Push notifications are not supported on this browser.',
    };
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return {
      success: false,
      error: 'VAPID public key is missing. Please configure VITE_VAPID_PUBLIC_KEY in your environment.',
    };
  }

  try {
    // 1. Request notification permission (must happen inside tap event)
    const permission = await Notification.requestPermission();
    if (permission === 'denied') {
      return {
        success: false,
        error: 'Notifications were blocked in device settings.',
      };
    }

    if (permission !== 'granted') {
      return {
        success: false,
        error: 'Notification permission was not granted.',
      };
    }

    // 2. Wait for service worker
    const reg = await navigator.serviceWorker.ready;

    // 3. Subscribe with VAPID key
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });
    }

    const subJson = sub.toJSON();
    const endpoint = sub.endpoint;
    const p256dh = subJson.keys?.p256dh || '';
    const auth = subJson.keys?.auth || '';

    if (!endpoint || !p256dh || !auth) {
      return {
        success: false,
        error: 'Push subscription was missing security keys.',
      };
    }

    // 4. Save into database
    const { error: dbError } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
      },
      { onConflict: 'endpoint' }
    );

    if (dbError) {
      throw new Error(`Failed to save subscription: ${dbError.message}`);
    }

    // 5. Update user settings reminders_enabled to true
    await supabase
      .from('settings')
      .update({ reminders_enabled: true })
      .eq('user_id', userId);

    return {
      success: true,
      subscription: sub,
    };
  } catch (err: unknown) {
    console.error('Failed to subscribe to push notifications:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during subscription',
    };
  }
}

/**
 * Unsubscribe from push service and remove from database.
 */
export async function unsubscribeFromPush(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (isPushSupported()) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
    }

    await supabase
      .from('settings')
      .update({ reminders_enabled: false })
      .eq('user_id', userId);

    return { success: true };
  } catch (err: unknown) {
    console.error('Failed to unsubscribe from push notifications:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during unsubscription',
    };
  }
}
