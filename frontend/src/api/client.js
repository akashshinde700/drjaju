/* eslint-disable react-hooks/purity, react-hooks/immutability */
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useMemo } from 'react';

const baseURL = (import.meta.env && import.meta.env.VITE_API_URL) || '';

const pendingRequests = new Map();

const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const cacheablePatterns = [
  '/api/medications/categories',
  '/api/doctors',
  '/api/clinics',
  '/api/icd/',
  '/api/symptoms/',
  '/api/advice/',
  '/api/receipt-templates',
  '/api/services',
  '/api/certificate-types',
];

function getCacheKey(config) {
  return `${config.headers?.Authorization || 'anonymous'}:${config.url}:${JSON.stringify(config.params || {})}`;
}

function isCacheable(url) {
  return cacheablePatterns.some(p => url.includes(p));
}

export function useApiClient() {
  const { token, setToken, setUser } = useAuth();

  const instance = useMemo(() => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const api = axios.create({
      baseURL,
      headers,
      timeout: 15000,
    });

    api.interceptors.request.use((config) => {
      // Always attach the latest token (guards against stale axios instance headers)
      const latestToken = localStorage.getItem('token');
      if (!latestToken) delete config.headers.Authorization;
      if (latestToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${latestToken}`;
      }

      if (config.method !== 'get') responseCache.clear();
      if (config.method === 'get') {
        const key = getCacheKey(config);

        // Return cached response for reference data
        if (isCacheable(config.url)) {
          const cached = responseCache.get(key);
          if (cached && Date.now() - cached.time < CACHE_TTL) {
            config.adapter = () =>
              Promise.resolve({
                data: cached.data,
                status: 200,
                statusText: 'OK',
                headers: { 'x-cache': 'HIT' },
                config,
              });
            return config;
          }
        }

        const controller = new AbortController();
        config.signal = config.signal || controller.signal;
        pendingRequests.set(key, controller);
      }
      return config;
    });

    api.interceptors.response.use(
      (response) => {
        if (response.config.method === 'get') {
          const key = getCacheKey(response.config);
          pendingRequests.delete(key);

          // Cache reference data responses
          if (isCacheable(response.config.url) && response.status === 200) {
            if (responseCache.size >= 500) responseCache.delete(responseCache.keys().next().value);
            responseCache.set(key, {
              data: response.data,
              time: Date.now(),
            });
          }
        }
        return response;
      },
      (error) => {
        if (error.config && error.config.method === 'get') {
          const key = getCacheKey(error.config);
          pendingRequests.delete(key);
        }
        if (axios.isCancel(error)) {
          return Promise.reject(error);
        }
        if (error.response?.status === 401 && error.config?.headers?.Authorization === `Bearer ${localStorage.getItem('token')}` && !error.config?.url?.startsWith('/api/auth/')) {
          responseCache.clear();
          setToken('');
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );

    return api;
  }, [token, setToken, setUser]);

  return instance;
}
