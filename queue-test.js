import { enqueue } from './queue.js';
await enqueue('send_mail', { to: 'failed@example.com', subject: 'failed job test 5' });
process.exit(0);