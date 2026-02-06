"use node";

import { v } from 'convex/values';
import { internalAction } from './_generated/server';

// Only import livekit-server-sdk when actually needed (lazy import in handler)
// This ensures the module is only loaded in Node.js runtime

/**
 * Generate a LiveKit access token for a user
 * This runs in the Node.js runtime because it uses the LiveKit SDK
 */
export const generateToken = internalAction({
  args: {
    roomName: v.string(),
    identity: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.warn('LiveKit credentials not configured. Using placeholder token.');
      // Return a development token that won't work with real LiveKit
      // but allows the call flow to continue for testing
      return `dev-token-${args.roomName}-${args.identity}-${Date.now()}`;
    }

    // Dynamic import to ensure this only runs in Node.js runtime
    const { AccessToken } = await import('livekit-server-sdk');

    const at = new AccessToken(apiKey, apiSecret, {
      identity: args.identity,
      name: args.name,
      ttl: '1h',
    });

    at.addGrant({
      roomJoin: true,
      room: args.roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return await at.toJwt();
  },
});
