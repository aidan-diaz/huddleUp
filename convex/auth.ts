import { convexAuth } from '@convex-dev/auth/server';
import { Password } from '@convex-dev/auth/providers/Password';

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // If updating an existing user, just return the existing ID
      if (args.existingUserId) {
        return args.existingUserId;
      }
      
      // Creating a new user - include all required fields
      const now = Date.now();
      const userId = await ctx.db.insert('users', {
        email: args.profile.email as string,
        name: args.profile.name as string | undefined,
        avatarUrl: args.profile.avatarUrl as string | undefined,
        presenceStatus: 'offline',
        lastHeartbeat: now,
        createdAt: now,
      });
      
      return userId;
    },
  },
});
