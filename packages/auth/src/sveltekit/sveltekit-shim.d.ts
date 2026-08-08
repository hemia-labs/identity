declare module '@sveltejs/kit' {
  export type Handle = (input: {
    event: {
      url: URL;
      locals: Record<string, unknown>;
      cookies: { get(name: string): string | undefined };
    };
    resolve(event: unknown): Response | Promise<Response>;
  }) => Response | Promise<Response>;

  export type RequestEvent = {
    url: URL;
    cookies: {
      get(name: string): string | undefined;
      set(name: string, value: string, options: Record<string, unknown>): void;
      delete(name: string, options: Record<string, unknown>): void;
    };
  };

  export function redirect(status: number, location: string): never;
  export function isRedirect(value: unknown): boolean;
  export function json(value: unknown): Response;
}
