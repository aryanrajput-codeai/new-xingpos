declare module 'next/headers' {
  export interface CookieStore {
    getAll(): Array<{ name: string; value: string }>;
    set(name: string, value: string, options?: any): void;
  }
  export function cookies(): Promise<CookieStore>;
}

declare module 'next/server' {
  export interface NextRequest {
    headers: Headers;
    cookies: {
      getAll(): Array<{ name: string; value: string }>;
      set(name: string, value: string, options?: any): void;
    };
  }
  export class NextResponse {
    static next(options?: { request?: { headers: Headers } }): NextResponse;
    cookies: {
      set(name: string, value: string, options?: any): void;
    };
  }
}
