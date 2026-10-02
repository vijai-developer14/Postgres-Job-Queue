import {claimJob, completeJob, failedJob} from './queue.js'

const processJob = async (job)=>{
    console.log(job.type, job.payload)
}
const sleep = (ms)=> new Promise((resolve)=>{
    setTimeout(resolve, ms)
})

const worker = async ()=>{
    let job = claimJob()
    while(true){    
        if(!job){
            await sleep(3000)
            continue
        }
        if(job === false){
            await sleep(2000)
            continue
        }

        try{
            await processJob(job);
            await completeJob(job.id)
        
        }
        catch(error){
            await failedJob(job.id)
        }

    }
}
worker()