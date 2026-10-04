import test from 'node:test'
import assert from 'node:assert'
import { enqueue } from './queue.js';
import { pool } from './config/db.js';

test('inserting job in DB', async ()=>{
     const job = await enqueue('send_mail', {to:'vijai@gmail.com', subject:'test'});
    try{
       
        assert.ok(job.id, 'job must have id');
        assert.strictEqual(job.type, 'send_mail');
        assert.strictEqual(job.status, 'pending')
    }
    finally{
        if (job?.id)
        await pool.query(`DELETE  FROM jobs WHERE id = $1`, [job.id])
    }
})