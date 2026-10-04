import {getStaleJob} from './queue.js'

const sleep = (ms)=>new Promise((r)=>setTimeout(r, ms))
const sweep = async()=>{
    console.log('Sweep started');
    while(true){
        await getStaleJob();
        await sleep(60000)
    }

}
sweep()