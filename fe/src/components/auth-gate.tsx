'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Loader2, LockKeyhole, ScanFace } from 'lucide-react';
import { AuthUser, getMe, login, register } from '@/lib/api';
import { DashboardShell } from './dashboard-shell';

export function AuthGate(){
  const [user,setUser]=useState<AuthUser|null>(null);const [checking,setChecking]=useState(true);const [registerMode,setRegisterMode]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState<string|null>(null);
  useEffect(()=>{const token=localStorage.getItem('facelog_token');if(!token){setChecking(false);return;}getMe().then(setUser).catch(()=>localStorage.removeItem('facelog_token')).finally(()=>setChecking(false));},[]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setMessage(null);try{const input={username:String(data.get('username')),password:String(data.get('password'))};if(registerMode){await register({...input,employeeCode:String(data.get('employeeCode')||'')||undefined});setRegisterMode(false);setMessage('Đăng ký thành công. Hãy đăng nhập.');}else{const response=await login(input);localStorage.setItem('facelog_token',response.data.token);setUser(response.data.user);}}catch(error){setMessage(error instanceof Error?error.message:'Không thể xác thực');}finally{setBusy(false);}}
  function logout(){localStorage.removeItem('facelog_token');setUser(null);}
  if(checking)return <div className="auth-loading"><Loader2 className="spin" size={30}/></div>;
  if(user)return <DashboardShell currentUser={user} onLogout={logout}/>;
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><div className="brand-mark"><ScanFace size={23}/></div><div><h1>FaceLog</h1><p>Quản trị chấm công FaceID</p></div></div><div className="auth-title"><LockKeyhole size={24}/><div><h2>{registerMode?'Đăng ký tài khoản':'Đăng nhập hệ thống'}</h2><p>{registerMode?'Tài khoản đăng ký công khai có vai trò Nhân viên.':'Sử dụng tài khoản được quản trị viên cấp.'}</p></div></div><form className="auth-form" onSubmit={submit}><label>Tên đăng nhập<input name="username" required minLength={3}/></label>{registerMode&&<label>Mã nhân viên (nếu có)<input name="employeeCode" placeholder="EMP001"/></label>}<label>Mật khẩu<input name="password" type="password" required minLength={8}/></label>{message&&<p className="auth-message">{message}</p>}<button className="button primary" disabled={busy}>{busy&&<Loader2 className="spin" size={17}/>} {registerMode?'Tạo tài khoản':'Đăng nhập'}</button></form><button className="auth-switch" type="button" onClick={()=>{setRegisterMode(!registerMode);setMessage(null);}}>{registerMode?'Đã có tài khoản? Đăng nhập':'Chưa có tài khoản? Đăng ký'}</button><p className="auth-default">Tài khoản cũ: <strong>admin</strong> / <strong>admin123</strong></p></section></main>;
}
