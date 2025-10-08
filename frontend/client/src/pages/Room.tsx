import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {LiveKitRoom, VideoConference} from '@livekit/components-react';
import '@livekit/components-styles';
import { fetchLivekitToken } from '../api';

const wsUrl = import.meta.env.VITE_LIVEKIT_WS_URL as string;

export default function RoomPage() {
    const { roomId = 'demo' } = useParams();
    const [token,setToken] = useState<string|undefined>();
    const [err,setErr] = useState<string|undefined>();

    useEffect(()=>{
        (async ()=>{
            try {
                const t = await fetchLivekitToken(roomId);
                setToken(t);
            } catch (e:any) {
                setErr(e.message||'Token error');
            }
        })();
    },[roomId]);

    if (err) return <div style={{padding:24,color:'crimson'}}>Error: {err}</div>;
    if (!token) return <div style={{padding:24}}>Connecting…</div>;

    return (
        <LiveKitRoom serverUrl={wsUrl} token={token} audio video connect>
            <VideoConference />
        </LiveKitRoom>
    );
}
