import { buildApp } from './app.js';import { connectDb,disconnectDb } from './core/db.js';import { closeQueues } from './core/queue.js';import { env } from './config/env.js';
const app=await buildApp();await connectDb();await app.listen({port:env.PORT,host:'0.0.0.0'});
const shutdown=async(signal:string)=>{app.log.info({signal},'shutting down');await app.close();await closeQueues();await disconnectDb();process.exit(0)};process.on('SIGTERM',()=>void shutdown('SIGTERM'));process.on('SIGINT',()=>void shutdown('SIGINT'));
