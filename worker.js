import {claimJob, completeJob, failedJob} from './queue.js'

const processJob = async (job)=>{
    // console.log()
    console.log(job.type, job.payload)
    // throw new Error('simulationg error')
    //  await new Promise(() => {})
}
const sleep = (ms)=> new Promise((resolve)=>{
    setTimeout(resolve, ms)
})

const worker = async ()=>{
    console.log('worker started polling jobs')
    
    while(true){

        let job = await claimJob();
        if(job === false){
            console.log('worker failed')
            await sleep(2000)
            continue
        }

        if(!job){
            await sleep(3000)
            continue
        }


        try{
            await processJob(job);
            await completeJob(job.id)
        
        }
        catch(error){
            console.log(job.id, error.message)
            await failedJob(job.id)
        }

    }
}
worker()