declare module '@novnc/novnc/lib/rfb.js' {
  export default class RFB extends EventTarget {
    constructor(target: HTMLElement, url: string, options?: {
      shared?: boolean;
      credentials?: { username?: string; password?: string; target?: string };
    });
    disconnect(): void;
    sendCredentials(credentials: { password: string }): void;
    scaleViewport: boolean;
    resizeSession: boolean;
    viewOnly: boolean;
    clipViewport: boolean;
  }
}
