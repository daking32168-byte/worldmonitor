import type { LocalNotificationRecord } from '../../shared/personal-intelligence';
import { isDesktopRuntime } from './runtime';

export type NotificationPermissionState = 'GRANTED' | 'DENIED' | 'PROMPT' | 'UNSUPPORTED';

export async function notificationPermissionState(): Promise<NotificationPermissionState> {
  if (isDesktopRuntime()) {
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
    return (await isPermissionGranted()) ? 'GRANTED' : 'PROMPT';
  }
  if (typeof Notification === 'undefined') return 'UNSUPPORTED';
  return Notification.permission === 'granted' ? 'GRANTED' : Notification.permission === 'denied' ? 'DENIED' : 'PROMPT';
}

/** Must be called only from an explicit user gesture. */
export async function requestNotificationPermissionFromUserGesture(): Promise<NotificationPermissionState> {
  if (isDesktopRuntime()) {
    const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
    if (await isPermissionGranted()) return 'GRANTED';
    return (await requestPermission()) === 'granted' ? 'GRANTED' : 'DENIED';
  }
  if (typeof Notification === 'undefined') return 'UNSUPPORTED';
  if (Notification.permission === 'granted') return 'GRANTED';
  return (await Notification.requestPermission()) === 'granted' ? 'GRANTED' : 'DENIED';
}

export async function deliverDesktopNotification(notification: LocalNotificationRecord): Promise<Readonly<{ status: 'DELIVERED' | 'PERMISSION_REQUIRED' | 'FAILED'; message: string }>> {
  if (notification.delivery_status !== 'PENDING' && notification.delivery_status !== 'PERMISSION_REQUIRED') {
    return { status: 'FAILED', message: `Notification is ${notification.delivery_status}, not dispatchable` };
  }
  const permission = await notificationPermissionState();
  if (permission !== 'GRANTED') return { status: 'PERMISSION_REQUIRED', message: `Notification permission is ${permission}; permission is never requested without a user gesture.` };
  try {
    if (isDesktopRuntime()) {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      sendNotification({ title: notification.title, body: `${notification.body}\n在应用中打开：${notification.detail_path}` });
    } else {
      const rendered = new Notification(notification.title, { body: notification.body, tag: notification.dedupe_key });
      rendered.onclick = () => {
        window.focus();
        window.location.assign(notification.detail_path);
        rendered.close();
      };
    }
    return { status: 'DELIVERED', message: `已发送；详情入口 ${notification.detail_path}` };
  } catch (error) {
    return { status: 'FAILED', message: error instanceof Error ? error.message : 'Unknown notification delivery error' };
  }
}
