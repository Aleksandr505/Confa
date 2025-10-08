import { useState } from 'react';
import { login } from '../api';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
    const [username,setU]=useState(''); const [password,setP]=useState('');
    const [err,setErr]=useState<string|undefined>(); const nav=useNavigate();

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault(); setErr(undefined);
        try {
            await login(username, password);
            nav('/room/demo');
        } catch (e:any) {
            setErr(e.message||'Login failed');
        }
    }

    return (
        <div style={{display:'grid',placeItems:'center',minHeight:'100vh',gap:16}}>
            <form onSubmit={onSubmit} style={{display:'grid',gap:12, minWidth: 320}}>
                <h1>Sign in</h1>
                <input placeholder="Username" value={username} onChange={e=>setU(e.target.value)} />
                <input placeholder="Password" type="password" value={password} onChange={e=>setP(e.target.value)} />
                <button type="submit">Login</button>
                {err && <div style={{color:'crimson'}}>{err}</div>}
            </form>
        </div>
    );
}
