import { mutation } from './_generated/server';

/**
 * Seed test users for development/testing
 * These users will appear in searches and can be added to groups/DMs
 * 
 * To fully test features like calls, you'll need to open the app in 
 * two different browser windows (or use incognito) and log in as different users.
 */
export const seedTestUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    const testUsers = [
      {
        email: 'alice@test.com',
        name: 'Alice Johnson',
        presenceStatus: 'offline' as const,
        lastHeartbeat: now,
        createdAt: now,
      },
      {
        email: 'bob@test.com',
        name: 'Bob Smith',
        presenceStatus: 'offline' as const,
        lastHeartbeat: now,
        createdAt: now,
      },
    ];

    const createdUsers = [];
    
    for (const user of testUsers) {
      // Check if user already exists
      const existing = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', user.email))
        .first();
      
      if (!existing) {
        const userId = await ctx.db.insert('users', user);
        createdUsers.push({ id: userId, email: user.email, name: user.name });
      } else {
        createdUsers.push({ id: existing._id, email: existing.email, name: existing.name, existed: true });
      }
    }

    return {
      message: 'Test users created/found',
      users: createdUsers,
    };
  },
});
