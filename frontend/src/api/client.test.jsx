import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { useApiClient } from './client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, container, api;
function Probe() { const client = useApiClient(); useEffect(() => { api = client; }, [client]); return null; }
beforeEach(async () => {
  localStorage.clear();
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<AuthProvider><Probe /></AuthProvider>));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); localStorage.clear(); });
const response = (config, data) => Promise.resolve({config, data, status:200, headers:{},statusText:'OK'});
describe('authenticated API cache isolation', () => {
  it('does not share doctor data across tokens', async () => {
    let calls = 0;
    const adapter = config => response(config, {value:++calls});
    localStorage.setItem('token','user-A');
    expect((await api.get('/api/doctors/cache-test',{adapter})).data.value).toBe(1);
    expect((await api.get('/api/doctors/cache-test',{adapter})).data.value).toBe(1);
    localStorage.setItem('token','user-B');
    expect((await api.get('/api/doctors/cache-test',{adapter})).data.value).toBe(2);
  });
  it('invalidates reference cache after writes', async () => {
    let calls = 0;
    const adapter = config => response(config,{value:++calls});
    await api.get('/api/clinics/cache-test',{adapter});
    await api.post('/api/clinics',{}, {adapter});
    expect((await api.get('/api/clinics/cache-test',{adapter})).data.value).toBe(3);
  });
  it('preserves the active session when credentials fail', async () => {
    localStorage.setItem('token','current-session');
    const adapter = config => Promise.reject({config,response:{status:401}});
    await expect(api.post('/api/auth/verify-credentials',{}, {adapter})).rejects.toBeDefined();
    expect(localStorage.getItem('token')).toBe('current-session');
  });
});
