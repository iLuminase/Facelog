import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { type AuthenticatedRequest, requireAuth, requireRoles } from '../../auth/middleware.js';
import { hashPassword } from '../../auth/password.js';
import { writeAuditLog } from '../../db/audit.js';
import { pool } from '../../db/pool.js';
import { asyncHandler } from '../../http/async-handler.js';
import { AppError } from '../../http/errors.js';

export const accountRouter = Router();
accountRouter.use(requireAuth, requireRoles('SUPER_ADMIN'));
const roleSchema = z.enum(['SUPER_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'SECURITY', 'EMPLOYEE']);
const statusSchema = z.enum(['ACTIVE', 'LOCKED', 'DISABLED']);

accountRouter.get('/', asyncHandler(async (req, res) => {
  const query = z.object({ keyword: z.string().trim().max(100).optional(), role: roleSchema.optional(), status: statusSchema.optional(), page: z.coerce.number().int().positive().default(1), pageSize: z.coerce.number().int().positive().max(100).default(20) }).parse(req.query);
  const filters: string[]=[]; const params: unknown[]=[];
  if(query.keyword){filters.push('(u.username LIKE ? OR e.full_name LIKE ? OR e.employee_code LIKE ?)'); const value=`%${query.keyword}%`;params.push(value,value,value);}
  if(query.role){filters.push('u.role=?');params.push(query.role);} if(query.status){filters.push('u.status=?');params.push(query.status);}
  const where=filters.length?`WHERE ${filters.join(' AND ')}`:''; const offset=(query.page-1)*query.pageSize;
  const [[counts],[rows]]=await Promise.all([
    pool.query<RowDataPacket[]>(`SELECT COUNT(*) total FROM users u LEFT JOIN employees e ON e.employee_id=u.employee_id ${where}`,params),
    pool.query<RowDataPacket[]>(`SELECT u.user_id userId,u.employee_id employeeId,u.username,u.role,u.status,u.last_login_at lastLoginAt,u.created_at createdAt,e.employee_code employeeCode,e.full_name fullName FROM users u LEFT JOIN employees e ON e.employee_id=u.employee_id ${where} ORDER BY u.created_at DESC,u.user_id DESC LIMIT ? OFFSET ?`,[...params,query.pageSize,offset])
  ]); const total=Number(counts[0]?.total??0); res.json({success:true,data:rows,pagination:{page:query.page,pageSize:query.pageSize,total,totalPages:Math.ceil(total/query.pageSize)}});
}));

accountRouter.post('/', asyncHandler(async (req,res)=>{
  const body=z.object({username:z.string().trim().min(3).max(80),password:z.string().min(8).max(100),role:roleSchema,status:statusSchema.default('ACTIVE'),employeeId:z.number().int().positive().optional().nullable()}).parse(req.body);
  const connection=await pool.getConnection(); try{await connection.beginTransaction();
    if(body.employeeId){const [linked]=await connection.query<RowDataPacket[]>('SELECT user_id FROM users WHERE employee_id=? LIMIT 1',[body.employeeId]);if(linked[0])throw new AppError(409,'Nhân viên đã có tài khoản','EMPLOYEE_ACCOUNT_EXISTS');}
    const [result]=await connection.execute<ResultSetHeader>('INSERT INTO users(employee_id,username,password_hash,role,status) VALUES(?,?,?,?,?)',[body.employeeId??null,body.username,await hashPassword(body.password),body.role,body.status]);
    await writeAuditLog(connection,{action:'ACCOUNT_CREATED',entityType:'USER',entityId:result.insertId,after:{...body,password:undefined},ipAddress:req.ip,userAgent:req.get('user-agent')}); await connection.commit();res.status(201).json({success:true,data:{userId:result.insertId}});
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}));

accountRouter.put('/:userId', asyncHandler(async(req,res)=>{
  const {userId}=z.object({userId:z.coerce.number().int().positive()}).parse(req.params); const body=z.object({role:roleSchema,status:statusSchema,employeeId:z.number().int().positive().optional().nullable()}).parse(req.body);
  if(userId===(req as AuthenticatedRequest).auth.userId&&(body.status!=='ACTIVE'||body.role!=='SUPER_ADMIN'))throw new AppError(400,'Không thể tự hạ quyền hoặc khóa tài khoản đang đăng nhập','CANNOT_RESTRICT_SELF');
  const connection=await pool.getConnection();try{await connection.beginTransaction();const [before]=await connection.query<RowDataPacket[]>('SELECT user_id userId,employee_id employeeId,role,status FROM users WHERE user_id=? LIMIT 1 FOR UPDATE',[userId]);if(!before[0])throw new AppError(404,'Không tìm thấy tài khoản','ACCOUNT_NOT_FOUND');
    if(body.employeeId){const [linked]=await connection.query<RowDataPacket[]>('SELECT user_id FROM users WHERE employee_id=? AND user_id<>? LIMIT 1',[body.employeeId,userId]);if(linked[0])throw new AppError(409,'Nhân viên đã có tài khoản','EMPLOYEE_ACCOUNT_EXISTS');}
    await connection.execute('UPDATE users SET employee_id=?,role=?,status=? WHERE user_id=?',[body.employeeId??null,body.role,body.status,userId]);await writeAuditLog(connection,{action:'ACCOUNT_UPDATED',entityType:'USER',entityId:userId,before:before[0],after:body,ipAddress:req.ip,userAgent:req.get('user-agent')});await connection.commit();res.json({success:true,data:{userId}});
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}));

accountRouter.put('/:userId/password', asyncHandler(async(req,res)=>{const {userId}=z.object({userId:z.coerce.number().int().positive()}).parse(req.params);const {password}=z.object({password:z.string().min(8).max(100)}).parse(req.body);const connection=await pool.getConnection();try{await connection.beginTransaction();const [result]=await connection.execute<ResultSetHeader>('UPDATE users SET password_hash=? WHERE user_id=?',[await hashPassword(password),userId]);if(!result.affectedRows)throw new AppError(404,'Không tìm thấy tài khoản','ACCOUNT_NOT_FOUND');await writeAuditLog(connection,{action:'ACCOUNT_PASSWORD_RESET',entityType:'USER',entityId:userId,ipAddress:req.ip,userAgent:req.get('user-agent')});await connection.commit();res.json({success:true,data:{userId}});}catch(error){await connection.rollback();throw error;}finally{connection.release();}}));
accountRouter.delete('/:userId', asyncHandler(async(req,res)=>{const {userId}=z.object({userId:z.coerce.number().int().positive()}).parse(req.params);if(userId===(req as AuthenticatedRequest).auth.userId)throw new AppError(400,'Không thể tự vô hiệu hóa tài khoản đang đăng nhập','CANNOT_DISABLE_SELF');const connection=await pool.getConnection();try{await connection.beginTransaction();const [before]=await connection.query<RowDataPacket[]>('SELECT status FROM users WHERE user_id=? LIMIT 1 FOR UPDATE',[userId]);if(!before[0])throw new AppError(404,'Không tìm thấy tài khoản','ACCOUNT_NOT_FOUND');await connection.execute("UPDATE users SET status='DISABLED' WHERE user_id=?",[userId]);await writeAuditLog(connection,{action:'ACCOUNT_DISABLED',entityType:'USER',entityId:userId,before:before[0],after:{status:'DISABLED'},ipAddress:req.ip,userAgent:req.get('user-agent')});await connection.commit();res.json({success:true,data:{userId}});}catch(error){await connection.rollback();throw error;}finally{connection.release();}}));
