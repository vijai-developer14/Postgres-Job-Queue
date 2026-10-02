import {pool} from './config/db.js'

export const enqueue = async(type, payload)=>{
     try{
        const result = await pool.query('INSERT  INTO jobs (type, payload) VALUES ($1, $2) RETURNING  *', [type, payload])
        return result.rows[0]
    }
    catch(error){
        console.error(error);
        return false
    }
}

export const claimJob = async()=>{
    try{
        const result = await pool.query(`UPDATE jobs SET status = 'ongoing', updated_at = NOW() WHERE id = (SELECT id FROM jobs WHERE run_at <= NOW() AND status = 'pending'  ORDER BY run_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`);
        return result.rows[0]
    }
    catch(error){
        console.error(error);
        return false
    }

}

export const completeJob = async(jobId)=>{
    try{
        const result = await pool.query(`UPDATE jobs SET status = 'completed', updated_at = NOW() WHERE id = $1 
            AND status = 'ongoing'  RETURNING *`, [jobId]);
        return result.rows[0]
    }
    catch(error){
        console.error(error)
        return false
    }
    
} 

export const failedJob = async(jobId)=>{
    try{
        const result = await pool.query(`UPDATE jobs SET
                                        attempts = attempts + 1, 
                                         status = CASE
                                         WHEN attempts + 1 > max_attempts THEN 'failed'
                                         ELSE 'pending'
                                         END,

                                         run_at = CASE
                                         WHEN attempts + 1 > max_attempts THEN NOW()
                                         ELSE NOW() + INTERVAL '3 seconds'
                                         END,

                                         updated_at = NOW()
                                        WHERE id = $1 AND status = 'ongoing'
                                        RETURNING *`, [jobId]);
        return result.rows[0]
    }
    catch(error){
        console.error(error)
        return false
    }
    
}




