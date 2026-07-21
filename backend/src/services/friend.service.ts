import { FriendRepository } from '../repositories/friend.repository';
import { AppError } from '../utils/app-error';
const friends=new FriendRepository();
export class FriendService {
 async request(userId:string,targetId:string){if(userId===targetId)throw new AppError('You cannot add yourself.',400);if(await friends.find(userId,targetId))throw new AppError('A relationship already exists.',409);return friends.create(userId,targetId)}
 async accept(userId:string,id:string){const request=await friends.find(userId,userId);const pending=await friends.pending(userId);const item=pending.find((p)=>p.id===id);if(!item)throw new AppError('Pending request not found.',404);return friends.update(item.id,'ACCEPTED')}
 async reject(userId:string,id:string){const pending=await friends.pending(userId);const item=pending.find((p)=>p.id===id);if(!item)throw new AppError('Pending request not found.',404);return friends.update(item.id,'REJECTED')}
 async cancel(userId:string,id:string){const item=await friends.find(userId,id);if(!item||item.senderId!==userId||item.status!=='PENDING')throw new AppError('Friend request not found.',404);return friends.remove(item.id)}
 async remove(userId:string,targetId:string){const item=await friends.find(userId,targetId);if(!item||item.status!=='ACCEPTED')throw new AppError('Friendship not found.',404);return friends.remove(item.id)}
 list(userId:string){return friends.list(userId)} pending(userId:string){return friends.pending(userId)}
}
