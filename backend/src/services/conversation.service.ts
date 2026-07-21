import { ConversationRepository } from '../repositories/conversation.repository';
import { AppError } from '../utils/app-error';
const conversations=new ConversationRepository();
export class ConversationService {
 async list(userId:string){
  const items=await conversations.listForUser(userId);
  return items.filter(item=>item.participants.length>1).map(item=>{
   const other=item.participants.find(participant=>participant.userId!==userId)?.user;
   const last=item.messages[0] ?? null;
   return {...item,title:item.title??other?.name??'Conversation',lastMessage:last?{...last,text:last.body??''}:null};
  });
 }
 async createDirect(userId:string,targetUserId:string){
  if(userId===targetUserId)throw new AppError('You cannot start a conversation with yourself.',400);
  const existing=await conversations.findDirectBetween(userId,targetUserId);
  if(existing)return existing;
  return conversations.createDirect([userId,targetUserId]);
 }
 async assertMember(id:string,userId:string){const c=await conversations.findMember(id,userId);if(!c)throw new AppError('Conversation not found.',404);return c}
}
