const GhostAdminAPI = require('@tryghost/admin-api');

const api = new GhostAdminAPI({
  url: process.env.GHOST_URL,
  key: process.env.GHOST_ADMIN_API_KEY,
  version: 'v5.0',
});

async function getPost(id) {
  return api.posts.read({ id }, { formats: ['html'], include: 'authors' });
}

async function getNewsletterMembers() {
  const members = [];
  let page = 1;
  while (true) {
    const batch = await api.members.browse({
      filter: 'subscribed:true',
      limit: 100,
      page,
    });
    members.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return members;
}

module.exports = { getPost, getNewsletterMembers };
