declare module 'qz-tray' {
  const qz: {
    websocket: {
      connect: (options?: any) => Promise<void>;
      disconnect: () => Promise<void>;
      isActive: () => boolean;
    };
    printers: {
      find: (query?: string) => Promise<string | string[]>;
      getDefault: () => Promise<string>;
    };
    configs: {
      create: (printer: string, options?: any) => any;
    };
    security?: {
      setCertificatePromise: (promiseHandler: any, options?: any) => void;
      setSignaturePromise: (promiseFactory: (toSign: string) => any) => void;
      setSignatureAlgorithm?: (algorithm: 'SHA1' | 'SHA256' | 'SHA512' | string) => void;
    };
    print: (config: any, data: any[]) => Promise<void>;
  };

  export default qz;
}
