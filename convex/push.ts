"use node";

import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import webpush from 'web-push';

/**
 * Send push notification to user (internal action – called from scheduler only).
 * Runs in Node runtime so web-push (http/https) works.
 */
export const sendPushNotification = internalAction({
  args: {
    userId: v.id('users'),
    title: v.string(),
    body: v.string(),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const subscriptions = await ctx.runQuery(
      internal.notifications.getUserPushSubscriptions,
      { userId: args.userId }
    );

    console.log('[push] sendPushNotification called', {
      userId: args.userId,
      subscriptionCount: subscriptions.length,
      title: args.title,
    });

    if (subscriptions.length === 0) {
      console.log('[push] Skipped: no push subscriptions for this user.');
      return { sent: 0 };
    }

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? '';
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? '';

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('[push] VAPID keys not set in Convex env. Push disabled.');
      return { sent: 0 };
    }

    webpush.setVapidDetails(
      'mailto:support@huddleup.app',
      vapidPublicKey,
      vapidPrivateKey
    );

    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      url: args.url ?? '/',
      // Optional: add public/notification.mp3 for custom push sound (Chrome Android, etc.)
      sound: '/notification.mp3',
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
        sent += 1;
      } catch (err) {
        console.error('Push send failed for endpoint:', sub.endpoint, err);
      }
    }

    if (sent > 0) {
      console.log('[push] Push notification sent to', sent, 'device(s)');
    } else {
      console.log('[push] No devices received (all send attempts failed).');
    }
    return { sent };
  },
});
