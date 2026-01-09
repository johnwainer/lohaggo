import { isNativePlatform } from './platform';

const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    return baseUrl ? `${baseUrl}/api` : '';
  }

  if (isNativePlatform()) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://www.lohaggo.com';
    return `${baseUrl}/api`;
  }

  return '/api';
};

interface RequestOptions extends RequestInit {
  timeout?: number;
}

const fetchWithTimeout = async (
  url: string,
  options: RequestOptions = {}
): Promise<Response> => {
  const { timeout = 10000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export const apiClient = {
  get: async <T = any>(endpoint: string, options?: RequestOptions): Promise<T> => {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    console.log('[apiClient] GET request:', { baseUrl, endpoint, url });

    const response = await fetchWithTimeout(url, {
      ...options,
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      console.error('[apiClient] GET error:', response.status, response.statusText);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[apiClient] GET response:', { endpoint, dataLength: Array.isArray(data) ? data.length : 'not-array' });
    return data;
  },

  post: async <T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> => {
    const url = `${getApiBaseUrl()}${endpoint}`;
    const response = await fetchWithTimeout(url, {
      ...options,
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  put: async <T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> => {
    const url = `${getApiBaseUrl()}${endpoint}`;
    const response = await fetchWithTimeout(url, {
      ...options,
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  delete: async <T = any>(endpoint: string, options?: RequestOptions): Promise<T> => {
    const url = `${getApiBaseUrl()}${endpoint}`;
    const response = await fetchWithTimeout(url, {
      ...options,
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  uploadFormData: async <T = any>(
    endpoint: string,
    formData: FormData,
    options?: RequestOptions
  ): Promise<T> => {
    const url = `${getApiBaseUrl()}${endpoint}`;
    const response = await fetchWithTimeout(url, {
      ...options,
      method: 'POST',
      credentials: 'include',
      body: formData,
      headers: {
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },
};

export const getApiUrl = (endpoint: string): string => {
  return `${getApiBaseUrl()}${endpoint}`;
};
