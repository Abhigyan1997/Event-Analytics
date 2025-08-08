import { connectMongoose } from '../db/mongoose';
import { eventsQueue } from '../queue/bull';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  await connectMongoose();
  console.log('Seeding...');

  const orgId = 'org_local';
  const projectId = 'proj_local';
  const users = 200;
  const eventsPerUser = 10;

  const allEvents = [];

  for (let u = 0; u < users; u++) {
    const userId = `user_${u}`;
    const signup = Date.now() - Math.floor(Math.random() * 30) * 24 * 3600 * 1000;
    allEvents.push({
      orgId, projectId, userId, eventName: 'signup', timestamp: new Date(signup), properties: {}, eventId: uuidv4()
    });
    for (let e = 1; e < eventsPerUser; e++) {
      const ts = signup + e * (3600 * 1000) + Math.floor(Math.random() * 10) * 1000;
      const name = Math.random() < 0.2 ? 'purchase' : (Math.random() < 0.5 ? 'page_view' : 'click');
      allEvents.push({
        orgId, projectId, userId, eventName: name, timestamp: new Date(ts), properties: {}, eventId: uuidv4()
      });
    }
  }

  for (let i = 0; i < allEvents.length; i += 500) {
    const chunk = allEvents.slice(i, i + 500);
    await eventsQueue.add('seed-batch', { events: chunk });
    console.log(`Enqueued ${chunk.length} events`);
  }

  console.log('Seeding enqueued');
  process.exit(0);
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
});
