/**
 * Type declaration for 'googleapis' so TypeScript can resolve the module
 * when building (e.g. on Railway). The package ships with its own types;
 * this is a fallback so the build succeeds when the package is installed.
 */
declare module 'googleapis' {
  export const google: any;
}
