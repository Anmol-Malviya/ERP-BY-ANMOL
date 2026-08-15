import mongoose from 'mongoose';
import { env } from '../config/env.js';
export async function connectDb(){mongoose.set('strictQuery',true);await mongoose.connect(env.MONGODB_URI,{autoIndex:env.NODE_ENV!=='production',maxPoolSize:30,minPoolSize:2,serverSelectionTimeoutMS:10000});}
export async function disconnectDb(){await mongoose.disconnect();}
